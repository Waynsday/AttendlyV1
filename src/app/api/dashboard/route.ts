/**
 * @fileoverview Secure Dashboard API Route
 * 
 * Implements secure dashboard data access with comprehensive security controls:
 * - Authentication middleware integration
 * - Role-based access control for dashboard metrics
 * - Educational interest validation for aggregated data
 * - Data aggregation with privacy protection
 * - Rate limiting with admin bypass functionality
 * - Comprehensive audit logging for dashboard access
 * 
 * SECURITY REQUIREMENTS:
 * - Aggregated data access requires indirect educational interest minimum
 * - PII aggregation requires direct educational interest
 * - Admin bypass for rate limiting on dashboard endpoints
 * - Audit logging for all dashboard data access
 * - Performance monitoring and caching controls
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  PaginationSchema,
  DateRangeSchema
} from '@/lib/validation/schemas';
import { authMiddleware } from '@/lib/security/auth-middleware';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { 
  createSecureErrorResponse,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  logSecurityEvent,
  ErrorSeverity
} from '@/lib/security/error-handler';

/**
 * GET /api/dashboard - Retrieve dashboard metrics with security controls
 */
export async function GET(request: NextRequest) {
  let authContext: any = null;
  
  try {
    // 1. Rate limiting check with admin bypass
    const userId = request.headers.get('X-User-ID');
    const isAdminBypass = request.headers.get('X-Admin-Override') === 'true';
    
    if (userId && !isAdminBypass) {
      await rateLimiter.checkLimit(userId, request, {
        customLimit: 200, // Higher limit for dashboard (frequent refreshes)
        window: 60000
      });
    }

    // 2. Authentication and authorization
    authContext = await authMiddleware(request);
    
    // 3. Educational interest validation for dashboard access
    if (authContext.educationalInterest === 'NONE') {
      throw new AuthorizationError('Educational interest required for dashboard access', {
        userId: authContext.userId,
        resource: '/api/dashboard',
        requiredPermission: 'READ_DASHBOARD',
        userPermissions: authContext.permissions
      });
    }

    // 4. Permission check
    if (!authContext.permissions.includes('READ_DASHBOARD') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions for dashboard access', {
        userId: authContext.userId,
        resource: '/api/dashboard',
        requiredPermission: 'READ_DASHBOARD',
        userPermissions: authContext.permissions
      });
    }

    // 5. Validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    // Optional date range for historical data
    let dateRange = null;
    if (queryParams.startDate && queryParams.endDate) {
      dateRange = DateRangeSchema.parse({
        startDate: queryParams.startDate,
        endDate: queryParams.endDate
      });
    }

    // Dashboard view type (determines data aggregation level)
    const viewType = queryParams.view || 'overview';
    const validViewTypes = ['overview', 'attendance', 'interventions', 'trends', 'detailed'];
    
    if (!validViewTypes.includes(viewType)) {
      throw new ValidationError('Invalid dashboard view type');
    }

    // 6. Security event logging
    logSecurityEvent({
      type: 'DASHBOARD_ACCESS',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Accessed dashboard view: ${viewType}${dateRange ? `, date range: ${dateRange.startDate} to ${dateRange.endDate}` : ''}${isAdminBypass ? ' [ADMIN_BYPASS]' : ''}`,
      timestamp: new Date()
    });

    // 7. Fetch dashboard data based on educational interest level
    const dashboardData = await fetchDashboardDataSecurely(viewType, dateRange, authContext);

    // 8. Return secure response with appropriate data filtering
    return NextResponse.json({
      success: true,
      data: dashboardData,
      meta: {
        viewType: viewType,
        accessedBy: authContext.employeeId,
        educationalInterest: authContext.educationalInterest,
        dateRange: dateRange,
        dataAggregationLevel: getDataAggregationLevel(authContext.educationalInterest),
        timestamp: new Date().toISOString(),
        cacheExpiry: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minute cache
      }
    });

  } catch (error) {
    // Security event logging for failures
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logSecurityEvent({
        type: 'DASHBOARD_ACCESS_DENIED',
        severity: ErrorSeverity.MEDIUM,
        userId: authContext?.userId || 'unknown',
        ipAddress: request.headers.get('X-Forwarded-For') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        correlationId: request.headers.get('X-Request-ID') || 'unknown',
        details: error.message,
        timestamp: new Date()
      });
    }

    const errorResponse = createSecureErrorResponse(error as Error, {
      userId: authContext?.userId || 'unknown',
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    });

    const statusCode = error instanceof AuthenticationError ? 401 : 
                      error instanceof AuthorizationError ? 403 :
                      error instanceof ValidationError ? 400 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * POST /api/dashboard/refresh - Force refresh dashboard data (admin only)
 */
export async function POST(request: NextRequest) {
  let authContext: any = null;
  
  try {
    // 1. Strict rate limiting for refresh operations
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 5, // Very low limit for refresh operations
        window: 300000 // 5 minute window
      });
    }

    // 2. Authentication and authorization
    authContext = await authMiddleware(request);
    
    // 3. Check admin permissions for cache refresh
    if (authContext.role !== 'ADMINISTRATOR' && 
        !authContext.permissions.includes('REFRESH_DASHBOARD')) {
      throw new AuthorizationError('Only administrators can refresh dashboard cache', {
        userId: authContext.userId,
        resource: '/api/dashboard/refresh',
        requiredPermission: 'REFRESH_DASHBOARD',
        userPermissions: authContext.permissions
      });
    }

    // 4. Parse request body for refresh parameters
    const body = await request.json();
    const refreshScope = body.scope || 'all'; // 'all', 'attendance', 'interventions'
    const validScopes = ['all', 'attendance', 'interventions', 'students'];
    
    if (!validScopes.includes(refreshScope)) {
      throw new ValidationError('Invalid refresh scope');
    }

    // 5. Critical security event logging
    logSecurityEvent({
      type: 'DASHBOARD_CACHE_REFRESH',
      severity: ErrorSeverity.MEDIUM,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Dashboard cache refresh initiated: scope=${refreshScope}`,
      timestamp: new Date()
    });

    // 6. Perform cache refresh
    const refreshResult = await refreshDashboardCache(refreshScope, authContext);

    // 7. Return secure response
    return NextResponse.json({
      success: true,
      data: refreshResult,
      meta: {
        refreshedBy: authContext.employeeId,
        scope: refreshScope,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorResponse = createSecureErrorResponse(error as Error, {
      userId: authContext?.userId || 'unknown',
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    });

    const statusCode = error instanceof AuthenticationError ? 401 : 
                      error instanceof AuthorizationError ? 403 :
                      error instanceof ValidationError ? 400 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * Fetch dashboard data with appropriate aggregation based on educational interest
 */
async function fetchDashboardDataSecurely(viewType: string, dateRange: any, authContext: any) {
  const aggregationLevel = getDataAggregationLevel(authContext.educationalInterest);
  
  switch (viewType) {
    case 'overview':
      return fetchOverviewMetrics(aggregationLevel, dateRange, authContext);
    
    case 'attendance':
      return fetchAttendanceMetrics(aggregationLevel, dateRange, authContext);
    
    case 'interventions':
      return fetchInterventionMetrics(aggregationLevel, dateRange, authContext);
    
    case 'trends':
      return fetchTrendMetrics(aggregationLevel, dateRange, authContext);
    
    case 'detailed':
      // Detailed view requires direct educational interest
      if (authContext.educationalInterest !== 'DIRECT' && 
          authContext.educationalInterest !== 'ADMINISTRATIVE') {
        throw new AuthorizationError('Direct educational interest required for detailed dashboard view');
      }
      return fetchDetailedMetrics(aggregationLevel, dateRange, authContext);
    
    default:
      throw new ValidationError('Invalid dashboard view type');
  }
}

/**
 * Determine data aggregation level based on educational interest
 */
function getDataAggregationLevel(educationalInterest: string): string {
  switch (educationalInterest) {
    case 'DIRECT':
    case 'ADMINISTRATIVE':
      return 'individual'; // Can see individual student data
    
    case 'INDIRECT':
      return 'aggregated'; // Only aggregated/statistical data
    
    default:
      return 'public'; // Only public/general metrics
  }
}

/**
 * Mock implementations for dashboard data fetching
 */
async function fetchOverviewMetrics(aggregationLevel: string, dateRange: any, authContext: any) {
  const baseMetrics = {
    totalStudents: aggregationLevel === 'public' ? null : 1247,
    schoolYear: '2024-2025',
    lastUpdated: new Date(),
    dataAggregationLevel: aggregationLevel
  };

  if (aggregationLevel === 'individual') {
    return {
      ...baseMetrics,
      attendanceOverview: {
        averageAttendanceRate: 87.3,
        chronicAbsenteeCount: 23,
        tardyRate: 12.1,
        trendDirection: 'improving'
      },
      interventionOverview: {
        activeInterventions: 15,
        completedThisMonth: 8,
        pendingReview: 3,
        mostCommonType: 'PARENT_CONTACT'
      },
      alertsAndNotifications: [
        {
          type: 'ATTENDANCE_ALERT',
          severity: 'HIGH',
          count: 5,
          message: '5 students with chronic absenteeism require attention'
        }
      ]
    };
  }

  if (aggregationLevel === 'aggregated') {
    return {
      ...baseMetrics,
      attendanceTrends: {
        averageAttendanceRate: 87.3,
        trendDirection: 'improving',
        monthlyComparison: [
          { month: 'Sept', rate: 85.2 },
          { month: 'Oct', rate: 86.8 },
          { month: 'Nov', rate: 87.3 }
        ]
      },
      interventionSummary: {
        totalInterventions: 156,
        successRate: 73.2,
        averageResolutionTime: '12 days'
      }
    };
  }

  // Public aggregation level
  return {
    ...baseMetrics,
    publicMetrics: {
      schoolAttendanceGoal: 90.0,
      currentProgress: 'On Track',
      lastReportDate: new Date()
    }
  };
}

async function fetchAttendanceMetrics(aggregationLevel: string, dateRange: any, authContext: any) {
  if (aggregationLevel === 'individual') {
    return {
      dataType: 'attendance',
      aggregationLevel: aggregationLevel,
      metrics: {
        dailyAttendance: [
          { date: '2024-01-15', present: 1198, absent: 49, tardy: 23 },
          { date: '2024-01-16', present: 1205, absent: 42, tardy: 18 }
        ],
        chronicallyAbsentStudents: [
          { studentId: 'STU001', absenceRate: 15.2, daysAbsent: 12 },
          { studentId: 'STU045', absenceRate: 18.7, daysAbsent: 15 }
        ],
        attendanceByGrade: {
          grade6: { rate: 88.5, count: 415 },
          grade7: { rate: 86.2, count: 423 },
          grade8: { rate: 87.1, count: 409 }
        }
      }
    };
  }

  // Aggregated data only
  return {
    dataType: 'attendance',
    aggregationLevel: aggregationLevel,
    metrics: {
      overallAttendanceRate: 87.3,
      trendData: [
        { period: 'Week 1', rate: 86.8 },
        { period: 'Week 2', rate: 87.1 },
        { period: 'Week 3', rate: 87.5 }
      ],
      gradeComparison: {
        grade6: 88.5,
        grade7: 86.2,
        grade8: 87.1
      }
    }
  };
}

async function fetchInterventionMetrics(aggregationLevel: string, dateRange: any, authContext: any) {
  if (aggregationLevel === 'individual') {
    return {
      dataType: 'interventions',
      aggregationLevel: aggregationLevel,
      metrics: {
        activeInterventions: [
          {
            id: 'INT001',
            studentId: 'STU001',
            type: 'PARENT_CONTACT',
            status: 'SCHEDULED',
            scheduledDate: '2024-01-18'
          }
        ],
        recentCompletions: [
          {
            id: 'INT002',
            studentId: 'STU002',
            type: 'COUNSELOR_REFERRAL',
            status: 'COMPLETED',
            outcome: 'Successful resolution'
          }
        ],
        interventionsByType: {
          PARENT_CONTACT: 45,
          COUNSELOR_REFERRAL: 23,
          ATTENDANCE_CONTRACT: 12,
          SART_REFERRAL: 8,
          SARB_REFERRAL: 3
        }
      }
    };
  }

  // Aggregated data only
  return {
    dataType: 'interventions',
    aggregationLevel: aggregationLevel,
    metrics: {
      totalActiveInterventions: 91,
      successRate: 73.2,
      averageResolutionTime: 12,
      interventionTrends: [
        { month: 'Sept', count: 28 },
        { month: 'Oct', count: 34 },
        { month: 'Nov', count: 29 }
      ]
    }
  };
}

async function fetchTrendMetrics(aggregationLevel: string, dateRange: any, authContext: any) {
  return {
    dataType: 'trends',
    aggregationLevel: aggregationLevel,
    metrics: {
      attendanceTrends: {
        direction: 'improving',
        changePercentage: 2.3,
        projectedRate: 88.1
      },
      interventionTrends: {
        direction: 'stable',
        changePercentage: -0.5,
        resolutionImprovement: 8.2
      },
      seasonalPatterns: {
        fallTrend: 'declining',
        winterTrend: 'stable',
        springProjection: 'improving'
      }
    }
  };
}

async function fetchDetailedMetrics(aggregationLevel: string, dateRange: any, authContext: any) {
  // This requires direct educational interest
  return {
    dataType: 'detailed',
    aggregationLevel: aggregationLevel,
    warning: 'This view contains individual student data and requires direct educational interest',
    metrics: {
      studentDetails: [
        {
          studentId: 'STU001',
          attendanceRate: 82.3,
          activeInterventions: 2,
          riskLevel: 'moderate',
          lastUpdate: new Date()
        }
      ],
      interventionDetails: [
        {
          interventionId: 'INT001',
          studentId: 'STU001',
          progress: 'on-track',
          nextAction: 'Follow-up scheduled',
          dueDate: new Date()
        }
      ]
    }
  };
}

async function refreshDashboardCache(scope: string, authContext: any) {
  // Mock implementation for cache refresh
  return {
    scope: scope,
    refreshedAt: new Date(),
    cacheExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minute cache
    itemsRefreshed: {
      attendance: scope === 'all' || scope === 'attendance' ? 1247 : 0,
      interventions: scope === 'all' || scope === 'interventions' ? 91 : 0,
      students: scope === 'all' || scope === 'students' ? 1247 : 0
    }
  };
}