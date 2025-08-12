/**
 * @fileoverview Enhanced Attendance Sync Service
 * 
 * Production-ready service for syncing attendance data from Aeries SIS to Supabase.
 * Implements comprehensive error handling, retry logic, and monitoring.
 * 
 * Features:
 * - Date range chunking for large datasets
 * - Circuit breaker pattern for fault tolerance
 * - Resume capability from failed batches
 * - FERPA-compliant data handling
 * - Comprehensive audit logging
 * - Real-time progress tracking
 * 
 * @author AP_Tool_V1 Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getAeriesClient, AeriesClient } from '../aeries/aeries-client';
import { FERPACompliance } from '../security/ferpa-compliance';
import { AuditLogger } from '../audit/audit-logger';
import type { 
  SyncOperation,
  SyncResult,
  ProgressUpdate,
  AttendanceRecord,
  CircuitBreakerState 
} from '@/types/sync';

// =====================================================
// Configuration and Validation Schemas
// =====================================================

const AttendanceSyncConfigSchema = z.object({
  dateRange: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }),
  schools: z.array(z.string()).optional(),
  batchSize: z.number().min(1).max(1000).default(500),
  chunkDays: z.number().min(1).max(90).default(30),
  parallelBatches: z.number().min(1).max(5).default(3),
  retryConfig: z.object({
    maxRetries: z.number().min(0).max(5).default(3),
    initialDelay: z.number().min(100).max(5000).default(1000),
    maxDelay: z.number().min(1000).max(30000).default(30000),
    backoffMultiplier: z.number().min(1).max(3).default(2)
  }).optional(),
  circuitBreaker: z.object({
    failureThreshold: z.number().min(1).max(10).default(5),
    resetTimeout: z.number().min(30000).max(300000).default(60000),
    halfOpenRequests: z.number().min(1).max(5).default(2)
  }).optional(),
  correctionWindow: z.object({
    enabled: z.boolean().default(true),
    days: z.number().min(1).max(30).default(7)
  }).optional(),
  monitoring: z.object({
    enableProgressTracking: z.boolean().default(true),
    progressUpdateInterval: z.number().min(1000).max(10000).default(5000),
    enableMetrics: z.boolean().default(true)
  }).optional()
});

type AttendanceSyncConfig = z.infer<typeof AttendanceSyncConfigSchema>;

// =====================================================
// Circuit Breaker Implementation
// =====================================================

class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private halfOpenRequestCount = 0;
  private halfOpenSuccessCount = 0;

  constructor(
    private readonly config: {
      failureThreshold: number;
      resetTimeout: number;
      halfOpenRequests: number;
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime?.getTime() || 0) > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenRequestCount = 0;
        this.halfOpenSuccessCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccessCount++;
      this.halfOpenRequestCount++;
      
      if (this.halfOpenRequestCount >= this.config.halfOpenRequests) {
        if (this.halfOpenSuccessCount === this.halfOpenRequestCount) {
          this.state = 'CLOSED';
          this.failureCount = 0;
        } else {
          this.state = 'OPEN';
        }
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }
}

// =====================================================
// Attendance Data Validator
// =====================================================

export class AttendanceDataValidator {
  private ferpaCompliance: FERPACompliance;

  constructor() {
    this.ferpaCompliance = new FERPACompliance();
  }

  async validateAttendanceRecord(record: any): Promise<{
    isValid: boolean;
    errors: string[];
    sanitizedRecord?: AttendanceRecord;
  }> {
    const errors: string[] = [];

    // Basic field validation
    if (!record.studentId) errors.push('Missing studentId');
    if (!record.attendanceDate) errors.push('Missing attendanceDate');
    if (!record.schoolCode) errors.push('Missing schoolCode');

    // Date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (record.attendanceDate && !dateRegex.test(record.attendanceDate)) {
      errors.push('Invalid date format for attendanceDate');
    }

    // FERPA compliance check
    const ferpaCheck = await this.ferpaCompliance.validateStudentData(record);
    if (!ferpaCheck.compliant) {
      errors.push(...ferpaCheck.violations);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Sanitize and transform the record
    const sanitizedRecord: AttendanceRecord = {
      student_id: record.studentId,
      attendance_date: record.attendanceDate,
      school_year: record.schoolYear || this.getCurrentSchoolYear(),
      is_present: this.calculatePresence(record),
      is_full_day_absent: record.dailyStatus === 'ABSENT',
      tardy_count: record.tardyCount || 0,
      days_enrolled: 1.0,
      ...this.mapPeriodStatuses(record.periods),
      aeries_last_sync: new Date().toISOString()
    };

    return { isValid: true, errors: [], sanitizedRecord };
  }

  private calculatePresence(record: any): boolean {
    if (record.dailyStatus === 'PRESENT' || record.dailyStatus === 'TARDY') {
      return true;
    }
    
    // Check period attendance for partial presence
    if (record.periods && Array.isArray(record.periods)) {
      const presentPeriods = record.periods.filter(
        (p: any) => p.status === 'PRESENT' || p.status === 'TARDY'
      );
      return presentPeriods.length > 0;
    }
    
    return false;
  }

  private mapPeriodStatuses(periods: any[]): Record<string, string> {
    const periodMap: Record<string, string> = {};
    
    if (!periods || !Array.isArray(periods)) {
      return periodMap;
    }

    for (let i = 1; i <= 7; i++) {
      const period = periods.find(p => p.period === i);
      periodMap[`period_${i}_status`] = period?.status || 'PRESENT';
    }

    return periodMap;
  }

  private getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (month >= 7) { // August or later
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }
}

// =====================================================
// Main Enhanced Attendance Sync Service
// =====================================================

export class EnhancedAttendanceSyncService extends EventEmitter {
  private config: AttendanceSyncConfig;
  private aeriesClient?: AeriesClient;
  private supabaseClient: SupabaseClient;
  private validator: AttendanceDataValidator;
  private auditLogger: AuditLogger;
  private circuitBreaker: CircuitBreaker;
  private currentOperation?: SyncOperation;
  private progressInterval?: NodeJS.Timeout;
  private metrics = {
    totalRecords: 0,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    skippedRecords: 0,
    startTime: Date.now(),
    batchesProcessed: 0,
    retryCount: 0
  };

  constructor(config: AttendanceSyncConfig) {
    super();
    
    // Validate configuration
    const validatedConfig = AttendanceSyncConfigSchema.parse(config);
    this.config = validatedConfig;
    
    // Initialize components
    this.supabaseClient = createClient();
    this.validator = new AttendanceDataValidator();
    this.auditLogger = new AuditLogger('AttendanceSyncService');
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreaker || {
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenRequests: 2
      }
    );
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    try {
      this.aeriesClient = await getAeriesClient();
      
      await this.auditLogger.log({
        action: 'SYNC_SERVICE_INITIALIZED',
        metadata: {
          dateRange: this.config.dateRange,
          schools: this.config.schools,
          batchSize: this.config.batchSize
        }
      });
      
      this.emit('initialized');
    } catch (error) {
      await this.auditLogger.logError('INITIALIZATION_FAILED', error);
      throw new Error(`Failed to initialize sync service: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute the attendance sync operation
   */
  async executeSync(): Promise<SyncResult> {
    if (!this.aeriesClient) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const operationId = this.generateOperationId();
    this.currentOperation = {
      id: operationId,
      type: 'AERIES_ATTENDANCE_BATCH',
      status: 'IN_PROGRESS',
      dateRange: this.config.dateRange,
      startTime: new Date().toISOString(),
      options: {
        schoolCodes: this.config.schools,
        batchSize: this.config.batchSize,
        parallelBatches: this.config.parallelBatches
      }
    };

    await this.saveOperationToDatabase(this.currentOperation);
    this.startProgressTracking();

    try {
      const result = await this.executeSyncWithRetry();
      
      this.currentOperation.status = 'COMPLETED';
      this.currentOperation.endTime = new Date().toISOString();
      await this.saveOperationToDatabase(this.currentOperation);
      
      await this.auditLogger.log({
        action: 'SYNC_COMPLETED',
        metadata: {
          operationId,
          result
        }
      });

      return result;
    } catch (error) {
      this.currentOperation.status = 'FAILED';
      this.currentOperation.endTime = new Date().toISOString();
      this.currentOperation.error = error instanceof Error ? error.message : String(error);
      await this.saveOperationToDatabase(this.currentOperation);
      
      await this.auditLogger.logError('SYNC_FAILED', error, { operationId });
      
      throw error;
    } finally {
      this.stopProgressTracking();
    }
  }

  /**
   * Execute sync with retry logic
   */
  private async executeSyncWithRetry(): Promise<SyncResult> {
    const retryConfig = this.config.retryConfig || {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    };

    let lastError: Error | null = null;
    let delay = retryConfig.initialDelay;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.metrics.retryCount++;
          await this.delay(delay);
          delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
        }

        return await this.performSync();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < retryConfig.maxRetries) {
          await this.auditLogger.log({
            action: 'SYNC_RETRY',
            metadata: {
              attempt: attempt + 1,
              error: lastError.message,
              nextDelay: delay
            }
          });
        }
      }
    }

    throw lastError || new Error('Sync failed after all retries');
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(): Promise<SyncResult> {
    const dateChunks = this.createDateChunks(
      this.config.dateRange.startDate,
      this.config.dateRange.endDate,
      this.config.chunkDays
    );

    const schools = this.config.schools || await this.getActiveSchools();
    
    // Estimate total records
    this.metrics.totalRecords = this.estimateTotalRecords(dateChunks.length, schools.length);
    
    for (const chunk of dateChunks) {
      for (const schoolCode of schools) {
        await this.syncSchoolAttendanceChunk(schoolCode, chunk.start, chunk.end);
      }
    }

    const executionTime = Date.now() - this.metrics.startTime;

    return {
      success: true,
      operationId: this.currentOperation!.id,
      startTime: this.currentOperation!.startTime,
      endTime: new Date().toISOString(),
      executionTime,
      recordsProcessed: this.metrics.processedRecords,
      recordsSuccessful: this.metrics.successfulRecords,
      recordsFailed: this.metrics.failedRecords,
      recordsSkipped: this.metrics.skippedRecords,
      retryAttempts: this.metrics.retryCount,
      totalExecutionTime: executionTime,
      metadata: {
        batchesProcessed: this.metrics.batchesProcessed,
        schools: schools.length,
        dateChunks: dateChunks.length,
        circuitBreakerState: this.circuitBreaker.getState()
      }
    };
  }

  /**
   * Sync attendance for a specific school and date range
   */
  private async syncSchoolAttendanceChunk(
    schoolCode: string,
    startDate: string,
    endDate: string
  ): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        await this.aeriesClient!.processAttendanceBatches(
          startDate,
          endDate,
          async (batch, batchNumber) => {
            await this.processBatch(batch, batchNumber, schoolCode);
          },
          {
            schoolCode,
            batchSize: this.config.batchSize
          }
        );
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Circuit breaker is OPEN') {
        await this.auditLogger.log({
          action: 'CIRCUIT_BREAKER_OPEN',
          metadata: { schoolCode, startDate, endDate }
        });
        
        // Add records to dead letter queue
        await this.addToDeadLetterQueue({
          schoolCode,
          startDate,
          endDate,
          error: 'Circuit breaker open'
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Process a batch of attendance records
   */
  private async processBatch(
    records: any[],
    batchNumber: number,
    schoolCode: string
  ): Promise<void> {
    this.metrics.batchesProcessed++;
    
    const batchPromises = records.map(async (record) => {
      try {
        this.metrics.processedRecords++;
        
        // Validate record
        const validation = await this.validator.validateAttendanceRecord(record);
        if (!validation.isValid) {
          this.metrics.failedRecords++;
          await this.auditLogger.log({
            action: 'RECORD_VALIDATION_FAILED',
            metadata: {
              studentId: record.studentId,
              errors: validation.errors
            }
          });
          return;
        }

        // Find student in database
        const student = await this.findStudent(record.studentId, schoolCode);
        if (!student) {
          this.metrics.skippedRecords++;
          return;
        }

        // Apply correction window if enabled
        const attendanceRecord = {
          ...validation.sanitizedRecord!,
          student_id: student.id,
          school_id: student.school_id,
          can_be_corrected: this.isWithinCorrectionWindow(record.attendanceDate),
          correction_deadline: this.calculateCorrectionDeadline(record.attendanceDate)
        };

        // Save to database
        await this.saveAttendanceRecord(attendanceRecord);
        this.metrics.successfulRecords++;

      } catch (error) {
        this.metrics.failedRecords++;
        await this.auditLogger.logError('RECORD_PROCESSING_FAILED', error, {
          studentId: record.studentId,
          batchNumber
        });
      }
    });

    // Process in parallel with concurrency limit
    await this.processInParallel(batchPromises, this.config.parallelBatches);
  }

  /**
   * Process promises in parallel with concurrency limit
   */
  private async processInParallel<T>(
    promises: Promise<T>[],
    concurrency: number
  ): Promise<void> {
    const results: Promise<T>[] = [];
    const executing: Promise<T>[] = [];

    for (const promise of promises) {
      const p = promise.then(result => {
        executing.splice(executing.indexOf(p), 1);
        return result;
      });
      
      results.push(p);
      executing.push(p);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(results);
  }

  /**
   * Create date chunks for processing
   */
  private createDateChunks(
    startDate: string,
    endDate: string,
    chunkDays: number
  ): Array<{ start: string; end: string }> {
    const chunks: Array<{ start: string; end: string }> = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    let currentStart = new Date(start);
    
    while (currentStart <= end) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + chunkDays - 1);
      
      if (currentEnd > end) {
        currentEnd.setTime(end.getTime());
      }

      chunks.push({
        start: currentStart.toISOString().split('T')[0],
        end: currentEnd.toISOString().split('T')[0]
      });

      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    return chunks;
  }

  /**
   * Get active schools from database
   */
  private async getActiveSchools(): Promise<string[]> {
    const { data, error } = await this.supabaseClient
      .from('schools')
      .select('aeries_school_code')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch active schools: ${error.message}`);
    }

    return data.map(school => school.aeries_school_code);
  }

  /**
   * Find student in database
   */
  private async findStudent(aeriesStudentId: string, schoolCode: string): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('students')
      .select('id, school_id')
      .eq('aeries_student_id', aeriesStudentId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Failed to find student: ${error.message}`);
    }

    return data;
  }

  /**
   * Save attendance record to database
   */
  private async saveAttendanceRecord(record: any): Promise<void> {
    const { error } = await this.supabaseClient
      .from('attendance_records')
      .upsert(record, {
        onConflict: 'student_id,attendance_date'
      });

    if (error) {
      throw new Error(`Failed to save attendance record: ${error.message}`);
    }
  }

  /**
   * Save operation to database
   */
  private async saveOperationToDatabase(operation: SyncOperation): Promise<void> {
    const { error } = await this.supabaseClient
      .from('aeries_sync_operations')
      .upsert({
        operation_id: operation.id,
        type: operation.type,
        status: operation.status,
        start_time: operation.startTime,
        end_time: operation.endTime,
        date_range: operation.dateRange,
        metadata: {
          options: operation.options,
          error: operation.error,
          metrics: this.metrics
        }
      });

    if (error) {
      console.error('Failed to save operation to database:', error);
    }
  }

  /**
   * Add failed chunk to dead letter queue
   */
  private async addToDeadLetterQueue(data: any): Promise<void> {
    const { error } = await this.supabaseClient
      .from('sync_dead_letter_queue')
      .insert({
        operation_id: this.currentOperation?.id,
        data,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to add to dead letter queue:', error);
    }
  }

  /**
   * Check if date is within correction window
   */
  private isWithinCorrectionWindow(attendanceDate: string): boolean {
    if (!this.config.correctionWindow?.enabled) {
      return false;
    }

    const date = new Date(attendanceDate);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDiff <= (this.config.correctionWindow.days || 7);
  }

  /**
   * Calculate correction deadline
   */
  private calculateCorrectionDeadline(attendanceDate: string): string {
    const date = new Date(attendanceDate);
    date.setDate(date.getDate() + (this.config.correctionWindow?.days || 7));
    return date.toISOString().split('T')[0];
  }

  /**
   * Start progress tracking
   */
  private startProgressTracking(): void {
    if (!this.config.monitoring?.enableProgressTracking) {
      return;
    }

    this.progressInterval = setInterval(() => {
      const progress: ProgressUpdate = {
        operationId: this.currentOperation!.id,
        timestamp: new Date().toISOString(),
        percentage: this.metrics.totalRecords > 0 
          ? Math.round((this.metrics.processedRecords / this.metrics.totalRecords) * 100)
          : 0,
        currentStep: `Processing batch ${this.metrics.batchesProcessed}`,
        recordsProcessed: this.metrics.processedRecords,
        totalRecords: this.metrics.totalRecords,
        throughput: this.calculateThroughput()
      };

      this.emit('progress', progress);
    }, this.config.monitoring.progressUpdateInterval || 5000);
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
  }

  /**
   * Calculate processing throughput
   */
  private calculateThroughput(): number {
    const elapsedSeconds = (Date.now() - this.metrics.startTime) / 1000;
    return elapsedSeconds > 0 ? this.metrics.processedRecords / elapsedSeconds : 0;
  }

  /**
   * Estimate total records
   */
  private estimateTotalRecords(chunks: number, schools: number): number {
    // Rough estimate: 1000 students per school * school days in chunk
    const avgDaysPerChunk = this.config.chunkDays;
    const schoolDays = avgDaysPerChunk * 0.7; // Assume 70% are school days
    return chunks * schools * 1000 * schoolDays;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `attendance-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Resume from checkpoint
   */
  async resumeFromCheckpoint(checkpointId: string): Promise<SyncResult> {
    const checkpoint = await this.loadCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    this.metrics = checkpoint.metrics;
    this.currentOperation = checkpoint.operation;

    await this.auditLogger.log({
      action: 'SYNC_RESUMED',
      metadata: { checkpointId, metrics: this.metrics }
    });

    return this.executeSync();
  }

  /**
   * Load checkpoint from database
   */
  private async loadCheckpoint(checkpointId: string): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('sync_checkpoints')
      .select('*')
      .eq('checkpoint_id', checkpointId)
      .single();

    if (error) {
      throw new Error(`Failed to load checkpoint: ${error.message}`);
    }

    return data;
  }

  /**
   * Save checkpoint
   */
  async saveCheckpoint(): Promise<string> {
    const checkpointId = `checkpoint-${Date.now()}`;
    
    const { error } = await this.supabaseClient
      .from('sync_checkpoints')
      .insert({
        checkpoint_id: checkpointId,
        operation: this.currentOperation,
        metrics: this.metrics,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to save checkpoint: ${error.message}`);
    }

    return checkpointId;
  }
}

