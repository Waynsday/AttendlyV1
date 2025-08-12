/**
 * @fileoverview Exponential Backoff Implementation
 * 
 * Provides exponential backoff retry logic for failed Aeries API requests
 * with configurable parameters, jitter support, and state management.
 * 
 * Features:
 * - Configurable base delay, max delay, and multiplier
 * - Optional jitter to prevent thundering herd
 * - State persistence and restoration
 * - Comprehensive statistics
 * - Performance monitoring
 */

export interface BackoffConfig {
  baseDelay?: number;      // Initial delay in milliseconds
  maxDelay?: number;       // Maximum delay in milliseconds
  maxAttempts?: number;    // Maximum number of retry attempts
  multiplier?: number;     // Exponential multiplier
  jitter?: boolean;        // Add random jitter to delays
}

export interface BackoffState {
  currentAttempt: number;
  nextDelay: number;
  canRetry: boolean;
  totalAttempts: number;
  startTime: number;
}

/**
 * Exponential backoff implementation with jitter and state management
 */
export class ExponentialBackoff {
  private config: Required<BackoffConfig>;
  private currentAttempt = 0;
  private totalAttempts = 0;
  private startTime = Date.now();

  constructor(config: BackoffConfig = {}) {
    // Set default configuration
    this.config = {
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      maxAttempts: config.maxAttempts || 3,
      multiplier: config.multiplier || 2,
      jitter: config.jitter !== undefined ? config.jitter : true
    };

    // Validate configuration
    this.validateConfig();
  }

  /**
   * Get the next delay for retry
   */
  getNextDelay(): number {
    if (this.currentAttempt >= this.config.maxAttempts) {
      return 0;
    }

    // Calculate exponential delay: baseDelay * (multiplier ^ currentAttempt)
    let delay = this.config.baseDelay * Math.pow(this.config.multiplier, this.currentAttempt);

    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelay);

    // Apply jitter if enabled
    if (this.config.jitter) {
      delay = this.applyJitter(delay);
    }

    // Increment attempt counter
    this.currentAttempt++;
    this.totalAttempts++;

