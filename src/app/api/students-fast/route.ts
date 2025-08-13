/**
 * @fileoverview Fast Students API Route using Supabase Views
 * Uses pre-calculated attendance metrics for instant data access
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('🚀 Fast students API called');
  
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || null;
    const grade = searchParams.get('grade') || null;
    const tier = searchParams.get('tier') || null;
    const search = searchParams.get('search') || null;
    const sortColumn = searchParams.get('sortColumn') || 'default';
    const sortDirection = searchParams.get('sortDirection') || 'asc';

    // Validate pagination
    const validatedLimit = Math.min(50, Math.max(10, limit));
    const offset = (Math.max(1, page) - 1) * validatedLimit;

    console.log('Using fast student data view with filters:', {
      schoolId,
      grade: grade ? parseInt(grade) : null,
      tier,
      search,
      limit: validatedLimit,
      offset,
      sortColumn,
      sortDirection
    });


    // Call the stored function that uses the view
    const { data, error } = await supabase.rpc('get_student_attendance_data', {
      p_school_id: schoolId,
      p_grade_level: grade && grade !== 'all' ? parseInt(grade) : null,
      p_tier: tier,
      p_search: search,
      p_limit: validatedLimit,
      p_offset: offset,
      p_sort_column: sortColumn,
      p_sort_direction: sortDirection
    });

    if (error) {
      console.error('Error fetching student data from view:', error);
      return NextResponse.json(
        { error: 'Failed to fetch student data', details: error.message },
        { status: 500 }
      );
    }

    // Get total count from first row (or 0 if no data)
    const totalCount = data && data.length > 0 ? parseInt(data[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / validatedLimit);
    
    console.log('Pagination debug:', {
      dataLength: data?.length || 0,
      totalCount,
      page,
      offset,
      limit: validatedLimit,
      totalPages
    });

    // Helper function to map risk_level to tier format
    const mapRiskLevelToTier = (riskLevel: string): string => {
      switch (riskLevel?.toLowerCase()) {
        case 'low': return 'Tier 1';
        case 'medium': return 'Tier 2';
        case 'high': return 'Tier 3';
        default: return 'Tier 1';
      }
    };

    // Transform data to match expected format
    const students = (data || []).map((row: any) => ({
      id: row.id,
      name: row.full_name,
      grade: row.grade_level !== null && row.grade_level !== undefined ? row.grade_level.toString() : '0',
      teacher: row.current_homeroom_teacher || 'Staff',
      studentId: row.aeries_student_id,
      attendanceRate: parseFloat(row.attendance_rate || 0),
      absences: row.absent_days || 0,
      enrolled: row.enrolled_days || 0,
      present: row.present_days || 0,
      tier: mapRiskLevelToTier(row.risk_level),
      riskLevel: row.risk_level,
      tardies: row.tardies || 0,
      schoolName: row.school_name,
      // iReady scores
      ireadyElaScore: row.iready_ela_score || null,
      ireadyElaPlacement: row.iready_ela_placement || null,
      ireadyElaDate: row.iready_ela_date || null,
      ireadyMathScore: row.iready_math_score || null,
      ireadyMathPlacement: row.iready_math_placement || null,
      ireadyMathDate: row.iready_math_date || null
    }));

    console.log(`✅ Fast query returned ${students.length} students out of ${totalCount} total`);

    return NextResponse.json({
      data: students,
      pagination: {
        page: Math.max(1, page),
        limit: validatedLimit,
        total: totalCount,
        totalPages
      },
      metadata: {
        schoolYear: 'SY 2024-2025',
        dateRange: {
          start: '2024-08-15',
          end: '2025-06-12'
        },
        filters: {
          schoolId,
          grade,
          tier,
          search
        },
        sorting: {
          column: sortColumn,
          direction: sortDirection
        },
        usingView: true
      }
    });

  } catch (error) {
    console.error('Error in fast students API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

