/**
 * @fileoverview Aeries Sync API Route
 * 
 * Provides REST API endpoints for managing Aeries SIS data synchronization.
 * Includes comprehensive security controls and audit logging for FERPA compliance.
 * 
 * ENDPOINTS:
 * - GET  /api/aeries/sync - Get sync status and history
 * - POST /api/aeries/sync - Start manual sync operation
 * - PUT  /api/aeries/sync - Update sync configuration
 * - DELETE /api/aeries/sync/{operationId} - Cancel sync operation
 * 
 * SECURITY REQUIREMENTS:
 * - Administrator privileges required for sync operations
 * - All operations must be audited for FERPA compliance
 * - Rate limiting to prevent API abuse
 * - Educational interest validation for data access
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
import { getAeriesSyncService, getAeriesSyncStatus } from '@/infrastructure/external-services/aeries-sync-service';
import { validateAeriesConfiguration } from '@/infrastructure/external-services/aeries-config';

// =====================================================
// Request Validation Schemas
// =====================================================

const SyncRequestSchema = z.object({
  syncType: z.enum(['FULL_SYNC', 'INCREMENTAL_SYNC', 'MANUAL_SYNC']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  schoolCodes: z.array(z.string()).optional(),
  batchSize: z.number().min(1).max(1000).optional(),
  forceRefresh: z.boolean().optional(),
  skipValidation: z.boolean().optional()
});

const SyncQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val)).refine(val => val >= 1 && val <= 100).optional(),
  offset: z.string().transform(val => parseInt(val)).refine(val => val >= 0).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  type: z.enum(['FULL_SYNC', 'INCREMENTAL_SYNC', 'MANUAL_SYNC']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// =====================================================
// GET /api/aeries/sync - Get sync status and history
// =====================================================

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
    
    // 3. Check administrator privileges
    if (authContext.role !== 'admin' && 
        !authContext.permissions.includes('READ_SYNC_OPERATIONS')) {
      throw new AuthorizationError('Administrator privileges required for sync operations', {
        userId: authContext.userId,
        resource: '/api/aeries/sync',
        requiredPermission: 'READ_SYNC_OPERATIONS',
        userPermissions: authContext.permissions
      });
    }

    // 4. Validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validatedQuery = SyncQuerySchema.parse(queryParams);

    // 5. Check Aeries configuration
    const configValid = await validateAeriesConfiguration();
    if (!configValid) {
      throw new Error('Aeries configuration is invalid or incomplete');
    }

    // 6. Get current sync status
    const syncService = getAeriesSyncService();
    const currentStatus = await getAeriesSyncStatus();
    
    // 7. Get sync history
    const syncHistory = await syncService.getSyncHistory(validatedQuery.limit || 20);

    // 8. Filter history based on query parameters
    let filteredHistory = syncHistory;
    
    if (validatedQuery.status) {
      filteredHistory = filteredHistory.filter(op => op.status === validatedQuery.status);
    }
    
    if (validatedQuery.type) {
      filteredHistory = filteredHistory.filter(op => op.type === validatedQuery.type);
    }
    
    if (validatedQuery.dateFrom) {
      const fromDate = new Date(validatedQuery.dateFrom);
      filteredHistory = filteredHistory.filter(op => new Date(op.startTime) >= fromDate);
    }
    
    if (validatedQuery.dateTo) {
      const toDate = new Date(validatedQuery.dateTo);
      filteredHistory = filteredHistory.filter(op => new Date(op.startTime) <= toDate);
    }

    // 9. Apply offset and limit
    const offset = validatedQuery.offset || 0;
    const limit = validatedQuery.limit || 20;
    const paginatedHistory = filteredHistory.slice(offset, offset + limit);

    // 10. Log access
    logSecurityEvent({
      type: 'AERIES_SYNC_STATUS_ACCESSED',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Accessed Aeries sync status and history (${paginatedHistory.length} records)`,
      timestamp: new Date()
    });

    // 11. Return response
    return NextResponse.json({
      success: true,
      data: {
        currentStatus,
        configurationValid: configValid,
        history: paginatedHistory,
        pagination: {
          offset,
          limit,
          total: filteredHistory.length,
          hasMore: (offset + limit) < filteredHistory.length
        }
      },
      meta: {
        accessedBy: authContext.employeeId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // Security event logging for failures
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logSecurityEvent({
        type: 'AERIES_SYNC_ACCESS_DENIED',
        severity: ErrorSeverity.MEDIUM,
        userId: authContext?.userId || 'unknown',
        ipAddress: request.headers.get('X-Forwarded-For') || 'unknown',
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

// =====================================================
// POST /api/aeries/sync - Start manual sync operation
// =====================================================

export async function POST(request: NextRequest) {
  let authContext: any = null;

  try {
    // 1. Strict rate limiting for sync operations
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 5, // Very strict limit for sync operations
        window: 300000  // 5 minute window
      });
    }

    // 2. Authentication and authorization
    authContext = await authMiddleware(request);
    
    // 3. Check administrator privileges (strict requirement for sync)
    if (authContext.role !== 'admin') {
      throw new AuthorizationError('Administrator privileges required to initiate sync operations', {
        userId: authContext.userId,
        resource: '/api/aeries/sync',
        requiredPermission: 'ADMIN',
        userPermissions: authContext.permissions
      });
    }

    // 4. Check Aeries configuration
    const configValid = await validateAeriesConfiguration();
    if (!configValid) {
      throw new Error('Aeries configuration is invalid or incomplete. Please check environment variables and certificates.');
    }

    // 5. Parse and validate request body
    const body = await request.json();
    const validatedOptions = SyncRequestSchema.parse(body);

    // 6. Additional business rule validation
    if (validatedOptions.startDate && validatedOptions.endDate) {
      const startDate = new Date(validatedOptions.startDate);
      const endDate = new Date(validatedOptions.endDate);
      
      if (startDate >= endDate) {
        throw new ValidationError('Start date must be before end date');
      }

      // Check if date range is within school year bounds
      const schoolYearStart = new Date('2024-08-15');
      const schoolYearEnd = new Date('2025-06-12');
      
      if (startDate < schoolYearStart || endDate > schoolYearEnd) {
        throw new ValidationError('Date range must be within school year 2024-2025 (Aug 15, 2024 - June 12, 2025)');
      }
    }

    // 7. Check if sync is already in progress
    const currentStatus = await getAeriesSyncStatus();
    if (currentStatus.isRunning) {
      throw new ValidationError('Sync operation is already in progress. Please wait for completion or cancel the current operation.');
    }

    // 8. Critical security logging for sync initiation
    logSecurityEvent({
      type: 'AERIES_SYNC_INITIATION_REQUESTED',
      severity: ErrorSeverity.HIGH,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `CRITICAL: Aeries sync initiation requested by ${authContext.employeeId} with options: ${JSON.stringify(validatedOptions)}`,
      timestamp: new Date()
    });

    // 9. Start sync operation
    const syncService = getAeriesSyncService();
    const operation = await syncService.startSync(
      validatedOptions,
      authContext.employeeId,
      {
        userAgent: authContext.userAgent,
        ipAddress: authContext.ipAddress
      }
    );

    // 10. Success logging
    logSecurityEvent({
      type: 'AERIES_SYNC_STARTED',
      severity: ErrorSeverity.MEDIUM,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      correlationId: operation.operationId,
      details: `Aeries sync operation started successfully: ${operation.operationId}`,
      timestamp: new Date()
    });

    // 11. Return response
    return NextResponse.json({
      success: true,
      data: {
        operation,
        message: 'Sync operation started successfully',
        estimatedDuration: this.estimateSyncDuration(validatedOptions)
      },
      meta: {
        initiatedBy: authContext.employeeId,
        timestamp: new Date().toISOString(),
        operationId: operation.operationId
      }
    }, { status: 201 });

  } catch (error) {
    // Log sync initiation failures
    logSecurityEvent({
      type: 'AERIES_SYNC_INITIATION_FAILED',
      severity: ErrorSeverity.HIGH,
      userId: authContext?.userId || 'unknown',
      employeeId: authContext?.employeeId || 'unknown',
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Aeries sync initiation failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date()
    });

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

// =====================================================
// DELETE /api/aeries/sync - Cancel sync operation
// =====================================================

export async function DELETE(request: NextRequest) {
  let authContext: any = null;

  try {
    // 1. Rate limiting check
    const userId = request.headers.get('X-User-ID');
    if (userId) {
      await rateLimiter.checkLimit(userId, request, { 
        customLimit: 10, // Moderate limit for cancel operations
        window: 60000 
      });
    }

    // 2. Authentication and authorization
    authContext = await authMiddleware(request);
    
    // 3. Check administrator privileges
    if (authContext.role !== 'admin') {
      throw new AuthorizationError('Administrator privileges required to cancel sync operations', {
        userId: authContext.userId,
        resource: '/api/aeries/sync',
        requiredPermission: 'ADMIN',
        userPermissions: authContext.permissions
      });
    }

    // 4. Get current sync status
    const currentStatus = await getAeriesSyncStatus();
    if (!currentStatus.isRunning) {
      throw new ValidationError('No sync operation is currently running');
    }

    // 5. Cancel sync operation
    const syncService = getAeriesSyncService();
    const cancelled = await syncService.cancelSync(authContext.employeeId);

    if (!cancelled) {
      throw new Error('Failed to cancel sync operation');
    }

    // 6. Log cancellation
    logSecurityEvent({
      type: 'AERIES_SYNC_CANCELLED',
      severity: ErrorSeverity.MEDIUM,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      correlationId: currentStatus.currentOperation?.operationId || 'unknown',
      details: `Aeries sync operation cancelled by ${authContext.employeeId}`,
      timestamp: new Date()
    });

    // 7. Return response
    return NextResponse.json({
      success: true,
      data: {
        message: 'Sync operation cancelled successfully',
        operationId: currentStatus.currentOperation?.operationId,
        cancelledBy: authContext.employeeId
      },
      meta: {
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

// =====================================================
// Helper Functions
// =====================================================

function estimateSyncDuration(options: any): string {
  // Rough estimation based on date range and batch size
  const startDate = new Date(options.startDate || '2024-08-15');
  const endDate = new Date(options.endDate || '2025-06-12');
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const batchSize = options.batchSize || 100;
  
  // Estimate: 1000 records per day, 1 second per batch
  const estimatedRecords = Math.min(days * 1000, 50000); // Cap at 50k records
  const estimatedBatches = Math.ceil(estimatedRecords / batchSize);
  const estimatedMinutes = Math.ceil(estimatedBatches / 60); // 1 batch per second
  
  if (estimatedMinutes < 60) {
    return `${estimatedMinutes} minutes`;
  } else {
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
}