/**
 * @fileoverview Data Sync Service Type Definitions
 * 
 * Comprehensive type definitions for the data synchronization service that orchestrates
 * sync operations between multiple data sources with transaction management and monitoring.
 * 
 * Supports:
 * - Aeries SIS real-time sync
 * - i-Ready diagnostic data daily batch sync
 * - A2A intervention data weekly batch sync
 * - Transaction management with ACID properties
 * - Conflict resolution and duplicate detection
 * - Progress tracking and monitoring
 */

import type { AeriesAttendanceRecord, AeriesStudent } from './aeries';

// =====================================================
// Core Sync Operation Types
// =====================================================

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  source: DataSource;
  target: DataTarget;
  status: SyncOperationStatus;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  options?: SyncOperationOptions;
  priority: SyncPriority;
  scheduledTime?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type SyncOperationType = 
  // Aeries sync operations
  | 'AERIES_ATTENDANCE_REALTIME'
  | 'AERIES_ATTENDANCE_BATCH'
  | 'AERIES_STUDENT_SYNC'
  | 'AERIES_TEACHER_ASSIGNMENT'
  | 'AERIES_DISTRICT_SYNC'
  | 'AERIES_COMPLIANCE_SYNC'
  | 'AERIES_FULL_DISTRICT_SYNC'
  // i-Ready sync operations
  | 'IREADY_DIAGNOSTIC_DAILY'
  | 'IREADY_DIAGNOSTIC_BATCH'
  | 'IREADY_BULK_SYNC'
  // A2A sync operations
  | 'A2A_INTERVENTION_WEEKLY'
  | 'A2A_TRUANCY_LETTER'
  | 'A2A_SARB_REFERRAL'
  | 'A2A_RECOVERY_SESSION'
  | 'A2A_PARENT_COMMUNICATION'
  // General operations
  | 'FULL_REFRESH'
  | 'INCREMENTAL_SYNC';

export type DataSource = 'aeries' | 'iready' | 'a2a' | 'csv' | 'manual';
export type DataTarget = 'supabase' | 'warehouse' | 'cache';
export type SyncOperationStatus = 'PENDING' | 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RETRYING';
export type SyncPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SyncOperationOptions {
  // General options
  batchSize?: number;
  parallelBatches?: number;
  timeout?: number;
  retryConfig?: RetryConfiguration;
  
  // School-specific options
  schoolCodes?: string[];
  schoolTypes?: SchoolType[];
  
  // Attendance-specific options
  includePeriods?: boolean;
  periodConfiguration?: PeriodConfiguration;
  correctionWindow?: CorrectionWindowConfig;
  handleCorrectionWindow?: boolean;
  
  // i-Ready specific options
  diagnosticTypes?: DiagnosticType[];
  subjects?: Subject[];
  includeHistoricalData?: boolean;
  yearRange?: string[];
  preserveHistoricalData?: boolean;
  
  // A2A specific options
  interventionTypes?: InterventionType[];
  includeRecoverySession?: boolean;
  recoverySessionConfig?: RecoverySessionConfig;
  
  // Performance options
  streamProcessing?: boolean;
  maxMemoryUsage?: string;
  useConnectionPooling?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  enableDatabaseOptimizations?: boolean;
  expectedRecordCount?: number;
  
  // Monitoring options
  enableProgressTracking?: boolean;
  
  // Validation options
  validateTeacherRatios?: boolean;
  maxStudentTeacherRatio?: number;
  
  // Compliance options
  complianceFramework?: ComplianceFramework;
  includeTruancyTracking?: boolean;
  includeSARBReporting?: boolean;
  includeInterventionTracking?: boolean;
  
  // School configuration
  schools?: SchoolConfiguration[];
}

// =====================================================
// Configuration Types
// =====================================================

export interface SyncConfiguration {
  dataSources: {
    aeries: DataSourceConfig;
    iready: DataSourceConfig;
    a2a: DataSourceConfig;
  };
  transactionConfig: TransactionConfiguration;
  conflictResolution: ConflictResolutionConfig;
  monitoring: MonitoringConfiguration;
  performance?: PerformanceConfiguration;
}

export interface DataSourceConfig {
  enabled: boolean;
  syncType: 'REAL_TIME' | 'DAILY_BATCH' | 'WEEKLY_BATCH' | 'MANUAL';
  batchSize: number;
  retryAttempts: number;
  timeout: number;
  rateLimitConfig?: RateLimitConfig;
  connectionConfig?: ConnectionConfig;
}

export interface TransactionConfiguration {
  isolation: TransactionIsolation;
  timeout: number;
  enableSaga: boolean;
  enableTwoPhaseCommit: boolean;
  deadlockRetryAttempts?: number;
  lockTimeout?: number;
}

export interface ConflictResolutionConfig {
  strategy: ConflictResolutionStrategy;
  enableManualReview: boolean;
  autoResolveThreshold: number;
  backupConflictedData: boolean;
}

