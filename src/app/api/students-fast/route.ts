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

    // Debug logging for intervention data
    if (data && data.length > 0) {
      const studentsWithInterventions = data.filter(row => row.last_intervention_type);
      console.log(`🔍 DEBUG: Found ${studentsWithInterventions.length} students with interventions out of ${data.length} total`);
      
      // Log specific student 1012350 if found
      const targetStudent = data.find(row => row.aeries_student_id === '1012350');
      if (targetStudent) {
        console.log('🎯 DEBUG: Student 1012350 data from database:', {
          name: targetStudent.full_name,
          aeries_id: targetStudent.aeries_student_id,
          intervention_type: targetStudent.last_intervention_type,
          intervention_date: targetStudent.last_intervention_date,
          intervention_description: targetStudent.last_intervention_description
        });
      }
      
      // Log a few samples of students with interventions
      if (studentsWithInterventions.length > 0) {
        console.log('📋 DEBUG: Sample students with interventions:');
        studentsWithInterventions.slice(0, 3).forEach(student => {
          console.log(`  - ${student.full_name} (${student.aeries_student_id}): ${student.last_intervention_type} on ${student.last_intervention_date}`);
        });
      }
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

    // Fetch intervention data for the current page students only
    let interventionsMap = new Map();
    if (data && data.length > 0) {
      const studentIds = data.map(row => row.aeries_student_id).filter(Boolean);
      console.log(`🔍 Fetching interventions for ${studentIds.length} students on current page`);
      
      if (studentIds.length > 0) {
        const { data: interventions, error: interventionError } = await supabase
          .from('interventions')
          .select('aeries_student_id, type, description, scheduled_date, completed_date')
          .in('aeries_student_id', studentIds)
          .not('aeries_student_id', 'is', null)
          .order('aeries_student_id')
          .order('completed_date', { ascending: false, nullsFirst: false })
          .order('scheduled_date', { ascending: false, nullsFirst: false });
        
        if (interventionError) {
          console.error('Error fetching interventions:', interventionError.message);
        } else if (interventions && interventions.length > 0) {
          // Group interventions by student and get the latest for each
          const latestInterventions = interventions.reduce((acc, intervention) => {
            if (!acc[intervention.aeries_student_id]) {
              acc[intervention.aeries_student_id] = {
                type: intervention.type,
                date: intervention.completed_date || intervention.scheduled_date,
                description: intervention.description
              };
            }
            return acc;
          }, {});
          
          interventionsMap = new Map(Object.entries(latestInterventions));
          console.log(`📋 Found interventions for ${interventionsMap.size} students`);
        }
      }
    }

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
    const students = (data || []).map((row: any) => {
      const student = {
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
        ireadyMathDate: row.iready_math_date || null,
        // Intervention data from intervention lookup
        lastIntervention: interventionsMap.get(row.aeries_student_id)?.type || null,
        interventionDate: interventionsMap.get(row.aeries_student_id)?.date || null,
        interventionDescription: interventionsMap.get(row.aeries_student_id)?.description || null
      };

      // Debug log for student 1012350 during transformation
      if (row.aeries_student_id === '1012350') {
        const interventionData = interventionsMap.get(row.aeries_student_id);
        console.log('🔄 DEBUG: Transforming student 1012350:', {
          intervention_lookup_data: interventionData,
          transformed_lastIntervention: student.lastIntervention,
          transformed_interventionDate: student.interventionDate,
          transformed_interventionDescription: student.interventionDescription
        });
      }

      return student;
    });

    console.log(`✅ Fast query returned ${students.length} students out of ${totalCount} total`);
    
    // Final debug: Check what intervention data is being returned to frontend
    const studentsWithInterventionsFinal = students.filter(s => s.lastIntervention);
    console.log(`🚀 FINAL DEBUG: Sending ${studentsWithInterventionsFinal.length} students with interventions to frontend`);
    
    if (studentsWithInterventionsFinal.length > 0) {
      console.log('📤 Sample intervention data being sent to frontend:');
      studentsWithInterventionsFinal.slice(0, 3).forEach(student => {
        console.log(`  - ${student.name} (${student.studentId}): ${student.lastIntervention} on ${student.interventionDate}`);
      });
    }
    
    // Check specifically for student 1012350 in final response
    const student1012350Final = students.find(s => s.studentId === '1012350');
    if (student1012350Final) {
      console.log('🎯 FINAL: Student 1012350 data being sent to frontend:', {
        name: student1012350Final.name,
        studentId: student1012350Final.studentId,
        lastIntervention: student1012350Final.lastIntervention,
        interventionDate: student1012350Final.interventionDate,
        interventionDescription: student1012350Final.interventionDescription
      });
    }

    const response = NextResponse.json({
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
        usingInterventionTable: true,
        lastUpdated: new Date().toISOString()
      }
    });

    // Add cache-busting headers to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;

  } catch (error) {
    console.error('Error in fast students API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

