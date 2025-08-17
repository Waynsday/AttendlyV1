/**
 * @fileoverview Student Attendance Details API Route
 * Provides detailed attendance records for a specific student
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const url = new URL(request.url);
    const schoolYear = url.searchParams.get('schoolYear') || '2024';

    // Define school year date range
    const startDate = schoolYear === '2024' ? '2024-08-15' : '2023-08-15';
    const endDate = schoolYear === '2024' ? '2025-06-12' : '2024-06-12';

    // First, find the student UUID from the aeries_student_id string (like "1010205")
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, aeries_student_id')
      .eq('aeries_student_id', parseInt(studentId))
      .single();

    if (studentError || !students) {
      console.error('Student not found:', studentError);
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Now fetch attendance records using the aeries_student_id
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select(`
        attendance_date,
        all_day_attendance_code,
        school_year,
        school_code
      `)
      .eq('aeries_student_id', parseInt(studentId))
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: false });

    if (attendanceError) {
      console.error('Error fetching attendance records:', attendanceError);
      return NextResponse.json(
        { error: 'Failed to fetch attendance records' },
        { status: 500 }
      );
    }

    // Get unique school codes from attendance records
    const uniqueSchoolCodes = [...new Set((attendanceRecords || []).map(record => record.school_code))];
    
    // Fetch school information for these school codes
    let schoolInfo = [];
    if (uniqueSchoolCodes.length > 0) {
      const { data: schools, error: schoolsError } = await supabase
        .from('schools')
        .select('school_code, aeries_school_code, school_name')
        .in('aeries_school_code', uniqueSchoolCodes);
      
      if (!schoolsError && schools) {
        schoolInfo = schools;
      }
    }

    // Process records to separate present and absent dates
    const presentDates = [];
    const absentDates = [];
    let totalEnrolled = 0;

    for (const record of attendanceRecords || []) {
      const dateStr = new Date(record.attendance_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Use all_day_attendance_code to determine presence: P = Present, A = Absent
      if (record.all_day_attendance_code === 'P') {
        presentDates.push({
          date: dateStr,
          rawDate: record.attendance_date,
          status: 'present'
        });
      } else if (record.all_day_attendance_code === 'A') {
        absentDates.push({
          date: dateStr,
          rawDate: record.attendance_date,
          status: 'absent'
        });
      }

      // Note: days_enrolled is not available in attendance_records
      // We'll calculate total enrolled days from the record count
      totalEnrolled++;
    }

    // Calculate attendance rate
    const totalRecords = (attendanceRecords || []).length;
    const presentCount = presentDates.length;
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        studentId,
        schoolYear,
        totalRecords,
        presentDays: presentCount,
        absentDays: absentDates.length,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        enrolledDays: totalEnrolled,
        presentDates,
        absentDates,
        schools: schoolInfo,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });

  } catch (error) {
    console.error('Error in student attendance API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}