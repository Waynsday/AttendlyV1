/**
 * @fileoverview Process Real Timeline Data API
 * Uses actual attendance records to generate timeline summaries
 */

import { NextRequest, NextResponse } from 'next/server';
import { AttendanceTimelineService } from '@/lib/services/attendance-timeline-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, schoolYear = '2024-2025' } = body;

    // Get actual attendance dates if no date range provided
    let actualStartDate = startDate;
    let actualEndDate = endDate;

    if (!startDate || !endDate) {
      const { data: attendanceDates } = await supabase
        .from('attendance_records')
        .select('attendance_date')
        .order('attendance_date', { ascending: true });
      
      if (attendanceDates && attendanceDates.length > 0) {
        const dates = attendanceDates.map(r => r.attendance_date);
        actualStartDate = dates[0];
        actualEndDate = dates[dates.length - 1];
      }
    }

    if (!actualStartDate || !actualEndDate) {
      return NextResponse.json({
        success: false,
        error: 'No attendance data found and no date range provided'
      });
    }

    // Clear existing timeline data first
    console.log('Clearing existing timeline data...');
    await supabase.from('grade_attendance_timeline_summary').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('district_attendance_timeline_summary').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Process the date range using direct queries
    console.log(`Processing real attendance data from ${actualStartDate} to ${actualEndDate}`);
    
    // Get all unique attendance dates
    const { data: attendanceDates } = await supabase
      .from('attendance_records')
      .select('attendance_date')
      .gte('attendance_date', actualStartDate)
      .lte('attendance_date', actualEndDate)
      .order('attendance_date', { ascending: true });
    
    const uniqueDates = [...new Set(attendanceDates?.map(r => r.attendance_date) || [])];
    const results = [];
    
    for (const date of uniqueDates) {
      console.log(`Processing date: ${date}`);
      
      // Get attendance data for this date
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('student_id, is_present')
        .eq('attendance_date', date);
      
      if (!attendanceRecords || attendanceRecords.length === 0) {
        results.push({
          success: false,
          date,
          error: 'No attendance records found for date'
        });
        continue;
      }
      
      // Get student info for these attendance records
      const studentIds = attendanceRecords.map(r => r.student_id);
      const { data: students } = await supabase
        .from('students')
        .select('id, school_id, grade_level')
        .in('id', studentIds);
      
      if (!students || students.length === 0) {
        results.push({
          success: false,
          date,
          error: 'No student data found'
        });
        continue;
      }
      
      // Get school info
      const schoolIds = [...new Set(students.map(s => s.school_id))];
      const { data: schools } = await supabase
        .from('schools')
        .select('id, school_name, school_code')
        .in('id', schoolIds);
      
      // Create lookup maps
      const studentMap = new Map(students.map(s => [s.id, s]));
      const schoolMap = new Map(schools?.map(s => [s.id, s]) || []);
      
      // Combine the data
      const dailyAttendance = attendanceRecords.map(record => ({
        ...record,
        student: studentMap.get(record.student_id),
        school: schoolMap.get(studentMap.get(record.student_id)?.school_id)
      })).filter(r => r.student && r.school);
      
      if (!dailyAttendance || dailyAttendance.length === 0) {
        results.push({
          success: false,
          date,
          error: 'No attendance data found for date'
        });
        continue;
      }
      
      // Group by school and grade
      const summaryMap = new Map();
      
      for (const record of dailyAttendance) {
        const student = record.student;
        const school = record.school;
        const key = `${student.school_id}-${student.grade_level}`;
        
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            school_id: student.school_id,
            school_name: school.school_name,
            school_code: school.school_code,
            grade_level: student.grade_level,
            total_students: 0,
            students_present: 0,
            students_absent: 0,
            daily_absences: 0
          });
        }
        
        const summary = summaryMap.get(key);
        summary.total_students++;
        
        if (record.is_present) {
          summary.students_present++;
        } else {
          summary.students_absent++;
          summary.daily_absences++;
        }
      }
      
      // Insert timeline summaries
      let inserted = 0;
      for (const [, summary] of summaryMap) {
        const timelineRecord = {
          school_id: summary.school_id,
          grade_level: summary.grade_level,
          summary_date: date,
          total_students: summary.total_students,
          students_present: summary.students_present,
          students_absent: summary.students_absent,
          daily_absences: summary.daily_absences,
          cumulative_absences: summary.daily_absences, // For now, same as daily
          excused_absences: 0,
          unexcused_absences: summary.daily_absences,
          tardy_count: 0,
          chronic_absent_count: 0,
          attendance_rate: summary.total_students > 0 ? 
            Math.round((summary.students_present / summary.total_students) * 100 * 100) / 100 : 100,
          absence_rate: summary.total_students > 0 ? 
            Math.round((summary.students_absent / summary.total_students) * 100 * 100) / 100 : 0,
          school_year: schoolYear,
          is_school_day: true
        };
        
        const { error } = await supabase
          .from('grade_attendance_timeline_summary')
          .upsert(timelineRecord, {
            onConflict: 'school_id,grade_level,summary_date,school_year'
          });
          
        if (!error) {
          inserted++;
        }
      }
      
      results.push({
        success: true,
        date,
        recordsCreated: inserted,
        summariesProcessed: summaryMap.size
      });
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: 'Real timeline data processing completed',
      summary: {
        totalDays: results.length,
        successfulDays: successCount,
        failedDays: errorCount,
        dateRange: {
          start: actualStartDate,
          end: actualEndDate
        },
        schoolYear
      },
      results: results.slice(0, 5) // Return first 5 results as sample
    });

  } catch (error) {
    console.error('Real timeline processing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}