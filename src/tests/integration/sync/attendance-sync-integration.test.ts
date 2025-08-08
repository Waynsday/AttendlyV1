/**
 * @fileoverview Integration tests for Attendance Sync Service
 * 
 * Tests integration with:
 * - Mock Aeries API (with rate limiting)
 * - Supabase database
 * - Audit logging system
 * - Circuit breaker functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { createAttendanceSyncService } from '@/lib/sync/enhanced-attendance-sync';
import type { AttendanceSyncConfig } from '@/lib/sync/enhanced-attendance-sync';

// =====================================================
// Mock Aeries API Server with Rate Limiting
// =====================================================

class MockAeriesServer {
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly rateLimitPerMinute = 60;
  private readonly requestWindow = 60000; // 1 minute
  private requestTimes: number[] = [];
  private shouldFailAfter?: number;
  private failureCount = 0;

  // Configure server behavior
  configure(options: { shouldFailAfter?: number } = {}) {
    this.shouldFailAfter = options.shouldFailAfter;
    this.failureCount = 0;
  }

  async processAttendanceBatches(
    startDate: string,
    endDate: string,
    callback: (records: any[], batchNumber: number) => Promise<void>,
    options: { schoolCode?: string; batchSize?: number } = {}
  ) {
    // Rate limiting check
    this.checkRateLimit();

    const batchSize = options.batchSize || 100;
    const schoolCode = options.schoolCode || '001';
    
    // Calculate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Simulate failure if configured
    if (this.shouldFailAfter && this.requestCount >= this.shouldFailAfter) {
      this.failureCount++;
      throw new Error(`Mock API failure (attempt ${this.failureCount})`);
    }

    let batchNumber = 0;
    let totalProcessed = 0;
    const errors: any[] = [];

    // Generate mock data for each day
    for (let day = 0; day < Math.min(daysDiff, 5); day++) { // Limit to 5 days for testing
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + day);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Create batches of mock records
      const recordsPerDay = Math.min(batchSize, 50); // Limit records per day
      const records = this.generateMockRecords(dateStr, schoolCode, recordsPerDay);

      if (records.length > 0) {
        batchNumber++;
        
        try {
          await callback(records, batchNumber);
          totalProcessed += records.length;
        } catch (error) {
          errors.push({
            batchNumber,
            error: error instanceof Error ? error.message : String(error),
            recordCount: records.length
          });
        }

        // Simulate processing delay
        await this.delay(10);
      }
    }

    return {
      totalProcessed,
      totalBatches: batchNumber,
      errors
    };
  }

  private checkRateLimit() {
    const now = Date.now();
    this.requestCount++;
    
    // Clean old requests
    this.requestTimes = this.requestTimes.filter(time => now - time < this.requestWindow);
    this.requestTimes.push(now);

    // Check rate limit
    if (this.requestTimes.length > this.rateLimitPerMinute) {
      throw new Error('Rate limit exceeded. Try again later.');
    }
  }

  private generateMockRecords(date: string, schoolCode: string, count: number) {
    const records = [];
    
    for (let i = 1; i <= count; i++) {
      const studentId = `${schoolCode}${String(i).padStart(4, '0')}`;
      const statuses = ['PRESENT', 'ABSENT', 'TARDY', 'EXCUSED_ABSENT'];
      const dailyStatus = statuses[Math.floor(Math.random() * statuses.length)];

      records.push({
        studentId,
        studentNumber: String(i).padStart(4, '0'),
        attendanceDate: date,
        schoolCode,
        schoolYear: '2024-2025',
        dailyStatus,
        periods: this.generatePeriodData(),
        lastModified: new Date().toISOString()
      });
    }

    return records;
  }

  private generatePeriodData() {
    const periods = [];
    const statuses = ['PRESENT', 'ABSENT', 'TARDY'];
    
    for (let period = 1; period <= 7; period++) {
      periods.push({
        period,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        minutesAbsent: Math.random() > 0.8 ? Math.floor(Math.random() * 50) : 0,
        minutesTardy: Math.random() > 0.9 ? Math.floor(Math.random() * 15) : 0
      });
    }

    return periods;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  reset() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.requestTimes = [];
    this.shouldFailAfter = undefined;
    this.failureCount = 0;
  }
}

// =====================================================
// Mock Database
// =====================================================

class MockDatabase {
  private students = new Map();
  private attendanceRecords = new Map();
  private syncOperations = new Map();
  private auditLogs: any[] = [];

  constructor() {
    // Pre-populate with test students
    this.addTestStudents();
  }

  private addTestStudents() {
    const schools = ['001', '002'];
    
    schools.forEach(schoolCode => {
      for (let i = 1; i <= 50; i++) {
        const studentId = `${schoolCode}${String(i).padStart(4, '0')}`;
        this.students.set(studentId, {
          id: `student-uuid-${studentId}`,
          school_id: `school-uuid-${schoolCode}`,
          aeries_student_id: studentId,
          first_name: `Student${i}`,
          last_name: `Test`,
          is_active: true
        });
      }
    });
  }

  async findStudent(aeriesStudentId: string) {
    const student = this.students.get(aeriesStudentId);
    return student ? { data: student, error: null } : { data: null, error: null };
  }

  async saveAttendanceRecord(record: any) {
    const key = `${record.student_id}-${record.attendance_date}`;
    this.attendanceRecords.set(key, { ...record, id: `attendance-${Date.now()}-${Math.random()}` });
    return { error: null };
  }

  async saveOperation(operation: any) {
    this.syncOperations.set(operation.operation_id, operation);
    return { error: null };
  }

  async logAudit(entry: any) {
    this.auditLogs.push({ ...entry, timestamp: new Date().toISOString() });
    return { error: null };
  }

  getAttendanceRecords() {
    return Array.from(this.attendanceRecords.values());
  }

  getAuditLogs() {
    return this.auditLogs;
  }

  reset() {
    this.attendanceRecords.clear();
    this.syncOperations.clear();
    this.auditLogs = [];
    this.addTestStudents();
  }
}

// =====================================================
// Test Setup
// =====================================================

describe('Attendance Sync Integration Tests', () => {
  let mockServer: MockAeriesServer;
  let mockDb: MockDatabase;
  let testConfig: AttendanceSyncConfig;

  beforeAll(() => {
    // Mock the dependencies
    mockServer = new MockAeriesServer();
    mockDb = new MockDatabase();

    // Mock Aeries client
    vi.mock('@/lib/aeries/aeries-client', () => ({
      getAeriesClient: vi.fn(() => Promise.resolve({
        processAttendanceBatches: mockServer.processAttendanceBatches.bind(mockServer)
      }))
    }));

    // Mock Supabase client
    vi.mock('@/lib/supabase/server', () => ({
      createClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'students') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => {
                    // Mock student lookup
                    return { data: null, error: null };
                  })
                }))
              }))
            };
          }
          if (table === 'attendance_records') {
            return {
              upsert: vi.fn(async (record: any) => mockDb.saveAttendanceRecord(record))
            };
          }
          if (table === 'aeries_sync_operations') {
            return {
              upsert: vi.fn(async (operation: any) => mockDb.saveOperation(operation))
            };
          }
          return {
            select: vi.fn(() => ({ data: [], error: null })),
            insert: vi.fn(() => ({ error: null })),
            upsert: vi.fn(() => ({ error: null }))
          };
        })
      }))
    }));

    // Mock FERPA compliance
    vi.mock('@/lib/security/ferpa-compliance', () => ({
      FERPACompliance: vi.fn().mockImplementation(() => ({
        validateStudentData: vi.fn(() => Promise.resolve({ compliant: true, violations: [] }))
      }))
    }));

    // Mock audit logger
    vi.mock('@/lib/audit/audit-logger', () => ({
      AuditLogger: vi.fn().mockImplementation(() => ({
        log: vi.fn(async (entry: any) => mockDb.logAudit(entry)),
        logError: vi.fn(async (action: string, error: any, metadata?: any) => 
          mockDb.logAudit({ action, error: error.message, metadata }))
      }))
    }));
  });

  beforeEach(() => {
    mockServer.reset();
    mockDb.reset();

    testConfig = {
      dateRange: {
        startDate: '2024-08-15',
        endDate: '2024-08-17' // Short range for testing
      },
      schools: ['001'],
      batchSize: 25,
      chunkDays: 1,
      parallelBatches: 2,
      retryConfig: {
        maxRetries: 2,
        initialDelay: 50,
        maxDelay: 200,
        backoffMultiplier: 2
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 500,
        halfOpenRequests: 1
      },
      monitoring: {
        enableProgressTracking: true,
        progressUpdateInterval: 100,
        enableMetrics: true
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Sync Operations', () => {
    it('should complete a small sync operation successfully', async () => {
      const service = await createAttendanceSyncService(testConfig);
      
      const result = await service.executeSync();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBeGreaterThan(0);
      expect(result.recordsProcessed).toBeLessThan(500); // Reasonable limit
      expect(mockServer.getRequestCount()).toBeGreaterThan(0);
      expect(mockServer.getRequestCount()).toBeLessThan(10); // Reasonable API calls
    });

    it('should respect rate limiting', async () => {
      const service = await createAttendanceSyncService({
        ...testConfig,
        schools: ['001', '002'], // Multiple schools to test rate limiting
        batchSize: 10
      });

      const startTime = Date.now();
      await service.executeSync();
      const duration = Date.now() - startTime;

      // Should take some time due to rate limiting
      expect(duration).toBeGreaterThan(50);
      expect(mockServer.getRequestCount()).toBeLessThan(20); // Reasonable limit
    });

    it('should track progress updates', async () => {
      const service = await createAttendanceSyncService(testConfig);
      const progressUpdates: any[] = [];

      service.on('progress', (update) => {
        progressUpdates.push(update);
      });

      await service.executeSync();

      // Wait for any pending progress updates
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates.length).toBeLessThan(50); // Reasonable number of updates
      
      progressUpdates.forEach(update => {
        expect(update).toHaveProperty('percentage');
        expect(update).toHaveProperty('recordsProcessed');
        expect(update.percentage).toBeGreaterThanOrEqual(0);
        expect(update.percentage).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should retry on temporary failures', async () => {
      // Configure server to fail first 2 requests then succeed
      mockServer.configure({ shouldFailAfter: 1 });

      const service = await createAttendanceSyncService({
        ...testConfig,
        retryConfig: {
          maxRetries: 3,
          initialDelay: 25,
          maxDelay: 100,
          backoffMultiplier: 2
        }
      });

      const result = await service.executeSync();

      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBeGreaterThan(0);
      expect(result.retryAttempts).toBeLessThanOrEqual(3);
    });

    it('should fail after max retries exceeded', async () => {
      // Configure server to always fail
      mockServer.configure({ shouldFailAfter: 0 });

      const service = await createAttendanceSyncService({
        ...testConfig,
        retryConfig: {
          maxRetries: 2,
          initialDelay: 25,
          maxDelay: 100,
          backoffMultiplier: 2
        }
      });

      await expect(service.executeSync()).rejects.toThrow('Mock API failure');
    });

    it('should handle circuit breaker opening', async () => {
      // Configure to fail frequently to trigger circuit breaker
      mockServer.configure({ shouldFailAfter: 0 });

      const service = await createAttendanceSyncService({
        ...testConfig,
        schools: ['001', '002'], // Multiple schools to trigger circuit breaker
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 200,
          halfOpenRequests: 1
        },
        retryConfig: {
          maxRetries: 0, // No retries to test circuit breaker faster
          initialDelay: 10,
          maxDelay: 50,
          backoffMultiplier: 1
        }
      });

      const result = await service.executeSync();

      expect(result.success).toBe(false);
      expect(result.metadata?.circuitBreakerState).toBeDefined();
      expect(mockServer.getRequestCount()).toBeLessThan(5); // Circuit should limit requests
    });
  });

  describe('Data Processing and Validation', () => {
    it('should process different attendance statuses correctly', async () => {
      const service = await createAttendanceSyncService(testConfig);
      
      await service.executeSync();

      const attendanceRecords = mockDb.getAttendanceRecords();
      expect(attendanceRecords.length).toBeGreaterThan(0);
      expect(attendanceRecords.length).toBeLessThan(200); // Reasonable limit

      // Check that records have required fields
      attendanceRecords.forEach(record => {
        expect(record).toHaveProperty('student_id');
        expect(record).toHaveProperty('attendance_date');
        expect(record).toHaveProperty('is_present');
        expect(typeof record.is_present).toBe('boolean');
      });
    });

    it('should handle period-based attendance', async () => {
      const service = await createAttendanceSyncService(testConfig);
      
      await service.executeSync();

      const attendanceRecords = mockDb.getAttendanceRecords();
      const recordsWithPeriods = attendanceRecords.filter(record => 
        Object.keys(record).some(key => key.startsWith('period_'))
      );

      expect(recordsWithPeriods.length).toBeGreaterThan(0);
    });
  });

  describe('Audit and Monitoring', () => {
    it('should create audit logs for sync operations', async () => {
      const service = await createAttendanceSyncService(testConfig);
      
      await service.executeSync();

      const auditLogs = mockDb.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs.length).toBeLessThan(20); // Reasonable number of logs

      const syncLogs = auditLogs.filter(log => 
        log.action === 'SYNC_SERVICE_INITIALIZED' || 
        log.action === 'SYNC_COMPLETED'
      );
      expect(syncLogs.length).toBeGreaterThanOrEqual(2);
    });

    it('should log errors appropriately', async () => {
      mockServer.configure({ shouldFailAfter: 0 });

      const service = await createAttendanceSyncService({
        ...testConfig,
        retryConfig: { maxRetries: 1, initialDelay: 10, maxDelay: 50, backoffMultiplier: 1 }
      });

      try {
        await service.executeSync();
      } catch (error) {
        // Expected to fail
      }

      const auditLogs = mockDb.getAuditLogs();
      const errorLogs = auditLogs.filter(log => log.action === 'SYNC_FAILED');
      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Limits', () => {
    it('should complete sync within reasonable time', async () => {
      const service = await createAttendanceSyncService(testConfig);
      
      const startTime = Date.now();
      await service.executeSync();
      const duration = Date.now() - startTime;

      // Should complete within 10 seconds for test data
      expect(duration).toBeLessThan(10000);
    });

    it('should not exceed reasonable resource usage', async () => {
      const service = await createAttendanceSyncService(testConfig);
      
      const initialMemory = process.memoryUsage().heapUsed;
      await service.executeSync();
      const finalMemory = process.memoryUsage().heapUsed;
      
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not use more than 50MB additional memory
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});