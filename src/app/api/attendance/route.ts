/**
 * @fileoverview Secure Attendance API Route
 * 
 * Implements secure attendance data access with comprehensive security controls:
 * - Authentication middleware integration
 * - Role-based access control with educational interest validation
 * - Input validation for attendance records
 * - CSV import security with comprehensive sanitization
 * - Rate limiting enforcement
 * - Comprehensive audit logging for FERPA compliance
 * 
 * SECURITY REQUIREMENTS:
 * - Educational interest required for attendance data access
 * - CSV import validation prevents malicious data injection
 * - Audit logging for all attendance data access
 * - Rate limiting to prevent DoS attacks on sensitive operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  AttendanceRecordSchema, 
  AttendanceRecordCreateSchema, 
  AttendanceRecordUpdateSchema,
  CSVAttendanceImportSchema,
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
 * GET /api/attendance - Retrieve attendance records with security controls
 */
export async function GET(request: NextRequest) {
  let authContext: any = null;
  
  try {
    // 1. Rate limiting check
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request);
    }

    // 2. Authentication and authorization
    authContext = await authMiddleware(request);
    
    // 3. Educational interest validation for attendance data
    if (authContext.educationalInterest === 'NONE') {
      throw new AuthorizationError('Educational interest required for attendance data access', {
        userId: authContext.userId,
        resource: '/api/attendance',
        requiredPermission: 'READ_ATTENDANCE',
        userPermissions: authContext.permissions
      });
    }

    // 4. Permission check
    if (!authContext.permissions.includes('READ_ATTENDANCE') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions for attendance data access', {
        userId: authContext.userId,
        resource: '/api/attendance',
        requiredPermission: 'READ_ATTENDANCE',
        userPermissions: authContext.permissions
      });
    }

    // 5. Validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const paginationParams = PaginationSchema.parse({
      page: queryParams.page || '1',
      limit: queryParams.limit || '20',
      sortBy: queryParams.sortBy || 'date',
      sortOrder: queryParams.sortOrder || 'desc'
    });

    // Optional date range filtering
    let dateRange = null;
    if (queryParams.startDate && queryParams.endDate) {
      dateRange = DateRangeSchema.parse({
        startDate: queryParams.startDate,
        endDate: queryParams.endDate
      });
    }

    // 6. Security event logging
    logSecurityEvent({
      type: 'ATTENDANCE_DATA_ACCESS',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Accessed attendance data with pagination: ${JSON.stringify(paginationParams)}${dateRange ? `, date range: ${dateRange.startDate} to ${dateRange.endDate}` : ''}`,
      timestamp: new Date()
    });

    // 7. Fetch attendance data
    const attendanceRecords = await fetchAttendanceSecurely(paginationParams, dateRange, authContext);

    // 8. Return secure response
    return NextResponse.json({
      success: true,
      data: attendanceRecords,
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: attendanceRecords.length,
        hasMore: attendanceRecords.length === paginationParams.limit
      },
      meta: {
        accessedBy: authContext.employeeId,
        educationalInterest: authContext.educationalInterest,
        dateRange: dateRange,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // Security event logging for failures
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logSecurityEvent({
        type: 'ATTENDANCE_DATA_ACCESS_DENIED',
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
 * POST /api/attendance - Create attendance record or bulk import
 */
export async function POST(request: NextRequest) {
  let authContext: any = null;
  
  try {
    // 1. Rate limiting check (stricter for POST operations)
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 30, // Lower limit for attendance creation
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    authContext = await authMiddleware(request);
    
    // 3. Check create permissions
    if (!authContext.permissions.includes('CREATE_ATTENDANCE') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions to create attendance records', {
        userId: authContext.userId,
        resource: '/api/attendance',
        requiredPermission: 'CREATE_ATTENDANCE',
        userPermissions: authContext.permissions
      });
    }

    // 4. Determine if this is a bulk import or single record
    const contentType = request.headers.get('Content-Type') || '';
    const isBulkImport = contentType.includes('multipart/form-data') || 
                        request.headers.get('X-Bulk-Import') === 'true';

    if (isBulkImport) {
      return await handleBulkAttendanceImport(request, authContext);
    } else {
      return await handleSingleAttendanceCreate(request, authContext);
    }

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
 * Handle single attendance record creation
 */
async function handleSingleAttendanceCreate(request: NextRequest, authContext: any) {
  // 1. Parse and validate request body
  const body = await request.json();
  const validatedData = AttendanceRecordCreateSchema.parse(body);

  // 2. Security event logging
  logSecurityEvent({
    type: 'ATTENDANCE_RECORD_CREATION',
    severity: ErrorSeverity.LOW,
    userId: authContext.userId,
    employeeId: authContext.employeeId,
    ipAddress: authContext.ipAddress,
    correlationId: request.headers.get('X-Request-ID') || 'unknown',
    details: `Creating attendance record for student: ${validatedData.studentId}, date: ${validatedData.date}`,
    timestamp: new Date()
  });

  // 3. Create attendance record
  const newRecord = await createAttendanceRecordSecurely(validatedData, authContext);

  // 4. Return secure response
  return NextResponse.json({
    success: true,
    data: newRecord,
    meta: {
      createdBy: authContext.employeeId,
      timestamp: new Date().toISOString()
    }
  }, { status: 201 });
}

/**
 * Handle bulk attendance import with comprehensive security validation
 */
async function handleBulkAttendanceImport(request: NextRequest, authContext: any) {
  try {
    // 1. Additional rate limiting for bulk operations
    await rateLimiter.checkLimit(authContext.userId, request, { 
      customLimit: 5, // Very strict for bulk imports
      window: 300000 // 5 minute window
    });

    // 2. Check bulk import permissions
    if (!authContext.permissions.includes('BULK_IMPORT_ATTENDANCE') && 
        authContext.role !== 'ADMINISTRATOR') {
      throw new AuthorizationError('Bulk attendance import requires administrator privileges', {
        userId: authContext.userId,
        resource: '/api/attendance/bulk',
        requiredPermission: 'BULK_IMPORT_ATTENDANCE',
        userPermissions: authContext.permissions
      });
    }

    // 3. Parse multipart form data (mock implementation)
    const csvData = await extractCSVFromRequest(request);
    
    if (!csvData || csvData.length === 0) {
      throw new ValidationError('CSV file is required for bulk import');
    }

    // 4. Validate CSV size limits
    if (csvData.length > 10000) { // Max 10,000 records per import
      throw new ValidationError('CSV file exceeds maximum size limit (10,000 records)');
    }

    // 5. Critical security event logging for bulk import
    logSecurityEvent({
      type: 'BULK_ATTENDANCE_IMPORT_INITIATED',
      severity: ErrorSeverity.HIGH,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `CRITICAL: Bulk attendance import initiated with ${csvData.length} records`,
      timestamp: new Date()
    });

    // 6. Validate each CSV row with security filters
    const validatedRecords = [];
    const validationErrors = [];

    for (let i = 0; i < csvData.length; i++) {
      try {
        const validatedRecord = CSVAttendanceImportSchema.parse(csvData[i]);
        validatedRecords.push(validatedRecord);
      } catch (validationError) {
        validationErrors.push({
          row: i + 1,
          error: validationError instanceof Error ? validationError.message : String(validationError),
          data: csvData[i]
        });
      }
    }

    // 7. Report validation failures
    if (validationErrors.length > 0) {
      logSecurityEvent({
        type: 'BULK_IMPORT_VALIDATION_FAILURES',
        severity: ErrorSeverity.MEDIUM,
        userId: authContext.userId,
        correlationId: request.headers.get('X-Request-ID') || 'unknown',
        details: `Validation failures in bulk import: ${validationErrors.length} errors`,
        timestamp: new Date()
      });

      return NextResponse.json({
        success: false,
        message: 'CSV validation failed',
        validationErrors: validationErrors.slice(0, 100), // Limit error reporting
        validRecords: validatedRecords.length,
        totalRecords: csvData.length
      }, { status: 400 });
    }

    // 8. Process bulk import
    const importResult = await processBulkAttendanceImport(validatedRecords, authContext);

    // 9. Log successful import
    logSecurityEvent({
      type: 'BULK_ATTENDANCE_IMPORT_COMPLETED',
      severity: ErrorSeverity.MEDIUM,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Bulk import completed: ${importResult.imported} records imported successfully`,
      timestamp: new Date()
    });

    // 10. Return secure response
    return NextResponse.json({
      success: true,
      data: importResult,
      meta: {
        importedBy: authContext.employeeId,
        timestamp: new Date().toISOString(),
        totalRecords: csvData.length,
        importedRecords: importResult.imported
      }
    }, { status: 201 });

  } catch (error) {
    // Log bulk import failures
    logSecurityEvent({
      type: 'BULK_ATTENDANCE_IMPORT_FAILED',
      severity: ErrorSeverity.HIGH,
      userId: authContext.userId,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Bulk import failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date()
    });

    throw error;
  }
}

