/**
 * @fileoverview Students API Route
 * Provides paginated student data with attendance metrics and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

interface StudentsQuery {
  page?: number;
  limit?: number;
  schoolId?: string;
  grade?: string;
  tier?: string;
  schoolYear?: string;
  search?: string;
}

interface StudentWithMetrics {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  studentId: string;
  attendanceRate: number;
  absences: number;
  enrolled: number;
  present: number;
  tier: string;
  riskLevel: 'low' | 'medium' | 'high';
  lastIntervention?: string;
  school?: string;
  schoolName?: string;
}

// Calculate tier based on attendance rate
function calculateTier(attendanceRate: number): string {
  if (attendanceRate >= 95) return 'Tier 1';
  if (attendanceRate >= 90) return 'Tier 2';
  return 'Tier 3';
}

// Calculate risk level based on attendance rate
function calculateRiskLevel(attendanceRate: number): 'low' | 'medium' | 'high' {
  if (attendanceRate >= 95) return 'low';
  if (attendanceRate >= 90) return 'medium';
  return 'high';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const query: StudentsQuery = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      schoolId: searchParams.get('schoolId') || undefined,
      grade: searchParams.get('grade') || undefined,
      tier: searchParams.get('tier') || undefined,
      schoolYear: searchParams.get('schoolYear') || '2024',
      search: searchParams.get('search') || undefined
    };

    // Validate pagination parameters
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(10, query.limit || 20));
    const offset = (page - 1) * limit;

    // Set up date range for the school year
    const baseYear = query.schoolYear || '2024';
    const startDate = `${baseYear}-08-15`;
    const endDate = `${parseInt(baseYear) + 1}-06-12`;

    // Get all students in batches to overcome 1000 row limit
    const allStudents: any[] = [];
    let batchStart = 0;
    const batchSize = 1000;
    let hasMore = true;

    console.log('Fetching all students in batches...');
    
    while (hasMore) {
      let studentsQuery = supabase
        .from('students')
        .select(`
          id,
          aeries_student_id,
          first_name,
          last_name,
          grade_level,
          school_id,
          current_homeroom_teacher,
          schools!inner(
            id,
            school_name
          )
        `)
        .eq('is_active', true)
        .range(batchStart, batchStart + batchSize - 1);

      // Apply filters to each batch
      if (query.schoolId && query.schoolId !== 'all') {
        studentsQuery = studentsQuery.eq('school_id', query.schoolId);
      }

      if (query.grade && query.grade !== 'all') {
        studentsQuery = studentsQuery.eq('grade_level', parseInt(query.grade));
      }

      if (query.search && query.search.trim()) {
        const searchTerm = query.search.trim();
        studentsQuery = studentsQuery.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,aeries_student_id.ilike.%${searchTerm}%`
        );
      }

      const { data: batchData, error: batchError } = await studentsQuery;

      if (batchError) {
        console.error(`Error fetching batch ${batchStart}-${batchStart + batchSize}:`, batchError);
        return NextResponse.json(
          { error: 'Failed to fetch student data', details: batchError.message },
          { status: 500 }
        );
      }

      if (batchData && batchData.length > 0) {
        allStudents.push(...batchData);
        console.log(`Fetched batch: ${batchData.length} students (total: ${allStudents.length})`);
        
        // If we got less than batchSize, we've reached the end
        if (batchData.length < batchSize) {
          hasMore = false;
        } else {
          batchStart += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    const studentsData = allStudents;
    console.log(`Total students fetched: ${studentsData.length}`);

    // Log applied filters
    if (query.schoolId && query.schoolId !== 'all') {
      console.log(`Filtered by school: ${query.schoolId}`);
    }
    if (query.grade && query.grade !== 'all') {
      console.log(`Filtered by grade: ${query.grade}`);
    }
    if (query.search && query.search.trim()) {
      console.log(`Searched for: "${query.search.trim()}"`);
    }


    if (!studentsData || studentsData.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      });
    }

    // Get attendance records in batches for all students
    const aeriesStudentIds = studentsData.map(s => s.aeries_student_id).filter(id => id !== null);
    console.log(`Querying attendance for ${aeriesStudentIds.length} students from ${startDate} to ${endDate}`);
    
    const allAttendanceRecords: any[] = [];
    const attendanceBatchSize = 1000;
    
    // Process students in chunks to avoid query size limits
    for (let i = 0; i < aeriesStudentIds.length; i += attendanceBatchSize) {
      const studentBatch = aeriesStudentIds.slice(i, i + attendanceBatchSize);
      
      // Get attendance records for this batch of students
      let attendanceBatchStart = 0;
      let hasMoreAttendance = true;
      
      while (hasMoreAttendance) {
        const { data: attendanceBatch, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('aeries_student_id, is_present')
          .in('aeries_student_id', studentBatch)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .range(attendanceBatchStart, attendanceBatchStart + 999); // 1000 records per batch

        if (attendanceError) {
          console.error('Error fetching attendance batch:', attendanceError);
          return NextResponse.json(
            { error: 'Failed to fetch attendance data', details: attendanceError.message },
            { status: 500 }
          );
        }

        if (attendanceBatch && attendanceBatch.length > 0) {
          allAttendanceRecords.push(...attendanceBatch);
          
          if (attendanceBatch.length < 1000) {
            hasMoreAttendance = false;
          } else {
            attendanceBatchStart += 1000;
          }
        } else {
          hasMoreAttendance = false;
        }
      }
      
      console.log(`Processed student batch ${i}-${Math.min(i + attendanceBatchSize, aeriesStudentIds.length)}, total attendance records: ${allAttendanceRecords.length}`);
    }
    
    const attendanceData = allAttendanceRecords;

    console.log(`Found ${attendanceData?.length || 0} attendance records for ${aeriesStudentIds.length} students`);

    // Process attendance data to calculate metrics per student
    const studentMetrics = new Map<string, {
      totalDays: number;
      presentDays: number;
      absentDays: number;
    }>();

    // Initialize metrics for all students (even those with no attendance records)
    studentsData.forEach(student => {
      if (student.aeries_student_id) {
        studentMetrics.set(student.aeries_student_id, {
          totalDays: 0,
          presentDays: 0,
          absentDays: 0
        });
      }
    });

    // Process attendance records
    if (attendanceData && attendanceData.length > 0) {
      attendanceData.forEach((record: any) => {
        const aeriesStudentId = record.aeries_student_id;
        
        if (studentMetrics.has(aeriesStudentId)) {
          const metrics = studentMetrics.get(aeriesStudentId)!;
          metrics.totalDays++;

          // Count present/absent days based on is_present boolean
          if (record.is_present === true) {
            metrics.presentDays++;
          } else {
            metrics.absentDays++;
          }
        }
      });
    }

    // Convert to student array with calculated metrics
    let students: StudentWithMetrics[] = studentsData.map(student => {
      const metrics = studentMetrics.get(student.aeries_student_id || '') || { totalDays: 0, presentDays: 0, absentDays: 0 };
      const attendanceRate = metrics.totalDays > 0 ? (metrics.presentDays / metrics.totalDays) * 100 : 0;
      const tier = calculateTier(attendanceRate);
      const riskLevel = calculateRiskLevel(attendanceRate);

      return {
        id: student.id,
        name: `${student.last_name}, ${student.first_name}`,
        grade: student.grade_level?.toString() || '0',
        teacher: student.current_homeroom_teacher || 'Staff',
        studentId: student.aeries_student_id || student.id,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        absences: metrics.absentDays,
        enrolled: metrics.totalDays,
        present: metrics.presentDays,
        tier,
        riskLevel,
        school: student.school_id,
        schoolName: student.schools?.school_name
      };
    });

    console.log(`Processed ${students.length} students with attendance data`);

    // Apply tier filter after calculation
    if (query.tier && query.tier !== 'all') {
      const tierFilter = query.tier.toLowerCase();
      students = students.filter(student => 
        student.tier.toLowerCase() === `tier ${tierFilter.replace('tier ', '')}`
      );
    }

    // Sort by grade, then by attendance rate (lowest first for intervention priority)
    students.sort((a, b) => {
      const gradeA = parseInt(a.grade) || 0;
      const gradeB = parseInt(b.grade) || 0;
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.attendanceRate - b.attendanceRate;
    });

    // Calculate total for pagination
    const total = students.length;
    const totalPages = Math.ceil(total / limit);

    // Apply pagination
    const paginatedStudents = students.slice(offset, offset + limit);

    console.log(`Returning page ${page}/${totalPages} with ${paginatedStudents.length} students (${total} total)`);
    
    // Sample some data for debugging
    if (paginatedStudents.length > 0) {
      const sample = paginatedStudents[0];
      console.log(`Sample student: ${sample.name}, Grade: ${sample.grade}, Teacher: ${sample.teacher}, Rate: ${sample.attendanceRate}%, Tier: ${sample.tier}`);
    }

    return NextResponse.json({
      data: paginatedStudents,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      metadata: {
        schoolYear: `SY ${baseYear}-${parseInt(baseYear) + 1}`,
        dateRange: {
          start: startDate,
          end: endDate
        },
        filters: {
          schoolId: query.schoolId,
          grade: query.grade,
          tier: query.tier,
          search: query.search
        }
      }
    });

  } catch (error) {
    console.error('Error in students API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

