/**
 * @fileoverview Attendance Timeline Service
 * Handles daily aggregation of attendance data into timeline summaries
 */

import { createClient } from '@supabase/supabase-js';
import type { Database, GradeAttendanceTimelineSummaryInsert, DistrictAttendanceTimelineSummaryInsert } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DailySummaryOptions {
  date: string;
  schoolYear?: string;
  schoolIds?: string[];
  forceRefresh?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  date: string;
  schoolYear: string;
  gradesProcessed: number[];
  recordsCreated: number;
  recordsUpdated: number;
  errors: string[];
  processingTimeMs: number;
}

/**
 * Main service class for attendance timeline data processing
 */
export class AttendanceTimelineService {
  /**
   * Process daily attendance summaries for a specific date
   */
  static async processDailySummaries(options: DailySummaryOptions): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      success: false,
      date: options.date,
      schoolYear: options.schoolYear || this.getCurrentSchoolYear(),
      gradesProcessed: [],
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [],
      processingTimeMs: 0
    };

    try {
      // Step 1: Clear existing summaries if force refresh
      if (options.forceRefresh) {
        await this.clearExistingSummaries(options.date, result.schoolYear);
      }

      // Step 2: Generate grade-level summaries
      const gradeResults = await this.generateGradeSummaries(options.date, result.schoolYear, options.schoolIds);
      result.recordsCreated += gradeResults.created;
      result.recordsUpdated += gradeResults.updated;
      result.gradesProcessed = gradeResults.grades;
      result.errors.push(...gradeResults.errors);

      // Step 3: Generate district-level summaries
      const districtResults = await this.generateDistrictSummaries(options.date, result.schoolYear);
      result.recordsCreated += districtResults.created;
      result.recordsUpdated += districtResults.updated;
      result.errors.push(...districtResults.errors);

      // Step 4: Update cumulative totals
      await this.updateCumulativeTotals(options.date, result.schoolYear, result.gradesProcessed, options.schoolIds);

      result.success = result.errors.length === 0;
      result.processingTimeMs = Date.now() - startTime;

      console.log(`Daily summary processing completed for ${options.date}:`, result);
      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown processing error');
      result.processingTimeMs = Date.now() - startTime;
      console.error('Daily summary processing failed:', error);
      return result;
    }
  }

  /**
   * Process multiple days of attendance summaries
   */
  static async processDateRange(
    startDate: string, 
    endDate: string, 
    schoolYear?: string,
    schoolIds?: string[]
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Skip weekends (basic school day filter)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const result = await this.processDailySummaries({
          date: dateStr,
          schoolYear,
          schoolIds,
          forceRefresh: false
        });
        results.push(result);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  /**
   * Generate grade-level attendance summaries
   */
  private static async generateGradeSummaries(
    date: string, 
    schoolYear: string, 
    schoolIds?: string[]
  ): Promise<{created: number, updated: number, grades: number[], errors: string[]}> {
    const result = { created: 0, updated: 0, grades: [], errors: [] };

    try {
      // Build query for attendance data
      let query = supabase
        .from('attendance_records')
        .select(`
          student_id,
          is_present,
          is_full_day_absent,
          tardy_count,
          students!inner(
            id,
            school_id,
            grade_level,
            schools!inner(
              id,
              school_code,
              school_name
            )
          )
        `)
        .eq('attendance_date', date);

      if (schoolIds && schoolIds.length > 0) {
        query = query.in('students.school_id', schoolIds);
      }

      const { data: attendanceData, error } = await query;

      if (error) {
        result.errors.push(`Failed to fetch attendance data: ${error.message}`);
        return result;
      }

      if (!attendanceData || attendanceData.length === 0) {
        console.log(`No attendance data found for ${date}`);
        return result;
      }

      // Group data by school and grade
      const summaryMap = new Map<string, {
        schoolId: string;
        schoolCode: string;
        schoolName: string;
        gradeLevel: number;
        totalStudents: number;
        studentsPresent: number;
        studentsAbsent: number;
        dailyAbsences: number;
        tardyCount: number;
      }>();

      for (const record of attendanceData) {
        const student = record.students;
        const school = student.schools;
        const key = `${student.school_id}-${student.grade_level}`;

        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            schoolId: student.school_id,
            schoolCode: school.school_code,
            schoolName: school.school_name,
            gradeLevel: student.grade_level,
            totalStudents: 0,
            studentsPresent: 0,
            studentsAbsent: 0,
            dailyAbsences: 0,
            tardyCount: 0
          });
        }

        const summary = summaryMap.get(key)!;
        summary.totalStudents++;

        if (record.is_present) {
          summary.studentsPresent++;
        }

        if (record.is_full_day_absent) {
          summary.studentsAbsent++;
          summary.dailyAbsences++;
        }

        summary.tardyCount += record.tardy_count || 0;
      }

      // Insert/update summaries
      for (const [, summary] of summaryMap) {
        try {
          const summaryRecord: GradeAttendanceTimelineSummaryInsert = {
            school_id: summary.schoolId,
            school_code: summary.schoolCode,
            school_name: summary.schoolName,
            grade_level: summary.gradeLevel,
            summary_date: date,
            total_students: summary.totalStudents,
            students_present: summary.studentsPresent,
            students_absent: summary.studentsAbsent,
            daily_absences: summary.dailyAbsences,
            cumulative_absences: 0, // Will be updated separately
            excused_absences: Math.floor(summary.dailyAbsences / 2), // Estimate
            unexcused_absences: Math.ceil(summary.dailyAbsences / 2), // Estimate
            tardy_count: summary.tardyCount,
            chronic_absent_count: 0, // Would need historical calculation
            attendance_rate: summary.totalStudents > 0 ? 
              Math.round((summary.studentsPresent / summary.totalStudents) * 100 * 100) / 100 : 100,
            absence_rate: summary.totalStudents > 0 ? 
              Math.round((summary.studentsAbsent / summary.totalStudents) * 100 * 100) / 100 : 0,
            school_year: schoolYear,
            is_school_day: true
          };

          const { error: upsertError } = await supabase
            .from('grade_attendance_timeline_summary')
            .upsert(summaryRecord, {
              onConflict: 'school_id,grade_level,summary_date,school_year'
            });

          if (upsertError) {
            result.errors.push(`Failed to upsert grade summary: ${upsertError.message}`);
          } else {
            result.created++;
            if (!result.grades.includes(summary.gradeLevel)) {
              result.grades.push(summary.gradeLevel);
            }
          }
        } catch (error) {
          result.errors.push(`Error processing grade ${summary.gradeLevel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      result.grades.sort((a, b) => a - b);
      return result;

    } catch (error) {
      result.errors.push(`Grade summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Generate district-level attendance summaries
   */
  private static async generateDistrictSummaries(
    date: string, 
    schoolYear: string
  ): Promise<{created: number, updated: number, errors: string[]}> {
    const result = { created: 0, updated: 0, errors: [] };

    try {
      // Aggregate grade summaries into district summaries
      const { data: gradeSummaries, error } = await supabase
        .from('grade_attendance_timeline_summary')
        .select('*')
        .eq('summary_date', date)
        .eq('school_year', schoolYear);

      if (error) {
        result.errors.push(`Failed to fetch grade summaries: ${error.message}`);
        return result;
      }

      if (!gradeSummaries || gradeSummaries.length === 0) {
        console.log(`No grade summaries found for ${date}`);
        return result;
      }

      // Group by grade level
      const districtMap = new Map<number, {
        gradeLevel: number;
        totalStudents: number;
        studentsPresent: number;
        studentsAbsent: number;
        dailyAbsences: number;
        excusedAbsences: number;
        unexcusedAbsences: number;
        tardyCount: number;
        chronicAbsentCount: number;
        schoolsIncluded: Set<string>;
      }>();

      for (const summary of gradeSummaries) {
        if (!districtMap.has(summary.grade_level)) {
          districtMap.set(summary.grade_level, {
            gradeLevel: summary.grade_level,
            totalStudents: 0,
            studentsPresent: 0,
            studentsAbsent: 0,
            dailyAbsences: 0,
            excusedAbsences: 0,
            unexcusedAbsences: 0,
            tardyCount: 0,
            chronicAbsentCount: 0,
            schoolsIncluded: new Set()
          });
        }

        const district = districtMap.get(summary.grade_level)!;
        district.totalStudents += summary.total_students;
        district.studentsPresent += summary.students_present;
        district.studentsAbsent += summary.students_absent;
        district.dailyAbsences += summary.daily_absences;
        district.excusedAbsences += summary.excused_absences;
        district.unexcusedAbsences += summary.unexcused_absences;
        district.tardyCount += summary.tardy_count;
        district.chronicAbsentCount += summary.chronic_absent_count;
        district.schoolsIncluded.add(summary.school_id);
      }

      // Insert/update district summaries
      for (const [, district] of districtMap) {
        try {
          const districtRecord: DistrictAttendanceTimelineSummaryInsert = {
            grade_level: district.gradeLevel,
            summary_date: date,
            total_students: district.totalStudents,
            students_present: district.studentsPresent,
            students_absent: district.studentsAbsent,
            daily_absences: district.dailyAbsences,
            cumulative_absences: 0, // Will be updated separately
            excused_absences: district.excusedAbsences,
            unexcused_absences: district.unexcusedAbsences,
            tardy_count: district.tardyCount,
            chronic_absent_count: district.chronicAbsentCount,
            attendance_rate: district.totalStudents > 0 ? 
              Math.round((district.studentsPresent / district.totalStudents) * 100 * 100) / 100 : 100,
            absence_rate: district.totalStudents > 0 ? 
              Math.round((district.studentsAbsent / district.totalStudents) * 100 * 100) / 100 : 0,
            school_year: schoolYear,
            schools_included: Array.from(district.schoolsIncluded),
            schools_count: district.schoolsIncluded.size,
            is_school_day: true
          };

          const { error: upsertError } = await supabase
            .from('district_attendance_timeline_summary')
            .upsert(districtRecord, {
              onConflict: 'grade_level,summary_date,school_year'
            });

          if (upsertError) {
            result.errors.push(`Failed to upsert district summary: ${upsertError.message}`);
          } else {
            result.created++;
          }
        } catch (error) {
          result.errors.push(`Error processing district grade ${district.gradeLevel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;

    } catch (error) {
      result.errors.push(`District summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Update cumulative totals for all summaries
   */
  private static async updateCumulativeTotals(
    date: string, 
    schoolYear: string, 
    grades: number[],
    schoolIds?: string[]
  ): Promise<void> {
    // Update grade-level cumulative totals
    for (const grade of grades) {
      let schoolQuery = supabase
        .from('grade_attendance_timeline_summary')
        .select('school_id, daily_absences')
        .eq('grade_level', grade)
        .eq('school_year', schoolYear)
        .lte('summary_date', date)
        .eq('is_school_day', true)
        .order('summary_date', { ascending: true });

      if (schoolIds && schoolIds.length > 0) {
        schoolQuery = schoolQuery.in('school_id', schoolIds);
      }

      const { data: historicalData } = await schoolQuery;

      if (historicalData) {
        const cumulativeMap = new Map<string, number>();

        for (const record of historicalData) {
          const key = record.school_id;
          cumulativeMap.set(key, (cumulativeMap.get(key) || 0) + record.daily_absences);
        }

        // Update current day's cumulative totals
        for (const [schoolId, cumulativeAbsences] of cumulativeMap) {
          await supabase
            .from('grade_attendance_timeline_summary')
            .update({ cumulative_absences: cumulativeAbsences })
            .eq('school_id', schoolId)
            .eq('grade_level', grade)
            .eq('summary_date', date)
            .eq('school_year', schoolYear);
        }
      }
    }

    // Update district-level cumulative totals
    for (const grade of grades) {
      const { data: historicalData } = await supabase
        .from('district_attendance_timeline_summary')
        .select('daily_absences')
        .eq('grade_level', grade)
        .eq('school_year', schoolYear)
        .lte('summary_date', date)
        .eq('is_school_day', true)
        .order('summary_date', { ascending: true });

      if (historicalData) {
        const cumulativeAbsences = historicalData.reduce((sum, record) => sum + record.daily_absences, 0);

        await supabase
          .from('district_attendance_timeline_summary')
          .update({ cumulative_absences: cumulativeAbsences })
          .eq('grade_level', grade)
          .eq('summary_date', date)
          .eq('school_year', schoolYear);
      }
    }
  }

  /**
   * Clear existing summaries for a specific date
   */
  private static async clearExistingSummaries(date: string, schoolYear: string): Promise<void> {
    await Promise.all([
      supabase
        .from('grade_attendance_timeline_summary')
        .delete()
        .eq('summary_date', date)
        .eq('school_year', schoolYear),
      
      supabase
        .from('district_attendance_timeline_summary')
        .delete()
        .eq('summary_date', date)
        .eq('school_year', schoolYear),

      supabase
        .from('attendance_timeline_cache')
        .delete()
        .overlaps('date_range', `[${date},${date}]`)
    ]);
  }

  /**
   * Get current school year in YYYY-YYYY format
   */
  private static getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() is 0-indexed
    
    // School year runs August to June
    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  /**
   * Validate if a date is a school day (basic implementation)
   */
  static isSchoolDay(date: string): boolean {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    
    // Exclude weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Additional holiday logic could be added here
    return true;
  }

  /**
   * Get summary statistics for a date range
   */
  static async getSummaryStats(
    startDate: string, 
    endDate: string, 
    schoolYear?: string
  ): Promise<{
    totalSchoolDays: number;
    totalAbsences: number;
    avgDailyAbsences: number;
    gradesTracked: number[];
    schoolsTracked: number;
  }> {
    const targetSchoolYear = schoolYear || this.getCurrentSchoolYear();

    const { data: stats } = await supabase
      .from('district_attendance_timeline_summary')
      .select('daily_absences, grade_level, schools_count')
      .eq('school_year', targetSchoolYear)
      .gte('summary_date', startDate)
      .lte('summary_date', endDate)
      .eq('is_school_day', true);

    if (!stats || stats.length === 0) {
      return {
        totalSchoolDays: 0,
        totalAbsences: 0,
        avgDailyAbsences: 0,
        gradesTracked: [],
        schoolsTracked: 0
      };
    }

    const totalAbsences = stats.reduce((sum, record) => sum + record.daily_absences, 0);
    const uniqueGrades = [...new Set(stats.map(s => s.grade_level))].sort();
    const maxSchools = Math.max(...stats.map(s => s.schools_count));
    const uniqueDays = new Set(stats.map(s => s.summary_date)).size;

    return {
      totalSchoolDays: uniqueDays,
      totalAbsences,
      avgDailyAbsences: uniqueDays > 0 ? Math.round(totalAbsences / uniqueDays * 100) / 100 : 0,
      gradesTracked: uniqueGrades,
      schoolsTracked: maxSchools
    };
  }
}