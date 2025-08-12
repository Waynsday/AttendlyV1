/**
 * Integration Tests for Enhanced Attendance Sync
 * 
 * Tests the enhanced Aeries attendance synchronization with date range processing,
 * error handling, and recovery mechanisms for the school year 2024-2025.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { AeriesApiClient } from '../../../infrastructure/external-services/aeries-api-client';
import { EnhancedAttendanceSyncManager } from '../../../../scripts/enhanced-attendance-sync';
import { createClient } from '../../../lib/supabase/client';

// Test configuration
const TEST_CONFIG = {
  startDate: '2024-08-15',
  endDate: '2024-09-15', // Test with 1 month for faster tests
  batchSize: 100,
  dateChunkSizeDays: 7,
  testSchoolCode: 'TEST001'
};

// Mock data
const mockAttendanceData = [
  {
    studentId: '1234567',
    attendanceDate: '2024-08-15',
    dailyStatus: 'PRESENT',
    periods: [
      { period: 1, status: 'PRESENT' },
      { period: 2, status: 'PRESENT' },
      { period: 3, status: 'TARDY' }
    ],
    tardyCount: 1,
    daysEnrolled: '1.0'
  },
  {
    studentId: '1234568',
    attendanceDate: '2024-08-15',
    dailyStatus: 'ABSENT',
    periods: [
      { period: 1, status: 'ABSENT' },
      { period: 2, status: 'ABSENT' },
      { period: 3, status: 'ABSENT' }
    ],
    tardyCount: 0,
    daysEnrolled: '1.0'
  }
];

const mockSchoolData = [
  {
    id: 'school-uuid-1',
    school_code: 'TEST001',
    aeries_school_code: '001',
    district_id: 'district-uuid-1'
  }
];

const mockStudentData = [
  {
    id: 'student-uuid-1',
    aeries_student_id: '1234567',
    school_id: 'school-uuid-1'
  },
  {
    id: 'student-uuid-2',
    aeries_student_id: '1234568',
    school_id: 'school-uuid-1'
  }
];

describe('Enhanced Attendance Sync Integration Tests', () => {
  let apiClient: AeriesApiClient;
  let syncManager: EnhancedAttendanceSyncManager;
  let supabase: any;

  beforeEach(() => {
    // Mock Supabase client
    supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: mockStudentData[0], error: null })),
            data: mockSchoolData,
            error: null
          })),
          data: mockSchoolData,
          error: null
        })),
        upsert: vi.fn(() => ({ error: null }))
      }))
    };

    // Create test instances
    apiClient = new AeriesApiClient();
    
    // Mock API client methods
    vi.spyOn(apiClient, 'healthCheck').mockResolvedValue(true);
    vi.spyOn(apiClient, 'getAttendanceByDateRange').mockResolvedValue({
      success: true,
      data: mockAttendanceData
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Date Range Processing', () => {
    test('should create correct date chunks for the school year', () => {
      const chunks = (apiClient as any).createDateChunks(
        '2024-08-15',
        '2025-06-12',
        30
      );

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].start).toBe('2024-08-15');
      expect(chunks[chunks.length - 1].end).toBe('2025-06-12');

      // Verify chunks don't overlap and cover the full range
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = new Date(chunks[i - 1].end);
        const currentStart = new Date(chunks[i].start);
        const expectedStart = new Date(prevEnd);
        expectedStart.setDate(expectedStart.getDate() + 1);
        
        expect(currentStart.getTime()).toBe(expectedStart.getTime());
      }
    });

    test('should handle edge cases for date chunking', () => {
      // Single day range
      const singleDayChunks = (apiClient as any).createDateChunks(
        '2024-08-15',
        '2024-08-15',
        30
      );
      expect(singleDayChunks).toHaveLength(1);
      expect(singleDayChunks[0].start).toBe('2024-08-15');
      expect(singleDayChunks[0].end).toBe('2024-08-15');

      // Large chunk size
      const largeChunkSize = (apiClient as any).createDateChunks(
        '2024-08-15',
        '2024-08-25',
        365
      );
      expect(largeChunkSize).toHaveLength(1);
      expect(largeChunkSize[0].start).toBe('2024-08-15');
      expect(largeChunkSize[0].end).toBe('2024-08-25');
    });
  });

  describe('Batch Processing with Date Chunks', () => {
    test('should process attendance data in date chunks', async () => {
      const processedBatches: any[] = [];
      const batchCallback = vi.fn(async (batch: any[], batchNumber: number) => {
        processedBatches.push({ batch, batchNumber });
      });

      const result = await apiClient.processAttendanceBatches(
        batchCallback,
        {
          startDate: TEST_CONFIG.startDate,
          endDate: TEST_CONFIG.endDate,
          batchSize: TEST_CONFIG.batchSize,
          dateChunkSizeDays: TEST_CONFIG.dateChunkSizeDays
        }
      );

      expect(result.totalProcessed).toBeGreaterThan(0);
      expect(result.totalBatches).toBeGreaterThan(0);
      expect(batchCallback).toHaveBeenCalled();
      expect(processedBatches.length).toBeGreaterThan(0);

      // Verify batch metadata was added
      const firstBatch = processedBatches[0].batch;
      expect(firstBatch[0]).toHaveProperty('_batchMetadata');
      expect(firstBatch[0]._batchMetadata).toHaveProperty('batchNumber');
      expect(firstBatch[0]._batchMetadata).toHaveProperty('chunkStart');
      expect(firstBatch[0]._batchMetadata).toHaveProperty('chunkEnd');
      expect(firstBatch[0]._batchMetadata).toHaveProperty('processedAt');
    });

    test('should handle resume from specific batch', async () => {
      const processedBatches: any[] = [];
      const batchCallback = vi.fn(async (batch: any[], batchNumber: number) => {
        processedBatches.push({ batch, batchNumber });
      });

      const resumeFromBatch = 5;
      
      // Mock multiple chunks
      vi.spyOn(apiClient, 'getAttendanceByDateRange')
        .mockResolvedValueOnce({
          success: true,
          data: mockAttendanceData
        })
        .mockResolvedValueOnce({
          success: true,
          data: []
        });

      const result = await apiClient.processAttendanceBatches(
        batchCallback,
        {
          startDate: TEST_CONFIG.startDate,
          endDate: TEST_CONFIG.endDate,
          resumeFromBatch
        }
      );

      // Should start from resumed batch
      if (processedBatches.length > 0) {
        expect(processedBatches[0].batchNumber).toBeGreaterThanOrEqual(resumeFromBatch);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle critical errors properly', () => {
      const criticalErrors = [
        new Error('Authentication failed'),
        new Error('SSL certificate error'),
        new Error('Connection refused'),
        new Error('DNS lookup failed')
      ];

      criticalErrors.forEach(error => {
        const isCritical = (apiClient as any).isCriticalError(error);
        expect(isCritical).toBe(true);
      });
    });

    test('should handle non-critical errors properly', () => {
      const nonCriticalErrors = [
        new Error('Temporary timeout'),
        new Error('Rate limit exceeded'),
        new Error('Invalid data format')
      ];

      nonCriticalErrors.forEach(error => {
        const isCritical = (apiClient as any).isCriticalError(error);
        expect(isCritical).toBe(false);
      });
    });

    test('should continue processing after non-critical errors', async () => {
      let callCount = 0;
      const batchCallback = vi.fn(async (batch: any[], batchNumber: number) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary processing error');
        }
        // Continue normally for subsequent calls
      });

      // Setup mock to return data twice
      vi.spyOn(apiClient, 'getAttendanceByDateRange')
        .mockResolvedValueOnce({
          success: true,
          data: mockAttendanceData
        })
        .mockResolvedValueOnce({
          success: true,
          data: mockAttendanceData
        })
        .mockResolvedValueOnce({
          success: true,
          data: []
        });

      const result = await apiClient.processAttendanceBatches(
        batchCallback,
        {
          startDate: TEST_CONFIG.startDate,
          endDate: TEST_CONFIG.endDate,
          batchSize: 1 // Small batch size to ensure multiple calls
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(batchCallback).toHaveBeenCalledTimes(2);
    });

    test('should stop processing on critical errors', async () => {
      const batchCallback = vi.fn(async (batch: any[], batchNumber: number) => {
        throw new Error('Authentication failed');
      });

      await expect(
        apiClient.processAttendanceBatches(batchCallback, {
          startDate: TEST_CONFIG.startDate,
          endDate: TEST_CONFIG.endDate
        })
      ).rejects.toThrow('Authentication failed');
    });
  });

  describe('Data Transformation', () => {
    test('should correctly transform Aeries attendance records', async () => {
      const syncManager = new EnhancedAttendanceSyncManager();
      const mockSchool = mockSchoolData[0];
      
      // Mock the private method
      const transformedRecord = await (syncManager as any).transformAttendanceRecord(
        mockAttendanceData[0],
        mockSchool
      );

      expect(transformedRecord).toHaveProperty('student_id');
      expect(transformedRecord).toHaveProperty('school_id', mockSchool.id);
      expect(transformedRecord).toHaveProperty('attendance_date', '2024-08-15');
      expect(transformedRecord).toHaveProperty('is_present', true);
      expect(transformedRecord).toHaveProperty('period_1_status', 'PRESENT');
      expect(transformedRecord).toHaveProperty('period_3_status', 'TARDY');
      expect(transformedRecord.tardy_count).toBe(1);
      expect(transformedRecord.can_be_corrected).toBe(true);
    });

    test('should map attendance statuses correctly', () => {
      const syncManager = new EnhancedAttendanceSyncManager();
      
      const statusMappings = [
        ['P', 'PRESENT'],
        ['A', 'ABSENT'],
        ['T', 'TARDY'],
        ['E', 'EXCUSED_ABSENT'],
        ['U', 'UNEXCUSED_ABSENT'],
        ['S', 'SUSPENDED'],
        ['PRESENT', 'PRESENT'],
        ['invalid', 'PRESENT'] // Default case
      ];

      statusMappings.forEach(([input, expected]) => {
        const result = (syncManager as any).mapAttendanceStatus(input);
        expect(result).toBe(expected);
      });
    });

    test('should calculate correction deadlines correctly', () => {
      const syncManager = new EnhancedAttendanceSyncManager();
      
      const testDate = '2024-08-15';
      const deadline = (syncManager as any).calculateCorrectionDeadline(testDate);
      
      expect(deadline).toBe('2024-08-22'); // 7 days later
    });

    test('should determine correction window correctly', () => {
      const syncManager = new EnhancedAttendanceSyncManager();
      
      const today = new Date();
      const withinWindow = new Date(today);
      withinWindow.setDate(withinWindow.getDate() - 5); // 5 days ago
      
      const outsideWindow = new Date(today);
      outsideWindow.setDate(outsideWindow.getDate() - 10); // 10 days ago

      expect((syncManager as any).isWithinCorrectionWindow(withinWindow.toISOString().split('T')[0])).toBe(true);
      expect((syncManager as any).isWithinCorrectionWindow(outsideWindow.toISOString().split('T')[0])).toBe(false);
    });
  });

  describe('Performance and Rate Limiting', () => {
    test('should apply exponential backoff on errors', async () => {
      const delays: number[] = [];
      const originalDelay = (apiClient as any).delay;
      
      // Mock delay to capture timing
      vi.spyOn(apiClient as any, 'delay').mockImplementation(async (ms: number) => {
        delays.push(ms);
        return originalDelay.call(apiClient, 10); // Use short delay for tests
      });

      let errorCount = 0;
      const batchCallback = vi.fn(async (batch: any[], batchNumber: number) => {
        errorCount++;
        if (errorCount <= 3) {
          throw new Error('Temporary error');
        }
      });

      // Mock multiple responses
      for (let i = 0; i < 5; i++) {
        vi.spyOn(apiClient, 'getAttendanceByDateRange')
          .mockResolvedValueOnce({
            success: true,
            data: mockAttendanceData
          });
      }

      await apiClient.processAttendanceBatches(batchCallback, {
        startDate: TEST_CONFIG.startDate,
        endDate: TEST_CONFIG.endDate,
        batchSize: 1
      });

      // Verify exponential backoff pattern
      expect(delays.length).toBeGreaterThan(0);
      if (delays.length > 1) {
        // Should increase with errors
        expect(delays[1]).toBeGreaterThan(delays[0]);
      }
    });

    test('should respect batch size limits', async () => {
      const processedBatches: number[] = [];
      const batchCallback = vi.fn(async (batch: any[], batchNumber: number) => {
        processedBatches.push(batch.length);
      });

      const batchSize = 1;
      
      vi.spyOn(apiClient, 'getAttendanceByDateRange')
        .mockResolvedValueOnce({
          success: true,
          data: mockAttendanceData.slice(0, 1)
        })
        .mockResolvedValueOnce({
          success: true,
          data: []
        });

      await apiClient.processAttendanceBatches(batchCallback, {
        startDate: TEST_CONFIG.startDate,
        endDate: TEST_CONFIG.endDate,
        batchSize
      });

      processedBatches.forEach(size => {
        expect(size).toBeLessThanOrEqual(batchSize);
      });
    });
  });

  describe('Full School Year Date Range', () => {
    test('should handle full school year date range', () => {
      const chunks = (apiClient as any).createDateChunks(
        '2024-08-15',
        '2025-06-12',
        30
      );

      expect(chunks.length).toBe(10); // ~300 days / 30 days per chunk
      expect(chunks[0].start).toBe('2024-08-15');
      expect(chunks[chunks.length - 1].end).toBe('2025-06-12');

      // Verify no gaps between chunks
      for (let i = 1; i < chunks.length; i++) {
        const prevEndDate = new Date(chunks[i - 1].end);
        const currentStartDate = new Date(chunks[i].start);
        const expectedStart = new Date(prevEndDate);
        expectedStart.setDate(expectedStart.getDate() + 1);
        
        expect(currentStartDate.getTime()).toBe(expectedStart.getTime());
      }
    });

    test('should handle date boundaries correctly', () => {
      // Test month boundaries
      const monthBoundaryChunks = (apiClient as any).createDateChunks(
        '2024-08-30',
        '2024-09-05',
        3
      );

      expect(monthBoundaryChunks.length).toBe(3);
      expect(monthBoundaryChunks[0]).toEqual({ start: '2024-08-30', end: '2024-09-01' });
      expect(monthBoundaryChunks[1]).toEqual({ start: '2024-09-02', end: '2024-09-04' });
      expect(monthBoundaryChunks[2]).toEqual({ start: '2024-09-05', end: '2024-09-05' });

      // Test year boundaries
      const yearBoundaryChunks = (apiClient as any).createDateChunks(
        '2024-12-30',
        '2025-01-05',
        3
      );

      expect(yearBoundaryChunks.length).toBe(3);
      expect(yearBoundaryChunks[0]).toEqual({ start: '2024-12-30', end: '2025-01-01' });
      expect(yearBoundaryChunks[1]).toEqual({ start: '2025-01-02', end: '2025-01-04' });
      expect(yearBoundaryChunks[2]).toEqual({ start: '2025-01-05', end: '2025-01-05' });
    });
  });
});