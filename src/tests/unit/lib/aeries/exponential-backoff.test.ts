/**
 * @fileoverview Exponential Backoff Tests
 * 
 * Tests for the exponential backoff implementation that handles
 * retry delays for failed Aeries API requests.
 * 
 * Following TDD practices - these tests define the expected behavior
 * of the exponential backoff before implementation.
 */

import { jest } from '@jest/globals';
import { ExponentialBackoff, BackoffConfig, BackoffState } from '../../../../lib/aeries/exponential-backoff';

describe('ExponentialBackoff', () => {
  let backoff: ExponentialBackoff;

  beforeEach(() => {
    backoff = new ExponentialBackoff({
      baseDelay: 1000,        // 1 second
      maxDelay: 32000,        // 32 seconds
      maxAttempts: 5,
      multiplier: 2,
      jitter: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      // Arrange & Act
      const defaultBackoff = new ExponentialBackoff();

      // Assert
      const config = defaultBackoff.getConfig();
      expect(config.baseDelay).toBe(1000);
      expect(config.maxDelay).toBe(30000);
      expect(config.maxAttempts).toBe(3);
      expect(config.multiplier).toBe(2);
      expect(config.jitter).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      // Arrange
      const customConfig: BackoffConfig = {
        baseDelay: 500,
        maxDelay: 60000,
        maxAttempts: 10,
        multiplier: 1.5,
        jitter: false
      };

      // Act
      const customBackoff = new ExponentialBackoff(customConfig);

      // Assert
      const config = customBackoff.getConfig();
      expect(config).toEqual(customConfig);
    });

    it('should validate configuration parameters', () => {
      // Act & Assert
      expect(() => new ExponentialBackoff({
        baseDelay: 0, // Invalid
        maxDelay: 30000,
        maxAttempts: 3,
        multiplier: 2,
        jitter: true
      })).toThrow('Base delay must be positive');

      expect(() => new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 500, // Less than base delay
        maxAttempts: 3,
        multiplier: 2,
        jitter: true
      })).toThrow('Max delay must be greater than base delay');

      expect(() => new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 30000,
        maxAttempts: 0, // Invalid
        multiplier: 2,
        jitter: true
      })).toThrow('Max attempts must be positive');

      expect(() => new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 30000,
        maxAttempts: 3,
        multiplier: 0.5, // Less than 1
        jitter: true
      })).toThrow('Multiplier must be at least 1');
    });
  });

  describe('Delay Calculation', () => {
    it('should calculate exponential delays correctly', () => {
      // Arrange & Act
      const delay1 = backoff.getNextDelay();
      const delay2 = backoff.getNextDelay();
      const delay3 = backoff.getNextDelay();

      // Assert - without jitter for predictable testing
      const backoffNoJitter = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 32000,
        maxAttempts: 5,
        multiplier: 2,
        jitter: false
      });

      expect(backoffNoJitter.getNextDelay()).toBe(1000);  // 1000 * 2^0
      expect(backoffNoJitter.getNextDelay()).toBe(2000);  // 1000 * 2^1
      expect(backoffNoJitter.getNextDelay()).toBe(4000);  // 1000 * 2^2
      expect(backoffNoJitter.getNextDelay()).toBe(8000);  // 1000 * 2^3
      expect(backoffNoJitter.getNextDelay()).toBe(16000); // 1000 * 2^4
    });

    it('should respect maximum delay limit', () => {
      // Arrange
      const backoffLimited = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 5000, // Low max for testing
        maxAttempts: 10,
        multiplier: 2,
        jitter: false
      });

      // Act - get delays that would exceed max
      const delays = [];
      for (let i = 0; i < 6; i++) {
        delays.push(backoffLimited.getNextDelay());
      }

      // Assert
      expect(delays[0]).toBe(1000); // 1000 * 2^0
      expect(delays[1]).toBe(2000); // 1000 * 2^1
      expect(delays[2]).toBe(4000); // 1000 * 2^2
      expect(delays[3]).toBe(5000); // Capped at maxDelay
      expect(delays[4]).toBe(5000); // Still capped
      expect(delays[5]).toBe(5000); // Still capped
    });

    it('should apply jitter when enabled', () => {
      // Arrange
      const backoffWithJitter = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 32000,
        maxAttempts: 5,
        multiplier: 2,
        jitter: true
      });

      // Act
      const delays = [];
      for (let i = 0; i < 10; i++) {
        backoffWithJitter.reset();
        delays.push(backoffWithJitter.getNextDelay());
      }

      // Assert - delays should vary due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be within reasonable range of base delay
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(500);  // 50% of base
        expect(delay).toBeLessThanOrEqual(1500);    // 150% of base
      });
    });

    it('should not apply jitter when disabled', () => {
      // Arrange
      const backoffNoJitter = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 32000,
        maxAttempts: 5,
        multiplier: 2,
        jitter: false
      });

      // Act
      const delays = [];
      for (let i = 0; i < 5; i++) {
        backoffNoJitter.reset();
        delays.push(backoffNoJitter.getNextDelay());
      }

      // Assert - all delays should be identical
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBe(1);
      expect(delays[0]).toBe(1000);
    });
  });

  describe('Retry Logic', () => {
    it('should allow retries within max attempts', () => {
      // Arrange & Act
      let canRetry = true;
      let attempts = 0;

      while (canRetry && attempts < 10) {
        attempts++;
        canRetry = backoff.shouldRetry();
        if (canRetry) {
          backoff.getNextDelay();
        }
      }

      // Assert
      expect(attempts).toBe(5); // maxAttempts
      expect(backoff.shouldRetry()).toBe(false);
    });

    it('should stop retrying after max attempts exceeded', () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        backoff.getNextDelay();
      }

      // Act & Assert
      expect(backoff.shouldRetry()).toBe(false);
    });

    it('should reset retry state when reset() is called', () => {
      // Arrange - exhaust attempts
      for (let i = 0; i < 5; i++) {
        backoff.getNextDelay();
      }
      expect(backoff.shouldRetry()).toBe(false);

      // Act
      backoff.reset();

      // Assert
      expect(backoff.shouldRetry()).toBe(true);
      expect(backoff.getNextDelay()).toBe(1000); // Back to base delay (without jitter)
    });

    it('should track current attempt count', () => {
      // Arrange & Act
      expect(backoff.getCurrentAttempt()).toBe(0);

      backoff.getNextDelay();
      expect(backoff.getCurrentAttempt()).toBe(1);

      backoff.getNextDelay();
      expect(backoff.getCurrentAttempt()).toBe(2);

      backoff.reset();
      expect(backoff.getCurrentAttempt()).toBe(0);
    });
  });

  describe('State Management', () => {
    it('should provide current backoff state', () => {
      // Arrange
      backoff.getNextDelay(); // First attempt
      backoff.getNextDelay(); // Second attempt

      // Act
      const state = backoff.getState();

      // Assert
      expect(state).toEqual({
        currentAttempt: 2,
        nextDelay: expect.any(Number),
        canRetry: true,
        totalAttempts: 2,
        startTime: expect.any(Number)
      });
    });

    it('should track total elapsed time', async () => {
      // Arrange
      const startTime = Date.now();
      
      // Act
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      backoff.getNextDelay();
      
      const state = backoff.getState();
      const elapsedTime = Date.now() - state.startTime;

      // Assert
      expect(elapsedTime).toBeGreaterThanOrEqual(100);
    });

    it('should restore state from previous backoff instance', () => {
      // Arrange
      backoff.getNextDelay(); // First attempt
      backoff.getNextDelay(); // Second attempt
      const savedState = backoff.getState();

      // Act
      const newBackoff = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 32000,
        maxAttempts: 5,
        multiplier: 2,
        jitter: false
      });
      
      newBackoff.setState(savedState);
      const restoredState = newBackoff.getState();

      // Assert
      expect(restoredState.currentAttempt).toBe(2);
      expect(restoredState.totalAttempts).toBe(2);
    });
  });

  describe('Advanced Features', () => {
    it('should support custom multiplier values', () => {
      // Arrange
      const customBackoff = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 32000,
        maxAttempts: 5,
        multiplier: 1.5, // Custom multiplier
        jitter: false
      });

      // Act & Assert
      expect(customBackoff.getNextDelay()).toBe(1000);  // 1000 * 1.5^0
      expect(customBackoff.getNextDelay()).toBe(1500);  // 1000 * 1.5^1
      expect(customBackoff.getNextDelay()).toBe(2250);  // 1000 * 1.5^2
      expect(customBackoff.getNextDelay()).toBe(3375);  // 1000 * 1.5^3
    });

    it('should provide time until next retry', () => {
      // Arrange
      backoff.getNextDelay(); // First delay

      // Act
      const timeUntilNext = backoff.getTimeUntilNextRetry();

      // Assert
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(2000); // Should be around second delay
    });

    it('should calculate total backoff time for all attempts', () => {
      // Arrange
      const backoffNoJitter = new ExponentialBackoff({
        baseDelay: 1000,
        maxDelay: 32000,
        maxAttempts: 4,
        multiplier: 2,
        jitter: false
      });

      // Act
      const totalTime = backoffNoJitter.getTotalBackoffTime();

      // Assert
      // Total: 1000 + 2000 + 4000 + 8000 = 15000ms
      expect(totalTime).toBe(15000);
    });

    it('should handle edge cases gracefully', () => {
      // Arrange
      const edgeCaseBackoff = new ExponentialBackoff({
        baseDelay: 1,
        maxDelay: 2,
        maxAttempts: 1,
        multiplier: 10,
        jitter: false
      });

      // Act & Assert
      expect(edgeCaseBackoff.getNextDelay()).toBe(1);
      expect(edgeCaseBackoff.shouldRetry()).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with async operations and delays', async () => {
      // Arrange
      const fastBackoff = new ExponentialBackoff({
        baseDelay: 10,
        maxDelay: 100,
        maxAttempts: 3,
        multiplier: 2,
        jitter: false
      });

      const attempts: number[] = [];
      let success = false;

      // Act - simulate retry loop
      while (fastBackoff.shouldRetry() && !success) {
        const delay = fastBackoff.getNextDelay();
        attempts.push(delay);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Simulate failure on first two attempts, success on third
        success = attempts.length >= 3;
      }

      // Assert
      expect(attempts).toEqual([10, 20, 40]);
      expect(success).toBe(true);
    });

    it('should handle rapid successive failures', () => {
      // Arrange
      const rapidBackoff = new ExponentialBackoff({
        baseDelay: 100,
        maxDelay: 1000,
        maxAttempts: 10,
        multiplier: 2,
        jitter: false
      });

      // Act - rapid successive calls
      const delays = [];
      while (rapidBackoff.shouldRetry() && delays.length < 5) {
        delays.push(rapidBackoff.getNextDelay());
      }

      // Assert
      expect(delays).toEqual([100, 200, 400, 800, 1000]); // Last capped at maxDelay
    });
  });
});