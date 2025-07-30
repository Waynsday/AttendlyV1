/**
 * @fileoverview Production-Ready Aeries API Client Test Suite
 * 
 * Comprehensive test suite following TDD principles for a production-ready
 * Aeries API client with circuit breaker pattern, error handling, and
 * Romoland-specific requirements.
 * 
 * Test Categories:
 * 1. Core API Client Features
 * 2. Circuit Breaker Pattern
 * 3. Error Handling Strategy
 * 4. Romoland-Specific Implementation
 * 5. Security & Compliance
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { z } from 'zod';
import { ProductionAeriesClient } from '../../../../lib/aeries/production-aeries-client';
import { CircuitBreakerState } from '../../../../lib/aeries/circuit-breaker';
import { AeriesConfig, AeriesStudent, AeriesAttendanceRecord, AeriesApiResponse } from '../../../../types/aeries';

// Mock axios for controlled testing
jest.mock('axios');
const mockAxios = jest.mocked(require('axios'));

describe('ProductionAeriesClient', () => {
  let client: ProductionAeriesClient;
  let mockConfig: AeriesConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock configuration
    mockConfig = {
      baseUrl: 'https://romolandapi.aeries.net/admin/api/v5',
      apiKey: 'test-api-key-32-characters-long',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret-16-chars',
      districtCode: 'ROMOLAND',
      certificatePath: '/path/to/cert.pem',
      privateKeyPath: '/path/to/key.pem',
      caCertPath: '/path/to/ca.pem',
      syncEnabled: true,
      syncSchedule: '0 6 * * 1-5',
      attendanceStartDate: '2024-08-15',
      attendanceEndDate: '2025-06-12',
      batchSize: 100,
      rateLimitPerMinute: 60
    };

    // Mock file system operations
    jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue('mock-certificate-content');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =============================================================================
  // 1. CORE API CLIENT FEATURES
  // =============================================================================

  describe('Core API Client Features', () => {
    describe('initialization', () => {
      it('should initialize with valid configuration and certificates', async () => {
        client = new ProductionAeriesClient(mockConfig);
        
        await expect(client.initialize()).resolves.not.toThrow();
        expect(client.isInitialized()).toBe(true);
        expect(client.getConfig()).toMatchObject({
          baseUrl: mockConfig.baseUrl,
          districtCode: mockConfig.districtCode
        });
      });

      it('should validate configuration with Zod schemas', async () => {
        const invalidConfig = { ...mockConfig, apiKey: 'too-short' };
        
        expect(() => new ProductionAeriesClient(invalidConfig)).toThrow('Invalid Aeries configuration');
      });

      it('should fail initialization with invalid certificates', async () => {
        jest.spyOn(require('fs/promises'), 'readFile').mockRejectedValue(new Error('Certificate not found'));
        
        client = new ProductionAeriesClient(mockConfig);
        
        await expect(client.initialize()).rejects.toThrow('Failed to load certificates');
      });

      it('should setup HTTPS agent with certificate authentication', async () => {
        client = new ProductionAeriesClient(mockConfig);
        
        await client.initialize();
        
        // Verify HTTPS agent was created with certificates
        expect(require('https').Agent).toHaveBeenCalledWith(
          expect.objectContaining({
            cert: expect.any(String),
            key: expect.any(String),
            ca: expect.any(String),
            rejectUnauthorized: true
          })
        );
      });
    });

    describe('HTTP client configuration', () => {
      beforeEach(async () => {
        client = new ProductionAeriesClient(mockConfig);
        await client.initialize();
      });

      it('should configure axios with proper headers and authentication', () => {
        expect(mockAxios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            baseURL: mockConfig.baseUrl,
            timeout: 30000,
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'AERIES-CERT': expect.any(String),
              'X-District-Code': mockConfig.districtCode
            })
          })
        );
      });

      it('should setup request interceptor for rate limiting and authentication', () => {
        const mockInstance = { interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
        mockAxios.create.mockReturnValue(mockInstance);
        
        expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
        expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
      });

      it('should include request ID in all API calls', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await client.getStudents('TEST');

        expect(mockInstance.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Request-ID': expect.stringMatching(/^aeries-\d{13}-\d+$/)
            })
          })
        );
      });
    });

    describe('request validation and response schemas', () => {
      beforeEach(async () => {
        client = new ProductionAeriesClient(mockConfig);
        await client.initialize();
      });

      it('should validate all request parameters with Zod schemas', async () => {
        await expect(
          client.getAttendanceByDateRange('invalid-date', '2024-08-16')
        ).rejects.toThrow('Invalid date format');
      });

      it('should validate and transform API responses', async () => {
        const mockResponse = {
          data: [{
            studentId: 'STU123',
            firstName: 'John',
            lastName: 'Doe',
            grade: '7',
            schoolCode: 'RIS'
          }],
          status: 200
        };

        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue(mockResponse)
        };
        mockAxios.create.mockReturnValue(mockInstance);

        const result = await client.getStudents('RIS');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
          studentId: 'STU123',
          firstName: 'John',
          lastName: 'Doe'
        });
      });

      it('should reject responses that fail schema validation', async () => {
        const invalidResponse = {
          data: [{ invalidField: 'invalid-data' }],
          status: 200
        };

        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue(invalidResponse)
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await expect(client.getStudents('RIS')).rejects.toThrow('Response validation failed');
      });
    });

    describe('rate limiting implementation', () => {
      beforeEach(async () => {
        client = new ProductionAeriesClient(mockConfig);
        await client.initialize();
      });

      it('should enforce rate limits based on configuration', async () => {
        const rapidRequests = Array(65).fill(null).map(() => 
          client.getStudents('RIS')
        );

        await expect(Promise.all(rapidRequests)).rejects.toThrow('Rate limit exceeded');
      });

      it('should reset rate limit after time window', async () => {
        // Fast-forward time to reset rate limit window
        jest.useFakeTimers();
        
        // Make rate limit requests
        for (let i = 0; i < 60; i++) {
          await client.getStudents('RIS');
        }

        // Advance time by 1 minute
        jest.advanceTimersByTime(60000);

        // Should not throw rate limit error
        await expect(client.getStudents('RIS')).resolves.not.toThrow();

        jest.useRealTimers();
      });

      it('should track rate limit usage and provide remaining count', () => {
        const rateLimitStatus = client.getRateLimitStatus();
        
        expect(rateLimitStatus).toMatchObject({
          requestsPerMinute: 60,
          requestsRemaining: expect.any(Number),
          resetTime: expect.any(String)
        });
      });
    });
  });

  // =============================================================================
  // 2. CIRCUIT BREAKER PATTERN
  // =============================================================================

  describe('Circuit Breaker Pattern', () => {
    beforeEach(async () => {
      client = new ProductionAeriesClient({
        ...mockConfig,
        circuitBreakerConfig: {
          failureThreshold: 5,
          recoveryTimeout: 30000,
          monitoringPeriod: 60000
        }
      });
      await client.initialize();
    });

    describe('failure detection', () => {
      it('should track consecutive failures and open circuit after threshold', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue(new Error('API Error'))
        };
        mockAxios.create.mockReturnValue(mockInstance);

        // Make 5 consecutive failing requests
        for (let i = 0; i < 5; i++) {
          await expect(client.getStudents('RIS')).rejects.toThrow();
        }

        expect(client.getCircuitBreakerState()).toBe(CircuitBreakerState.OPEN);
      });

      it('should immediately reject requests when circuit is open', async () => {
        // Force circuit to open state
        await client.forceCircuitState(CircuitBreakerState.OPEN);

        await expect(client.getStudents('RIS')).rejects.toThrow('Circuit breaker is OPEN');
      });

      it('should transition to half-open state after recovery timeout', async () => {
        jest.useFakeTimers();
        
        // Force circuit to open
        await client.forceCircuitState(CircuitBreakerState.OPEN);
        
        // Advance time past recovery timeout
        jest.advanceTimersByTime(30000);
        
        expect(client.getCircuitBreakerState()).toBe(CircuitBreakerState.HALF_OPEN);
        
        jest.useRealTimers();
      });

      it('should close circuit on successful request in half-open state', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        // Set to half-open state
        await client.forceCircuitState(CircuitBreakerState.HALF_OPEN);

        await client.getStudents('RIS');

        expect(client.getCircuitBreakerState()).toBe(CircuitBreakerState.CLOSED);
      });
    });

    describe('fallback mechanisms', () => {
      it('should provide cached data when circuit is open', async () => {
        // First, populate cache with successful request
        const mockSuccessResponse = { data: [{ studentId: 'STU123' }], status: 200 };
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue(mockSuccessResponse)
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await client.getStudents('RIS');

        // Force circuit open
        await client.forceCircuitState(CircuitBreakerState.OPEN);

        // Should return cached data with fallback indicator
        const result = await client.getStudentsWithFallback('RIS');
        expect(result.fromCache).toBe(true);
        expect(result.data).toHaveLength(1);
      });

      it('should provide degraded service mode with limited functionality', async () => {
        await client.forceCircuitState(CircuitBreakerState.OPEN);

        const degradedService = client.getDegradedService();
        expect(degradedService.isAvailable).toBe(true);
        expect(degradedService.availableOperations).toContain('getBasicStudentInfo');
        expect(degradedService.availableOperations).not.toContain('getDetailedAttendance');
      });

      it('should log circuit breaker state changes for monitoring', async () => {
        const logSpy = jest.spyOn(console, 'warn').mockImplementation();

        await client.forceCircuitState(CircuitBreakerState.OPEN);

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Circuit breaker state changed to OPEN')
        );
      });
    });

    describe('health checks', () => {
      it('should perform regular health checks to test service availability', async () => {
        const healthCheckSpy = jest.spyOn(client, 'performHealthCheck');

        await client.startHealthCheckMonitoring();

        // Health checks should be called periodically
        expect(healthCheckSpy).toHaveBeenCalled();
      });

      it('should update circuit breaker state based on health check results', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        const isHealthy = await client.performHealthCheck();
        expect(isHealthy).toBe(true);
      });

      it('should provide detailed health status information', async () => {
        const healthStatus = await client.getHealthStatus();

        expect(healthStatus).toMatchObject({
          isHealthy: expect.any(Boolean),
          circuitBreakerState: expect.any(String),
          lastSuccessfulRequest: expect.any(String),
          consecutiveFailures: expect.any(Number),
          uptime: expect.any(Number)
        });
      });
    });
  });

  // =============================================================================
  // 3. ERROR HANDLING STRATEGY
  // =============================================================================

  describe('Error Handling Strategy', () => {
    beforeEach(async () => {
      client = new ProductionAeriesClient({
        ...mockConfig,
        retryConfig: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2
        }
      });
      await client.initialize();
    });

    describe('exponential backoff for transient failures', () => {
      it('should retry requests with exponential backoff on transient errors', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn()
            .mockRejectedValueOnce(new Error('Network timeout'))
            .mockRejectedValueOnce(new Error('Network timeout'))
            .mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        jest.useFakeTimers();
        
        const requestPromise = client.getStudents('RIS');
        
        // Advance timer for retry delays
        jest.advanceTimersByTime(5000);
        
        const result = await requestPromise;
        expect(result.success).toBe(true);

        // Should have been called 3 times (original + 2 retries)
        expect(mockInstance.get).toHaveBeenCalledTimes(3);
        
        jest.useRealTimers();
      });

      it('should not retry on non-transient errors (4xx status codes)', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue({
            response: { status: 401, data: { error: 'Unauthorized' } }
          })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await expect(client.getStudents('RIS')).rejects.toThrow('Authentication failed');
        
        // Should only be called once (no retries for auth errors)
        expect(mockInstance.get).toHaveBeenCalledTimes(1);
      });

      it('should respect maximum retry attempts', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue(new Error('Network timeout'))
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await expect(client.getStudents('RIS')).rejects.toThrow('Max retry attempts exceeded');
        
        // Should be called 3 times (original + 2 retries, then give up)
        expect(mockInstance.get).toHaveBeenCalledTimes(3);
      });
    });

    describe('dead letter queue for failed requests', () => {
      it('should add failed requests to dead letter queue after max retries', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue(new Error('Permanent failure'))
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await expect(client.getStudents('RIS')).rejects.toThrow();

        const deadLetterQueue = client.getDeadLetterQueue();
        expect(deadLetterQueue).toHaveLength(1);
        expect(deadLetterQueue[0]).toMatchObject({
          request: expect.objectContaining({
            method: 'GET',
            endpoint: expect.stringContaining('students')
          }),
          error: expect.any(String),
          timestamp: expect.any(String),
          retryCount: 3
        });
      });

      it('should provide methods to retry dead letter queue items', async () => {
        // First, add item to dead letter queue
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue(new Error('Temporary failure'))
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await expect(client.getStudents('RIS')).rejects.toThrow();

        // Now mock successful retry
        const mockSuccessInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockSuccessInstance);

        const retryResults = await client.retryDeadLetterQueue();
        expect(retryResults.successCount).toBe(1);
        expect(retryResults.failureCount).toBe(0);
      });

      it('should allow manual inspection and cleanup of dead letter queue', () => {
        const deadLetterQueue = client.getDeadLetterQueue();
        client.clearDeadLetterQueue();
        
        expect(client.getDeadLetterQueue()).toHaveLength(0);
      });
    });

    describe('comprehensive error classification', () => {
      it('should classify network errors correctly', async () => {
        const networkError = new Error('Network Error');
        networkError.code = 'ECONNREFUSED';

        const classification = client.classifyError(networkError);
        expect(classification).toMatchObject({
          type: 'NETWORK_ERROR',
          isRetryable: true,
          severity: 'HIGH',
          userMessage: 'Network connection failed. Please check your internet connection.'
        });
      });

      it('should classify authentication errors correctly', async () => {
        const authError = { response: { status: 401, data: { error: 'Invalid token' } } };

        const classification = client.classifyError(authError);
        expect(classification).toMatchObject({
          type: 'AUTHENTICATION_ERROR',
          isRetryable: false,
          severity: 'CRITICAL',
          userMessage: 'Authentication failed. Please check your credentials.'
        });
      });

      it('should classify data validation errors correctly', async () => {
        const validationError = { response: { status: 400, data: { error: 'Invalid student ID' } } };

        const classification = client.classifyError(validationError);
        expect(classification).toMatchObject({
          type: 'DATA_VALIDATION_ERROR',
          isRetryable: false,
          severity: 'MEDIUM',
          userMessage: 'The provided data is invalid. Please check your input.'
        });
      });

      it('should provide appropriate user-friendly error messages', async () => {
        const serverError = { response: { status: 500, data: { error: 'Internal server error' } } };

        const classification = client.classifyError(serverError);
        expect(classification.userMessage).not.toContain('Internal server error');
        expect(classification.userMessage).toContain('temporary problem');
      });
    });

    describe('detailed logging for troubleshooting', () => {
      it('should log all API requests with correlation IDs', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation();

        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await client.getStudents('RIS');

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[Aeries API\].*GET.*students.*correlation-id:.*/i)
        );
      });

      it('should log error details with context for debugging', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();

        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue(new Error('API Error'))
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await expect(client.getStudents('RIS')).rejects.toThrow();

        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[Aeries API\].*Error.*correlation-id.*/i)
        );
      });

      it('should provide structured logging output for log aggregation', () => {
        const logEntry = client.createStructuredLogEntry('INFO', 'Request completed', {
          endpoint: '/students',
          duration: 250,
          statusCode: 200
        });

        expect(logEntry).toMatchObject({
          timestamp: expect.any(String),
          level: 'INFO',
          message: 'Request completed',
          component: 'AeriesClient',
          metadata: expect.objectContaining({
            endpoint: '/students',
            duration: 250,
            statusCode: 200
          })
        });
      });
    });
  });

  // =============================================================================
  // 4. ROMOLAND-SPECIFIC IMPLEMENTATION
  // =============================================================================

  describe('Romoland-Specific Implementation', () => {
    beforeEach(async () => {
      client = new ProductionAeriesClient(mockConfig);
      await client.initialize();
    });

    describe('Aeries query support', () => {
      it('should support the existing Romoland query format', async () => {
        const query = 'LIST STU TCH AHS STU.NM STU.GR TCH.TE STU.ID AHS.SP AHS.EN AHS.AB AHS.PR';
        
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          post: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await client.executeCustomQuery(query);

        expect(mockInstance.post).toHaveBeenCalledWith(
          '/query',
          expect.objectContaining({
            query: query,
            parameters: expect.any(Object)
          })
        );
      });

      it('should parse and validate query results according to expected format', async () => {
        const mockQueryResponse = {
          data: [{
            'STU.NM': 'John Doe',
            'STU.GR': '7',
            'TCH.TE': 'Smith, Jane',
            'STU.ID': 'STU123',
            'AHS.SP': '1',
            'AHS.EN': '2024-08-15',
            'AHS.AB': '0',
            'AHS.PR': '1'
          }],
          status: 200
        };

        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          post: jest.fn().mockResolvedValue(mockQueryResponse)
        };
        mockAxios.create.mockReturnValue(mockInstance);

        const result = await client.executeCustomQuery('LIST STU TCH AHS...');

        expect(result.data[0]).toMatchObject({
          studentName: 'John Doe',
          grade: '7',
          teacherName: 'Smith, Jane',
          studentId: 'STU123',
          schoolPeriod: 1,
          entryDate: '2024-08-15',
          absentCount: 0,
          presentCount: 1
        });
      });
    });

    describe('period-based attendance handling', () => {
      it('should handle 7-period middle school attendance structure', async () => {
        const attendanceData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'ABSENT' },
            { period: 3, status: 'PRESENT' },
            { period: 4, status: 'TARDY' },
            { period: 5, status: 'PRESENT' },
            { period: 6, status: 'PRESENT' },
            { period: 7, status: 'PRESENT' }
          ]
        };

        const result = client.calculatePeriodAttendance(attendanceData);

        expect(result).toMatchObject({
          totalPeriods: 7,
          periodsPresent: 5,
          periodsAbsent: 1,
          periodsTardy: 1,
          attendancePercentage: 71.43 // 5/7 * 100
        });
      });

      it('should validate that all 7 periods are accounted for', () => {
        const incompleteData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'ABSENT' },
            // Missing periods 3-7
          ]
        };

        expect(() => client.calculatePeriodAttendance(incompleteData))
          .toThrow('All 7 periods must be provided for middle school attendance');
      });

      it('should handle different attendance statuses per period', () => {
        const attendanceData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'EXCUSED_ABSENT' },
            { period: 3, status: 'UNEXCUSED_ABSENT' },
            { period: 4, status: 'TARDY' },
            { period: 5, status: 'PRESENT' },
            { period: 6, status: 'PRESENT' },
            { period: 7, status: 'PRESENT' }
          ]
        };

        const result = client.calculatePeriodAttendance(attendanceData);

        expect(result.periodBreakdown).toMatchObject({
          present: 4,
          excusedAbsent: 1,
          unexcusedAbsent: 1,
          tardy: 1
        });
      });
    });

    describe('full-day absence calculation logic', () => {
      it('should calculate full-day absence based on period attendance', () => {
        const allAbsentData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: Array(7).fill({ status: 'ABSENT' }).map((p, i) => ({ period: i + 1, status: 'ABSENT' }))
        };

        const result = client.calculateDailyAttendanceStatus(allAbsentData);
        expect(result.dailyStatus).toBe('ABSENT');
        expect(result.isFullDayAbsent).toBe(true);
      });

      it('should not mark as full-day absent if student was present for any period', () => {
        const partiallyPresentData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            ...Array(6).fill({ status: 'ABSENT' }).map((p, i) => ({ period: i + 2, status: 'ABSENT' }))
          ]
        };

        const result = client.calculateDailyAttendanceStatus(partiallyPresentData);
        expect(result.dailyStatus).toBe('PARTIALLY_PRESENT');
        expect(result.isFullDayAbsent).toBe(false);
      });

      it('should handle mixed excuse statuses in daily calculation', () => {
        const mixedExcuseData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'EXCUSED_ABSENT' },
            { period: 2, status: 'EXCUSED_ABSENT' },
            { period: 3, status: 'UNEXCUSED_ABSENT' },
            { period: 4, status: 'UNEXCUSED_ABSENT' },
            { period: 5, status: 'UNEXCUSED_ABSENT' },
            { period: 6, status: 'UNEXCUSED_ABSENT' },
            { period: 7, status: 'UNEXCUSED_ABSENT' }
          ]
        };

        const result = client.calculateDailyAttendanceStatus(mixedExcuseData);
        expect(result.dailyStatus).toBe('UNEXCUSED_ABSENT'); // Majority unexcused
        expect(result.excuseBreakdown).toMatchObject({
          excusedPeriods: 2,
          unexcusedPeriods: 5
        });
      });
    });

    describe('7-day correction window support', () => {
      it('should track attendance changes within 7-day correction window', async () => {
        const originalAttendance = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [{ period: 1, status: 'ABSENT' }]
        };

        const correctedAttendance = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [{ period: 1, status: 'EXCUSED_ABSENT' }]
        };

        // Simulate correction within 7 days
        const correctionDate = new Date('2024-08-20'); // 5 days later

        const result = await client.processCorrectedAttendance(
          originalAttendance,
          correctedAttendance,
          correctionDate
        );

        expect(result.isWithinCorrectionWindow).toBe(true);
        expect(result.correctionApplied).toBe(true);
        expect(result.auditTrail).toContainEqual(
          expect.objectContaining({
            action: 'ATTENDANCE_CORRECTED',
            originalStatus: 'ABSENT',
            newStatus: 'EXCUSED_ABSENT',
            correctionDate: correctionDate.toISOString()
          })
        );
      });

      it('should reject corrections outside 7-day window', async () => {
        const originalAttendance = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [{ period: 1, status: 'ABSENT' }]
        };

        const correctedAttendance = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [{ period: 1, status: 'EXCUSED_ABSENT' }]
        };

        // Simulate correction after 7 days
        const correctionDate = new Date('2024-08-25'); // 10 days later

        await expect(
          client.processCorrectedAttendance(originalAttendance, correctedAttendance, correctionDate)
        ).rejects.toThrow('Correction window has expired');
      });

      it('should maintain audit trail for all correction attempts', async () => {
        const auditTrail = await client.getAttendanceCorrectionAuditTrail('STU123', '2024-08-15');

        expect(auditTrail).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              studentId: 'STU123',
              date: '2024-08-15',
              correctionAttempts: expect.any(Array),
              lastModified: expect.any(String)
            })
          ])
        );
      });
    });
  });

  // =============================================================================
  // 5. SECURITY & COMPLIANCE
  // =============================================================================

  describe('Security & Compliance', () => {
    beforeEach(async () => {
      client = new ProductionAeriesClient({
        ...mockConfig,
        securityConfig: {
          enablePiiMasking: true,
          auditingEnabled: true,
          encryptionEnabled: true
        }
      });
      await client.initialize();
    });

    describe('certificate-based authentication', () => {
      it('should use AERIES-CERT header for authentication', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await client.getStudents('RIS');

        expect(mockInstance.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'AERIES-CERT': expect.any(String)
            })
          })
        );
      });

      it('should validate certificate expiration and warn before expiry', () => {
        const certificateStatus = client.getCertificateStatus();

        expect(certificateStatus).toMatchObject({
          isValid: expect.any(Boolean),
          expirationDate: expect.any(String),
          daysUntilExpiration: expect.any(Number),
          renewalRequired: expect.any(Boolean)
        });
      });

      it('should fail gracefully when certificate is invalid or expired', async () => {
        // Mock certificate validation to return expired
        jest.spyOn(client, 'validateCertificate').mockReturnValue({
          isValid: false,
          error: 'Certificate expired'
        });

        await expect(client.initialize()).rejects.toThrow('Certificate expired');
      });
    });

    describe('PII data masking in logs', () => {
      it('should mask student names in log outputs', () => {
        const sensitiveData = {
          studentId: 'STU123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@student.romoland.org'
        };

        const maskedData = client.maskSensitiveData(sensitiveData);

        expect(maskedData).toMatchObject({
          studentId: 'STU123', // ID is okay to log
          firstName: '****',
          lastName: '***',
          email: 'j***.d**@student.romoland.org'
        });
      });

      it('should mask SSN and other sensitive identifiers', () => {
        const sensitiveData = {
          ssn: '123-45-6789',
          birthDate: '2010-05-15',
          address: '123 Main St, Romoland, CA'
        };

        const maskedData = client.maskSensitiveData(sensitiveData);

        expect(maskedData).toMatchObject({
          ssn: '***-**-****',
          birthDate: '****-**-**',
          address: '*** Main St, ********, **'
        });
      });

      it('should provide configurable masking levels', () => {
        const data = { firstName: 'John', lastName: 'Doe' };

        const partialMask = client.maskSensitiveData(data, { level: 'PARTIAL' });
        const fullMask = client.maskSensitiveData(data, { level: 'FULL' });

        expect(partialMask.firstName).toBe('J***');
        expect(fullMask.firstName).toBe('****');
      });
    });

    describe('FERPA-compliant error handling', () => {
      it('should never expose student PII in error messages', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue({
            response: {
              status: 404,
              data: { error: 'Student John Doe not found in database' }
            }
          })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        try {
          await client.getStudent('STU123');
        } catch (error) {
          expect(error.message).not.toContain('John Doe');
          expect(error.message).toContain('Student not found');
        }
      });

      it('should log detailed errors separately from user-facing messages', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();

        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockRejectedValue(new Error('Database connection failed for student John Doe'))
        };
        mockAxios.create.mockReturnValue(mockInstance);

        try {
          await client.getStudent('STU123');
        } catch (error) {
          // User-facing error should be generic
          expect(error.message).toBe('Unable to retrieve student information');
          
          // Detailed error should be logged (with PII masked)
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Database connection failed for student ****')
          );
        }
      });

      it('should implement proper data retention policies in error logs', () => {
        const retentionPolicy = client.getErrorLogRetentionPolicy();

        expect(retentionPolicy).toMatchObject({
          maxAge: 90, // days
          maxSize: 100, // MB
          compressionEnabled: true,
          autoCleanupEnabled: true
        });
      });
    });

    describe('audit trails for troubleshooting', () => {
      it('should create audit entries for all API operations', async () => {
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await client.getStudents('RIS');

        const auditEntries = client.getAuditTrail();
        expect(auditEntries).toContainEqual(
          expect.objectContaining({
            operation: 'GET_STUDENTS',
            timestamp: expect.any(String),
            schoolCode: 'RIS',
            success: true,
            duration: expect.any(Number)
          })
        );
      });

      it('should include correlation IDs for request tracing', async () => {
        const correlationId = 'test-correlation-123';
        
        const mockInstance = {
          interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
          get: jest.fn().mockResolvedValue({ data: [], status: 200 })
        };
        mockAxios.create.mockReturnValue(mockInstance);

        await client.getStudents('RIS', { correlationId });

        const auditEntries = client.getAuditTrail();
        expect(auditEntries[auditEntries.length - 1].correlationId).toBe(correlationId);
      });

      it('should provide audit trail export functionality', async () => {
        const auditExport = await client.exportAuditTrail({
          startDate: '2024-08-01',
          endDate: '2024-08-31',
          format: 'JSON'
        });

        expect(auditExport).toMatchObject({
          format: 'JSON',
          entries: expect.any(Array),
          totalEntries: expect.any(Number),
          exportTimestamp: expect.any(String)
        });
      });
    });
  });
});