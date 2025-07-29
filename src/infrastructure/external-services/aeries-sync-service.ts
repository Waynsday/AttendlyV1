/**
 * @fileoverview Aeries Attendance Data Sync Service
 * 
 * Handles automated synchronization of attendance data from Aeries SIS to local database.
 * Covers the period from August 15, 2024 to June 12, 2025 with incremental sync support.
 * 
 * FEATURES:
 * - Full sync and incremental sync modes
 * - Batch processing with configurable batch sizes
 * - Error handling and retry logic
 * - Progress tracking and reporting
 * - Data validation and sanitization
 * - FERPA-compliant audit logging
 * 
 * SECURITY REQUIREMENTS:
 * - All sync operations must be audited
 * - Student data must be encrypted in transit and at rest
 * - Failed syncs must be logged for investigation
 * - Rate limiting must be respected to prevent API abuse
 */

import { cron } from 'node-cron';
import { z } from 'zod';
import { 
  AeriesSyncOperation,
  AeriesSyncResult,
  AeriesSyncError,
  AeriesAttendanceRecord,
  AeriesAttendanceMapping
} from '@/types/aeries';
import { AeriesApiClient } from './aeries-api-client';
import { getAeriesConfig } from './aeries-config';
import { logSecurityEvent, ErrorSeverity } from '@/lib/security/error-handler';
import { createClient } from '@/lib/supabase/server';

// =====================================================
// Sync Configuration Schema
// =====================================================

