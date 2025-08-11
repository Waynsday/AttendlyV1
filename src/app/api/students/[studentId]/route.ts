/**
 * @fileoverview Individual Student API Route
 * Provides detailed student data including attendance metrics and tardy information
 * from student_attendance_summary view
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const supabase = createAdminClient();
    const { studentId } = params;

    console.log(`🔍 Fetching data for student ${studentId}`);

    // Get student data from the student_attendance_summary view
    const { data: student, error } = await supabase
      .from('student_attendance_summary')
      .select(`
        id,
        first_name,
        last_name,
        grade_level,
        current_homeroom_teacher,
        aeries_student_id,
        attendance_rate,
        absent_days,
        enrolled_days,
        present_days,
        tardies,
        school_id,
        schools!inner(
          id,
          school_name
        )
      `)
      .eq('id', studentId)
      .single();

    if (error) {
      console.error('Error fetching student:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Student not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch student data', details: error.message },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Get attendance history for the student
    const { data: attendanceHistory } = await supabase
      .from('attendance_records')
      .select('attendance_date, is_present, tardy_count')
      .eq('student_id', studentId)
      .gte('attendance_date', '2024-08-15')
      .lte('attendance_date', '2025-06-12')
      .order('attendance_date', { ascending: false })
      .limit(100); // Last 100 days

    // Transform attendance history
    const transformedHistory = attendanceHistory?.map(record => ({
      date: record.attendance_date,
      status: record.tardy_count > 0 ? 'tardy' : (record.is_present ? 'present' : 'absent'),
      notes: null
    })) || [];

    // Calculate risk tier
    const attendanceRate = student.attendance_rate || 0;
    const tier = attendanceRate >= 95 ? 1 : attendanceRate >= 90 ? 2 : 3;

    // Transform the data to match StudentSideCard expectations
    const transformedStudent = {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      grade: student.grade_level?.toString() || '0',
      teacherName: student.current_homeroom_teacher || 'Staff',
      attendanceRate: student.attendance_rate || 0,
      totalAbsences: student.absent_days || 0,
      chronicAbsences: Math.max(0, (student.absent_days || 0) - 5), // Simple chronic calculation
      totalTardies: student.tardies || 0,
      tier,
      lastAbsenceDate: transformedHistory.find(h => h.status === 'absent')?.date || '2024-08-15',
      attendanceHistory: transformedHistory,
      iReadyScores: {
        currentYear: {
          ela: { diagnostic1: { score: 85, placement: 'On Grade Level' } },
          math: { diagnostic1: { score: 78, placement: 'Below Grade Level' } }
        },
        previousYear: {
          ela: { diagnostic1: { score: 82, placement: 'On Grade Level' } },
          math: { diagnostic1: { score: 75, placement: 'Below Grade Level' } }
        }
      },
      interventions: []
    };

    console.log(`✅ Returning student data: ${student.first_name} ${student.last_name}, Tardies: ${student.tardies}`);

    return NextResponse.json({
      success: true,
      data: transformedStudent
    });

  } catch (error) {
    console.error('Error in individual student API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}