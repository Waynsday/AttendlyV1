/**
 * @fileoverview Attendance Summaries API Route (Optimized)
 * 
 * Provides attendance data aggregated by grade level using efficient
 * SQL queries and the enhanced analytics service
 */

import { NextRequest, NextResponse } from 'next/server'
import { dashboardAnalytics } from '@/lib/services/dashboard-analytics-service'
import { fastDashboardAnalytics } from '@/lib/services/fast-dashboard-analytics'
import { 
  createSecureErrorResponse,
  logSecurityEvent,
  ErrorSeverity
} from '@/lib/security/error-handler'

export async function GET(request: NextRequest) {
  try {
    // 1. Parse query parameters
    const url = new URL(request.url)
    const schoolId = url.searchParams.get('schoolId') || 'all'
    const schoolYear = url.searchParams.get('schoolYear') || '2024'
    const useFast = url.searchParams.get('fast') !== 'false' // Default to fast mode
    
    // 2. Validate parameters - accept both YYYY and YYYY-YYYY formats
    if (schoolYear && !/^\d{4}(-\d{4})?$/.test(schoolYear)) {
      return NextResponse.json(
        { success: false, error: 'Invalid school year format. Use YYYY or YYYY-YYYY' },
        { status: 400 }
      )
    }

    // 3. Choose analytics service based on performance needs
    let analyticsService = dashboardAnalytics
    if (useFast) {
      // Check if fast views exist, fallback to regular if not
      const viewsExist = await fastDashboardAnalytics.checkViewsExist()
      if (viewsExist) {
        analyticsService = fastDashboardAnalytics
        console.log('🚀 Using fast analytics with SQL views')
      } else {
        console.log('⚠️ Views not found, falling back to regular analytics')
      }
    }

    // 4. Get attendance summaries using selected analytics service
    let attendanceData
    let meta
    
    if (schoolId === 'all') {
      // District-wide view
      attendanceData = await analyticsService.getDistrictAttendanceSummaries(schoolYear)
      
      // Get today's metrics for the header
      const todayMetrics = await analyticsService.getTodayAttendanceMetrics()
      
      meta = {
        schoolId: 'all',
        schoolName: 'District-wide',
        schoolYear,
        todayAttendance: todayMetrics,
        timestamp: new Date().toISOString(),
        fastMode: useFast && analyticsService === fastDashboardAnalytics
      }
    } else {
      // School-specific view
      attendanceData = await analyticsService.getSchoolAttendanceSummaries(schoolId, schoolYear)
      
      // Get today's metrics for this school
      const todayMetrics = await analyticsService.getTodayAttendanceMetrics(schoolId)
      
      // Get school name from the database directly if summaries are empty
      let schoolName = attendanceData[0]?.schoolName || 'Unknown School'
      if (schoolName === 'Unknown School') {
        try {
          const { createClient } = await import('@/lib/supabase/server')
          const supabase = await createClient()
          const { data: school } = await supabase
            .from('schools')
            .select('school_name')
            .eq('id', schoolId)
            .single()
          
          if (school) {
            schoolName = school.school_name
          }
        } catch (error) {
          console.warn('Could not fetch school name:', error)
        }
      }
      
      meta = {
        schoolId,
        schoolName,
        schoolYear,
        todayAttendance: todayMetrics,
        timestamp: new Date().toISOString(),
        fastMode: useFast && analyticsService === fastDashboardAnalytics
      }
    }

    // 4. Log successful access (if logging is available)
    try {
      await logSecurityEvent({
        type: 'ATTENDANCE_SUMMARY_ACCESS',
        severity: 'INFO',
        metadata: {
          schoolId,
          schoolYear,
          recordCount: attendanceData.length,
          requestId: request.headers.get('X-Request-ID') || 'unknown'
        }
      })
    } catch (logError) {
      console.warn('Security logging not available:', logError)
    }

    // 5. Return response
    return NextResponse.json({
      success: true,
      data: attendanceData,
      meta
    })

  } catch (error) {
    console.error('Attendance summaries API error:', error)
    
    const errorResponse = createSecureErrorResponse(error as Error, {
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    })

    return NextResponse.json(errorResponse, { status: 500 })
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
      'Access-Control-Allow-Headers': 'Content-Type, X-Request-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}