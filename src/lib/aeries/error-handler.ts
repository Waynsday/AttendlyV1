/**
 * @fileoverview Comprehensive Error Handling Strategy
 * 
 * Implements sophisticated error handling with:
 * - Error classification and categorization
 * - Exponential backoff with jitter
 * - Dead letter queue for failed requests
 * - Retry mechanisms with smart logic
 * - Structured logging and monitoring
 */

import { EventEmitter } from 'events';

/**
 * Error classification types
 */
export interface ErrorClassification {
  type: string;
  isRetryable: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'TRANSIENT' | 'PERMANENT' | 'AUTHENTICATION' | 'AUTHORIZATION';
  userMessage: string;
  retryDelay?: number;
  validationErrors?: string[];
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitterEnabled?: boolean;
  deadLetterQueueConfig?: {
    maxSize?: number;
    retentionPeriodMs?: number;
  };
}

/**
 * Dead letter queue item
 */
export interface DeadLetterQueueItem {
  id: string;
  request: {
    method: string;
    endpoint: string;
    params?: any;
    body?: any;
  };
  error: string;
  retryCount: number;
  timestamp: string;
  classification: ErrorClassification;
  lastRetryAttempt?: string;
}

/**
 * Error statistics
 */
interface ErrorStats {
  timestamp: number;
  errorType: string;
  severity: string;
  isRetryable: boolean;
}

/**
 * Exponential backoff calculator
 */
export class ExponentialBackoff {
  constructor(private config: Required<RetryConfig>) {}
  
  calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.config.maxDelay);
    
    // Apply jitter if enabled
    if (this.config.jitterEnabled) {
      const jitter = Math.random() * 0.1 * delay; // 10% jitter
      delay = delay + (Math.random() > 0.5 ? jitter : -jitter);
    }
    
    return Math.max(delay, this.config.baseDelay);
  }
  
  reset(): void {
    // Reset any internal state if needed
  }
}

/**
 * Aeries Error Handler Implementation
 */
export class AeriesErrorHandler extends EventEmitter {
  private config: Required<RetryConfig>;
  private backoff: ExponentialBackoff;
  private deadLetterQueue: DeadLetterQueueItem[] = [];
  private errorStats: ErrorStats[] = [];
  
