/**
 * @fileoverview Unit tests for Enhanced Attendance Sync Service
 * 
 * Tests cover:
 * - Service initialization
 * - Batch processing
 * - Error handling and retry logic
 * - Circuit breaker functionality
 * - Progress tracking
 * - Checkpoint/resume capability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedAttendanceSyncService, AttendanceDataValidator } from '@/lib/sync/enhanced-attendance-sync';
import type { AttendanceSyncConfig } from '@/lib/sync/enhanced-attendance-sync';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          data: []
        }))
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      insert: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }))
}));

vi.mock('@/lib/aeries/aeries-client', () => ({
  getAeriesClient: vi.fn(() => Promise.resolve({
    processAttendanceBatches: vi.fn()
  }))
}));

vi.mock('@/lib/security/ferpa-compliance', () => ({
  FERPACompliance: vi.fn().mockImplementation(() => ({
    validateStudentData: vi.fn(() => Promise.resolve({ compliant: true, violations: [] }))
  }))
}));

vi.mock('@/lib/audit/audit-logger', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn(() => Promise.resolve()),
    logError: vi.fn(() => Promise.resolve())
  }))
}));

describe('EnhancedAttendanceSyncService', () => {
  let service: EnhancedAttendanceSyncService;
  let defaultConfig: AttendanceSyncConfig;

  beforeEach(() => {
    defaultConfig = {
      dateRange: {
        startDate: '2024-08-15',
        endDate: '2024-08-20'
      },
      batchSize: 100,
      chunkDays: 7,
      parallelBatches: 2,
      retryConfig: {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 1000,
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

  describe('Service Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      service = new EnhancedAttendanceSyncService(defaultConfig);
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        dateRange: {
          startDate: 'invalid-date',
          endDate: '2024-08-20'
        },
        batchSize: 100
      };

      expect(() => new EnhancedAttendanceSyncService(invalidConfig as any)).toThrow();
    });

    it('should emit initialized event', async () => {
      service = new EnhancedAttendanceSyncService(defaultConfig);
      
      const initializedPromise = new Promise<void>((resolve) => {
        service.once('initialized', resolve);
      });

      await service.initialize();
      await expect(initializedPromise).resolves.not.toThrow();
    });
  });

  describe('Sync Execution', () => {
    beforeEach(async () => {
      service = new EnhancedAttendanceSyncService(defaultConfig);
      await service.initialize();
    });

    it('should execute sync successfully with mock data', async () => {
      // Mock Aeries client to return test data
      const mockAeriesClient = {
        processAttendanceBatches: vi.fn(async (start, end, callback) => {
          // Simulate 2 batches with 5 records each
          await callback([
            { studentId: '1', attendanceDate: '2024-08-15', schoolCode: '001', dailyStatus: 'PRESENT' },
            { studentId: '2', attendanceDate: '2024-08-15', schoolCode: '001', dailyStatus: 'ABSENT' },
            { studentId: '3', attendanceDate: '2024-08-15', schoolCode: '001', dailyStatus: 'PRESENT' },
            { studentId: '4', attendanceDate: '2024-08-15', schoolCode: '001', dailyStatus: 'TARDY' },
            { studentId: '5', attendanceDate: '2024-08-15', schoolCode: '001', dailyStatus: 'PRESENT' }
          ], 1);
          
          await callback([
            { studentId: '6', attendanceDate: '2024-08-16', schoolCode: '001', dailyStatus: 'PRESENT' },
            { studentId: '7', attendanceDate: '2024-08-16', schoolCode: '001', dailyStatus: 'PRESENT' },
            { studentId: '8', attendanceDate: '2024-08-16', schoolCode: '001', dailyStatus: 'ABSENT' },
            { studentId: '9', attendanceDate: '2024-08-16', schoolCode: '001', dailyStatus: 'PRESENT' },
            { studentId: '10', attendanceDate: '2024-08-16', schoolCode: '001', dailyStatus: 'PRESENT' }
          ], 2);

          return { totalProcessed: 10, totalBatches: 2, errors: [] };
        })
      };

      vi.mocked(await import('@/lib/aeries/aeries-client')).getAeriesClient.mockResolvedValue(mockAeriesClient as any);

      const result = await service.executeSync();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(10);
      expect(result.recordsSkipped).toBe(10); // All skipped because no students found in DB
      expect(mockAeriesClient.processAttendanceBatches).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      const mockAeriesClient = {
        processAttendanceBatches: vi.fn().mockRejectedValue(new Error('API Error'))
      };

      vi.mocked(await import('@/lib/aeries/aeries-client')).getAeriesClient.mockResolvedValue(mockAeriesClient as any);

      await expect(service.executeSync()).rejects.toThrow('API Error');
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      service = new EnhancedAttendanceSyncService(defaultConfig);
      await service.initialize();
    });

    it('should emit progress updates during sync', async () => {
      const progressUpdates: any[] = [];
      
      service.on('progress', (update) => {
        progressUpdates.push(update);
      });

      // Mock successful sync with limited data
      const mockAeriesClient = {
        processAttendanceBatches: vi.fn(async (start, end, callback) => {
          await callback([
            { studentId: '1', attendanceDate: '2024-08-15', schoolCode: '001', dailyStatus: 'PRESENT' }
          ], 1);
          return { totalProcessed: 1, totalBatches: 1, errors: [] };
        })
      };

      vi.mocked(await import('@/lib/aeries/aeries-client')).getAeriesClient.mockResolvedValue(mockAeriesClient as any);

      await service.executeSync();

      // Wait for progress updates
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty('percentage');
      expect(progressUpdates[0]).toHaveProperty('recordsProcessed');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure up to max retries', async () => {
      const retryConfig = {
        ...defaultConfig,
        retryConfig: {
          maxRetries: 2,
          initialDelay: 50,
          maxDelay: 200,
          backoffMultiplier: 2
        }
      };

      service = new EnhancedAttendanceSyncService(retryConfig);
      await service.initialize();

      let attemptCount = 0;
      const mockAeriesClient = {
        processAttendanceBatches: vi.fn(async () => {
          attemptCount++;
          if (attemptCount <= 2) {
            throw new Error('Temporary failure');
          }
          return { totalProcessed: 0, totalBatches: 0, errors: [] };
        })
      };

      vi.mocked(await import('@/lib/aeries/aeries-client')).getAeriesClient.mockResolvedValue(mockAeriesClient as any);

      const result = await service.executeSync();
      
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3); // Initial + 2 retries
      expect(result.retryAttempts).toBe(2);
    });

    it('should fail after max retries exceeded', async () => {
      const retryConfig = {
        ...defaultConfig,
        retryConfig: {
          maxRetries: 1,
          initialDelay: 50,
          maxDelay: 100,
          backoffMultiplier: 2
        }
      };

      service = new EnhancedAttendanceSyncService(retryConfig);
      await service.initialize();

      const mockAeriesClient = {
        processAttendanceBatches: vi.fn().mockRejectedValue(new Error('Persistent failure'))
      };

      vi.mocked(await import('@/lib/aeries/aeries-client')).getAeriesClient.mockResolvedValue(mockAeriesClient as any);

      await expect(service.executeSync()).rejects.toThrow('Persistent failure');
      expect(mockAeriesClient.processAttendanceBatches).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const circuitConfig = {
        ...defaultConfig,
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 500,
          halfOpenRequests: 1
        },
        schools: ['001', '002', '003'] // Multiple schools to test circuit breaker
      };

      service = new EnhancedAttendanceSyncService(circuitConfig);
      await service.initialize();

      let callCount = 0;
      const mockAeriesClient = {
        processAttendanceBatches: vi.fn(async () => {
          callCount++;
          throw new Error('Service unavailable');
        })
      };

      vi.mocked(await import('@/lib/aeries/aeries-client')).getAeriesClient.mockResolvedValue(mockAeriesClient as any);

      const result = await service.executeSync();
      
      // Circuit should open after 2 failures, preventing further calls
      expect(callCount).toBeLessThanOrEqual(circuitConfig.circuitBreaker.failureThreshold);
      expect(result.metadata?.circuitBreakerState).toBeDefined();
    });
  });

  describe('Checkpoint and Resume', () => {
    beforeEach(async () => {
      service = new EnhancedAttendanceSyncService(defaultConfig);
      await service.initialize();
    });

    it('should save checkpoint', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => Promise.resolve({ error: null }))
        }))
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient.mockReturnValue(mockSupabase as any);

      const checkpointId = await service.saveCheckpoint();
      
      expect(checkpointId).toMatch(/^checkpoint-\d+$/);
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_checkpoints');
    });
  });
});

describe('AttendanceDataValidator', () => {
  let validator: AttendanceDataValidator;

  beforeEach(() => {
    validator = new AttendanceDataValidator();
  });

  describe('Record Validation', () => {
    it('should validate valid attendance record', async () => {
      const record = {
        studentId: '12345',
        attendanceDate: '2024-08-15',
        schoolCode: '001',
        dailyStatus: 'PRESENT',
        schoolYear: '2024-2025'
      };

      const result = await validator.validateAttendanceRecord(record);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedRecord).toBeDefined();
    });

    it('should reject record with missing required fields', async () => {
      const record = {
        attendanceDate: '2024-08-15',
        schoolCode: '001'
      };

      const result = await validator.validateAttendanceRecord(record);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing studentId');
    });

    it('should reject record with invalid date format', async () => {
      const record = {
        studentId: '12345',
        attendanceDate: '08/15/2024', // Wrong format
        schoolCode: '001'
      };

      const result = await validator.validateAttendanceRecord(record);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid date format for attendanceDate');
    });

    it('should handle period-based attendance', async () => {
      const record = {
        studentId: '12345',
        attendanceDate: '2024-08-15',
        schoolCode: '001',
        dailyStatus: 'PRESENT',
        periods: [
          { period: 1, status: 'PRESENT' },
          { period: 2, status: 'TARDY' },
          { period: 3, status: 'ABSENT' },
          { period: 4, status: 'PRESENT' },
          { period: 5, status: 'PRESENT' },
          { period: 6, status: 'PRESENT' },
          { period: 7, status: 'PRESENT' }
        ]
      };

      const result = await validator.validateAttendanceRecord(record);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedRecord).toHaveProperty('period_1_status', 'PRESENT');
      expect(result.sanitizedRecord).toHaveProperty('period_2_status', 'TARDY');
      expect(result.sanitizedRecord).toHaveProperty('period_3_status', 'ABSENT');
    });

    it('should calculate presence correctly', async () => {
      const absentRecord = {
        studentId: '12345',
        attendanceDate: '2024-08-15',
        schoolCode: '001',
        dailyStatus: 'ABSENT'
      };

      const presentRecord = {
        studentId: '12346',
        attendanceDate: '2024-08-15',
        schoolCode: '001',
        dailyStatus: 'TARDY'
      };

      const absentResult = await validator.validateAttendanceRecord(absentRecord);
      const presentResult = await validator.validateAttendanceRecord(presentRecord);

      expect(absentResult.sanitizedRecord?.is_present).toBe(false);
      expect(presentResult.sanitizedRecord?.is_present).toBe(true);
    });
  });
});