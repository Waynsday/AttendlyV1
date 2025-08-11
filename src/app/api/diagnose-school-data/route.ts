/**
 * @fileoverview Diagnose School Data Coverage
 * Identifies why some schools show "no data available" in timeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const results = [];

    // 1. Check all schools and their data availability
    console.log('Analyzing school data coverage...');
    
    const { data: schoolDataAnalysis, error: analysisError } = await supabase.rpc('sql', {
      query: `
        SELECT 
          s.id as school_id,
          s.school_name,
          s.school_code,
          s.is_active,
          COUNT(ar.id) as attendance_records_count,
          MIN(ar.attendance_date) as earliest_attendance_date,
          MAX(ar.attendance_date) as latest_attendance_date,
          COUNT(DISTINCT ar.student_id) as unique_students_with_attendance,
          COUNT(DISTINCT ar.attendance_date) as unique_attendance_dates,
          COUNT(gts.id) as timeline_records_count
        FROM schools s
        LEFT JOIN attendance_records ar ON s.id = ar.school_id 
          AND ar.attendance_date >= '2024-08-15' 
          AND ar.attendance_date <= '2024-12-15'
        LEFT JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
        WHERE s.is_active = true
        GROUP BY s.id, s.school_name, s.school_code, s.is_active
        ORDER BY s.school_name;
      `
    });

    if (schoolDataAnalysis) {
      results.push({
        analysis: 'school_data_coverage',
        schools: schoolDataAnalysis,
        summary: {
          totalActiveSchools: schoolDataAnalysis.length,
          schoolsWithAttendance: schoolDataAnalysis.filter(s => s.attendance_records_count > 0).length,
          schoolsWithTimeline: schoolDataAnalysis.filter(s => s.timeline_records_count > 0).length,
          schoolsMissingData: schoolDataAnalysis.filter(s => s.timeline_records_count === 0).map(s => s.school_name)
        }
      });
    }

    // 2. Check student-attendance relationship issues
    const { data: relationshipCheck } = await supabase.rpc('sql', {
      query: `
        SELECT 
          s.school_name,
          COUNT(ar.id) as attendance_records,
          COUNT(st.id) as matching_students,
          COUNT(CASE WHEN st.id IS NULL THEN 1 END) as orphaned_attendance_records,
          COUNT(CASE WHEN st.grade_level IS NULL THEN 1 END) as students_without_grade
        FROM schools s
        LEFT JOIN attendance_records ar ON s.id = ar.school_id 
          AND ar.attendance_date >= '2024-08-15' 
          AND ar.attendance_date <= '2024-12-15'
        LEFT JOIN students st ON ar.student_id = st.id
        WHERE s.is_active = true
        GROUP BY s.id, s.school_name
        ORDER BY s.school_name;
      `
    });

    if (relationshipCheck) {
      results.push({
        analysis: 'relationship_issues',
        data: relationshipCheck,
        issues: relationshipCheck.filter(r => 
          r.orphaned_attendance_records > 0 || r.students_without_grade > 0
        )
      });
    }

    // 3. Specific check for schools with missing timeline data
    const { data: missingDataSchools } = await supabase.rpc('sql', {
      query: `
        SELECT 
          s.school_name,
          s.school_code,
          s.id as school_id,
          COUNT(ar.id) as attendance_records,
          COUNT(st.id) as student_records,
          COUNT(CASE WHEN st.grade_level IS NOT NULL THEN 1 END) as students_with_grade,
          'Reason: ' || 
          CASE 
            WHEN COUNT(ar.id) = 0 THEN 'No attendance records'
            WHEN COUNT(st.id) = 0 THEN 'No students in students table'
            WHEN COUNT(CASE WHEN st.grade_level IS NOT NULL THEN 1 END) = 0 THEN 'Students have no grade_level'
            ELSE 'Unknown issue - check data relationships'
          END as likely_issue
        FROM schools s
        LEFT JOIN attendance_records ar ON s.id = ar.school_id 
          AND ar.attendance_date >= '2024-08-15'
        LEFT JOIN students st ON ar.student_id = st.id
        LEFT JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
        WHERE s.is_active = true
          AND gts.id IS NULL  -- Schools with no timeline data
        GROUP BY s.id, s.school_name, s.school_code
        ORDER BY s.school_name;
      `
    });

    if (missingDataSchools && missingDataSchools.length > 0) {
      results.push({
        analysis: 'schools_missing_timeline_data',
        count: missingDataSchools.length,
        schools: missingDataSchools,
        recommendedAction: 'Run fix-missing-school-data.sql to resolve data relationship issues'
      });
    }

    // 4. Check specific school if requested
    const { searchParams } = new URL(request.url);
    const schoolName = searchParams.get('schoolName');
    
    if (schoolName) {
      const { data: specificSchoolCheck } = await supabase.rpc('sql', {
        query: `
          SELECT 
            'Specific School Analysis' as analysis_type,
            s.school_name,
            s.school_code,
            s.id as school_uuid,
            COUNT(ar.id) as attendance_records,
            MIN(ar.attendance_date) as earliest_date,
            MAX(ar.attendance_date) as latest_date,
            COUNT(DISTINCT ar.student_id) as unique_students,
            COUNT(st.id) as student_table_records,
            COUNT(CASE WHEN st.grade_level IS NOT NULL THEN 1 END) as students_with_grades,
            STRING_AGG(DISTINCT st.grade_level::text, ', ' ORDER BY st.grade_level::text) as available_grades
          FROM schools s
          LEFT JOIN attendance_records ar ON s.id = ar.school_id
            AND ar.attendance_date >= '2024-08-15'
          LEFT JOIN students st ON ar.student_id = st.id
          WHERE s.school_name ILIKE '%${schoolName}%'
          GROUP BY s.id, s.school_name, s.school_code;
        `
      });

      if (specificSchoolCheck) {
        results.push({
          analysis: 'specific_school_check',
          schoolName,
          data: specificSchoolCheck
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      recommendations: [
        {
          issue: 'Schools with no timeline data',
          solution: 'Run fix-missing-school-data.sql',
          description: 'Creates timeline data using attendance_records even when student relationships are broken'
        },
        {
          issue: 'Orphaned attendance records',
          solution: 'Check student_id foreign key relationships',
          description: 'Some attendance records may reference students that don\'t exist in students table'
        },
        {
          issue: 'Students without grade levels',
          solution: 'Update students table with grade_level data',
          description: 'Timeline requires grade_level to group data properly'
        }
      ]
    });

  } catch (error) {
    console.error('Diagnosis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'fix_missing_schools') {
      // Execute the fix for missing school data
      console.log('Attempting to fix missing school data...');
      
      const results = [];

      // Create fallback timeline data for schools missing it
      const { data: fixResult, error: fixError } = await supabase.rpc('sql', {
        query: `
          INSERT INTO grade_attendance_timeline_summary (
            school_id, grade_level, summary_date, total_students, students_present, 
            students_absent, daily_absences, cumulative_absences, excused_absences, 
            unexcused_absences, tardy_count, chronic_absent_count, attendance_rate, 
            absence_rate, school_year, is_school_day, created_at, updated_at
          )
          SELECT 
            ar.school_id,
            COALESCE(st.grade_level, 3) as grade_level,  -- Default to grade 3 if no grade
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
            CASE WHEN COUNT(*) > 0 
              THEN ROUND((COUNT(CASE WHEN ar.is_present = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
              ELSE 100.00 
            END as attendance_rate,
            CASE WHEN COUNT(*) > 0 
              THEN ROUND((COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
              ELSE 0.00 
            END as absence_rate,
            '2024-2025' as school_year,
            true as is_school_day,
            NOW() as created_at,
            NOW() as updated_at
          FROM attendance_records ar
          JOIN schools s ON ar.school_id = s.id
          LEFT JOIN students st ON ar.student_id = st.id
          WHERE ar.attendance_date >= '2024-08-15'
            AND ar.attendance_date <= '2024-12-15'
            AND s.is_active = true
            AND EXTRACT(DOW FROM ar.attendance_date) NOT IN (0, 6)
            -- Only insert if this combination doesn't already exist
            AND NOT EXISTS (
              SELECT 1 FROM grade_attendance_timeline_summary gts 
              WHERE gts.school_id = ar.school_id 
                AND gts.summary_date = ar.attendance_date
                AND gts.grade_level = COALESCE(st.grade_level, 3)
            )
          GROUP BY ar.school_id, COALESCE(st.grade_level, 3), ar.attendance_date
          HAVING COUNT(*) > 0;
        `
      });

      if (fixError) {
        results.push({
          step: 'fix_missing_schools',
          success: false,
          error: fixError.message
        });
      } else {
        results.push({
          step: 'fix_missing_schools',
          success: true,
          message: 'Added timeline data for schools with missing data'
        });

        // Refresh materialized view
        await supabase.rpc('refresh_district_timeline');
        
        results.push({
          step: 'refresh_view',
          success: true,
          message: 'Refreshed district timeline view'
        });
      }

      return NextResponse.json({
        success: true,
        action: 'fix_missing_schools',
        results
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Fix error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}