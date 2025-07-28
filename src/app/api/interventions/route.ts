/**
 * @fileoverview Secure Interventions API Route
 * 
 * Implements secure intervention data access with comprehensive security controls:
 * - Authentication middleware integration
 * - Role-based access control for intervention management
 * - Input validation and sanitization for intervention data
 * - Educational interest validation for student intervention access
 * - Rate limiting enforcement
 * - Comprehensive audit logging for intervention tracking
 * 
 * SECURITY REQUIREMENTS:
 * - Educational interest required for student intervention access
 * - Input validation prevents injection attacks in descriptions
 * - Audit logging for all intervention actions (FERPA compliance)
 * - Rate limiting to prevent DoS attacks
 * - Proper authorization for intervention creation and updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  InterventionSchema, 
  InterventionCreateSchema, 
  InterventionUpdateSchema,
  PaginationSchema
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
 * GET /api/interventions - Retrieve interventions with security controls
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Rate limiting check
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request);
    }

    // 2. Authentication and authorization
    const authContext = await authMiddleware(request);
    
    // 3. Educational interest validation for intervention data
    if (authContext.educationalInterest === 'NONE') {
      throw new AuthorizationError('Educational interest required for intervention data access', {
        userId: authContext.userId,
        resource: '/api/interventions',
        requiredPermission: 'READ_INTERVENTIONS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Permission check
    if (!authContext.permissions.includes('READ_INTERVENTIONS') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions for intervention data access', {
        userId: authContext.userId,
        resource: '/api/interventions',
        requiredPermission: 'READ_INTERVENTIONS',
        userPermissions: authContext.permissions
      });
    }

    // 5. Validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const paginationParams = PaginationSchema.parse({
      page: queryParams.page || '1',
      limit: queryParams.limit || '20',
      sortBy: queryParams.sortBy || 'scheduledDate',
      sortOrder: queryParams.sortOrder || 'desc'
    });

    // Optional filtering by student ID or intervention type
    const filters = {
      studentId: queryParams.studentId,
      type: queryParams.type,
      status: queryParams.status,
      createdBy: queryParams.createdBy
    };

    // 6. Security event logging
    logSecurityEvent({
      type: 'INTERVENTION_DATA_ACCESS',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Accessed intervention data with pagination: ${JSON.stringify(paginationParams)}, filters: ${JSON.stringify(filters)}`,
      timestamp: new Date()
    });

    // 7. Fetch intervention data
    const interventions = await fetchInterventionsSecurely(paginationParams, filters, authContext);

    // 8. Return secure response
    return NextResponse.json({
      success: true,
      data: interventions,
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: interventions.length,
        hasMore: interventions.length === paginationParams.limit
      },
      meta: {
        accessedBy: authContext.employeeId,
        educationalInterest: authContext.educationalInterest,
        filters: filters,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // Security event logging for failures
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logSecurityEvent({
        type: 'INTERVENTION_DATA_ACCESS_DENIED',
        severity: ErrorSeverity.MEDIUM,
        userId: userId || 'unknown',
        ipAddress: request.headers.get('X-Forwarded-For') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        correlationId: request.headers.get('X-Request-ID') || 'unknown',
        details: error.message,
        timestamp: new Date()
      });
    }

    const errorResponse = createSecureErrorResponse(error as Error, {
      userId: userId || 'unknown',
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    });

    const statusCode = error instanceof AuthenticationError ? 401 : 
                      error instanceof AuthorizationError ? 403 :
                      error instanceof ValidationError ? 400 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * POST /api/interventions - Create new intervention with security validation
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting check (moderate for intervention creation)
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 25, // Moderate limit for intervention creation
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    const authContext = await authMiddleware(request);
    
    // 3. Check create permissions
    if (!authContext.permissions.includes('CREATE_INTERVENTIONS') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions to create interventions', {
        userId: authContext.userId,
        resource: '/api/interventions',
        requiredPermission: 'CREATE_INTERVENTIONS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Parse and validate request body
    const body = await request.json();
    
    // Ensure createdBy field matches authenticated user (security control)
    const interventionData = {
      ...body,
      createdBy: authContext.employeeId // Override with authenticated user ID
    };
    
    const validatedData = InterventionCreateSchema.parse(interventionData);

    // 5. Additional validation: verify user has educational interest in the student
    if (authContext.educationalInterest === 'NONE') {
      throw new AuthorizationError('Educational interest required to create interventions for students', {
        userId: authContext.userId,
        resource: `/api/interventions/student/${validatedData.studentId}`,
        requiredPermission: 'CREATE_INTERVENTIONS',
        userPermissions: authContext.permissions
      });
    }

    // 6. Security event logging
    logSecurityEvent({
      type: 'INTERVENTION_CREATION',
      severity: ErrorSeverity.MEDIUM,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Creating intervention for student: ${validatedData.studentId}, type: ${validatedData.type}`,
      timestamp: new Date()
    });

    // 7. Create intervention record
    const newIntervention = await createInterventionSecurely(validatedData, authContext);

    // 8. Return secure response
    return NextResponse.json({
      success: true,
      data: newIntervention,
      meta: {
        createdBy: authContext.employeeId,
        timestamp: new Date().toISOString()
      }
    }, { status: 201 });

  } catch (error) {
    // Log security events for failures
    if (error instanceof ValidationError) {
      logSecurityEvent({
        type: 'INVALID_INTERVENTION_DATA_SUBMISSION',
        severity: ErrorSeverity.LOW,
        userId: userId || 'unknown',
        ipAddress: request.headers.get('X-Forwarded-For') || 'unknown',
        correlationId: request.headers.get('X-Request-ID') || 'unknown',
        details: `Validation failed: ${error.message}`,
        timestamp: new Date()
      });
    }

    const errorResponse = createSecureErrorResponse(error as Error, {
      userId: userId || 'unknown',
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    });

    const statusCode = error instanceof AuthenticationError ? 401 : 
                      error instanceof AuthorizationError ? 403 :
                      error instanceof ValidationError ? 400 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * PUT /api/interventions/[id] - Update intervention with security validation
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. Rate limiting check
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 35, // Moderate limit for updates
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    const authContext = await authMiddleware(request);
    
    // 3. Check update permissions
    if (!authContext.permissions.includes('UPDATE_INTERVENTIONS') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions to update interventions', {
        userId: authContext.userId,
        resource: '/api/interventions',
        requiredPermission: 'UPDATE_INTERVENTIONS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Extract intervention ID from URL
    const url = new URL(request.url);
    const interventionId = url.pathname.split('/').pop();
    
    if (!interventionId) {
      throw new ValidationError('Intervention ID is required for update');
    }

    // 5. Verify user has permission to update this specific intervention
    const existingIntervention = await getInterventionById(interventionId);
    
    if (!existingIntervention) {
      throw new ValidationError('Intervention not found');
    }

    // Check if user created the intervention or has admin privileges
    if (existingIntervention.createdBy !== authContext.employeeId && 
        authContext.role !== 'ADMINISTRATOR' && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('You can only update interventions you created', {
        userId: authContext.userId,
        resource: `/api/interventions/${interventionId}`,
        requiredPermission: 'UPDATE_OWN_INTERVENTIONS'
      });
    }

    // 6. Parse and validate request body
    const body = await request.json();
    const validatedData = InterventionUpdateSchema.parse(body);

    // 7. Security event logging
    logSecurityEvent({
      type: 'INTERVENTION_UPDATE',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Updating intervention: ${interventionId}${validatedData.status ? `, status: ${validatedData.status}` : ''}`,
      timestamp: new Date()
    });

    // 8. Update intervention record
    const updatedIntervention = await updateInterventionSecurely(interventionId, validatedData, authContext);

    // 9. Return secure response
    return NextResponse.json({
      success: true,
      data: updatedIntervention,
      meta: {
        updatedBy: authContext.employeeId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorResponse = createSecureErrorResponse(error as Error, {
      userId: userId || 'unknown',
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    });

    const statusCode = error instanceof AuthenticationError ? 401 : 
                      error instanceof AuthorizationError ? 403 :
                      error instanceof ValidationError ? 400 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * DELETE /api/interventions/[id] - Delete intervention with strict security validation
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Rate limiting check (strict for deletes)
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 10, // Very low limit for deletion operations
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    const authContext = await authMiddleware(request);
    
    // 3. Check delete permissions (only certain roles can delete interventions)
    if (!authContext.permissions.includes('DELETE_INTERVENTIONS') && 
        authContext.role !== 'ADMINISTRATOR' &&
        authContext.role !== 'ASSISTANT_PRINCIPAL') {
      throw new AuthorizationError('Insufficient privileges to delete interventions', {
        userId: authContext.userId,
        resource: '/api/interventions',
        requiredPermission: 'DELETE_INTERVENTIONS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Extract intervention ID from URL
    const url = new URL(request.url);
    const interventionId = url.pathname.split('/').pop();
    
    if (!interventionId) {
      throw new ValidationError('Intervention ID is required for deletion');
    }

    // 5. Verify intervention exists and get details for audit logging
    const existingIntervention = await getInterventionById(interventionId);
    
    if (!existingIntervention) {
      throw new ValidationError('Intervention not found');
    }

    // 6. Critical security event logging
    logSecurityEvent({
      type: 'INTERVENTION_DELETION',
      severity: ErrorSeverity.HIGH,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `CRITICAL: Deleting intervention: ${interventionId}, student: ${existingIntervention.studentId}, type: ${existingIntervention.type}`,
      timestamp: new Date()
    });

    // 7. Delete intervention record (or soft delete for audit trail)
    await deleteInterventionSecurely(interventionId, authContext);

    // 8. Return secure response
    return NextResponse.json({
      success: true,
      message: 'Intervention deleted successfully',
      meta: {
        deletedBy: authContext.employeeId,
        timestamp: new Date().toISOString(),
        interventionId: interventionId,
        studentId: existingIntervention.studentId
      }
    });

  } catch (error) {
    const errorResponse = createSecureErrorResponse(error as Error, {
      userId: userId || 'unknown',
      requestId: request.headers.get('X-Request-ID') || 'unknown'
    });

    const statusCode = error instanceof AuthenticationError ? 401 : 
                      error instanceof AuthorizationError ? 403 :
                      error instanceof ValidationError ? 400 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

// Mock implementations (to be replaced with actual database operations)
async function fetchInterventionsSecurely(params: any, filters: any, authContext: any) {
  // Mock implementation - replace with actual database query
  const mockInterventions = [
    {
      id: 'INT001',
      studentId: 'STU001',
      type: 'PARENT_CONTACT',
      description: 'Contacted parent regarding attendance concerns',
      createdBy: 'T001',
      scheduledDate: new Date('2024-01-15'),
      status: 'COMPLETED',
      completedDate: new Date('2024-01-15'),
      outcome: 'Parent agreed to monitor morning routine',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Apply filters
  let filteredInterventions = mockInterventions;
  
  if (filters.studentId) {
    filteredInterventions = filteredInterventions.filter(i => i.studentId === filters.studentId);
  }
  
  if (filters.type) {
    filteredInterventions = filteredInterventions.filter(i => i.type === filters.type);
  }
  
  if (filters.status) {
    filteredInterventions = filteredInterventions.filter(i => i.status === filters.status);
  }
  
  if (filters.createdBy) {
    filteredInterventions = filteredInterventions.filter(i => i.createdBy === filters.createdBy);
  }

  return filteredInterventions;
}

async function createInterventionSecurely(data: any, authContext: any) {
  // Mock implementation - replace with actual database creation
  return {
    id: 'INT' + Date.now(),
    ...data,
    status: 'SCHEDULED', // Default status
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function updateInterventionSecurely(id: string, data: any, authContext: any) {
  // Mock implementation - replace with actual database update
  return {
    id,
    ...data,
    updatedAt: new Date()
  };
}

async function getInterventionById(id: string) {
  // Mock implementation - replace with actual database query
  return {
    id: id,
    studentId: 'STU001',
    type: 'PARENT_CONTACT',
    description: 'Mock intervention',
    createdBy: 'T001',
    scheduledDate: new Date(),
    status: 'SCHEDULED',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function deleteInterventionSecurely(id: string, authContext: any) {
  // Mock implementation - replace with actual database deletion or soft delete
  // In production, consider soft delete for audit trail
  return true;
}