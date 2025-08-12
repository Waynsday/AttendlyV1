/**
 * @fileoverview Enhanced Aeries API Client Tests
 * 
 * Comprehensive test suite for the enhanced Aeries API client with:
 * - Circuit breaker pattern integration
 * - Exponential backoff and retry logic
 * - Dead letter queue for failed operations
 * - Romoland-specific query handling
 * - Advanced error handling and monitoring
 * 
 * Following TDD practices - these tests define the expected behavior
 * of the enhanced client before implementation.
 */

import { jest } from '@jest/globals';
import { CircuitBreaker, CircuitBreakerState } from '../../../../lib/aeries/circuit-breaker';
import { EnhancedAeriesClient } from '../../../../lib/aeries/enhanced-aeries-client';
import { DeadLetterQueue } from '../../../../lib/aeries/dead-letter-queue';
import { ExponentialBackoff } from '../../../../lib/aeries/exponential-backoff';
import { RomolandQueryBuilder } from '../../../../lib/aeries/romoland-query-builder';
import { AeriesDataValidator } from '../../../../lib/aeries/data-validator';
import type { 
  AeriesAttendanceRecord, 
  AeriesSyncOperation,
  RomolandAttendanceQuery,
  ValidationResult
} from '../../../../types/aeries';

// Mock dependencies
jest.mock('../../../../lib/aeries/circuit-breaker');
jest.mock('../../../../lib/aeries/dead-letter-queue');
jest.mock('../../../../lib/aeries/exponential-backoff');
jest.mock('../../../../lib/aeries/romoland-query-builder');
jest.mock('../../../../lib/aeries/data-validator');

