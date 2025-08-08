/**
 * @fileoverview Circuit Breaker Pattern Implementation
 * 
 * Implements the circuit breaker pattern to prevent cascading failures
 * and provide resilience for the Aeries API client. Features:
 * - Three states: CLOSED, OPEN, HALF_OPEN
 * - Configurable failure thresholds and recovery timeouts
 * - Health check integration
 * - Fallback mechanism support
 * - Statistics and monitoring
 */

import { EventEmitter } from 'events';

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation, requests pass through
  OPEN = 'OPEN',         // Circuit is open, requests are blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold?: number;      // Number of failures before opening circuit
  recoveryTimeout?: number;       // Time to wait before moving to HALF_OPEN (ms)
  monitoringPeriod?: number;      // Period for monitoring success/failure rates (ms)
  halfOpenMaxRequests?: number;   // Max requests allowed in HALF_OPEN state
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  failureRate: number;
  averageResponseTime: number;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  timeInCurrentState: number;
}

/**
 * State change event data
 */
export interface StateChangeEvent {
  from: CircuitBreakerState;
  to: CircuitBreakerState;
  reason: string;
  timestamp: string;
}

/**
 * State history entry
 */
interface StateHistoryEntry {
  state: CircuitBreakerState;
  timestamp: string;
  reason: string;
  duration?: number;
}

/**
 * Request statistics
 */
interface RequestStats {
  timestamp: number;
  success: boolean;
  responseTime: number;
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private config: Required<CircuitBreakerConfig>;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;
  private lastStateChangeTime = Date.now();
  private halfOpenRequestCount = 0;
  
  // Statistics tracking
  private requestStats: RequestStats[] = [];
  private stateHistory: StateHistoryEntry[] = [];
  
  // Health check
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckFunction: (() => Promise<boolean>) | null = null;
  
  constructor(config: CircuitBreakerConfig = {}) {
    super();
    
    // Set default configuration
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000,
      monitoringPeriod: config.monitoringPeriod || 300000,
      halfOpenMaxRequests: config.halfOpenMaxRequests || 1
    };
    
    // Validate configuration
    this.validateConfig();
    