export interface MonitoringConfiguration {
  enableMetrics: boolean;
  enableProgressTracking: boolean;
  enableAlerting: boolean;
  alertThresholds: AlertThresholds;
  metricsRetentionDays: number;
}

// =====================================================
// Transaction Management Types
// =====================================================

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  startTime: string;
  endTime?: string;
  isolation: TransactionIsolation;
  operations: TransactionOperation[];
  error?: string;
}

export interface TransactionOperation {
  id: string;
  type: string;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  startTime: string;
  endTime?: string;
  recordsAffected?: number;
  error?: string;
}

export type TransactionIsolation = 
  | 'READ_UNCOMMITTED' 
  | 'READ_COMMITTED' 
  | 'REPEATABLE_READ' 
  | 'SERIALIZABLE';

export interface SagaTransaction {
  success: boolean;
  sagaId: string;
  steps: SagaStep[];
  currentStep: number;
  status: SagaStatus;
  compensationActions: CompensationAction[];
}

export interface SagaStep {
  name: string;
  compensationAction: string;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  data?: any;
  error?: string;
}

export type SagaStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING' | 'COMPENSATED';

export interface CompensationAction {
  stepName: string;
  action: string;
  executed: boolean;
  executedAt?: string;
  success?: boolean;
  error?: string;
}

// =====================================================
// Sync Result Types
// =====================================================

export interface SyncResult {
  success: boolean;
  operationId: string;
  transactionId?: string;
  startTime: string;
  endTime: string;
  executionTime: number;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  recordsSkipped: number;
  retryAttempts?: number;
  totalExecutionTime?: number;
  addedToDeadLetterQueue?: boolean;
  compensationActionsExecuted?: CompensationAction[];
  metadata: SyncResultMetadata;
  error?: string;
  warnings?: string[];
}

export interface SyncResultMetadata {
  // General metadata
  batchesProcessed?: number;
  totalBatches?: number;
  parallelBatchesUsed?: number;
  recordsPerSecond?: number;
  
  // Attendance-specific metadata
  middleSchoolPeriodsProcessed?: number;
  correctionWindowApplied?: boolean;
  
  // i-Ready specific metadata
  diagnosticTypesProcessed?: DiagnosticType[];
  yearsProcessed?: string[];
  
  // A2A specific metadata
  interventionTypesProcessed?: InterventionType[];
  recoverySessionsProcessed?: number;
  
  // Performance metadata
  memoryUsageKept?: boolean;
  streamProcessingUsed?: boolean;
  connectionPoolUsed?: boolean;
  maxConnections?: number;
  
  // Validation metadata
  teacherRatioValidation?: boolean;
  ratioViolations?: TeacherRatioViolation[];
  
  // Compliance metadata
  complianceValidation?: boolean;
  complianceFramework?: ComplianceFramework;
  
  // School processing metadata
  schoolsProcessed?: SchoolConfiguration[];
}

// =====================================================
// Conflict Resolution Types
// =====================================================

export interface ConflictResult {
  success: boolean;
  conflictDetected: boolean;
  resolution: string;
  resolvedRecord?: any;
  conflictedRecords?: any[];
  manualReviewRequired?: boolean;
}

export interface ConflictData {
  type: ConflictType;
  affectedRecords: any[];
  strategy: ConflictResolutionStrategy;
  metadata?: any;
}

export type ConflictType = 
  | 'DUPLICATE_RECORD'
  | 'CONFLICTING_DATA'
  | 'VERSION_CONFLICT'
  | 'CONCURRENT_UPDATE'
  | 'DATA_INTEGRITY_VIOLATION';

export type ConflictResolutionStrategy = 
  | 'LAST_MODIFIED_WINS'
  | 'FIRST_WINS'
  | 'MANUAL_REVIEW'
  | 'MERGE_DATA'
  | 'VERSION_CONTROL';

// =====================================================
// Progress Tracking Types
// =====================================================

export interface ProgressUpdate {
  operationId: string;
  timestamp: string;
  percentage: number;
  currentStep: string;
  recordsProcessed: number;
  totalRecords: number;
  estimatedTimeRemaining?: number;
  currentBatch?: number;
  totalBatches?: number;
  throughput?: number;
}

export interface ProgressTracker {
  startTracking(operationId: string, totalRecords: number): void;
  updateProgress(operationId: string, recordsProcessed: number, currentStep?: string): void;
  completeTracking(operationId: string): void;
  getProgress(operationId: string): ProgressUpdate | null;
}

// =====================================================
// Monitoring and Metrics Types
// =====================================================

export interface SyncMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  successRate: number;
  errorRate: number;
  averageExecutionTime: number;
  totalDataProcessed: number;
  throughputRecordsPerSecond: number;
  currentActiveOperations: number;
  queuedOperations: number;
  lastSyncTime?: string;
  uptime: number;
}