describe('EnhancedAeriesClient', () => {
  let client: EnhancedAeriesClient;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;
  let mockDeadLetterQueue: jest.Mocked<DeadLetterQueue>;
  let mockBackoff: jest.Mocked<ExponentialBackoff>;
  let mockQueryBuilder: jest.Mocked<RomolandQueryBuilder>;
  let mockValidator: jest.Mocked<AeriesDataValidator>;

  beforeEach(() => {
    // Setup mocks
    mockCircuitBreaker = new CircuitBreaker() as jest.Mocked<CircuitBreaker>;
    mockDeadLetterQueue = new DeadLetterQueue() as jest.Mocked<DeadLetterQueue>;
    mockBackoff = new ExponentialBackoff() as jest.Mocked<ExponentialBackoff>;
    mockQueryBuilder = new RomolandQueryBuilder() as jest.Mocked<RomolandQueryBuilder>;
    mockValidator = new AeriesDataValidator() as jest.Mocked<AeriesDataValidator>;

    // Create client instance
    client = new EnhancedAeriesClient({
      baseUrl: 'https://romolandapi.aeries.net/admin/api/v5',
      apiKey: 'test-api-key',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      certificatePath: './certs/aeries-client.crt',
      circuitBreakerConfig: {
        failureThreshold: 5,
        recoveryTimeout: 60000
      },
      retryConfig: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Circuit Breaker Integration', () => {
    it('should execute requests through circuit breaker when CLOSED', async () => {
      // Arrange
      mockCircuitBreaker.getState.mockReturnValue(CircuitBreakerState.CLOSED);
      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      const result = await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should reject requests immediately when circuit breaker is OPEN', async () => {
      // Arrange
      mockCircuitBreaker.getState.mockReturnValue(CircuitBreakerState.OPEN);
      mockCircuitBreaker.execute.mockRejectedValue(new Error('Circuit breaker is OPEN'));

      // Act & Assert
      await expect(
        client.getAttendanceByDateRange('2024-08-15', '2024-08-16')
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should allow limited requests when circuit breaker is HALF_OPEN', async () => {
      // Arrange
      mockCircuitBreaker.getState.mockReturnValue(CircuitBreakerState.HALF_OPEN);
      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      const result = await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should transition circuit breaker to OPEN after consecutive failures', async () => {
      // Arrange
      mockCircuitBreaker.execute.mockRejectedValue(new Error('API Error'));
      mockCircuitBreaker.recordFailure.mockImplementation(() => {
        mockCircuitBreaker.getState.mockReturnValue(CircuitBreakerState.OPEN);
      });

      // Act & Assert
      await expect(
        client.getAttendanceByDateRange('2024-08-15', '2024-08-16')
      ).rejects.toThrow('API Error');

      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();
    });
  });

  describe('Exponential Backoff and Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      // Arrange
      const mockError = new Error('Temporary API failure');
      mockBackoff.shouldRetry.mockReturnValue(true);
      mockBackoff.getNextDelay.mockReturnValueOnce(1000).mockReturnValueOnce(2000);
      
      let callCount = 0;
      mockCircuitBreaker.execute.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw mockError;
        }
        return { success: true, data: [] };
      });

      // Act
      const result = await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(3);
      expect(mockBackoff.getNextDelay).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('should stop retrying after max attempts reached', async () => {
      // Arrange
      const mockError = new Error('Persistent API failure');
      mockBackoff.shouldRetry
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      
      mockCircuitBreaker.execute.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        client.getAttendanceByDateRange('2024-08-15', '2024-08-16')
      ).rejects.toThrow('Persistent API failure');

      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff delays between retries', async () => {
      // Arrange
      const delays = [1000, 2000, 4000];
      mockBackoff.getNextDelay
        .mockReturnValueOnce(delays[0])
        .mockReturnValueOnce(delays[1])
        .mockReturnValueOnce(delays[2]);
      
      mockBackoff.shouldRetry.mockReturnValue(true);
      mockCircuitBreaker.execute.mockRejectedValue(new Error('API Error'));

      // Act
      const startTime = Date.now();
      try {
        await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');
      } catch (error) {
        // Expected to fail after retries
      }

      // Assert
      expect(mockBackoff.getNextDelay).toHaveBeenCalledTimes(2);
      // Verify that delays were applied (allowing some tolerance for test execution time)
      const totalTimeExpected = delays[0] + delays[1];
      const actualTime = Date.now() - startTime;
      expect(actualTime).toBeGreaterThanOrEqual(totalTimeExpected * 0.8);
    });
  });

  describe('Dead Letter Queue Integration', () => {
    it('should add failed operations to dead letter queue', async () => {
      // Arrange
      const mockError = new Error('Unrecoverable API error');
      mockBackoff.shouldRetry.mockReturnValue(false);
      mockCircuitBreaker.execute.mockRejectedValue(mockError);

      const operation: AeriesSyncOperation = {
        operationId: 'sync-123',
        type: 'MANUAL_SYNC',
        status: 'FAILED',
        startTime: new Date().toISOString(),
        dateRange: { startDate: '2024-08-15', endDate: '2024-08-16' },
        batchSize: 100,
        progress: {
          totalRecords: 0,
          processedRecords: 0,
          successfulRecords: 0,
          failedRecords: 1,
          currentBatch: 1,
          totalBatches: 1
        },
        metadata: {
          initiatedBy: 'test-user',
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1'
        }
      };

      // Act
      try {
        await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');
      } catch (error) {
        // Expected to fail
      }

      // Assert
      expect(mockDeadLetterQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: expect.any(String),
          error: mockError,
          timestamp: expect.any(String),
          retryCount: 0
        })
      );
    });

    it('should process dead letter queue items for retry', async () => {
      // Arrange
      const failedOperation = {
        operationId: 'failed-sync-456',
        error: new Error('Previous failure'),
        timestamp: new Date().toISOString(),
        retryCount: 1
      };

      mockDeadLetterQueue.getNextItem.mockResolvedValue(failedOperation);
      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.processDeadLetterQueue();

      // Assert
      expect(mockDeadLetterQueue.getNextItem).toHaveBeenCalled();
      expect(mockDeadLetterQueue.markAsProcessed).toHaveBeenCalledWith(failedOperation.operationId);
    });

    it('should increment retry count when re-queuing failed operations', async () => {
      // Arrange
      const failedOperation = {
        operationId: 'retry-sync-789',
        error: new Error('Retry failure'),
        timestamp: new Date().toISOString(),
        retryCount: 2
      };

      mockDeadLetterQueue.getNextItem.mockResolvedValue(failedOperation);
      mockCircuitBreaker.execute.mockRejectedValue(new Error('Still failing'));

      // Act
      await client.processDeadLetterQueue();

      // Assert
      expect(mockDeadLetterQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: failedOperation.operationId,
          retryCount: 3
        })
      );
    });
  });

  describe('Romoland-Specific Query Handling', () => {
    it('should build Romoland-specific attendance query correctly', async () => {
      // Arrange
      const expectedQuery: RomolandAttendanceQuery = {
        fields: ['STU.NM', 'STU.GR', 'TCH.TE', 'STU.ID', 'AHS.SP', 'AHS.EN', 'AHS.AB', 'AHS.PR'],
        tables: ['STU', 'TCH', 'AHS'],
        dateRange: { startDate: '2024-08-15', endDate: '2024-08-16' },
        filters: {
          schoolCode: 'RHS',
          activeOnly: true
        }
      };

      mockQueryBuilder.buildAttendanceQuery.mockReturnValue(expectedQuery);
      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.getRomolandAttendanceData('2024-08-15', '2024-08-16', 'RHS');

      // Assert
      expect(mockQueryBuilder.buildAttendanceQuery).toHaveBeenCalledWith({
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCode: 'RHS',
        includePeriods: true
      });
    });

    it('should handle period-based attendance for middle school (7 periods)', async () => {
      // Arrange
      const mockAttendanceData = {
        success: true,
        data: [{
          studentId: 'STU123',
          studentNumber: '12345',
          schoolCode: 'RMS',
          attendanceDate: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'ABSENT' },
            { period: 3, status: 'PRESENT' },
            { period: 4, status: 'PRESENT' },
            { period: 5, status: 'PRESENT' },
            { period: 6, status: 'PRESENT' },
            { period: 7, status: 'PRESENT' }
          ]
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockAttendanceData);

      // Act
      const result = await client.getRomolandAttendanceData('2024-08-15', '2024-08-16', 'RMS');

      // Assert
      expect(result.data[0].periods).toHaveLength(7);
      expect(result.data[0].dailyAttendance?.status).toBe('PRESENT'); // Not absent all periods
    });

    it('should calculate full-day absent when student is absent all 7 periods', async () => {
      // Arrange
      const mockAttendanceData = {
        success: true,
        data: [{
          studentId: 'STU456',
          studentNumber: '67890',
          schoolCode: 'RMS',
          attendanceDate: '2024-08-15',
          periods: [
            { period: 1, status: 'ABSENT' },
            { period: 2, status: 'ABSENT' },
            { period: 3, status: 'ABSENT' },
            { period: 4, status: 'ABSENT' },
            { period: 5, status: 'ABSENT' },
            { period: 6, status: 'ABSENT' },
            { period: 7, status: 'ABSENT' }
          ]
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockAttendanceData);

      // Act
      const result = await client.getRomolandAttendanceData('2024-08-15', '2024-08-16', 'RMS');

      // Assert
      expect(result.data[0].dailyAttendance?.status).toBe('ABSENT');
    });

    it('should handle 7-day correction window for attendance data', async () => {
      // Arrange
      const correctionDate = new Date();
      correctionDate.setDate(correctionDate.getDate() - 5); // 5 days ago
      const correctionDateStr = correctionDate.toISOString().split('T')[0];

      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.syncAttendanceWithCorrectionWindow(correctionDateStr, correctionDateStr);

      // Assert
      expect(mockQueryBuilder.buildAttendanceQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          includeCorrectionWindow: true,
          correctionWindowDays: 7
        })
      );
    });
  });

  describe('Data Validation and Transformation', () => {
    it('should validate Aeries API response data', async () => {
      // Arrange
      const mockResponse = {
        success: true,
        data: [{
          studentId: 'STU123',
          studentNumber: '12345',
          attendanceDate: '2024-08-15',
          periods: []
        }]
      };

      const validationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        sanitizedData: mockResponse.data
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);
      mockValidator.validateAttendanceData.mockReturnValue(validationResult);

      // Act
      const result = await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(mockValidator.validateAttendanceData).toHaveBeenCalledWith(mockResponse.data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid data and log validation errors', async () => {
      // Arrange
      const invalidResponse = {
        success: true,
        data: [{
          // Missing required fields
          invalidField: 'invalid'
        }]
      };

      const validationResult: ValidationResult = {
        isValid: false,
        errors: [
          { field: 'studentId', message: 'Required field missing', value: undefined }
        ],
        warnings: [],
        sanitizedData: null
      };

      mockCircuitBreaker.execute.mockResolvedValue(invalidResponse);
      mockValidator.validateAttendanceData.mockReturnValue(validationResult);

      // Act & Assert
      await expect(
        client.getAttendanceByDateRange('2024-08-15', '2024-08-16')
      ).rejects.toThrow('Data validation failed');

      expect(mockValidator.validateAttendanceData).toHaveBeenCalled();
    });

    it('should sanitize PII data in logs and error messages', async () => {
      // Arrange
      const mockError = new Error('Student ID 123456789 not found');
      mockCircuitBreaker.execute.mockRejectedValue(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      try {
        await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');
      } catch (error) {
        // Expected to fail
      }

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Student ID \*\*\*\*\* not found/) // PII should be masked
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Security and Compliance', () => {
    it('should validate SSL certificate before making requests', async () => {
      // Arrange
      const certValidationSpy = jest.spyOn(client, 'validateCertificate');
      certValidationSpy.mockResolvedValue(true);

      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(certValidationSpy).toHaveBeenCalled();
    });

    it('should enforce rate limiting according to API constraints', async () => {
      // Arrange
      const rateLimitSpy = jest.spyOn(client, 'checkRateLimit');
      rateLimitSpy.mockResolvedValue(true);

      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(rateLimitSpy).toHaveBeenCalled();
    });

    it('should encrypt sensitive data in transit', async () => {
      // Arrange
      const encryptionSpy = jest.spyOn(client, 'encryptRequestData');
      encryptionSpy.mockImplementation((data) => `encrypted:${JSON.stringify(data)}`);

      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(encryptionSpy).toHaveBeenCalled();
    });
  });

  describe('Health Check and Monitoring', () => {
    it('should perform health check before critical operations', async () => {
      // Arrange
      const healthCheckSpy = jest.spyOn(client, 'performHealthCheck');
      healthCheckSpy.mockResolvedValue(true);

      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.syncAllAttendanceData('2024-08-15', '2024-08-16');

      // Assert
      expect(healthCheckSpy).toHaveBeenCalled();
    });

    it('should collect and report performance metrics', async () => {
      // Arrange
      const metricsSpy = jest.spyOn(client, 'recordMetrics');
      metricsSpy.mockImplementation(() => {});

      mockCircuitBreaker.execute.mockResolvedValue({ success: true, data: [] });

      // Act
      await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');

      // Assert
      expect(metricsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getAttendanceByDateRange',
          duration: expect.any(Number),
          success: true
        })
      );
    });

    it('should integrate with circuit breaker health checks', async () => {
      // Arrange
      const healthCheckFn = jest.fn().mockResolvedValue(true);
      mockCircuitBreaker.setHealthCheck.mockImplementation((fn) => {
        healthCheckFn.mockImplementation(fn);
      });

      // Act
      await client.initialize();

      // Assert
      expect(mockCircuitBreaker.setHealthCheck).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });
});