const SyncOptionsSchema = z.object({
  syncType: z.enum(['FULL_SYNC', 'INCREMENTAL_SYNC', 'MANUAL_SYNC']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  schoolCodes: z.array(z.string()).optional(),
  batchSize: z.number().min(1).max(1000).optional(),
  forceRefresh: z.boolean().default(false),
  skipValidation: z.boolean().default(false)
});

export type SyncOptions = z.infer<typeof SyncOptionsSchema>;

// =====================================================
// Aeries Sync Service Implementation
// =====================================================

export class AeriesSyncService {
  private static instance: AeriesSyncService;
  private apiClient: AeriesApiClient;
  private currentOperation: AeriesSyncOperation | null = null;
  private cronJob: any = null;
  private supabase: any;

  private constructor() {
    this.apiClient = new AeriesApiClient();
    this.supabase = createClient();
    this.initializeScheduledSync();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AeriesSyncService {
    if (!AeriesSyncService.instance) {
      AeriesSyncService.instance = new AeriesSyncService();
    }
    return AeriesSyncService.instance;
  }

  /**
   * Start manual sync operation
   */
  public async startSync(
    options: Partial<SyncOptions>,
    initiatedBy: string = 'system',
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AeriesSyncOperation> {
    try {
      // Validate options
      const validatedOptions = SyncOptionsSchema.parse({
        syncType: options.syncType || 'MANUAL_SYNC',
        startDate: options.startDate || (await this.getDefaultStartDate()),
        endDate: options.endDate || (await this.getDefaultEndDate()),
        schoolCodes: options.schoolCodes,
        batchSize: options.batchSize || (await this.getDefaultBatchSize()),
        forceRefresh: options.forceRefresh || false,
        skipValidation: options.skipValidation || false
      });

      // Check if sync is already in progress
      if (this.currentOperation?.status === 'IN_PROGRESS') {
        throw new Error('Sync operation already in progress');
      }

      // Create new sync operation
      const operation: AeriesSyncOperation = {
        operationId: this.generateOperationId(),
        type: validatedOptions.syncType,
        status: 'PENDING',
        startTime: new Date().toISOString(),
        dateRange: {
          startDate: validatedOptions.startDate,
          endDate: validatedOptions.endDate
        },
        batchSize: validatedOptions.batchSize,
        progress: {
          totalRecords: 0,
          processedRecords: 0,
          successfulRecords: 0,
          failedRecords: 0,
          currentBatch: 0,
          totalBatches: 0
        },
        errors: [],
        metadata: {
          initiatedBy,
          userAgent: metadata.userAgent || 'AeriesSyncService',
          ipAddress: metadata.ipAddress || 'localhost'
        }
      };

      this.currentOperation = operation;

      // Log sync initiation
      logSecurityEvent({
        type: 'AERIES_SYNC_INITIATED',
        severity: ErrorSeverity.MEDIUM,
        userId: initiatedBy,
        correlationId: operation.operationId,
        details: `Aeries sync initiated: ${validatedOptions.syncType} from ${validatedOptions.startDate} to ${validatedOptions.endDate}`,
        timestamp: new Date()
      });

      // Start sync in background
      this.executeSyncOperation(operation, validatedOptions)
        .catch(error => {
          this.handleSyncError(operation, error);
        });

      return operation;

    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_SYNC_INITIATION_FAILED',
        severity: ErrorSeverity.HIGH,
        userId: initiatedBy,
        correlationId: 'sync-init',
        details: `Failed to initiate Aeries sync: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      throw new Error(`Failed to initiate sync: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current sync operation status
   */
  public getCurrentOperation(): AeriesSyncOperation | null {
    return this.currentOperation ? { ...this.currentOperation } : null;
  }

  /**
   * Cancel current sync operation
   */
  public async cancelSync(cancelledBy: string): Promise<boolean> {
    if (!this.currentOperation || this.currentOperation.status !== 'IN_PROGRESS') {
      return false;
    }

    this.currentOperation.status = 'CANCELLED';
    this.currentOperation.endTime = new Date().toISOString();

    logSecurityEvent({
      type: 'AERIES_SYNC_CANCELLED',
      severity: ErrorSeverity.MEDIUM,
      userId: cancelledBy,
      correlationId: this.currentOperation.operationId,
      details: `Aeries sync cancelled by ${cancelledBy}`,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Get sync history from database
   */
  public async getSyncHistory(limit: number = 50): Promise<AeriesSyncOperation[]> {
    try {
      const { data, error } = await this.supabase
        .from('aeries_sync_operations')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_SYNC_HISTORY_FETCH_FAILED',
        severity: ErrorSeverity.LOW,
        userId: 'system',
        correlationId: 'sync-history',
        details: `Failed to fetch sync history: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      return [];
    }
  }

  // =====================================================
  // Private Sync Execution Methods
  // =====================================================

  private async executeSyncOperation(
    operation: AeriesSyncOperation,
    options: SyncOptions
  ): Promise<void> {
    try {
      operation.status = 'IN_PROGRESS';
      
      // Get schools to sync
      const schoolCodes = options.schoolCodes || await this.getActiveSchoolCodes();
      
      // Calculate total estimated records
      const estimatedRecords = await this.estimateTotalRecords(
        options.startDate,
        options.endDate,
        schoolCodes
      );
      
      operation.progress.totalRecords = estimatedRecords;
      operation.progress.totalBatches = Math.ceil(estimatedRecords / options.batchSize);

      // Save operation to database
      await this.saveOperationToDatabase(operation);

      // Process each school
      for (const schoolCode of schoolCodes) {
        if (operation.status === 'CANCELLED') {
          break;
        }

        await this.syncSchoolAttendance(operation, options, schoolCode);
      }

      // Complete operation
      if (operation.status !== 'CANCELLED') {
        operation.status = operation.errors && operation.errors.length > 0 ? 'FAILED' : 'COMPLETED';
      }

      operation.endTime = new Date().toISOString();
      await this.saveOperationToDatabase(operation);

      // Log completion
      logSecurityEvent({
        type: 'AERIES_SYNC_COMPLETED',
        severity: operation.status === 'COMPLETED' ? ErrorSeverity.LOW : ErrorSeverity.MEDIUM,
        userId: operation.metadata.initiatedBy,
        correlationId: operation.operationId,
        details: `Aeries sync ${operation.status.toLowerCase()}: ${operation.progress.successfulRecords}/${operation.progress.totalRecords} records processed`,
        timestamp: new Date()
      });

    } catch (error) {
      await this.handleSyncError(operation, error);
    }
  }

  private async syncSchoolAttendance(
    operation: AeriesSyncOperation,
    options: SyncOptions,
    schoolCode: string
  ): Promise<void> {
    try {
      await this.apiClient.processAttendanceBatches(
        async (batch: any[], batchNumber: number) => {
          operation.progress.currentBatch = batchNumber;
          await this.saveOperationToDatabase(operation);

          // Process batch
          const batchResult = await this.processBatch(batch, operation, options);
          
          // Update progress
          operation.progress.processedRecords += batch.length;
          operation.progress.successfulRecords += batchResult.successful;
          operation.progress.failedRecords += batchResult.failed;

          // Add any errors
          if (batchResult.errors.length > 0) {
            operation.errors = [...(operation.errors || []), ...batchResult.errors];
          }

          logSecurityEvent({
            type: 'AERIES_BATCH_PROCESSED',
            severity: ErrorSeverity.LOW,
            userId: operation.metadata.initiatedBy,
            correlationId: operation.operationId,
            details: `Batch ${batchNumber} processed: ${batchResult.successful}/${batch.length} successful`,
            timestamp: new Date()
          });
        },
        {
          startDate: options.startDate,
          endDate: options.endDate,
          schoolCode,
          batchSize: options.batchSize
        }
      );

    } catch (error) {
      const syncError: AeriesSyncError = {
        errorId: this.generateErrorId(),
        batchNumber: operation.progress.currentBatch,
        recordIndex: -1,
        errorCode: 'SCHOOL_SYNC_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorDetails: { schoolCode },
        timestamp: new Date().toISOString(),
        retryCount: 0,
        resolved: false
      };

      operation.errors = [...(operation.errors || []), syncError];
    }
  }

  private async processBatch(
    batch: any[],
    operation: AeriesSyncOperation,
    options: SyncOptions
  ): Promise<{ successful: number; failed: number; errors: AeriesSyncError[] }> {
    let successful = 0;
    let failed = 0;
    const errors: AeriesSyncError[] = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        const record = batch[i];
        
        // Validate record if not skipping validation
        if (!options.skipValidation) {
          const validationResult = await this.validateAttendanceRecord(record);
          if (!validationResult.isValid) {
            throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
          }
        }

        // Transform Aeries record to local format
        const localRecord = await this.transformAttendanceRecord(record);

        // Save to database
        await this.saveAttendanceRecord(localRecord, operation.operationId);

        successful++;

      } catch (error) {
        failed++;

        const syncError: AeriesSyncError = {
          errorId: this.generateErrorId(),
          batchNumber: operation.progress.currentBatch,
          recordIndex: i,
          studentId: batch[i]?.studentId,
          errorCode: 'RECORD_PROCESSING_FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorDetails: batch[i],
          timestamp: new Date().toISOString(),
          retryCount: 0,
          resolved: false
        };

        errors.push(syncError);
      }
    }

    return { successful, failed, errors };
  }

  // =====================================================
  // Data Transformation and Validation
  // =====================================================

  private async validateAttendanceRecord(record: any): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!record.studentId) errors.push('Student ID is required');
    if (!record.attendanceDate) errors.push('Attendance date is required');
    if (!record.schoolCode) errors.push('School code is required');

    // Date validation
    if (record.attendanceDate) {
      const date = new Date(record.attendanceDate);
      if (isNaN(date.getTime())) {
        errors.push('Invalid attendance date format');
      } else {
        // Check if date is within expected range
        const configService = getAeriesConfig();
        const config = await configService.getConfiguration();
        
        if (!configService.validateDateRange(record.attendanceDate, record.attendanceDate)) {
          warnings.push('Attendance date is outside configured range');
        }
      }
    }

    // Student ID format validation
    if (record.studentId && !/^[A-Z0-9]{6,12}$/.test(record.studentId)) {
      warnings.push('Student ID format may be invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async transformAttendanceRecord(aeriesRecord: any): Promise<AeriesAttendanceMapping> {
    return {
      aeriesRecord,
      localRecord: {
        studentId: aeriesRecord.studentId,
        date: aeriesRecord.attendanceDate,
        schoolYear: aeriesRecord.schoolYear || this.getCurrentSchoolYear(),
        dailyStatus: this.mapAttendanceStatus(aeriesRecord.dailyAttendance?.status),
        periodAttendance: (aeriesRecord.periods || []).map((period: any) => ({
          period: period.period,
          status: this.mapAttendanceStatus(period.status),
          minutesAbsent: period.minutesAbsent,
          minutesTardy: period.minutesTardy
        })),
        syncMetadata: {
          aeriesLastModified: aeriesRecord.lastModified,
          syncTimestamp: new Date().toISOString(),
          syncOperationId: this.currentOperation?.operationId || 'unknown'
        }
      }
    };
  }

  private mapAttendanceStatus(aeriesStatus: string): string {
    const statusMap: Record<string, string> = {
      'PRESENT': 'PRESENT',
      'ABSENT': 'ABSENT',
      'TARDY': 'TARDY',
      'EXCUSED_ABSENT': 'EXCUSED_ABSENT',
      'UNEXCUSED_ABSENT': 'UNEXCUSED_ABSENT'
    };

    return statusMap[aeriesStatus] || 'UNKNOWN';
  }

  // =====================================================
  // Database Operations
  // =====================================================

  private async saveOperationToDatabase(operation: AeriesSyncOperation): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('aeries_sync_operations')
        .upsert({
          operation_id: operation.operationId,
          type: operation.type,
          status: operation.status,
          start_time: operation.startTime,
          end_time: operation.endTime,
          date_range: operation.dateRange,
          batch_size: operation.batchSize,
          progress: operation.progress,
          errors: operation.errors,
          metadata: operation.metadata
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to save sync operation to database:', error);
    }
  }

  private async saveAttendanceRecord(
    record: AeriesAttendanceMapping['localRecord'],
    operationId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('attendance_records')
        .upsert({
          student_id: record.studentId,
          date: record.date,
          school_year: record.schoolYear,
          daily_status: record.dailyStatus,
          period_attendance: record.periodAttendance,
          sync_metadata: record.syncMetadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to save attendance record: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // =====================================================
  // Scheduled Sync Management
  // =====================================================

  private async initializeScheduledSync(): Promise<void> {
    try {
      const configService = getAeriesConfig();
      const config = await configService.getConfiguration();

      if (config.syncEnabled && config.syncSchedule) {
        this.cronJob = cron.schedule(config.syncSchedule, async () => {
          try {
            await this.startSync({
              syncType: 'INCREMENTAL_SYNC'
            }, 'scheduler');
          } catch (error) {
            logSecurityEvent({
              type: 'SCHEDULED_SYNC_FAILED',
              severity: ErrorSeverity.HIGH,
              userId: 'system',
              correlationId: 'scheduled-sync',
              details: `Scheduled sync failed: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date()
            });
          }
        }, {
          scheduled: true,
          timezone: 'America/Los_Angeles' // Pacific Time for Romoland
        });

        logSecurityEvent({
          type: 'SCHEDULED_SYNC_INITIALIZED',
          severity: ErrorSeverity.LOW,
          userId: 'system',
          correlationId: 'scheduled-sync',
          details: `Scheduled sync initialized with schedule: ${config.syncSchedule}`,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to initialize scheduled sync:', error);
    }
  }

  // =====================================================
  // Helper Methods
  // =====================================================

  private async handleSyncError(operation: AeriesSyncOperation, error: any): Promise<void> {
    operation.status = 'FAILED';
    operation.endTime = new Date().toISOString();

    const syncError: AeriesSyncError = {
      errorId: this.generateErrorId(),
      batchNumber: operation.progress.currentBatch,
      recordIndex: -1,
      errorCode: 'SYNC_OPERATION_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      retryCount: 0,
      resolved: false
    };

    operation.errors = [...(operation.errors || []), syncError];
    
    await this.saveOperationToDatabase(operation);

    logSecurityEvent({
      type: 'AERIES_SYNC_FAILED',
      severity: ErrorSeverity.HIGH,
      userId: operation.metadata.initiatedBy,
      correlationId: operation.operationId,
      details: `Aeries sync failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date()
    });
  }

  private generateOperationId(): string {
    return `aeries-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getDefaultStartDate(): Promise<string> {
    const configService = getAeriesConfig();
    const config = await configService.getConfiguration();
    return config.attendanceStartDate;
  }

  private async getDefaultEndDate(): Promise<string> {
    const configService = getAeriesConfig();
    const config = await configService.getConfiguration();
    return config.attendanceEndDate;
  }

  private async getDefaultBatchSize(): Promise<number> {
    const configService = getAeriesConfig();
    const config = await configService.getConfiguration();
    return config.batchSize;
  }

  private async getActiveSchoolCodes(): Promise<string[]> {
    // In a real implementation, this would fetch from the database or API
    // For now, return common Romoland school codes
    return ['001', '002', '003', '004', '005']; // Replace with actual school codes
  }

  private async estimateTotalRecords(
    startDate: string,
    endDate: string,
    schoolCodes: string[]
  ): Promise<number> {
    // Rough estimation: 1000 students per school * number of school days
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    return schoolCodes.length * 1000 * Math.min(days, 180); // Cap at 180 school days
  }

  private getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // School year runs from August to June
    if (month >= 7) { // August or later
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }
}

// =====================================================
// Export Functions
// =====================================================

/**
 * Get singleton instance of sync service
 */
export function getAeriesSyncService(): AeriesSyncService {
  return AeriesSyncService.getInstance();
}

/**
 * Quick sync status check
 */
export async function getAeriesSyncStatus(): Promise<{
  isRunning: boolean;
  currentOperation: AeriesSyncOperation | null;
  lastSync: string | null;
}> {
  const syncService = getAeriesSyncService();
  const currentOperation = syncService.getCurrentOperation();
  
  return {
    isRunning: currentOperation?.status === 'IN_PROGRESS' || false,
    currentOperation,
    lastSync: currentOperation?.startTime || null
  };
}