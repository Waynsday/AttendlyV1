/**
 * @fileoverview Error Handling Strategy Test Suite
 * 
 * Comprehensive tests for error handling, retry mechanisms,
 * dead letter queue, and error classification used by the
 * production Aeries API client.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  AeriesErrorHandler, 
  ErrorClassification, 
  RetryConfig, 
  DeadLetterQueueItem,
  ExponentialBackoff
} from '../../../../lib/aeries/error-handler';

describe('AeriesErrorHandler', () => {
  let errorHandler: AeriesErrorHandler;
  let mockRetryConfig: RetryConfig;

  beforeEach(() => {
    mockRetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterEnabled: true
    };

    errorHandler = new AeriesErrorHandler(mockRetryConfig);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('error classification', () => {
    it('should classify network errors as retryable', () => {
      const networkError = new Error('Network Error');
      networkError.code = 'ECONNREFUSED';

      const classification = errorHandler.classifyError(networkError);

      expect(classification).toMatchObject({
        type: 'NETWORK_ERROR',
        isRetryable: true,
        severity: 'HIGH',
        category: 'TRANSIENT',
        userMessage: expect.stringContaining('network connection'),
        retryDelay: expect.any(Number)
      });
    });

    it('should classify timeout errors as retryable', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      const classification = errorHandler.classifyError(timeoutError);

      expect(classification).toMatchObject({
        type: 'TIMEOUT_ERROR',
        isRetryable: true,
        severity: 'MEDIUM',
        category: 'TRANSIENT'
      });
    });

    it('should classify 401 errors as non-retryable authentication failures', () => {
      const authError = {
        response: {
          status: 401,
          data: { error: 'Invalid authentication token' }
        }
      };

      const classification = errorHandler.classifyError(authError);

      expect(classification).toMatchObject({
        type: 'AUTHENTICATION_ERROR',
        isRetryable: false,
        severity: 'CRITICAL',
        category: 'PERMANENT',
        userMessage: expect.stringContaining('authentication')
      });
    });

    it('should classify 403 errors as authorization failures', () => {
      const authzError = {
        response: {
          status: 403,
          data: { error: 'Insufficient permissions' }
        }
      };

      const classification = errorHandler.classifyError(authzError);

      expect(classification).toMatchObject({
        type: 'AUTHORIZATION_ERROR',
        isRetryable: false,
        severity: 'CRITICAL',
        category: 'PERMANENT'
      });
    });

    it('should classify 404 errors as resource not found', () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { error: 'Student not found' }
        }
      };

      const classification = errorHandler.classifyError(notFoundError);

      expect(classification).toMatchObject({
        type: 'RESOURCE_NOT_FOUND',
        isRetryable: false,
        severity: 'LOW',
        category: 'PERMANENT'
      });
    });

    it('should classify 429 errors as rate limit exceeded with retry delay', () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {
            'retry-after': '60'
          },
          data: { error: 'Rate limit exceeded' }
        }
      };

      const classification = errorHandler.classifyError(rateLimitError);

      expect(classification).toMatchObject({
        type: 'RATE_LIMIT_ERROR',
        isRetryable: true,
        severity: 'MEDIUM',
        category: 'TRANSIENT',
        retryDelay: 60000 // 60 seconds
      });
    });

    it('should classify 500 errors as server errors with retry', () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: 'Internal server error' }
        }
      };

      const classification = errorHandler.classifyError(serverError);

      expect(classification).toMatchObject({
        type: 'SERVER_ERROR',
        isRetryable: true,
        severity: 'HIGH',
        category: 'TRANSIENT'
      });
    });

    it('should classify 503 errors as service unavailable with retry', () => {
      const serviceError = {
        response: {
          status: 503,
          data: { error: 'Service temporarily unavailable' }
        }
      };

      const classification = errorHandler.classifyError(serviceError);

      expect(classification).toMatchObject({
        type: 'SERVICE_UNAVAILABLE',
        isRetryable: true,
        severity: 'HIGH',
        category: 'TRANSIENT'
      });
    });

    it('should classify validation errors as non-retryable', () => {
      const validationError = {
        response: {
          status: 400,
          data: { 
            error: 'Validation failed',
            details: ['Invalid student ID format']
          }
        }
      };

      const classification = errorHandler.classifyError(validationError);

      expect(classification).toMatchObject({
        type: 'DATA_VALIDATION_ERROR',
        isRetryable: false,
        severity: 'MEDIUM',
        category: 'PERMANENT',
        validationErrors: ['Invalid student ID format']
      });
    });

    it('should provide user-friendly error messages without exposing technical details', () => {
      const technicalError = {
        response: {
          status: 500,
          data: { 
            error: 'Database connection pool exhausted on server aeries-db-01.internal',
            stack: 'Error at DatabaseConnection.connect...'
          }
        }
      };

      const classification = errorHandler.classifyError(technicalError);

      expect(classification.userMessage).not.toContain('aeries-db-01.internal');
      expect(classification.userMessage).not.toContain('Database connection pool');
      expect(classification.userMessage).toContain('temporary problem');
    });
  });

  describe('exponential backoff implementation', () => {
    it('should calculate exponential backoff delays correctly', () => {
      const backoff = new ExponentialBackoff(mockRetryConfig);

      const delay1 = backoff.calculateDelay(1);
      const delay2 = backoff.calculateDelay(2);
      const delay3 = backoff.calculateDelay(3);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThan(2000); // With jitter
      
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThan(4000); // 2000 * 2 with jitter
      
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThan(8000); // 4000 * 2 with jitter
    });

    it('should respect maximum delay limits', () => {
      const backoff = new ExponentialBackoff({
        ...mockRetryConfig,
        maxDelay: 5000
      });

      const longDelay = backoff.calculateDelay(10); // Would normally be very large

      expect(longDelay).toBeLessThanOrEqual(5000);
    });

    it('should apply jitter to prevent thundering herd', () => {
      const backoff = new ExponentialBackoff({
        ...mockRetryConfig,
        jitterEnabled: true
      });

      const delays = Array(10).fill(null).map(() => backoff.calculateDelay(2));
      
      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should provide consistent delays when jitter is disabled', () => {
      const backoff = new ExponentialBackoff({
        ...mockRetryConfig,
        jitterEnabled: false
      });

      const delay1 = backoff.calculateDelay(2);
      const delay2 = backoff.calculateDelay(2);

      expect(delay1).toBe(delay2);
    });

    it('should reset backoff state after successful operation', () => {
      const backoff = new ExponentialBackoff(mockRetryConfig);

      backoff.calculateDelay(3); // High attempt number
      backoff.reset();

      const delay = backoff.calculateDelay(1);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(2000);
    });
  });

  describe('retry mechanism', () => {
    it('should retry transient errors with exponential backoff', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue({
        response: { status: 401, data: { error: 'Unauthorized' } }
      });

      await expect(errorHandler.executeWithRetry(mockOperation)).rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect maximum retry attempts', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Network timeout'));

      await expect(errorHandler.executeWithRetry(mockOperation)).rejects.toThrow('Max retry attempts exceeded');
      
      expect(mockOperation).toHaveBeenCalledTimes(mockRetryConfig.maxAttempts);
    });

    it('should wait for calculated delay between retries', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      const executePromise = errorHandler.executeWithRetry(mockOperation);

      // First call should happen immediately
      expect(mockOperation).toHaveBeenCalledTimes(1);

      // Advance time for retry delay
      jest.advanceTimersByTime(1500); // Should be enough for first retry

      await executePromise;
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should provide retry attempt context to operation', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success');

      await errorHandler.executeWithRetry(mockOperation, {
        includeContext: true
      });

      expect(mockOperation).toHaveBeenLastCalledWith({
        attempt: 2,
        previousError: expect.any(Error),
        totalAttempts: mockRetryConfig.maxAttempts
      });
    });

    it('should allow custom retry decision logic', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Custom error'));
      const customShouldRetry = jest.fn().mockReturnValue(false);

      await expect(
        errorHandler.executeWithRetry(mockOperation, {
          shouldRetry: customShouldRetry
        })
      ).rejects.toThrow('Custom error');

      expect(customShouldRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Object) // classification
      );
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('dead letter queue management', () => {
    it('should add failed requests to dead letter queue after max retries', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Permanent failure'));
      const requestContext = {
        method: 'GET',
        endpoint: '/students',
        params: { schoolCode: 'RIS' }
      };

      await expect(
        errorHandler.executeWithRetry(mockOperation, { context: requestContext })
      ).rejects.toThrow();

      const deadLetterQueue = errorHandler.getDeadLetterQueue();
      expect(deadLetterQueue).toHaveLength(1);
      expect(deadLetterQueue[0]).toMatchObject({
        request: requestContext,
        error: expect.stringContaining('Permanent failure'),
        retryCount: mockRetryConfig.maxAttempts,
        timestamp: expect.any(String),
        classification: expect.any(Object)
      });
    });

    it('should provide methods to inspect dead letter queue', () => {
      const dlqItem: DeadLetterQueueItem = {
        id: 'test-1',
        request: { method: 'GET', endpoint: '/students' },
        error: 'Test error',
        retryCount: 3,
        timestamp: new Date().toISOString(),
        classification: {
          type: 'NETWORK_ERROR',
          isRetryable: true,
          severity: 'HIGH',
          category: 'TRANSIENT',
          userMessage: 'Network error'
        }
      };

      errorHandler.addToDeadLetterQueue(dlqItem);

      const queue = errorHandler.getDeadLetterQueue();
      expect(queue).toContainEqual(dlqItem);

      const filteredQueue = errorHandler.getDeadLetterQueue({
        errorType: 'NETWORK_ERROR'
      });
      expect(filteredQueue).toHaveLength(1);
    });

    it('should allow retry of dead letter queue items', async () => {
      // Add item to dead letter queue
      const dlqItem: DeadLetterQueueItem = {
        id: 'retry-test',
        request: { method: 'GET', endpoint: '/students' },
        error: 'Network timeout',
        retryCount: 3,
        timestamp: new Date().toISOString(),
        classification: {
          type: 'NETWORK_ERROR',
          isRetryable: true,
          severity: 'HIGH',
          category: 'TRANSIENT',
          userMessage: 'Network error'
        }
      };

      errorHandler.addToDeadLetterQueue(dlqItem);

      // Mock successful retry
      const mockRetryOperation = jest.fn().mockResolvedValue('success');

      const retryResults = await errorHandler.retryDeadLetterQueue({
        operation: mockRetryOperation,
        maxItemsToRetry: 1
      });

      expect(retryResults.attempted).toBe(1);
      expect(retryResults.succeeded).toBe(1);
      expect(retryResults.failed).toBe(0);
      expect(errorHandler.getDeadLetterQueue()).toHaveLength(0);
    });

    it('should handle failed retries by keeping items in queue', async () => {
      const dlqItem: DeadLetterQueueItem = {
        id: 'failed-retry',
        request: { method: 'GET', endpoint: '/students' },
        error: 'Network timeout',
        retryCount: 3,
        timestamp: new Date().toISOString(),
        classification: {
          type: 'NETWORK_ERROR',
          isRetryable: true,
          severity: 'HIGH',
          category: 'TRANSIENT',
          userMessage: 'Network error'
        }
      };

      errorHandler.addToDeadLetterQueue(dlqItem);

      const mockFailingRetry = jest.fn().mockRejectedValue(new Error('Still failing'));

      const retryResults = await errorHandler.retryDeadLetterQueue({
        operation: mockFailingRetry,
        maxItemsToRetry: 1
      });

      expect(retryResults.attempted).toBe(1);
      expect(retryResults.succeeded).toBe(0);
      expect(retryResults.failed).toBe(1);
      
      // Item should remain in queue with updated retry count
      const queue = errorHandler.getDeadLetterQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].retryCount).toBe(4);
    });

    it('should provide dead letter queue cleanup methods', () => {
      const oldItem: DeadLetterQueueItem = {
        id: 'old-item',
        request: { method: 'GET', endpoint: '/students' },
        error: 'Old error',
        retryCount: 3,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        classification: {
          type: 'NETWORK_ERROR',
          isRetryable: true,
          severity: 'HIGH',
          category: 'TRANSIENT',
          userMessage: 'Network error'
        }
      };

      errorHandler.addToDeadLetterQueue(oldItem);

      const cleanupResult = errorHandler.cleanupDeadLetterQueue({
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
        maxItems: 1000
      });

      expect(cleanupResult.removedItems).toBe(1);
      expect(errorHandler.getDeadLetterQueue()).toHaveLength(0);
    });

    it('should limit dead letter queue size to prevent memory issues', () => {
      const maxQueueSize = 100;
      const handler = new AeriesErrorHandler({
        ...mockRetryConfig,
        deadLetterQueueConfig: {
          maxSize: maxQueueSize
        }
      });

      // Add more items than the limit
      for (let i = 0; i < maxQueueSize + 10; i++) {
        handler.addToDeadLetterQueue({
          id: `item-${i}`,
          request: { method: 'GET', endpoint: '/students' },
          error: `Error ${i}`,
          retryCount: 3,
          timestamp: new Date().toISOString(),
          classification: {
            type: 'NETWORK_ERROR',
            isRetryable: true,
            severity: 'HIGH',
            category: 'TRANSIENT',
            userMessage: 'Network error'
          }
        });
      }

      expect(handler.getDeadLetterQueue()).toHaveLength(maxQueueSize);
    });
  });

  describe('logging and monitoring', () => {
    it('should log all error occurrences with structured data', () => {
      const logSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('Test error');
      const classification = errorHandler.classifyError(error);

      errorHandler.logError(error, classification, {
        operation: 'getStudents',
        context: { schoolCode: 'RIS' }
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AeriesErrorHandler]'),
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error',
            type: classification.type
          }),
          operation: 'getStudents',
          context: { schoolCode: 'RIS' },
          timestamp: expect.any(String)
        })
      );
    });

    it('should mask sensitive data in error logs', () => {
      const logSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('Student John Doe (SSN: 123-45-6789) not found');
      const classification = errorHandler.classifyError(error);

      errorHandler.logError(error, classification, {
        operation: 'getStudent',
        context: { 
          studentId: 'STU123',
          studentName: 'John Doe',
          ssn: '123-45-6789'
        }
      });

      const logCall = logSpy.mock.calls[0];
      const loggedData = JSON.stringify(logCall);

      expect(loggedData).not.toContain('John Doe');
      expect(loggedData).not.toContain('123-45-6789');
      expect(loggedData).toContain('STU123'); // ID is okay to log
    });

    it('should provide error statistics and metrics', () => {
      // Simulate various errors
      errorHandler.classifyError(new Error('Network error'));
      errorHandler.classifyError({ response: { status: 401 } });
      errorHandler.classifyError({ response: { status: 500 } });
      errorHandler.classifyError(new Error('Network error')); // Duplicate type

      const stats = errorHandler.getErrorStatistics();

      expect(stats).toMatchObject({
        totalErrors: 4,
        errorsByType: expect.objectContaining({
          'NETWORK_ERROR': 2,
          'AUTHENTICATION_ERROR': 1,
          'SERVER_ERROR': 1
        }),
        errorsBySeverity: expect.objectContaining({
          'HIGH': 2,
          'CRITICAL': 1,
          'HIGH': 1
        }),
        retryableErrors: 3,
        nonRetryableErrors: 1
      });
    });

    it('should reset error statistics when requested', () => {
      errorHandler.classifyError(new Error('Test error'));
      
      expect(errorHandler.getErrorStatistics().totalErrors).toBe(1);
      
      errorHandler.resetErrorStatistics();
      
      expect(errorHandler.getErrorStatistics().totalErrors).toBe(0);
    });

    it('should provide time-windowed error statistics', () => {
      // Record errors at different times
      errorHandler.classifyError(new Error('Old error'));
      
      jest.advanceTimersByTime(60000); // 1 minute
      
      errorHandler.classifyError(new Error('Recent error'));

      const recentStats = errorHandler.getErrorStatistics({
        timeWindowMs: 30000 // Last 30 seconds
      });

      expect(recentStats.totalErrors).toBe(1); // Only recent error
    });
  });

  describe('integration and edge cases', () => {
    it('should handle circular reference errors safely', () => {
      const circularError: any = new Error('Circular error');
      circularError.circular = circularError;

      expect(() => errorHandler.classifyError(circularError)).not.toThrow();
      
      const classification = errorHandler.classifyError(circularError);
      expect(classification.type).toBe('UNKNOWN_ERROR');
    });

    it('should handle errors with no stack trace', () => {
      const noStackError = new Error('No stack');
      delete noStackError.stack;

      const classification = errorHandler.classifyError(noStackError);
      expect(classification.type).toBe('UNKNOWN_ERROR');
      expect(classification.userMessage).toBeDefined();
    });

    it('should handle null and undefined errors gracefully', () => {
      expect(() => errorHandler.classifyError(null)).not.toThrow();
      expect(() => errorHandler.classifyError(undefined)).not.toThrow();
      
      const nullClassification = errorHandler.classifyError(null);
      expect(nullClassification.type).toBe('UNKNOWN_ERROR');
    });

    it('should handle very large error objects without performance issues', () => {
      const largeError = {
        response: {
          status: 500,
          data: {
            error: 'Large error',
            metadata: Array(10000).fill('x').join('')
          }
        }
      };

      const startTime = Date.now();
      const classification = errorHandler.classifyError(largeError);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(classification.type).toBe('SERVER_ERROR');
    });

    it('should handle concurrent error processing without race conditions', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Concurrent error'));

      const promises = Array(10).fill(null).map(() => 
        errorHandler.executeWithRetry(mockOperation).catch(() => {})
      );

      await Promise.all(promises);

      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(30); // 10 operations * 3 attempts each
    });
  });
});