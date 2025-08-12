/**
 * @fileoverview Schools API Route
 * 
 * Provides secure access to school data for dashboard dropdown population
 * Includes grade levels served and basic school information
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  createSecureErrorResponse,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  logSecurityEvent,
  ErrorSeverity
} from '@/lib/security/error-handler'

export async function GET(request: NextRequest) {
  try {
    // 1. Create Supabase client
    const supabase = await createClient()

    // 2. Query schools with essential information for dropdown
    const { data: schools, error } = await supabase
      .from('schools')
      .select(`
        id,
        school_code,
        school_name,
        school_type,
        grade_levels_served,
        principal_name,
        current_enrollment,
        is_active
      `)
      .eq('is_active', true)
      .order('school_name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      throw new Error('Failed to fetch schools data')
    }

    // 3. Transform data for frontend consumption
    const transformedSchools = schools?.map(school => ({
      id: school.id,
      code: school.school_code,
      name: school.school_name,
      type: school.school_type,
      gradeLevelsServed: school.grade_levels_served || [],
      principalName: school.principal_name,
      enrollment: school.current_enrollment || 0
    })) || []

    // 4. Add district-wide option
    const schoolOptions = [
      {
        id: 'all',
        code: 'ALL',
        name: 'All Schools (District-wide)',
        type: 'DISTRICT',
        gradeLevelsServed: [1, 2, 3, 4, 5, 6, 7, 8],
        principalName: 'District Administration',
        enrollment: transformedSchools.reduce((sum, school) => sum + school.enrollment, 0)
      },
      ...transformedSchools
    ]

    return NextResponse.json({
      success: true,
      data: schoolOptions,
      meta: {
        total: schoolOptions.length - 1, // Exclude "All Schools" from count
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Schools API error:', error)
    
    const errorResponse = createSecureErrorResponse(error as Error, {
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    })

    return NextResponse.json(errorResponse, { status: 500 })
  }
}