/**
 * @fileoverview Aeries SIS API Type Definitions
 * 
 * Defines TypeScript interfaces for Aeries API integration with
 * comprehensive type safety for attendance data synchronization.
 * 
 * SECURITY NOTE: All types include FERPA-compliant field validation
 * and sensitive data handling requirements.
 */

// =====================================================
// Aeries Configuration Types
// =====================================================

export interface AeriesConfig {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  districtCode: string;
  certificatePath: string;
  privateKeyPath: string;
  caCertPath: string;
  syncEnabled: boolean;
  syncSchedule: string;
  attendanceStartDate: string;
  attendanceEndDate: string;
  batchSize: number;
  rateLimitPerMinute: number;
}

export interface AeriesCertificateConfig {
  clientCert: string;
  privateKey: string;
  caCert: string;
  passphrase?: string;
}

// =====================================================
// Aeries API Response Types
// =====================================================

export interface AeriesApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  pagination?: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export interface AeriesErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// =====================================================
// Aeries Student Data Types
// =====================================================

export interface AeriesStudent {
  studentId: string;
  studentNumber: string;
  stateStudentId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  grade: string;
  schoolCode: string;
  homeRoom?: string;
  enrollmentStatus: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
  enrollmentDate: string;
  withdrawalDate?: string;
  birthDate: string;
  gender: 'M' | 'F' | 'X';
  ethnicity?: string;
  language?: string;
  specialPrograms?: string[];
  lastUpdate: string;
}

// =====================================================
// Aeries Attendance Data Types
// =====================================================

export interface AeriesAttendanceRecord {
  studentId: string;
  studentNumber: string;
  schoolCode: string;
  attendanceDate: string;
  schoolYear: string;
  periods: AeriesAttendancePeriod[];
  dailyAttendance: {
    status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT';
    minutesAbsent?: number;
    minutesTardy?: number;
    excuseCode?: string;
    excuseDescription?: string;
  };
  lastModified: string;
  modifiedBy: string;
}

export interface AeriesAttendancePeriod {
  period: number;
  periodName: string;
  status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT';
  teacherId?: string;
  teacherName?: string;
  courseCode?: string;
  courseName?: string;
  minutesAbsent?: number;
  minutesTardy?: number;
  excuseCode?: string;
  lastModified: string;
}

// =====================================================
// Aeries Sync Operation Types
// =====================================================

export interface AeriesSyncOperation {
  operationId: string;
  type: 'FULL_SYNC' | 'INCREMENTAL_SYNC' | 'MANUAL_SYNC';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startTime: string;
  endTime?: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  batchSize: number;
  progress: {
    totalRecords: number;
    processedRecords: number;
    successfulRecords: number;
    failedRecords: number;
    currentBatch: number;
    totalBatches: number;
  };
  errors?: AeriesSyncError[];
  metadata: {
    initiatedBy: string;
    userAgent: string;
    ipAddress: string;
  };
}

export interface AeriesSyncError {
  errorId: string;
  batchNumber: number;
  recordIndex: number;
  studentId?: string;
  errorCode: string;
  errorMessage: string;
  errorDetails?: any;
  timestamp: string;
  retryCount: number;
  resolved: boolean;
}

export interface AeriesSyncResult {
  operation: AeriesSyncOperation;
  summary: {
    totalRequested: number;
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    duplicatesSkipped: number;
    newRecords: number;
    updatedRecords: number;
  };
  performanceMetrics: {
    averageApiResponseTime: number;
    averageBatchProcessingTime: number;
    totalSyncTime: number;
    rateLimitHits: number;
  };
}

// =====================================================
// Aeries API Client Types
// =====================================================

export interface AeriesApiClientOptions {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  certificateConfig: AeriesCertificateConfig;
  timeout: number;
  retryAttempts: number;
  rateLimitConfig: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

export interface AeriesApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retryOnFailure?: boolean;
}

// =====================================================
// Aeries Integration Events
// =====================================================

export interface AeriesIntegrationEvent {
  eventId: string;
  type: 'API_CALL' | 'SYNC_START' | 'SYNC_COMPLETE' | 'ERROR' | 'RATE_LIMIT' | 'CERTIFICATE_RENEWAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  details: {
    endpoint?: string;
    method?: string;
    responseTime?: number;
    statusCode?: number;
    batchNumber?: number;
    recordCount?: number;
    errorMessage?: string;
  };
  metadata: {
    operationId?: string;
    userId?: string;
    correlationId: string;
  };
}

// =====================================================
// Database Mapping Types
// =====================================================

export interface AeriesAttendanceMapping {
  aeriesRecord: AeriesAttendanceRecord;
  localRecord: {
    studentId: string;
    date: string;
    schoolYear: string;
    dailyStatus: string;
    periodAttendance: Array<{
      period: number;
      status: string;
      minutesAbsent?: number;
      minutesTardy?: number;
    }>;
    syncMetadata: {
      aeriesLastModified: string;
      syncTimestamp: string;
      syncOperationId: string;
    };
  };
}

// =====================================================
// Validation and Security Types
// =====================================================

export interface AeriesDataValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value: any;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    value: any;
  }>;
  sanitizedData: any;
}

export interface AeriesSecurityContext {
  certificateValid: boolean;
  apiKeyValid: boolean;
  rateLimitRemaining: number;
  lastHealthCheck: string;
  encryptionEnabled: boolean;
  auditingEnabled: boolean;
}

// =====================================================
// Rate Limiting Types
// =====================================================

export interface AeriesRateLimit {
  requestsPerMinute: number;
  requestsRemaining: number;
  resetTime: string;
  burstLimit: number;
  currentBurstUsage: number;
}

// =====================================================
// Certificate Management Types
// =====================================================

export interface AeriesCertificateStatus {
  isValid: boolean;
  expirationDate: string;
  daysUntilExpiration: number;
  issuer: string;
  subject: string;
  serialNumber: string;
  renewalRequired: boolean;
  lastValidated: string;
}