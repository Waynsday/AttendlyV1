/**
 * @fileoverview Dead Letter Queue Tests
 * 
 * Tests for the dead letter queue implementation that handles
 * failed Aeries sync operations and provides retry mechanisms.
 * 
 * Following TDD practices - these tests define the expected behavior
 * of the dead letter queue before implementation.
 */

import { jest } from '@jest/globals';
import { DeadLetterQueue, FailedOperation, QueueStats } from '../../../../lib/aeries/dead-letter-queue';

describe('DeadLetterQueue', () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue({
      maxRetries: 3,
      retryDelayMs: 5000,
      maxQueueSize: 1000,
      persistencePath: './test-dlq.json'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Queue Operations', () => {
    it('should add failed operations to the queue', async () => {
      // Arrange
      const failedOperation: FailedOperation = {
        operationId: 'sync-123',
        type: 'ATTENDANCE_SYNC',
        error: new Error('API timeout'),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        payload: {
          startDate: '2024-08-15',
          endDate: '2024-08-16',
          schoolCode: 'RHS'
        }
      };

      // Act
      await dlq.add(failedOperation);

      // Assert
      const stats = await dlq.getStats();
      expect(stats.totalItems).toBe(1);
      expect(stats.pendingItems).toBe(1);
    });

    it('should retrieve next item for processing', async () => {
      // Arrange
      const failedOperation: FailedOperation = {
        operationId: 'sync-456',
        type: 'STUDENT_SYNC',
        error: new Error('Network error'),
        timestamp: new Date().toISOString(),
        retryCount: 1,
        payload: { batchSize: 100 }
      };

      await dlq.add(failedOperation);

      // Act
      const nextItem = await dlq.getNextItem();

      // Assert
      expect(nextItem).toEqual(failedOperation);
    });

    it('should return null when queue is empty', async () => {
      // Act
      const nextItem = await dlq.getNextItem();

      // Assert
      expect(nextItem).toBeNull();
    });

    it('should mark items as processed', async () => {
      // Arrange
      const failedOperation: FailedOperation = {
        operationId: 'sync-789',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Validation error'),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        payload: {}
      };

      await dlq.add(failedOperation);

      // Act
      await dlq.markAsProcessed('sync-789');

      // Assert
      const stats = await dlq.getStats();
      expect(stats.processedItems).toBe(1);
      expect(stats.pendingItems).toBe(0);
    });

    it('should mark items as permanently failed after max retries', async () => {
      // Arrange
      const failedOperation: FailedOperation = {
        operationId: 'sync-failed',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Persistent error'),
        timestamp: new Date().toISOString(),
        retryCount: 3, // Equals max retries
        payload: {}
      };

      // Act
      await dlq.add(failedOperation);

      // Assert
      const stats = await dlq.getStats();
      expect(stats.permanentlyFailedItems).toBe(1);
      expect(stats.pendingItems).toBe(0);
    });
  });

  describe('Retry Logic', () => {
    it('should respect retry delay when getting next item', async () => {
      // Arrange
      const recentFailure: FailedOperation = {
        operationId: 'recent-fail',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Recent error'),
        timestamp: new Date().toISOString(), // Just failed
        retryCount: 1,
        payload: {},
        nextRetryAt: new Date(Date.now() + 10000).toISOString() // 10 seconds from now
      };

      await dlq.add(recentFailure);

      // Act
      const nextItem = await dlq.getNextItem();

      // Assert
      expect(nextItem).toBeNull(); // Should not return item until retry time
    });

    it('should return items ready for retry', async () => {
      // Arrange
      const readyForRetry: FailedOperation = {
        operationId: 'retry-ready',
        type: 'STUDENT_SYNC',
        error: new Error('Previous error'),
        timestamp: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
        retryCount: 1,
        payload: {},
        nextRetryAt: new Date(Date.now() - 1000).toISOString() // 1 second ago
      };

      await dlq.add(readyForRetry);

      // Act
      const nextItem = await dlq.getNextItem();

      // Assert
      expect(nextItem).toEqual(readyForRetry);
    });

    it('should increment retry count when re-adding failed operations', async () => {
      // Arrange
      const operation: FailedOperation = {
        operationId: 'increment-test',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Another failure'),
        timestamp: new Date().toISOString(),
        retryCount: 1,
        payload: {}
      };

      // Act
      const updatedOperation = await dlq.incrementRetryCount(operation);

      // Assert
      expect(updatedOperation.retryCount).toBe(2);
      expect(updatedOperation.nextRetryAt).toBeDefined();
    });

    it('should calculate exponential backoff for retry delays', async () => {
      // Arrange
      const operation: FailedOperation = {
        operationId: 'backoff-test',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Backoff test'),
        timestamp: new Date().toISOString(),
        retryCount: 2,
        payload: {}
      };

      // Act
      const delay = await dlq.calculateRetryDelay(operation);

      // Assert
      // Should be exponential: baseDelay * (2 ^ retryCount)
      // Expected: 5000 * (2 ^ 2) = 20000ms
      expect(delay).toBe(20000);
    });
  });

  describe('Queue Management', () => {
    it('should enforce maximum queue size', async () => {
      // Arrange
      const dlqSmall = new DeadLetterQueue({
        maxRetries: 3,
        retryDelayMs: 1000,
        maxQueueSize: 2 // Small queue for testing
      });

      // Act & Assert
      await dlqSmall.add({
        operationId: 'op1',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Error 1'),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        payload: {}
      });

      await dlqSmall.add({
        operationId: 'op2',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Error 2'),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        payload: {}
      });

      // Third item should be rejected
      await expect(dlqSmall.add({
        operationId: 'op3',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Error 3'),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        payload: {}
      })).rejects.toThrow('Queue is full');
    });

    it('should prioritize items by retry count (fewer retries first)', async () => {
      // Arrange
      const highRetryOperation: FailedOperation = {
        operationId: 'high-retry',
        type: 'ATTENDANCE_SYNC',
        error: new Error('High retry'),
        timestamp: new Date().toISOString(),
        retryCount: 2,
        payload: {},
        nextRetryAt: new Date(Date.now() - 1000).toISOString()
      };

      const lowRetryOperation: FailedOperation = {
        operationId: 'low-retry',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Low retry'),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        payload: {},
        nextRetryAt: new Date(Date.now() - 1000).toISOString()
      };

      await dlq.add(highRetryOperation);
      await dlq.add(lowRetryOperation);

      // Act
      const firstItem = await dlq.getNextItem();

      // Assert
      expect(firstItem?.operationId).toBe('low-retry');
    });

    it('should clean up old processed items', async () => {
      // Arrange
      const oldProcessedOperation: FailedOperation = {
        operationId: 'old-processed',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Old error'),
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
        retryCount: 0,
        payload: {},
        processedAt: new Date(Date.now() - 86400000).toISOString()
      };

      await dlq.add(oldProcessedOperation);

      // Act
      await dlq.cleanup(3600000); // Clean items older than 1 hour

      // Assert
      const stats = await dlq.getStats();
      expect(stats.totalItems).toBe(0);
    });
  });

  describe('Persistence', () => {
    it('should persist queue state to disk', async () => {
      // Arrange
      const operation: FailedOperation = {
        operationId: 'persist-test',
        type: 'ATTENDANCE_SYNC',
        error: new Error('Persist error'),
        timestamp: new Date().toISOString(),
        retryCount: 0,
        payload: {}
      };

      await dlq.add(operation);

      // Act
      await dlq.persist();

      // Assert
      const newDlq = new DeadLetterQueue({
        maxRetries: 3,
        retryDelayMs: 5000,
        maxQueueSize: 1000,
        persistencePath: './test-dlq.json'
      });

      await newDlq.restore();
      const stats = await newDlq.getStats();
      expect(stats.totalItems).toBe(1);
    });

    it('should restore queue state from disk', async () => {
      // Arrange
      const operations = [
        {
          operationId: 'restore-1',
          type: 'ATTENDANCE_SYNC' as const,
          error: new Error('Error 1'),
          timestamp: new Date().toISOString(),
          retryCount: 0,
          payload: {}
        },
        {
          operationId: 'restore-2',
          type: 'STUDENT_SYNC' as const,
          error: new Error('Error 2'),
          timestamp: new Date().toISOString(),
          retryCount: 1,
          payload: {}
        }
      ];

      // Add operations to one instance
      for (const op of operations) {
        await dlq.add(op);
      }
      await dlq.persist();

      // Act - create new instance and restore
      const newDlq = new DeadLetterQueue({
        maxRetries: 3,
        retryDelayMs: 5000,
        maxQueueSize: 1000,
        persistencePath: './test-dlq.json'
      });

      await newDlq.restore();

      // Assert
      const stats = await newDlq.getStats();
      expect(stats.totalItems).toBe(2);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive queue statistics', async () => {
      // Arrange
      const operations = [
        {
          operationId: 'stat-pending',
          type: 'ATTENDANCE_SYNC' as const,
          error: new Error('Pending'),
          timestamp: new Date().toISOString(),
          retryCount: 0,
          payload: {}
        },
        {
          operationId: 'stat-processed',
          type: 'STUDENT_SYNC' as const,
          error: new Error('Processed'),
          timestamp: new Date().toISOString(),
          retryCount: 1,
          payload: {},
          processedAt: new Date().toISOString()
        },
        {
          operationId: 'stat-failed',
          type: 'ATTENDANCE_SYNC' as const,
          error: new Error('Failed'),
          timestamp: new Date().toISOString(),
          retryCount: 3, // Max retries exceeded
          payload: {}
        }
      ];

      for (const op of operations) {
        await dlq.add(op);
      }

      // Act
      const stats = await dlq.getStats();

      // Assert
      expect(stats).toEqual({
        totalItems: 3,
        pendingItems: 1,
        processedItems: 1,
        permanentlyFailedItems: 1,
        averageRetryCount: expect.any(Number),
        oldestItem: expect.any(String),
        queueUtilization: expect.any(Number)
      });
    });

    it('should track queue utilization percentage', async () => {
      // Arrange
      const dlqSmall = new DeadLetterQueue({
        maxRetries: 3,
        retryDelayMs: 1000,
        maxQueueSize: 10
      });

      // Add 3 items to queue of size 10
      for (let i = 0; i < 3; i++) {
        await dlqSmall.add({
          operationId: `util-${i}`,
          type: 'ATTENDANCE_SYNC',
          error: new Error(`Error ${i}`),
          timestamp: new Date().toISOString(),
          retryCount: 0,
          payload: {}
        });
      }

      // Act
      const stats = await dlqSmall.getStats();

      // Assert
      expect(stats.queueUtilization).toBe(30); // 3/10 * 100 = 30%
    });
  });
});