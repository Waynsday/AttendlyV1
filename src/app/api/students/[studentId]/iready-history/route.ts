/**
 * @fileoverview iReady Historical Data API Route
 * Fetches comprehensive iReady diagnostic history for individual students
 * Provides multi-year ELA and Math assessment data with trends
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { studentId } = await params;

    console.log(`🔍 Fetching iReady history for student ${studentId}`);

    // Get all iReady diagnostic results for this student
    const { data: ireadyData, error } = await supabase
      .from('iready_diagnostic_results')
      .select(`
        id,
        subject,
        overall_scale_score,
        overall_placement,
        diagnostic_date,
        school_year,
        created_at
      `)
      .eq('student_id', studentId)
      .order('diagnostic_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching iReady history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch iReady history', details: error.message },
        { status: 500 }
      );
    }

    if (!ireadyData || ireadyData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasData: false,
          message: 'No iReady assessment data available for this student',
          history: {
            ela: [],
            math: []
          },
          summary: {
            totalAssessments: 0,
            latestEla: null,
            latestMath: null,
            yearRange: null
          }
        }
      });
    }

    // Helper function to format placement text
    const formatPlacement = (placement: string): string => {
      const placements: Record<string, string> = {
        'THREE_OR_MORE_GRADE_LEVELS_BELOW': '3+ Levels Below',
        'TWO_GRADE_LEVELS_BELOW': '2 Levels Below',
        'ONE_GRADE_LEVEL_BELOW': '1 Level Below',
        'ON_GRADE_LEVEL': 'On Grade Level',
        'ONE_GRADE_LEVEL_ABOVE': '1 Level Above',
        'TWO_GRADE_LEVELS_ABOVE': '2 Levels Above',
        'THREE_OR_MORE_GRADE_LEVELS_ABOVE': '3+ Levels Above'
      };
      return placements[placement] || placement;
    };

    // Separate ELA and Math data
    const elaData = ireadyData
      .filter(record => record.subject === 'ELA')
      .map(record => ({
        id: record.id,
        score: record.overall_scale_score,
        placement: formatPlacement(record.overall_placement),
        rawPlacement: record.overall_placement,
        date: record.diagnostic_date,
        academicYear: record.school_year,
        createdAt: record.created_at
      }));

    const mathData = ireadyData
      .filter(record => record.subject === 'MATH')
      .map(record => ({
        id: record.id,
        score: record.overall_scale_score,
        placement: formatPlacement(record.overall_placement),
        rawPlacement: record.overall_placement,
        date: record.diagnostic_date,
        academicYear: record.school_year,
        createdAt: record.created_at
      }));

    // Calculate trends and summary
    const calculateTrend = (data: any[]): 'improving' | 'declining' | 'stable' | 'insufficient' => {
      if (data.length < 2) return 'insufficient';
      
      const recent = data[0];
      const previous = data[1];
      
      const scoreDiff = recent.score - previous.score;
      if (scoreDiff > 10) return 'improving';
      if (scoreDiff < -10) return 'declining';
      return 'stable';
    };

    const latestEla = elaData[0] || null;
    const latestMath = mathData[0] || null;
    
    // Get year range
    const allYears = [...new Set(ireadyData.map(r => r.school_year))].sort();
    const yearRange = allYears.length > 1 
      ? `${allYears[0]} - ${allYears[allYears.length - 1]}`
      : allYears[0] || null;

    const transformedData = {
      hasData: true,
      history: {
        ela: elaData,
        math: mathData
      },
      summary: {
        totalAssessments: ireadyData.length,
        latestEla,
        latestMath,
        yearRange,
        trends: {
          ela: calculateTrend(elaData),
          math: calculateTrend(mathData)
        }
      }
    };

    console.log(`✅ Found ${ireadyData.length} iReady records for student`);

    return NextResponse.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    console.error('Error in iReady history API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}