    // Initialize state history
    this.stateHistory.push({
      state: this.state,
      timestamp: new Date().toISOString(),
      reason: 'INITIAL_STATE'
    });
  }
  
  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if request should be allowed
    this.checkRequestAllowed();
    
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      
      this.recordSuccess(responseTime);
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordFailure(responseTime);
      throw error;
    }
  }
  
  /**
   * Execute operation with fallback when circuit is open
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(operation);
    } catch (error) {
      if (this.state === CircuitBreakerState.OPEN) {
        return await fallback();
      }
      throw error;
    }
  }
  
  /**
   * Check if request should be allowed based on current state
   */
  private checkRequestAllowed(): void {
    const now = Date.now();
    
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // Requests allowed in closed state
        break;
        
      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has elapsed
        if (now - this.lastFailureTime >= this.config.recoveryTimeout) {
          this.transitionToHalfOpen();
        } else {
          throw new Error('Circuit breaker is OPEN');
        }
        break;
        
      case CircuitBreakerState.HALF_OPEN:
        // Allow limited requests in half-open state
        if (this.halfOpenRequestCount >= this.config.halfOpenMaxRequests) {
          throw new Error('Circuit breaker HALF_OPEN request limit exceeded');
        }
        this.halfOpenRequestCount++;
        break;
    }
  }
  
  /**
   * Record successful operation
   */
  recordSuccess(responseTime: number = 0): void {
    const now = Date.now();
    
    // Add to statistics
    this.requestStats.push({
      timestamp: now,
      success: true,
      responseTime
    });
    
    // Clean old statistics
    this.cleanOldStats();
    
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    
    // Handle state transitions
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we've completed the half-open test successfully, close the circuit
      if (this.halfOpenRequestCount >= this.config.halfOpenMaxRequests) {
        this.transitionToClosed();
      }
    }
  }
  
  /**
   * Record failed operation
   */
  recordFailure(responseTime: number = 0): void {
    const now = Date.now();
    
    // Add to statistics
    this.requestStats.push({
      timestamp: now,
      success: false,
      responseTime
    });
    
    // Clean old statistics
    this.cleanOldStats();
    
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = now;
    
    // Handle state transitions
    if (this.state === CircuitBreakerState.CLOSED && 
        this.consecutiveFailures >= this.config.failureThreshold) {
      this.transitionToOpen();
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state should open the circuit
      this.transitionToOpen();
    }
  }
  
  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.lastStateChangeTime = Date.now();
    this.halfOpenRequestCount = 0;
    
    this.recordStateChange(previousState, 'FAILURE_THRESHOLD_EXCEEDED');
    
    console.warn(`[CircuitBreaker] Circuit breaker opened due to ${this.consecutiveFailures} consecutive failures`);
  }
  
  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.HALF_OPEN;
    this.lastStateChangeTime = Date.now();
    this.halfOpenRequestCount = 0;
    
    this.recordStateChange(previousState, 'RECOVERY_TIMEOUT_ELAPSED');
    
    console.info(`[CircuitBreaker] Circuit breaker transitioning to HALF_OPEN for testing`);
  }
  
  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.CLOSED;
    this.lastStateChangeTime = Date.now();
    this.halfOpenRequestCount = 0;
    this.consecutiveFailures = 0;
    
    this.recordStateChange(previousState, 'RECOVERY_SUCCESSFUL');
    
    console.info(`[CircuitBreaker] Circuit breaker closed - service recovered`);
  }
  
  /**
   * Record state change in history and emit event
   */
  private recordStateChange(previousState: CircuitBreakerState, reason: string): void {
    const now = new Date().toISOString();
    
    // Update previous state duration
    if (this.stateHistory.length > 0) {
      const lastEntry = this.stateHistory[this.stateHistory.length - 1];
      lastEntry.duration = Date.now() - new Date(lastEntry.timestamp).getTime();
    }
    
    // Add new state
    this.stateHistory.push({
      state: this.state,
      timestamp: now,
      reason
    });
    
    // Emit state change event
    const changeEvent: StateChangeEvent = {
      from: previousState,
      to: this.state,
      reason,
      timestamp: now
    };
    
    this.emit('stateChange', changeEvent);
  }
  
  /**
   * Clean old statistics outside monitoring period
   */
  private cleanOldStats(): void {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.requestStats = this.requestStats.filter(stat => stat.timestamp > cutoff);
  }
  
  /**
   * Validate configuration parameters
   */
  private validateConfig(): void {
    if (this.config.failureThreshold <= 0) {
      throw new Error('Failure threshold must be greater than 0');
    }
    
    if (this.config.recoveryTimeout <= 0) {
      throw new Error('Recovery timeout must be positive');
    }
    
    if (this.config.monitoringPeriod <= 0) {
      throw new Error('Monitoring period must be positive');
    }
    
    if (this.config.halfOpenMaxRequests <= 0) {
      throw new Error('Half-open max requests must be greater than 0');
    }
  }
  
  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================
  
  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }
  
  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.consecutiveFailures;
  }
  
  /**
   * Get current success count
   */
  getSuccessCount(): number {
    return this.consecutiveSuccesses;
  }
  
  /**
   * Get circuit breaker configuration
   */
  getConfig(): Required<CircuitBreakerConfig> {
    return { ...this.config };
  }
  
  /**
   * Update circuit breaker configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    // Validate before updating
    const testConfig = { ...this.config, ...newConfig };
    const tempBreaker = new CircuitBreaker(testConfig);
    
    // If validation passes, update configuration
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Force circuit breaker to specific state (for testing)
   */
  forceState(state: CircuitBreakerState): void {
    const previousState = this.state;
    this.state = state;
    this.lastStateChangeTime = Date.now();
    this.halfOpenRequestCount = 0;
    
    if (state === CircuitBreakerState.CLOSED) {
      this.consecutiveFailures = 0;
    }
    
    this.recordStateChange(previousState, 'FORCED_STATE_CHANGE');
  }
  
  /**
   * Get comprehensive statistics
   */
  getStatistics(options: { timeWindowMs?: number } = {}): CircuitBreakerStats {
    const timeWindow = options.timeWindowMs || this.config.monitoringPeriod;
    const cutoff = Date.now() - timeWindow;
    const relevantStats = this.requestStats.filter(stat => stat.timestamp > cutoff);
    
    const totalRequests = relevantStats.length;
    const successfulRequests = relevantStats.filter(stat => stat.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const totalResponseTime = relevantStats.reduce((sum, stat) => sum + stat.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      failureRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      timeInCurrentState: Date.now() - this.lastStateChangeTime
    };
  }
  
  /**
   * Reset all statistics
   */
  resetStatistics(): void {
    this.requestStats = [];
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }
  
  /**
   * Get state history
   */
  getStateHistory(): StateHistoryEntry[] {
    return [...this.stateHistory];
  }
  
  /**
   * Enable health checks
   */
  enableHealthChecks(
    healthCheckFn: () => Promise<boolean>,
    intervalMs: number = 30000
  ): void {
    this.healthCheckFunction = healthCheckFn;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.healthCheckFunction!();
        
        if (isHealthy) {
          // If service is healthy and circuit is open, consider transitioning to half-open
          if (this.state === CircuitBreakerState.OPEN) {
            const timeSinceFailure = Date.now() - this.lastFailureTime;
            if (timeSinceFailure >= this.config.recoveryTimeout) {
              this.transitionToHalfOpen();
            }
          }
        } else {
          // Health check failed - record as failure
          this.recordFailure();
        }
      } catch (error) {
        console.error('[CircuitBreaker] Health check error:', error);
        this.recordFailure();
      }
    }, intervalMs);
  }
  
  /**
   * Disable health checks
   */
  disableHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.healthCheckFunction = null;
  }
  
  /**
   * Perform manual health check
   */
  async performHealthCheck(): Promise<boolean> {
    if (!this.healthCheckFunction) {
      throw new Error('No health check function configured');
    }
    
    try {
      return await this.healthCheckFunction();
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Set health check function
   */
  setHealthCheck(healthCheckFn: () => Promise<boolean>): void {
    this.healthCheckFunction = healthCheckFn;
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    this.disableHealthChecks();
    this.requestStats = [];
    this.stateHistory = [];
  }
}