/**
 * @fileoverview Complete Aeries Sync Service
 * 
 * Production-ready service for syncing attendance data from Aeries SIS.
 * Handles automated daily sync and manual sync operations.
 * 
 * COPY-PASTE READY - No modifications needed for basic deployment
 */

import { cron } from 'node-cron';
import { getAeriesClient, AeriesClient } from './aeries-client';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// Types and Interfaces
// =====================================================

interface SyncOperation {
  operationId: string;
  type: 'FULL_SYNC' | 'INCREMENTAL_SYNC' | 'MANUAL_SYNC';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startTime: string;
  endTime?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  progress: {
    totalRecords: number;
    processedRecords: number;
    successfulRecords: number;
    failedRecords: number;
    currentBatch: number;
    totalBatches: number;
  };
  errors: Array<{
    errorId: string;
    batchNumber: number;
    errorMessage: string;
    timestamp: string;
  }>;
  metadata: {
    initiatedBy: string;
    userAgent: string;
    ipAddress: string;
  };
}

interface SyncOptions {
  syncType?: 'FULL_SYNC' | 'INCREMENTAL_SYNC' | 'MANUAL_SYNC';
  startDate?: string;
  endDate?: string;
  schoolCodes?: string[];
  batchSize?: number;
  forceRefresh?: boolean;
}

// =====================================================
// Main Sync Service Class
// =====================================================

export class AeriesSyncService {
  private static instance: AeriesSyncService;
  private aeriesClient: AeriesClient | null = null;
  private supabase: SupabaseClient;
  private currentOperation: SyncOperation | null = null;
  private cronJob: any = null;