  constructor(config: RetryConfig = {}) {
    super();
    
    // Set default configuration
    this.config = {
      maxAttempts: config.maxAttempts || 3,
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 10000,
      backoffMultiplier: config.backoffMultiplier || 2,
      jitterEnabled: config.jitterEnabled !== false,
      deadLetterQueueConfig: {
        maxSize: config.deadLetterQueueConfig?.maxSize || 1000,
        retentionPeriodMs: config.deadLetterQueueConfig?.retentionPeriodMs || 24 * 60 * 60 * 1000 // 24 hours
      }
    };
    
    this.backoff = new ExponentialBackoff(this.config);
  }
  
  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: Function,
    options: {
      context?: any;
      shouldRetry?: (error: any, attempt: number, classification: ErrorClassification) => boolean;
      includeContext?: boolean;
    } = {}
  ): Promise<T> {
    let lastError: any;
    let lastClassification: ErrorClassification;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        // Include context if requested
        if (options.includeContext && attempt > 1) {
          return await operation({
            attempt,
            previousError: lastError,
            totalAttempts: this.config.maxAttempts
          });
        } else {
          return await operation();
        }
      } catch (error) {
        lastError = error;
        lastClassification = this.classifyError(error);
        
        // Log the error
        this.logError(error, lastClassification, {
          attempt,
          maxAttempts: this.config.maxAttempts,
          context: options.context
        });
        
        // Check if we should retry
        const shouldRetry = options.shouldRetry 
          ? options.shouldRetry(error, attempt, lastClassification)
          : lastClassification.isRetryable;
        
        if (!shouldRetry || attempt === this.config.maxAttempts) {
          // Add to dead letter queue if all retries exhausted
          if (attempt === this.config.maxAttempts) {
            this.addToDeadLetterQueue({
              id: this.generateId(),
              request: options.context || {},
              error: error.message || String(error),
              retryCount: attempt,
              timestamp: new Date().toISOString(),
              classification: lastClassification
            });
          }
          
          throw new Error(
            attempt === this.config.maxAttempts 
              ? 'Max retry attempts exceeded'
              : lastClassification.userMessage
          );
        }
        
        // Calculate delay and wait
        const delay = lastClassification.retryDelay || this.backoff.calculateDelay(attempt);
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Classify error for appropriate handling
   */
  classifyError(error: any): ErrorClassification {
    // Record error in statistics
    this.recordErrorStats(error);
    
    // Handle null/undefined errors
    if (!error) {
      return {
        type: 'UNKNOWN_ERROR',
        isRetryable: false,
        severity: 'MEDIUM',
        category: 'PERMANENT',
        userMessage: 'An unknown error occurred. Please try again.'
      };
    }
    
    // Network errors
    if (error.code && ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(error.code)) {
      return {
        type: 'NETWORK_ERROR',
        isRetryable: true,
        severity: 'HIGH',
        category: 'TRANSIENT',
        userMessage: 'Network connection failed. Please check your internet connection.',
        retryDelay: 2000
      };
    }
    
    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return {
        type: 'TIMEOUT_ERROR',
        isRetryable: true,
        severity: 'MEDIUM',
        category: 'TRANSIENT',
        userMessage: 'Request timed out. Please try again.',
        retryDelay: 1500
      };
    }
    
    // HTTP response errors
    if (error.response?.status) {
      const status = error.response.status;
      
      switch (true) {
        case status === 401:
          return {
            type: 'AUTHENTICATION_ERROR',
            isRetryable: false,
            severity: 'CRITICAL',
            category: 'AUTHENTICATION',
            userMessage: 'Authentication failed. Please check your credentials.'
          };
          
        case status === 403:
          return {
            type: 'AUTHORIZATION_ERROR',
            isRetryable: false,
            severity: 'CRITICAL',
            category: 'AUTHORIZATION',
            userMessage: 'Access denied. You do not have permission to access this resource.'
          };
          
        case status === 404:
          return {
            type: 'RESOURCE_NOT_FOUND',
            isRetryable: false,
            severity: 'LOW',
            category: 'PERMANENT',
            userMessage: 'The requested resource was not found.'
          };
          
        case status === 429:
          const retryAfter = error.response.headers?.['retry-after'];
          return {
            type: 'RATE_LIMIT_ERROR',
            isRetryable: true,
            severity: 'MEDIUM',
            category: 'TRANSIENT',
            userMessage: 'Rate limit exceeded. Please wait and try again.',
            retryDelay: retryAfter ? parseInt(retryAfter) * 1000 : 5000
          };
          
        case status >= 400 && status < 500:
          const validationErrors = this.extractValidationErrors(error.response.data);
          return {
            type: 'DATA_VALIDATION_ERROR',
            isRetryable: false,
            severity: 'MEDIUM',
            category: 'PERMANENT',
            userMessage: 'The provided data is invalid. Please check your input.',
            validationErrors
          };
          
        case status >= 500 && status < 600:
          if (status === 503) {
            return {
              type: 'SERVICE_UNAVAILABLE',
              isRetryable: true,
              severity: 'HIGH',
              category: 'TRANSIENT',
              userMessage: 'The service is temporarily unavailable. Please try again later.',
              retryDelay: 3000
            };
          }
          return {
            type: 'SERVER_ERROR',
            isRetryable: true,
            severity: 'HIGH',
            category: 'TRANSIENT',
            userMessage: 'A server error occurred. Please try again later.',
            retryDelay: 2500
          };
      }
    }
    
    // Generic error fallback
    return {
      type: 'UNKNOWN_ERROR',
      isRetryable: false,
      severity: 'MEDIUM',
      category: 'PERMANENT',
      userMessage: 'An unexpected error occurred. Please try again.'
    };
  }
  
  /**
   * Extract validation errors from error response
   */
  private extractValidationErrors(errorData: any): string[] {
    if (!errorData) return [];
    
    if (errorData.details && Array.isArray(errorData.details)) {
      return errorData.details;
    }
    
    if (errorData.errors && Array.isArray(errorData.errors)) {
      return errorData.errors.map((err: any) => err.message || String(err));
    }
    
    if (errorData.validationErrors && Array.isArray(errorData.validationErrors)) {
      return errorData.validationErrors;
    }
    
    return [];
  }
  
  /**
   * Record error statistics
   */
  private recordErrorStats(error: any): void {
    const classification = this.quickClassifyForStats(error);
    
    this.errorStats.push({
      timestamp: Date.now(),
      errorType: classification.type,
      severity: classification.severity,
      isRetryable: classification.isRetryable
    });
    
    // Clean old stats (older than 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.errorStats = this.errorStats.filter(stat => stat.timestamp > cutoff);
  }
  
  /**
   * Quick classification for statistics (without full processing)
   */
  private quickClassifyForStats(error: any): Partial<ErrorClassification> {
    if (error?.response?.status) {
      const status = error.response.status;
      if (status === 401) return { type: 'AUTHENTICATION_ERROR', severity: 'CRITICAL', isRetryable: false };
      if (status === 429) return { type: 'RATE_LIMIT_ERROR', severity: 'MEDIUM', isRetryable: true };
      if (status >= 500) return { type: 'SERVER_ERROR', severity: 'HIGH', isRetryable: true };
    }
    
    if (error?.code === 'ECONNREFUSED') return { type: 'NETWORK_ERROR', severity: 'HIGH', isRetryable: true };
    
    return { type: 'UNKNOWN_ERROR', severity: 'MEDIUM', isRetryable: false };
  }
  
  // =============================================================================
  // DEAD LETTER QUEUE MANAGEMENT
  // =============================================================================
  
  /**
   * Add item to dead letter queue
   */
  addToDeadLetterQueue(item: DeadLetterQueueItem): void {
    // Check if queue is at capacity
    if (this.deadLetterQueue.length >= this.config.deadLetterQueueConfig!.maxSize!) {
      // Remove oldest item
      this.deadLetterQueue.shift();
    }
    
    this.deadLetterQueue.push(item);
    this.emit('deadLetterQueueItem', item);
  }
  
  /**
   * Get dead letter queue items
   */
  getDeadLetterQueue(filters: {
    errorType?: string;
    severity?: string;
    maxAge?: number;
  } = {}): DeadLetterQueueItem[] {
    let items = [...this.deadLetterQueue];
    
    if (filters.errorType) {
      items = items.filter(item => item.classification.type === filters.errorType);
    }
    
    if (filters.severity) {
      items = items.filter(item => item.classification.severity === filters.severity);
    }
    
    if (filters.maxAge) {
      const cutoff = Date.now() - filters.maxAge;
      items = items.filter(item => new Date(item.timestamp).getTime() > cutoff);
    }
    
    return items;
  }
  
  /**
   * Retry dead letter queue items
   */
  async retryDeadLetterQueue(options: {
    operation?: Function;
    maxItemsToRetry?: number;
    filterBy?: (item: DeadLetterQueueItem) => boolean;
  } = {}): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
  }> {
    const maxItems = options.maxItemsToRetry || this.deadLetterQueue.length;
    const itemsToRetry = this.deadLetterQueue
      .filter(item => !options.filterBy || options.filterBy(item))
      .slice(0, maxItems);
    
    let succeeded = 0;
    let failed = 0;
    
    for (const item of itemsToRetry) {
      try {
        if (options.operation) {
          await options.operation(item);
        }
        
        // Remove from queue on success
        const index = this.deadLetterQueue.findIndex(queueItem => queueItem.id === item.id);
        if (index !== -1) {
          this.deadLetterQueue.splice(index, 1);
        }
        
        succeeded++;
      } catch (error) {
        // Update retry count and timestamp
        item.retryCount++;
        item.lastRetryAttempt = new Date().toISOString();
        failed++;
      }
    }
    
    return {
      attempted: itemsToRetry.length,
      succeeded,
      failed
    };
  }
  
  /**
   * Clean up dead letter queue
   */
  cleanupDeadLetterQueue(options: {
    maxAge?: number;
    maxItems?: number;
  } = {}): { removedItems: number } {
    const initialLength = this.deadLetterQueue.length;
    
    // Remove items older than maxAge
    if (options.maxAge) {
      const cutoff = Date.now() - options.maxAge;
      this.deadLetterQueue = this.deadLetterQueue.filter(
        item => new Date(item.timestamp).getTime() > cutoff
      );
    }
    
    // Limit total items
    if (options.maxItems && this.deadLetterQueue.length > options.maxItems) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-options.maxItems);
    }
    
    return {
      removedItems: initialLength - this.deadLetterQueue.length
    };
  }
  
  // =============================================================================
  // LOGGING AND MONITORING
  // =============================================================================
  
  /**
   * Log error with structured data
   */
  logError(
    error: any,
    classification: ErrorClassification,
    context: any = {}
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      component: 'AeriesErrorHandler',
      error: {
        message: this.sanitizeErrorMessage(error?.message || String(error)),
        type: classification.type,
        severity: classification.severity,
        isRetryable: classification.isRetryable,
        stack: error?.stack ? this.sanitizeStackTrace(error.stack) : undefined
      },
      context: this.sanitizeContext(context),
      correlationId: context.correlationId || this.generateId()
    };
    
    console.error('[AeriesErrorHandler]', logEntry);
  }
  
  /**
   * Sanitize error message to remove PII
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove common PII patterns
    return message
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****') // SSN
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '****@****.***') // Email
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '***-***-****') // Phone
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '**** ****'); // Names
  }
  
  /**
   * Sanitize stack trace
   */
  private sanitizeStackTrace(stack: string): string {
    // Remove file paths that might contain sensitive info
    return stack.replace(/\/[^\s]+/g, '/***');
  }
  
  /**
   * Sanitize context data
   */
  private sanitizeContext(context: any): any {
    if (!context || typeof context !== 'object') return context;
    
    const sanitized = { ...context };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'ssn', 'email', 'phone'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '****';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Get error statistics
   */
  getErrorStatistics(options: { timeWindowMs?: number } = {}): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    retryableErrors: number;
    nonRetryableErrors: number;
  } {
    const timeWindow = options.timeWindowMs || 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - timeWindow;
    const relevantStats = this.errorStats.filter(stat => stat.timestamp > cutoff);
    
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    let retryableErrors = 0;
    let nonRetryableErrors = 0;
    
    for (const stat of relevantStats) {
      errorsByType[stat.errorType] = (errorsByType[stat.errorType] || 0) + 1;
      errorsBySeverity[stat.severity] = (errorsBySeverity[stat.severity] || 0) + 1;
      
      if (stat.isRetryable) {
        retryableErrors++;
      } else {
        nonRetryableErrors++;
      }
    }
    
    return {
      totalErrors: relevantStats.length,
      errorsByType,
      errorsBySeverity,
      retryableErrors,
      nonRetryableErrors
    };
  }
  
  /**
   * Reset error statistics
   */
  resetErrorStatistics(): void {
    this.errorStats = [];
  }
  
  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}