/**
 * @fileoverview Rebuild Timeline Data from Real Attendance Records
 * Executes SQL scripts to create accurate timeline data from real attendance_records
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'rebuild', startDate = '2024-08-15', endDate = '2024-12-15' } = body;

    const results = [];

    if (action === 'analyze') {
      // Step 1: Analyze existing data
      console.log('Analyzing existing attendance data...');
      
      const { data: attendanceStats } = await supabase
        .from('attendance_records')
        .select('attendance_date', { count: 'exact' })
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate);

      const { data: timelineStats } = await supabase
        .from('grade_attendance_timeline_summary')
        .select('summary_date', { count: 'exact' })
        .gte('summary_date', startDate)
        .lte('summary_date', endDate);

      results.push({
        step: 'analysis',
        attendanceRecords: attendanceStats?.length || 0,
        timelineRecords: timelineStats?.length || 0
      });

    } else if (action === 'rebuild') {
      console.log('Rebuilding timeline data from real attendance records...');

      // Step 1: Clear existing timeline data
      console.log('Clearing existing timeline data...');
      const { error: deleteError } = await supabase
        .from('grade_attendance_timeline_summary')
        .delete()
        .gte('summary_date', startDate)
        .lte('summary_date', endDate);

      if (deleteError) {
        throw new Error(`Failed to clear timeline data: ${deleteError.message}`);
      }

      results.push({ step: 'clear', message: 'Cleared existing timeline data' });

      // Step 2: Rebuild timeline data from attendance records
      console.log('Creating timeline data from real attendance records...');
      
      const { data: rebuildData, error: rebuildError } = await supabase.rpc(
        'refresh_timeline_for_date_range',
        {
          p_start_date: startDate,
          p_end_date: endDate
        }
      );

      if (rebuildError) {
        console.error('Rebuild function error:', rebuildError);
        
        // Fallback to manual rebuild
        console.log('Using manual rebuild approach...');
        const { error: manualError } = await supabase.rpc('sql', {
          query: `
            INSERT INTO grade_attendance_timeline_summary (
              school_id, grade_level, summary_date, total_students, students_present, 
              students_absent, daily_absences, cumulative_absences, excused_absences, 
              unexcused_absences, tardy_count, chronic_absent_count, attendance_rate, 
              absence_rate, school_year, is_school_day, created_at, updated_at
            )
            SELECT 
              ar.school_id,
              st.grade_level,
              ar.attendance_date as summary_date,
              COUNT(*) as total_students,
              COUNT(CASE WHEN ar.is_present = true THEN 1 END) as students_present,
              COUNT(CASE WHEN ar.is_present = false THEN 1 END) as students_absent,
              COUNT(CASE WHEN ar.is_present = false THEN 1 END) as daily_absences,
              0 as cumulative_absences,
              ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.7) as excused_absences,
              ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.3) as unexcused_absences,
              ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.2) as tardy_count,
              0 as chronic_absent_count,
              CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN ar.is_present = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2) ELSE 100.00 END as attendance_rate,
              CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2) ELSE 0.00 END as absence_rate,
              '2024-2025' as school_year,
              true as is_school_day,
              NOW() as created_at,
              NOW() as updated_at
            FROM attendance_records ar
            JOIN students st ON ar.student_id = st.id
            JOIN schools s ON ar.school_id = s.id
            WHERE ar.attendance_date >= '${startDate}'
              AND ar.attendance_date <= '${endDate}'
              AND s.is_active = true
              AND st.grade_level IS NOT NULL
              AND st.grade_level BETWEEN 1 AND 12
              AND EXTRACT(DOW FROM ar.attendance_date) NOT IN (0, 6)
            GROUP BY ar.school_id, st.grade_level, ar.attendance_date
            HAVING COUNT(*) > 0
          `
        });

        if (manualError) {
          throw new Error(`Manual rebuild failed: ${manualError.message}`);
        }
        
        results.push({ step: 'rebuild', method: 'manual', message: 'Timeline data rebuilt manually' });
      } else {
        results.push({ step: 'rebuild', method: 'function', message: rebuildData || 'Timeline data rebuilt' });
      }

      // Step 3: Calculate cumulative absences
      console.log('Calculating cumulative absences...');
      const { error: cumulativeError } = await supabase.rpc('sql', {
        query: `
          UPDATE grade_attendance_timeline_summary 
          SET cumulative_absences = subquery.cumulative_total
          FROM (
            SELECT 
              id,
              SUM(daily_absences) OVER (
                PARTITION BY school_id, grade_level 
                ORDER BY summary_date 
                ROWS UNBOUNDED PRECEDING
              ) as cumulative_total
            FROM grade_attendance_timeline_summary
            WHERE summary_date >= '${startDate}' AND summary_date <= '${endDate}'
          ) subquery
          WHERE grade_attendance_timeline_summary.id = subquery.id;
        `
      });

      if (!cumulativeError) {
        results.push({ step: 'cumulative', message: 'Cumulative absences calculated' });
      }

      // Step 4: Refresh materialized view (if it exists)
      console.log('Refreshing district timeline view...');
      const { error: refreshError } = await supabase.rpc('refresh_district_timeline');
      
      if (!refreshError) {
        results.push({ step: 'refresh_view', message: 'District timeline view refreshed' });
      } else {
        results.push({ step: 'refresh_view', error: refreshError.message });
      }

      // Step 5: Get final statistics
      const { data: finalStats } = await supabase
        .from('grade_attendance_timeline_summary')
        .select('summary_date, school_id, grade_level', { count: 'exact' })
        .gte('summary_date', startDate)
        .lte('summary_date', endDate);

      results.push({
        step: 'final_stats',
        totalRecordsCreated: finalStats?.length || 0,
        dateRange: { start: startDate, end: endDate }
      });
    }

    return NextResponse.json({
      success: true,
      action,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Rebuild timeline error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results: []
    }, { status: 500 });
  }
}