  private constructor() {
    this.supabase = createClient();
    this.initializeScheduledSync();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AeriesSyncService {
    if (!AeriesSyncService.instance) {
      AeriesSyncService.instance = new AeriesSyncService();
    }
    return AeriesSyncService.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      this.aeriesClient = await getAeriesClient();
      console.log('[Aeries Sync] Service initialized successfully');
    } catch (error) {
      console.error('[Aeries Sync] Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start manual sync operation
   */
  async startSync(
    options: SyncOptions = {},
    initiatedBy: string = 'system',
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<SyncOperation> {
    try {
      // Ensure client is initialized
      if (!this.aeriesClient) {
        await this.initialize();
      }

      // Check if sync is already in progress
      if (this.currentOperation?.status === 'IN_PROGRESS') {
        throw new Error('Sync operation already in progress');
      }

      // Create new sync operation
      const operation: SyncOperation = {
        operationId: this.generateOperationId(),
        type: options.syncType || 'MANUAL_SYNC',
        status: 'PENDING',
        startTime: new Date().toISOString(),
        dateRange: {
          startDate: options.startDate || '2024-08-15',
          endDate: options.endDate || '2025-06-12'
        },
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

      console.log(`[Aeries Sync] Starting sync operation: ${operation.operationId}`);

      // Save initial operation to database
      await this.saveOperationToDatabase(operation);

      // Start sync in background
      this.executeSyncOperation(operation, options).catch(error => {
        console.error('[Aeries Sync] Sync operation failed:', error);
        this.handleSyncError(operation, error);
      });

      return operation;

    } catch (error) {
      console.error('[Aeries Sync] Failed to start sync:', error);
      throw new Error(`Failed to start sync: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current sync operation status
   */
  getCurrentOperation(): SyncOperation | null {
    return this.currentOperation ? { ...this.currentOperation } : null;
  }

  /**
   * Cancel current sync operation
   */
  async cancelSync(cancelledBy: string): Promise<boolean> {
    if (!this.currentOperation || this.currentOperation.status !== 'IN_PROGRESS') {
      return false;
    }

    this.currentOperation.status = 'CANCELLED';
    this.currentOperation.endTime = new Date().toISOString();

    await this.saveOperationToDatabase(this.currentOperation);

    console.log(`[Aeries Sync] Sync cancelled by ${cancelledBy}`);
    return true;
  }

  /**
   * Get sync history
   */
  async getSyncHistory(limit: number = 50): Promise<SyncOperation[]> {
    try {
      const { data, error } = await this.supabase
        .from('aeries_sync_operations')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map(this.transformDatabaseRecord);
    } catch (error) {
      console.error('[Aeries Sync] Failed to fetch sync history:', error);
      return [];
    }
  }

  // =====================================================
  // Private Sync Execution Methods
  // =====================================================

  private async executeSyncOperation(operation: SyncOperation, options: SyncOptions): Promise<void> {
    try {
      operation.status = 'IN_PROGRESS';
      
      // Get schools to sync
      const schoolCodes = options.schoolCodes || await this.getActiveSchoolCodes();
      
      // Estimate total records
      const estimatedRecords = await this.estimateTotalRecords(
        operation.dateRange.startDate,
        operation.dateRange.endDate,
        schoolCodes
      );
      
      operation.progress.totalRecords = estimatedRecords;
      operation.progress.totalBatches = Math.ceil(estimatedRecords / (options.batchSize || 100));

      await this.saveOperationToDatabase(operation);

      console.log(`[Aeries Sync] Processing ${schoolCodes.length} schools, estimated ${estimatedRecords} records`);

      // Process each school
      for (const schoolCode of schoolCodes) {
        if (operation.status === 'CANCELLED') {
          break;
        }

        await this.syncSchoolAttendance(operation, options, schoolCode);
      }

      // Complete operation
      if (operation.status !== 'CANCELLED') {
        operation.status = operation.errors.length > 0 ? 'FAILED' : 'COMPLETED';
      }

      operation.endTime = new Date().toISOString();
      await this.saveOperationToDatabase(operation);

      const duration = new Date(operation.endTime).getTime() - new Date(operation.startTime).getTime();
      console.log(`[Aeries Sync] Operation ${operation.status.toLowerCase()}: ${operation.progress.successfulRecords}/${operation.progress.totalRecords} records processed in ${Math.round(duration / 1000)}s`);

    } catch (error) {
      await this.handleSyncError(operation, error);
    }
  }

  private async syncSchoolAttendance(
    operation: SyncOperation,
    options: SyncOptions,
    schoolCode: string
  ): Promise<void> {
    try {
      console.log(`[Aeries Sync] Syncing school: ${schoolCode}`);

      await this.aeriesClient!.processAttendanceBatches(
        operation.dateRange.startDate,
        operation.dateRange.endDate,
        async (batch, batchNumber) => {
          operation.progress.currentBatch = batchNumber;
          await this.saveOperationToDatabase(operation);

          const batchResult = await this.processBatch(batch, operation);
          
          operation.progress.processedRecords += batch.length;
          operation.progress.successfulRecords += batchResult.successful;
          operation.progress.failedRecords += batchResult.failed;

          if (batchResult.errors.length > 0) {
            operation.errors.push(...batchResult.errors);
          }

          console.log(`[Aeries Sync] Batch ${batchNumber}: ${batchResult.successful}/${batch.length} successful`);
        },
        {
          schoolCode,
          batchSize: options.batchSize || 100
        }
      );

    } catch (error) {
      const syncError = {
        errorId: this.generateErrorId(),
        batchNumber: operation.progress.currentBatch,
        errorMessage: `School sync failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      };

      operation.errors.push(syncError);
      console.error(`[Aeries Sync] School ${schoolCode} sync failed:`, error);
    }
  }

  private async processBatch(
    batch: any[],
    operation: SyncOperation
  ): Promise<{ successful: number; failed: number; errors: any[] }> {
    let successful = 0;
    let failed = 0;
    const errors: any[] = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        const record = batch[i];
        
        // Transform and save attendance record
        await this.saveAttendanceRecord(record, operation.operationId);
        successful++;

      } catch (error) {
        failed++;
        const syncError = {
          errorId: this.generateErrorId(),
          batchNumber: operation.progress.currentBatch,
          errorMessage: `Record processing failed: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date().toISOString()
        };

        errors.push(syncError);
      }
    }

    return { successful, failed, errors };
  }

  // =====================================================
  // Database Operations
  // =====================================================

  private async saveOperationToDatabase(operation: SyncOperation): Promise<void> {
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
          progress: operation.progress,
          errors: operation.errors,
          metadata: operation.metadata
        });

      if (error) {
        console.error('[Aeries Sync] Failed to save operation to database:', error);
      }
    } catch (error) {
      console.error('[Aeries Sync] Database save error:', error);
    }
  }

  private async saveAttendanceRecord(record: any, operationId: string): Promise<void> {
    try {
      const transformedRecord = {
        student_id: record.studentId,
        date: record.attendanceDate,
        school_year: record.schoolYear,
        daily_status: record.dailyStatus,
        period_attendance: record.periods,
        aeries_student_number: record.studentNumber,
        aeries_last_modified: record.lastModified,
        sync_operation_id: operationId,
        sync_metadata: {
          syncTimestamp: new Date().toISOString(),
          source: 'aeries_api'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('attendance_records')
        .upsert(transformedRecord, {
          onConflict: 'student_id,date'
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
      const syncEnabled = process.env.AERIES_SYNC_ENABLED === 'true';
      const syncSchedule = process.env.AERIES_SYNC_SCHEDULE || '0 1 * * *';

      if (syncEnabled) {
        this.cronJob = cron.schedule(syncSchedule, async () => {
          try {
            console.log('[Aeries Sync] Starting scheduled sync');
            await this.startSync({
              syncType: 'INCREMENTAL_SYNC'
            }, 'scheduler');
          } catch (error) {
            console.error('[Aeries Sync] Scheduled sync failed:', error);
          }
        }, {
          scheduled: true,
          timezone: 'America/Los_Angeles'
        });

        console.log(`[Aeries Sync] Scheduled sync initialized: ${syncSchedule}`);
      } else {
        console.log('[Aeries Sync] Scheduled sync disabled');
      }
    } catch (error) {
      console.error('[Aeries Sync] Failed to initialize scheduled sync:', error);
    }
  }

  // =====================================================
  // Helper Methods
  // =====================================================

  private async handleSyncError(operation: SyncOperation, error: any): Promise<void> {
    operation.status = 'FAILED';
    operation.endTime = new Date().toISOString();

    const syncError = {
      errorId: this.generateErrorId(),
      batchNumber: operation.progress.currentBatch,
      errorMessage: `Sync operation failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString()
    };

    operation.errors.push(syncError);
    await this.saveOperationToDatabase(operation);

    console.error('[Aeries Sync] Sync operation failed:', error);
  }

  private async getActiveSchoolCodes(): Promise<string[]> {
    try {
      if (this.aeriesClient) {
        const response = await this.aeriesClient.getSchools();
        return response.data
          .filter(school => school.active)
          .map(school => school.schoolCode);
      }
    } catch (error) {
      console.error('[Aeries Sync] Failed to get school codes:', error);
    }

    // Fallback to common Romoland school codes
    return ['001', '002', '003', '004', '005'];
  }

  private async estimateTotalRecords(
    startDate: string,
    endDate: string,
    schoolCodes: string[]
  ): Promise<number> {
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const schoolDays = Math.min(days, 180); // Cap at 180 school days
    return schoolCodes.length * 1000 * schoolDays; // Rough estimate: 1000 students per school
  }

  private transformDatabaseRecord(record: any): SyncOperation {
    return {
      operationId: record.operation_id,
      type: record.type,
      status: record.status,
      startTime: record.start_time,
      endTime: record.end_time,
      dateRange: record.date_range,
      progress: record.progress,
      errors: record.errors || [],
      metadata: record.metadata
    };
  }

  private generateOperationId(): string {
    return `aeries-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =====================================================
// Singleton Export and Utility Functions
// =====================================================

let syncServiceInstance: AeriesSyncService | null = null;

/**
 * Get singleton Aeries sync service instance
 */
export async function getAeriesSyncService(): Promise<AeriesSyncService> {
  if (!syncServiceInstance) {
    syncServiceInstance = AeriesSyncService.getInstance();
    await syncServiceInstance.initialize();
  }
  
  return syncServiceInstance;
}

/**
 * Quick sync status check
 */
export async function getAeriesSyncStatus(): Promise<{
  isRunning: boolean;
  currentOperation: SyncOperation | null;
  lastSync: string | null;
}> {
  try {
    const syncService = await getAeriesSyncService();
    const currentOperation = syncService.getCurrentOperation();
    
    return {
      isRunning: currentOperation?.status === 'IN_PROGRESS' || false,
      currentOperation,
      lastSync: currentOperation?.startTime || null
    };
  } catch (error) {
    console.error('[Aeries Sync] Status check failed:', error);
    return {
      isRunning: false,
      currentOperation: null,
      lastSync: null
    };
  }
}

/**
 * Start manual sync (convenience function)
 */
export async function startManualSync(
  options: SyncOptions = {},
  initiatedBy: string = 'manual'
): Promise<SyncOperation> {
  const syncService = await getAeriesSyncService();
  return await syncService.startSync(options, initiatedBy);
}