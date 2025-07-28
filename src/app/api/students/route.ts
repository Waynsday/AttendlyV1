/**
 * @fileoverview Secure Students API Route
 * 
 * Implements secure student data access with comprehensive security controls:
 * - Authentication middleware integration
 * - Role-based access control with FERPA compliance
 * - Input validation using Zod schemas
 * - Rate limiting enforcement
 * - Comprehensive audit logging
 * - Error handling with information disclosure protection
 * 
 * SECURITY REQUIREMENTS:
 * - All student data access requires direct educational interest
 * - Input validation prevents injection attacks
 * - Audit logging for all access attempts
 * - Rate limiting to prevent DoS attacks
 * - Proper error handling to prevent information leakage
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  StudentSchema, 
  StudentCreateSchema, 
  StudentUpdateSchema, 
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
 * GET /api/students - Retrieve students with security controls
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
    
    // 3. Educational interest validation for student data
    if (authContext.educationalInterest !== 'DIRECT' && 
        authContext.educationalInterest !== 'ADMINISTRATIVE') {
      throw new AuthorizationError('Direct educational interest required for student data access', {
        userId: authContext.userId,
        resource: '/api/students',
        requiredPermission: 'READ_STUDENT_PII',
        userPermissions: authContext.permissions
      });
    }

    // 4. Permission check
    if (!authContext.permissions.includes('READ_STUDENTS') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions for student data access', {
        userId: authContext.userId,
        resource: '/api/students',
        requiredPermission: 'READ_STUDENTS',
        userPermissions: authContext.permissions
      });
    }

    // 5. Validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const paginationParams = PaginationSchema.parse({
      page: queryParams.page || '1',
      limit: queryParams.limit || '20',
      sortBy: queryParams.sortBy,
      sortOrder: queryParams.sortOrder || 'asc'
    });

    // 6. Security event logging
    logSecurityEvent({
      type: 'STUDENT_DATA_ACCESS',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Accessed student list with pagination: ${JSON.stringify(paginationParams)}`,
      timestamp: new Date()
    });

    // 7. Fetch student data (mock implementation for now)
    const students = await fetchStudentsSecurely(paginationParams, authContext);

    // 8. Return secure response
    return NextResponse.json({
      success: true,
      data: students,
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: students.length,
        hasMore: students.length === paginationParams.limit
      },
      meta: {
        accessedBy: authContext.employeeId,
        educationalInterest: authContext.educationalInterest,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // Security event logging for failures
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logSecurityEvent({
        type: 'STUDENT_DATA_ACCESS_DENIED',
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
      requestId: request.headers.get('X-Request-ID') || 'unknown',
      ipAddress: request.headers.get('X-Forwarded-For') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown'
    });

    const statusCode = error instanceof AuthenticationError ? 401 : 
                      error instanceof AuthorizationError ? 403 :
                      error instanceof ValidationError ? 400 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * POST /api/students - Create new student with security validation
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting check (stricter for POST operations)
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 20, // Lower limit for creation operations
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    const authContext = await authMiddleware(request);
    
    // 3. Check create permissions
    if (!authContext.permissions.includes('CREATE_STUDENTS') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions to create students', {
        userId: authContext.userId,
        resource: '/api/students',
        requiredPermission: 'CREATE_STUDENTS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const validatedData = StudentCreateSchema.parse(body);

    // 5. Security event logging
    logSecurityEvent({
      type: 'STUDENT_RECORD_CREATION',
      severity: ErrorSeverity.MEDIUM,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Creating student record for ID: ${validatedData.id}`,
      timestamp: new Date()
    });

    // 6. Create student record (mock implementation for now)
    const newStudent = await createStudentSecurely(validatedData, authContext);

    // 7. Return secure response
    return NextResponse.json({
      success: true,
      data: newStudent,
      meta: {
        createdBy: authContext.employeeId,
        timestamp: new Date().toISOString()
      }
    }, { status: 201 });

  } catch (error) {
    // Log security events for failures
    if (error instanceof ValidationError) {
      logSecurityEvent({
        type: 'INVALID_STUDENT_DATA_SUBMISSION',
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
 * PUT /api/students/[id] - Update student with security validation
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. Rate limiting check
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 30, // Moderate limit for updates
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    const authContext = await authMiddleware(request);
    
    // 3. Check update permissions
    if (!authContext.permissions.includes('UPDATE_STUDENTS') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions to update students', {
        userId: authContext.userId,
        resource: '/api/students',
        requiredPermission: 'UPDATE_STUDENTS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Extract student ID from URL
    const url = new URL(request.url);
    const studentId = url.pathname.split('/').pop();
    
    if (!studentId) {
      throw new ValidationError('Student ID is required for update');
    }

    // 5. Parse and validate request body
    const body = await request.json();
    const validatedData = StudentUpdateSchema.parse(body);

    // 6. Security event logging
    logSecurityEvent({
      type: 'STUDENT_RECORD_UPDATE',
      severity: ErrorSeverity.MEDIUM,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Updating student record: ${studentId}`,
      timestamp: new Date()
    });

    // 7. Update student record (mock implementation for now)
    const updatedStudent = await updateStudentSecurely(studentId, validatedData, authContext);

    // 8. Return secure response
    return NextResponse.json({
      success: true,
      data: updatedStudent,
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
 * DELETE /api/students/[id] - Delete student with strict security validation
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Rate limiting check (very strict for deletes)
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 5, // Very low limit for deletion operations
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    const authContext = await authMiddleware(request);
    
    // 3. Check delete permissions (only administrators should delete)
    if (authContext.role !== 'ADMINISTRATOR' && !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Only administrators can delete student records', {
        userId: authContext.userId,
        resource: '/api/students',
        requiredPermission: 'DELETE_STUDENTS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Extract student ID from URL
    const url = new URL(request.url);
    const studentId = url.pathname.split('/').pop();
    
    if (!studentId) {
      throw new ValidationError('Student ID is required for deletion');
    }

    // 5. Critical security event logging
    logSecurityEvent({
      type: 'STUDENT_RECORD_DELETION',
      severity: ErrorSeverity.HIGH,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `CRITICAL: Deleting student record: ${studentId}`,
      timestamp: new Date()
    });

    // 6. Delete student record (mock implementation for now)
    await deleteStudentSecurely(studentId, authContext);

    // 7. Return secure response
    return NextResponse.json({
      success: true,
      message: 'Student record deleted successfully',
      meta: {
        deletedBy: authContext.employeeId,
        timestamp: new Date().toISOString(),
        studentId: studentId
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
async function fetchStudentsSecurely(params: any, authContext: any) {
  // Mock implementation - replace with actual database query
  return [
    {
      id: 'STU001',
      firstName: 'John',
      lastName: 'Doe',
      gradeLevel: 7,
      email: 'john.doe@school.edu',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
}

async function createStudentSecurely(data: any, authContext: any) {
  // Mock implementation - replace with actual database creation
  return {
    ...data,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function updateStudentSecurely(id: string, data: any, authContext: any) {
  // Mock implementation - replace with actual database update
  return {
    id,
    ...data,
    updatedAt: new Date()
  };
}

async function deleteStudentSecurely(id: string, authContext: any) {
  // Mock implementation - replace with actual database deletion
  // In production, this might soft-delete or require additional approvals
  return true;
}