// =====================================================
// Factory Function and Exports
// =====================================================

/**
 * Create and initialize an enhanced attendance sync service
 */
export async function createAttendanceSyncService(
  config: AttendanceSyncConfig
): Promise<EnhancedAttendanceSyncService> {
  const service = new EnhancedAttendanceSyncService(config);
  await service.initialize();
  return service;
}

/**
 * Execute a full school year sync
 */
export async function syncFullSchoolYear(
  options: {
    schools?: string[];
    batchSize?: number;
    resumeFromCheckpoint?: string;
  } = {}
): Promise<SyncResult> {
  const config: AttendanceSyncConfig = {
    dateRange: {
      startDate: '2024-08-15',
      endDate: '2025-06-12'
    },
    schools: options.schools,
    batchSize: options.batchSize || 500,
    chunkDays: 30,
    parallelBatches: 3,
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenRequests: 2
    },
    correctionWindow: {
      enabled: true,
      days: 7
    },
    monitoring: {
      enableProgressTracking: true,
      progressUpdateInterval: 5000,
      enableMetrics: true
    }
  };

  const service = await createAttendanceSyncService(config);

  if (options.resumeFromCheckpoint) {
    return service.resumeFromCheckpoint(options.resumeFromCheckpoint);
  }

  return service.executeSync();
}