export interface AlertThresholds {
  errorRate: number;
  syncLatency: number;
  failureCount: number;
  queueSize?: number;
  memoryUsage?: number;
  diskUsage?: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: string;
  operationId?: string;
  resolved: boolean;
  resolvedAt?: string;
}

export type AlertType = 
  | 'HIGH_ERROR_RATE'
  | 'SYNC_LATENCY_EXCEEDED'
  | 'QUEUE_SIZE_EXCEEDED'
  | 'MEMORY_USAGE_HIGH'
  | 'DISK_USAGE_HIGH'
  | 'CONNECTION_FAILURE'
  | 'DATA_QUALITY_ISSUE';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// =====================================================
// Domain-Specific Types
// =====================================================

export type SchoolType = 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL';
export type DiagnosticType = 'BOY' | 'MOY' | 'EOY';
export type Subject = 'ELA' | 'MATH';
export type InterventionType = 'TRUANCY_LETTER' | 'SARB_REFERRAL' | 'PARENT_COMMUNICATION' | 'RECOVERY_SESSION';
export type ComplianceFramework = 'CA_SB_153_176' | 'FERPA' | 'COPPA';

export interface PeriodConfiguration {
  totalPeriods: number;
  schoolType: SchoolType;
  blockSchedule?: boolean;
  attendanceCalculation?: 'PERIOD_BASED' | 'DAILY_BASED';
}

export interface CorrectionWindowConfig {
  enabled: boolean;
  days: number;
  includeWeekends: boolean;
}

export interface RecoverySessionConfig {
  hoursPerDay: number;
  maxSessionsPerWeek: number;
  trackAttendance: boolean;
}

export interface SchoolConfiguration {
  code: string;
  name: string;
  type: SchoolType;
  districtCode?: string;
  configuration?: {
    periods?: number;
    blockSchedule?: boolean;
    attendanceCalculation?: 'PERIOD_BASED' | 'DAILY_BASED';
  };
}

export interface TeacherRatioViolation {
  teacherId: string;
  teacherName: string;
  currentRatio: number;
  maxAllowedRatio: number;
  excessStudents: number;
  schoolCode: string;
}

// =====================================================
// Error Handling Types
// =====================================================

export interface SyncError {
  id: string;
  operationId: string;
  type: SyncErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  timestamp: string;
  stackTrace?: string;
  context?: {
    batchNumber?: number;
    recordIndex?: number;
    studentId?: string;
    schoolCode?: string;
  };
  retryable: boolean;
  retryCount: number;
  resolved: boolean;
  resolvedAt?: string;
}

export type SyncErrorType = 
  | 'API_ERROR'
  | 'DATABASE_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'DATA_FORMAT_ERROR'
  | 'CONSTRAINT_VIOLATION'
  | 'DEADLOCK_ERROR';

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RetryConfiguration {
  maxAttempts: number;
  baseDelay: number;
  multiplier: number;
  maxDelay: number;
  retryableErrors?: SyncErrorType[];
}

// =====================================================
// Performance and Optimization Types
// =====================================================

export interface PerformanceConfiguration {
  enableConnectionPooling: boolean;
  maxDatabaseConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  batchSizeOptimization: boolean;
  enableParallelProcessing: boolean;
  maxParallelOperations: number;
  memoryLimits: {
    maxHeapSize: string;
    maxBatchMemory: string;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  windowSizeMs: number;
}

export interface ConnectionConfig {
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
}

// =====================================================
// Event Types
// =====================================================

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  operationId?: string;
  timestamp: string;
  data: any;
  source: string;
}

export type SyncEventType = 
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'BATCH_PROCESSED'
  | 'PROGRESS_UPDATE'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'ALERT_TRIGGERED'
  | 'TRANSACTION_STARTED'
  | 'TRANSACTION_COMMITTED'
  | 'TRANSACTION_ROLLED_BACK';

// =====================================================
// Queue Management Types
// =====================================================

export interface SyncQueue {
  id: string;
  name: string;
  operations: SyncOperation[];
  maxSize: number;
  processingOrder: 'FIFO' | 'LIFO' | 'PRIORITY';
  parallelProcessing: boolean;
  maxConcurrentOperations: number;
}

export interface DeadLetterQueueStats {
  queueSize: number;
  oldestItemAge: number;
  retryAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  lastProcessedAt?: string;
}

// =====================================================
// Health Check Types
// =====================================================

export interface HealthCheck {
  status: HealthStatus;
  timestamp: string;
  checks: {
    database: ComponentHealth;
    aeries: ComponentHealth;
    iready: ComponentHealth;
    a2a: ComponentHealth;
    queue: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
  };
  overallHealth: ComponentHealth;
}

export interface ComponentHealth {
  status: HealthStatus;
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: any;
}

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';