    return Math.round(delay);
  }

  /**
   * Check if more retries are allowed
   */
  shouldRetry(): boolean {
    return this.currentAttempt < this.config.maxAttempts;
  }

  /**
   * Reset the backoff state
   */
  reset(): void {
    this.currentAttempt = 0;
    this.startTime = Date.now();
  }

  /**
   * Get current attempt number (0-indexed)
   */
  getCurrentAttempt(): number {
    return this.currentAttempt;
  }

  /**
   * Get total attempts made across all resets
   */
  getTotalAttempts(): number {
    return this.totalAttempts;
  }

  /**
   * Get current backoff state
   */
  getState(): BackoffState {
    return {
      currentAttempt: this.currentAttempt,
      nextDelay: this.shouldRetry() ? this.calculateNextDelay() : 0,
      canRetry: this.shouldRetry(),
      totalAttempts: this.totalAttempts,
      startTime: this.startTime
    };
  }

  /**
   * Set backoff state (for restoration)
   */
  setState(state: BackoffState): void {
    this.currentAttempt = state.currentAttempt;
    this.totalAttempts = state.totalAttempts;
    this.startTime = state.startTime;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<BackoffConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BackoffConfig>): void {
    const updatedConfig = { ...this.config, ...newConfig };
    
    // Validate new configuration
    const tempBackoff = new ExponentialBackoff(updatedConfig);
    
    // If validation passes, update configuration
    this.config = updatedConfig as Required<BackoffConfig>;
  }

  /**
   * Get time until next retry (if in delay period)
   */
  getTimeUntilNextRetry(): number {
    if (!this.shouldRetry()) {
      return 0;
    }

    const nextDelay = this.calculateNextDelay();
    return nextDelay;
  }

  /**
   * Calculate total backoff time for all attempts
   */
  getTotalBackoffTime(): number {
    let total = 0;
    
    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      let delay = this.config.baseDelay * Math.pow(this.config.multiplier, attempt);
      delay = Math.min(delay, this.config.maxDelay);
      total += delay;
    }
    
    return total;
  }

  /**
   * Calculate the next delay without incrementing counters
   */
  private calculateNextDelay(): number {
    if (this.currentAttempt >= this.config.maxAttempts) {
      return 0;
    }

    let delay = this.config.baseDelay * Math.pow(this.config.multiplier, this.currentAttempt);
    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.jitter) {
      delay = this.applyJitter(delay);
    }

    return Math.round(delay);
  }

  /**
   * Apply jitter to delay to prevent thundering herd
   */
  private applyJitter(delay: number): number {
    // Apply jitter: delay ± 25%
    const jitterRange = delay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(delay + jitter, 0);
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(): void {
    if (this.config.baseDelay <= 0) {
      throw new Error('Base delay must be positive');
    }

    if (this.config.maxDelay <= this.config.baseDelay) {
      throw new Error('Max delay must be greater than base delay');
    }

    if (this.config.maxAttempts <= 0) {
      throw new Error('Max attempts must be positive');
    }

    if (this.config.multiplier < 1) {
      throw new Error('Multiplier must be at least 1');
    }
  }

  /**
   * Get backoff statistics
   */
  getStatistics(): {
    config: Required<BackoffConfig>;
    currentAttempt: number;
    totalAttempts: number;
    remainingAttempts: number;
    estimatedTotalTime: number;
    elapsedTime: number;
    averageDelayPerAttempt: number;
  } {
    const elapsedTime = Date.now() - this.startTime;
    const estimatedTotalTime = this.getTotalBackoffTime();
    const remainingAttempts = Math.max(0, this.config.maxAttempts - this.currentAttempt);
    
    // Calculate average delay per attempt
    let totalDelayTime = 0;
    for (let i = 0; i < this.currentAttempt; i++) {
      let delay = this.config.baseDelay * Math.pow(this.config.multiplier, i);
      delay = Math.min(delay, this.config.maxDelay);
      totalDelayTime += delay;
    }
    
    const averageDelayPerAttempt = this.currentAttempt > 0 ? totalDelayTime / this.currentAttempt : 0;

    return {
      config: this.getConfig(),
      currentAttempt: this.currentAttempt,
      totalAttempts: this.totalAttempts,
      remainingAttempts,
      estimatedTotalTime,
      elapsedTime,
      averageDelayPerAttempt: Math.round(averageDelayPerAttempt)
    };
  }

  /**
   * Create a delay promise for async operations
   */
  async delay(): Promise<void> {
    const delayMs = this.getNextDelay();
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Execute a function with automatic retry and backoff
   */
  async executeWithBackoff<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error, delay: number) => void
  ): Promise<T> {
    this.reset();
    let lastError: Error;

    while (this.shouldRetry()) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (!this.shouldRetry()) {
          break;
        }

        const delay = this.getNextDelay();
        
        if (onRetry) {
          onRetry(this.currentAttempt, lastError, delay);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Get human-readable status
   */
  getStatus(): string {
    if (this.currentAttempt === 0) {
      return 'Ready for first attempt';
    } else if (this.shouldRetry()) {
      return `Attempt ${this.currentAttempt + 1} of ${this.config.maxAttempts}`;
    } else {
      return 'Max attempts reached';
    }
  }

  /**
   * Check if backoff is in initial state
   */
  isInitialState(): boolean {
    return this.currentAttempt === 0;
  }

  /**
   * Check if max attempts have been reached
   */
  isExhausted(): boolean {
    return this.currentAttempt >= this.config.maxAttempts;
  }

  /**
   * Get progress as percentage (0-100)
   */
  getProgress(): number {
    return Math.round((this.currentAttempt / this.config.maxAttempts) * 100);
  }
}