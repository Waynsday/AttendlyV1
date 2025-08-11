/**
 * @fileoverview Test Timeline API
 * For testing the timeline functionality and populating sample data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Check if we have schools data
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name, school_code')
      .eq('is_active', true)
      .limit(5);

    if (schoolsError) {
      return NextResponse.json({
        success: false,
        error: `Schools query error: ${schoolsError.message}`,
        details: schoolsError
      });
    }

    // Check if we have students data
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, school_id, grade_level, first_name, last_name')
      .eq('is_active', true)
      .limit(10);

    if (studentsError) {
      return NextResponse.json({
        success: false,
        error: `Students query error: ${studentsError.message}`,
        details: studentsError
      });
    }

    // Check if we have attendance records
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('id, student_id, attendance_date, is_present')
      .gte('attendance_date', '2024-08-01')
      .limit(10);

    if (attendanceError) {
      return NextResponse.json({
        success: false,
        error: `Attendance query error: ${attendanceError.message}`,
        details: attendanceError
      });
    }

    // Check timeline summary tables
    const { data: gradeSummary, error: gradeSummaryError } = await supabase
      .from('grade_attendance_timeline_summary')
      .select('*')
      .limit(5);

    const { data: districtSummary, error: districtSummaryError } = await supabase
      .from('district_attendance_timeline_summary')
      .select('*')
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        schools: {
          count: schools?.length || 0,
          sample: schools?.slice(0, 3),
          error: schoolsError?.message
        },
        students: {
          count: students?.length || 0,
          sample: students?.slice(0, 3),
          error: studentsError?.message
        },
        attendance: {
          count: attendance?.length || 0,
          sample: attendance?.slice(0, 3),
          error: attendanceError?.message
        },
        gradeSummary: {
          count: gradeSummary?.length || 0,
          sample: gradeSummary,
          error: gradeSummaryError?.message
        },
        districtSummary: {
          count: districtSummary?.length || 0,
          sample: districtSummary,
          error: districtSummaryError?.message
        }
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'populate_sample_data' || action === 'process_real_data') {
      let dates = [];
      
      if (action === 'process_real_data') {
        // Get actual attendance dates from database
        const { data: attendanceDates } = await supabase
          .from('attendance_records')
          .select('attendance_date')
          .order('attendance_date', { ascending: true });
        
        if (attendanceDates && attendanceDates.length > 0) {
          // Get unique dates, limit to last 10 for testing
          const uniqueDates = [...new Set(attendanceDates.map(r => r.attendance_date))];
          dates = uniqueDates.slice(-10);
        }
      } else {
        // Generate last 7 days (sample data)
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
            dates.push(date.toISOString().split('T')[0]);
          }
        }
      }

      // Get first school
      const { data: schools } = await supabase
        .from('schools')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (!schools || schools.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active schools found'
        });
      }

      const schoolId = schools[0].id;
      const results = [];

      // Populate sample data for each date
      for (const date of dates) {
        // Call the function to populate grade timeline summary
        const { data, error } = await supabase.rpc('populate_grade_timeline_summary', {
          p_summary_date: date,
          p_school_year: '2024-2025'
        });

        if (error) {
          results.push({ date, error: error.message });
        } else {
          results.push({ date, success: true });

          // Also populate district summary
          await supabase.rpc('refresh_district_timeline_summary', {
            p_summary_date: date,
            p_school_year: '2024-2025'
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Sample data population completed',
        results,
        processedDates: dates
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use: populate_sample_data'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}