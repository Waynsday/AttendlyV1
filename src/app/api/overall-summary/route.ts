/**
 * @fileoverview Overall Attendance Summary API Route
 * 
 * Provides district-wide and school-specific attendance summaries
 * without grade filtering for dashboard header statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const schoolId = searchParams.get('schoolId') || 'all'
    
    console.log('🚀 Overall summary API called for:', schoolId)
    
    // Query the overall_attendance_summary view
    let query = supabase
      .from('overall_attendance_summary')
      .select('*')
    
    if (schoolId === 'all') {
      // Get district-wide summary (where school_id is NULL)
      query = query.is('school_id', null)
    } else {
      // Get specific school summary
      query = query.eq('school_id', schoolId)
    }
    
    const { data, error } = await query.single()
    
    if (error) {
      console.error('Error fetching overall summary:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch overall summary', 
          details: error.message 
        },
        { status: 500 }
      )
    }
    
    if (!data) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No summary data found',
          details: `No data found for ${schoolId === 'all' ? 'district-wide' : 'school ' + schoolId}`
        },
        { status: 404 }
      )
    }
    
    // Transform the data to match expected format
    const summary = {
      schoolId: data.school_id,
      schoolName: data.school_name,
      totalStudents: data.total_students || 0,
      totalAbsences: data.total_absent_records || 0,
      absenceRate: data.absence_rate || 0,
      attendanceRate: data.attendance_rate || 0,
      gradeLevelsCount: data.grade_levels_count || 0,
      dateRange: {
        start: data.earliest_date,
        end: data.latest_date
      },
      lastUpdated: new Date().toISOString()
    }
    
    console.log(`✅ Overall summary for ${data.school_name}:`, {
      students: summary.totalStudents,
      absences: summary.totalAbsences,
      absenceRate: summary.absenceRate + '%',
      grades: summary.gradeLevelsCount
    })
    
    return NextResponse.json({
      success: true,
      data: summary
    })
    
  } catch (error) {
    console.error('Error in overall summary API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}