/**
 * PUT /api/attendance/[id] - Update attendance record
 */
export async function PUT(request: NextRequest) {
  let authContext: any = null;
  
  try {
    // 1. Rate limiting check
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 40, // Moderate limit for updates
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    authContext = await authMiddleware(request);
    
    // 3. Check update permissions
    if (!authContext.permissions.includes('UPDATE_ATTENDANCE') && 
        !authContext.permissions.includes('*')) {
      throw new AuthorizationError('Insufficient permissions to update attendance records', {
        userId: authContext.userId,
        resource: '/api/attendance',
        requiredPermission: 'UPDATE_ATTENDANCE',
        userPermissions: authContext.permissions
      });
    }

    // 4. Extract record ID from URL
    const url = new URL(request.url);
    const recordId = url.pathname.split('/').pop();
    
    if (!recordId) {
      throw new ValidationError('Attendance record ID is required for update');
    }

    // 5. Parse and validate request body
    const body = await request.json();
    const validatedData = AttendanceRecordUpdateSchema.parse(body);

    // 6. Security event logging
    logSecurityEvent({
      type: 'ATTENDANCE_RECORD_UPDATE',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Updating attendance record: ${recordId}`,
      timestamp: new Date()
    });

    // 7. Update attendance record
    const updatedRecord = await updateAttendanceRecordSecurely(recordId, validatedData, authContext);

    // 8. Return secure response
    return NextResponse.json({
      success: true,
      data: updatedRecord,
      meta: {
        updatedBy: authContext.employeeId,
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

// Mock implementations (to be replaced with actual database operations)
async function fetchAttendanceSecurely(params: any, dateRange: any, authContext: any) {
  // Mock implementation - replace with actual database query
  return [
    {
      studentId: 'STU001',
      date: new Date('2024-01-15'),
      schoolYear: '2024-2025',
      periodAttendance: [
        { period: 1, status: 'PRESENT' },
        { period: 2, status: 'PRESENT' },
        { period: 3, status: 'TARDY' },
        { period: 4, status: 'PRESENT' },
        { period: 5, status: 'PRESENT' },
        { period: 6, status: 'ABSENT' },
        { period: 7, status: 'PRESENT' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
}

async function createAttendanceRecordSecurely(data: any, authContext: any) {
  // Mock implementation - replace with actual database creation
  return {
    ...data,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function updateAttendanceRecordSecurely(id: string, data: any, authContext: any) {
  // Mock implementation - replace with actual database update
  return {
    id,
    ...data,
    updatedAt: new Date()
  };
}

async function extractCSVFromRequest(request: NextRequest): Promise<any[]> {
  // Mock implementation - replace with actual CSV parsing
  // In production, use libraries like 'csv-parser' or 'papaparse'
  return [
    {
      student_id: 'STU001',
      date: '2024-01-15',
      school_year: '2024-2025',
      period_1: 'PRESENT',
      period_2: 'PRESENT',
      period_3: 'TARDY',
      period_4: 'PRESENT',
      period_5: 'PRESENT',
      period_6: 'ABSENT',
      period_7: 'PRESENT'
    }
  ];
}

async function processBulkAttendanceImport(records: any[], authContext: any) {
  // Mock implementation - replace with actual bulk database operations
  return {
    imported: records.length,
    failed: 0,
    duplicates: 0
  };
}