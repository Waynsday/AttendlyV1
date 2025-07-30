/**
 * @fileoverview Circuit Breaker Pattern Test Suite
 * 
 * Comprehensive tests for the circuit breaker implementation used by
 * the production Aeries API client. Tests all states, transitions,
 * and failure recovery mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CircuitBreaker, CircuitBreakerState, CircuitBreakerConfig } from '../../../../lib/aeries/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockConfig: CircuitBreakerConfig;

  beforeEach(() => {
    mockConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
      halfOpenMaxRequests: 3
    };

    circuitBreaker = new CircuitBreaker(mockConfig);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize in CLOSED state with zero failures', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
      expect(circuitBreaker.getSuccessCount()).toBe(0);
    });

    it('should validate configuration parameters', () => {
      expect(() => new CircuitBreaker({
        ...mockConfig,
        failureThreshold: 0
      })).toThrow('Failure threshold must be greater than 0');

      expect(() => new CircuitBreaker({
        ...mockConfig,
        recoveryTimeout: -1
      })).toThrow('Recovery timeout must be positive');
    });

    it('should apply default configuration values', () => {
      const defaultBreaker = new CircuitBreaker({});
      
      expect(defaultBreaker.getConfig()).toMatchObject({
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 300000,
        halfOpenMaxRequests: 1
      });
    });
  });

  describe('state transitions', () => {
    describe('CLOSED to OPEN', () => {
      it('should open circuit after reaching failure threshold', async () => {
        const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

        // Execute failing operations up to threshold
        for (let i = 0; i < mockConfig.failureThreshold; i++) {
          await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();
        }

        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      });

      it('should reset failure count on successful operation in CLOSED state', async () => {
        const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
        const mockSuccessOperation = jest.fn().mockResolvedValue('success');

        // Add some failures
        for (let i = 0; i < 3; i++) {
          await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();
        }

        expect(circuitBreaker.getFailureCount()).toBe(3);

        // Successful operation should reset failure count
        const result = await circuitBreaker.execute(mockSuccessOperation);
        expect(result).toBe('success');
        expect(circuitBreaker.getFailureCount()).toBe(0);
      });

      it('should emit state change event when opening', async () => {
        const stateChangeHandler = jest.fn();
        circuitBreaker.on('stateChange', stateChangeHandler);

        const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

        // Trigger circuit open
        for (let i = 0; i < mockConfig.failureThreshold; i++) {
          await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();
        }

        expect(stateChangeHandler).toHaveBeenCalledWith({
          from: CircuitBreakerState.CLOSED,
          to: CircuitBreakerState.OPEN,
          reason: 'FAILURE_THRESHOLD_EXCEEDED',
          timestamp: expect.any(String)
        });
      });
    });

    describe('OPEN to HALF_OPEN', () => {
      beforeEach(async () => {
        // Force circuit to OPEN state
        const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
        for (let i = 0; i < mockConfig.failureThreshold; i++) {
          await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();
        }
      });

      it('should transition to HALF_OPEN after recovery timeout', () => {
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

        // Advance time past recovery timeout
        jest.advanceTimersByTime(mockConfig.recoveryTimeout);

        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      });

      it('should emit state change event when transitioning to HALF_OPEN', () => {
        const stateChangeHandler = jest.fn();
        circuitBreaker.on('stateChange', stateChangeHandler);

        jest.advanceTimersByTime(mockConfig.recoveryTimeout);

        expect(stateChangeHandler).toHaveBeenCalledWith({
          from: CircuitBreakerState.OPEN,
          to: CircuitBreakerState.HALF_OPEN,
          reason: 'RECOVERY_TIMEOUT_ELAPSED',
          timestamp: expect.any(String)
        });
      });

      it('should immediately reject requests in OPEN state', async () => {
        const mockOperation = jest.fn().mockResolvedValue('success');

        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN');
        
        // Operation should not be called
        expect(mockOperation).not.toHaveBeenCalled();
      });
    });

    describe('HALF_OPEN behavior', () => {
      beforeEach(async () => {
        // Force circuit to OPEN then HALF_OPEN
        const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
        for (let i = 0; i < mockConfig.failureThreshold; i++) {
          await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();
        }
        jest.advanceTimersByTime(mockConfig.recoveryTimeout);
      });

      it('should allow limited requests in HALF_OPEN state', async () => {
        const mockSuccessOperation = jest.fn().mockResolvedValue('success');

        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

        // Should allow up to halfOpenMaxRequests
        for (let i = 0; i < mockConfig.halfOpenMaxRequests; i++) {
          const result = await circuitBreaker.execute(mockSuccessOperation);
          expect(result).toBe('success');
        }

        expect(mockSuccessOperation).toHaveBeenCalledTimes(mockConfig.halfOpenMaxRequests);
      });

      it('should transition to CLOSED on successful requests', async () => {
        const mockSuccessOperation = jest.fn().mockResolvedValue('success');

        // Execute successful operations up to half-open limit
        for (let i = 0; i < mockConfig.halfOpenMaxRequests; i++) {
          await circuitBreaker.execute(mockSuccessOperation);
        }

        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      });

      it('should transition back to OPEN on any failure', async () => {
        const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

        await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();

        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      });

      it('should reject additional requests after half-open limit', async () => {
        const mockOperation = jest.fn().mockResolvedValue('success');

        // Fill up half-open request quota
        for (let i = 0; i < mockConfig.halfOpenMaxRequests; i++) {
          await circuitBreaker.execute(mockOperation);
        }

        // Additional request should be rejected
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker HALF_OPEN request limit exceeded');
      });
    });
  });

  describe('statistics and monitoring', () => {
    it('should track request counts and success rates', async () => {
      const mockSuccessOperation = jest.fn().mockResolvedValue('success');
      const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Execute mixed operations
      await circuitBreaker.execute(mockSuccessOperation);
      await circuitBreaker.execute(mockSuccessOperation);
      await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();

      const stats = circuitBreaker.getStatistics();
      expect(stats).toMatchObject({
        totalRequests: 3,
        successfulRequests: 2,
        failedRequests: 1,
        successRate: 66.67,
        failureRate: 33.33
      });
    });

    it('should track average response times', async () => {
      const mockSlowOperation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });

      jest.useRealTimers(); // Need real timers for timing measurement
      
      await circuitBreaker.execute(mockSlowOperation);
      
      const stats = circuitBreaker.getStatistics();
      expect(stats.averageResponseTime).toBeGreaterThan(90);
      
      jest.useFakeTimers();
    });

    it('should provide time-windowed statistics', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      // Execute operations
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);

      // Advance time
      jest.advanceTimersByTime(30000);

      // Execute more operations
      await circuitBreaker.execute(mockOperation);

      const recentStats = circuitBreaker.getStatistics({ timeWindowMs: 20000 });
      expect(recentStats.totalRequests).toBe(1); // Only the recent request
    });

    it('should reset statistics when requested', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);

      expect(circuitBreaker.getStatistics().totalRequests).toBe(2);

      circuitBreaker.resetStatistics();

      expect(circuitBreaker.getStatistics().totalRequests).toBe(0);
    });
  });

  describe('health checks', () => {
    it('should perform periodic health checks when enabled', async () => {
      const mockHealthCheck = jest.fn().mockResolvedValue(true);
      
      circuitBreaker.enableHealthChecks(mockHealthCheck, 10000);

      // Advance time to trigger health checks
      jest.advanceTimersByTime(10000);
      
      expect(mockHealthCheck).toHaveBeenCalled();
    });

    it('should transition to OPEN on failed health checks', async () => {
      const mockFailingHealthCheck = jest.fn().mockResolvedValue(false);
      
      circuitBreaker.enableHealthChecks(mockFailingHealthCheck, 5000);

      // Trigger health check
      jest.advanceTimersByTime(5000);

      // Should transition to OPEN after consecutive health check failures
      jest.advanceTimersByTime(25000); // Multiple health check intervals

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should provide manual health check method', async () => {
      const mockHealthCheck = jest.fn().mockResolvedValue(true);
      
      circuitBreaker.setHealthCheck(mockHealthCheck);

      const isHealthy = await circuitBreaker.performHealthCheck();
      expect(isHealthy).toBe(true);
      expect(mockHealthCheck).toHaveBeenCalled();
    });

    it('should disable health checks when requested', () => {
      const mockHealthCheck = jest.fn();
      
      circuitBreaker.enableHealthChecks(mockHealthCheck, 5000);
      circuitBreaker.disableHealthChecks();

      jest.advanceTimersByTime(10000);

      expect(mockHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('fallback mechanisms', () => {
    it('should execute fallback when circuit is OPEN', async () => {
      const mockOperation = jest.fn().mockResolvedValue('normal-result');
      const mockFallback = jest.fn().mockResolvedValue('fallback-result');

      // Force circuit to OPEN
      const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      for (let i = 0; i < mockConfig.failureThreshold; i++) {
        await expect(circuitBreaker.execute(mockFailingOperation)).rejects.toThrow();
      }

      const result = await circuitBreaker.executeWithFallback(mockOperation, mockFallback);

      expect(result).toBe('fallback-result');
      expect(mockOperation).not.toHaveBeenCalled();
      expect(mockFallback).toHaveBeenCalled();
    });

    it('should execute normal operation when circuit is CLOSED', async () => {
      const mockOperation = jest.fn().mockResolvedValue('normal-result');
      const mockFallback = jest.fn().mockResolvedValue('fallback-result');

      const result = await circuitBreaker.executeWithFallback(mockOperation, mockFallback);

      expect(result).toBe('normal-result');
      expect(mockOperation).toHaveBeenCalled();
      expect(mockFallback).not.toHaveBeenCalled();
    });

    it('should execute fallback if normal operation fails in CLOSED state', async () => {
      const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const mockFallback = jest.fn().mockResolvedValue('fallback-result');

      const result = await circuitBreaker.executeWithFallback(mockFailingOperation, mockFallback);

      expect(result).toBe('fallback-result');
      expect(mockFailingOperation).toHaveBeenCalled();
      expect(mockFallback).toHaveBeenCalled();
    });

    it('should throw if both operation and fallback fail', async () => {
      const mockFailingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const mockFailingFallback = jest.fn().mockRejectedValue(new Error('Fallback failed'));

      await expect(
        circuitBreaker.executeWithFallback(mockFailingOperation, mockFailingFallback)
      ).rejects.toThrow('Fallback failed');
    });
  });

  describe('configuration and state management', () => {
    it('should allow runtime configuration updates', () => {
      const newConfig = {
        ...mockConfig,
        failureThreshold: 10,
        recoveryTimeout: 60000
      };

      circuitBreaker.updateConfig(newConfig);

      expect(circuitBreaker.getConfig()).toMatchObject(newConfig);
    });

    it('should validate configuration updates', () => {
      expect(() => {
        circuitBreaker.updateConfig({
          ...mockConfig,
          failureThreshold: -1
        });
      }).toThrow('Invalid configuration');
    });

    it('should allow manual state transitions for testing', () => {
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should provide state history for debugging', () => {
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      circuitBreaker.forceState(CircuitBreakerState.CLOSED);

      const stateHistory = circuitBreaker.getStateHistory();
      expect(stateHistory).toHaveLength(4); // Initial CLOSED + 3 forced states
      expect(stateHistory[stateHistory.length - 1].state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle operation timeouts appropriately', async () => {
      const mockTimeoutOperation = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 1000)
        )
      );

      jest.useRealTimers();
      
      await expect(circuitBreaker.execute(mockTimeoutOperation, { timeout: 500 }))
        .rejects.toThrow('Operation timeout');
      
      expect(circuitBreaker.getFailureCount()).toBe(1);
      
      jest.useFakeTimers();
    });

    it('should handle concurrent requests appropriately', async () => {
      const mockSlowOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 100))
      );

      // Execute multiple concurrent requests
      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(mockSlowOperation)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(results.every(result => result === 'success')).toBe(true);
    });

    it('should handle memory cleanup for long-running instances', () => {
      // Simulate long-running operation with many requests
      for (let i = 0; i < 1000; i++) {
        circuitBreaker.recordSuccess();
      }

      const memoryUsage = process.memoryUsage();
      const initialHeapUsed = memoryUsage.heapUsed;

      // Trigger cleanup
      circuitBreaker.cleanup();

      const afterCleanupUsage = process.memoryUsage();
      
      // Memory usage should not have grown significantly
      expect(afterCleanupUsage.heapUsed).toBeLessThanOrEqual(initialHeapUsed * 1.1);
    });
  });
});