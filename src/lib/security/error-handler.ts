/**
 * @fileoverview Secure Error Handler for AP_Tool_V1
 * 
 * Provides comprehensive error handling with security controls:
 * - Sanitizes error messages to prevent information disclosure
 * - Implements audit logging for security events
 * - Handles different environments (production vs development)
 * - Protects against information leakage attacks
 * - Tracks error patterns for attack detection
 * 
 * SECURITY REQUIREMENTS:
 * - Never expose sensitive student data in error messages
 * - Log security events for audit and monitoring
 * - Apply different security policies based on environment
 * - Prevent stack trace information disclosure
 * - Implement rate limiting for error responses
 */

/**
 * Error severity levels for security event classification
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM', 
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Base security error context interface
 */
interface SecurityContext {
  userId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  correlationId?: string;
  [key: string]: any;
}

/**
 * Security event structure for audit logging
 */
interface SecurityEvent {
  type: string;
  severity?: ErrorSeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  correlationId?: string;
  details?: string;
  [key: string]: any;
}

/**
 * Error response structure for API consistency
 */
interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  type: string;
  requestId?: string;
  timestamp: Date;
  details?: any;
  stack?: string;
}

/**
 * Base Security Error class with enhanced context
 */
export class SecurityError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly isSecurityRelated: boolean = true;
  public readonly context: SecurityContext;

  constructor(message: string, context: SecurityContext & { severity?: ErrorSeverity } = {}) {
    super(message);
    this.name = 'SecurityError';
    this.severity = context.severity || ErrorSeverity.MEDIUM;
    this.context = context;
  }
}

/**
 * Validation Error for input validation failures
 */
export class ValidationError extends Error {
  public readonly field?: string;
  public readonly value?: any;
  public readonly rule?: string;
  public readonly isSecurityRelated: boolean = false;

  constructor(message: string, context: { field?: string; value?: any; rule?: string } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.field = context.field;
    this.value = context.value;
    this.rule = context.rule;
  }
}

/**
 * Authentication Error for login/auth failures
 */
export class AuthenticationError extends Error {
  public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM;
  public readonly isSecurityRelated: boolean = true;
  public readonly attemptCount?: number;
  public readonly lockoutTime?: Date;
  public readonly userId?: string;

  constructor(message: string, context: { userId?: string; attemptCount?: number; lockoutTime?: Date } = {}) {
    super(message);
    this.name = 'AuthenticationError';
    this.userId = context.userId;
    this.attemptCount = context.attemptCount;
    this.lockoutTime = context.lockoutTime;
  }
}

/**
 * Authorization Error for permission failures
 */
export class AuthorizationError extends Error {
  public readonly severity: ErrorSeverity = ErrorSeverity.HIGH;
  public readonly isSecurityRelated: boolean = true;
  public readonly userId?: string;
  public readonly resource?: string;
  public readonly requiredPermission?: string;
  public readonly userPermissions?: string[];

  constructor(message: string, context: { 
    userId?: string; 
    resource?: string; 
    requiredPermission?: string; 
    userPermissions?: string[];
  } = {}) {
    super(message);
    this.name = 'AuthorizationError';
    this.userId = context.userId;
    this.resource = context.resource;
    this.requiredPermission = context.requiredPermission;
    this.userPermissions = context.userPermissions;
  }
}

/**
 * Rate Limiting Error for request throttling
 */
export class RateLimitError extends Error {
  public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM;
  public readonly isSecurityRelated: boolean = true;
  public readonly userId?: string;
  public readonly limit: number;
  public readonly current: number;
  public readonly resetTime: Date;

  constructor(message: string, context: {
    userId?: string;
    limit: number;
    current: number;
    resetTime: Date;
  }) {
    super(message);
    this.name = 'RateLimitError';
    this.userId = context.userId;
    this.limit = context.limit;
    this.current = context.current;
    this.resetTime = context.resetTime;
  }
}

/**
 * Patterns for detecting and redacting sensitive information
 */
const SENSITIVE_PATTERNS = [
  // SSN patterns
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, replacement: '[EMAIL_REDACTED]' },
  // File paths
  { pattern: /[\/\\][\w\-_\.\/\\]+[\/\\][\w\-_\.]+/g, replacement: '[PATH_REDACTED]' },
  // SQL queries
  { pattern: /SELECT.*FROM.*WHERE/gi, replacement: '[SQL_REDACTED]' },
  { pattern: /INSERT.*INTO.*VALUES/gi, replacement: '[SQL_REDACTED]' },
  { pattern: /UPDATE.*SET.*WHERE/gi, replacement: '[SQL_REDACTED]' },
  { pattern: /DELETE.*FROM.*WHERE/gi, replacement: '[SQL_REDACTED]' },
  // Database connection strings
  { pattern: /[\w]+:\/\/[\w\-\.]+:\d+[\w\/@\-\.]+/g, replacement: '[CONNECTION_REDACTED]' },
  // API keys and tokens
  { pattern: /[Bb]earer\s+[\w\-\.]+/g, replacement: '[TOKEN_REDACTED]' },
  { pattern: /[Aa]pi[_-]?[Kk]ey[:\s=]+[\w\-]+/g, replacement: '[API_KEY_REDACTED]' },
  // Student IDs (assuming format like 12345 - adjust based on actual format)
  { pattern: /\bstudent[_\s]*id[:\s=]*[\w\-]+/gi, replacement: '[STUDENT_ID_REDACTED]' },
  // Credit card numbers
  { pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  // Database table names with sensitive data
  { pattern: /\b[\w_]*pii[\w_]*\b/gi, replacement: '[TABLE_REDACTED]' },
  { pattern: /\bstudents_\w+\b/gi, replacement: '[TABLE_REDACTED]' },
  // System error codes
  { pattern: /\bENOENT\b/g, replacement: '[SYSTEM_ERROR]' },
  { pattern: /\bEACCES\b/g, replacement: '[SYSTEM_ERROR]' },
  { pattern: /\bEMFILE\b/g, replacement: '[SYSTEM_ERROR]' },
  // Column names that might be sensitive
  { pattern: /\bssn\b/gi, replacement: '[SENSITIVE_FIELD]' },
  { pattern: /\bsocial_security\b/gi, replacement: '[SENSITIVE_FIELD]' }
];

/**
 * Sanitizes error messages to prevent information disclosure
 */
export function sanitizeErrorMessage(error: Error | string): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  const message = typeof error === 'string' ? error : error.message;
  
  // In development, allow validation errors through as they're safe for debugging
  if (isDevelopment && error instanceof ValidationError) {
    return message;
  }

  // In production, always use generic messages
  if (isProduction) {
    if (error instanceof ValidationError) {
      return 'Validation failed. Please check your input.';
    }
    if (error instanceof AuthenticationError) {
      return 'Authentication failed. Please check your credentials.';
    }
    if (error instanceof AuthorizationError) {
      return 'Access denied. You do not have permission to perform this action.';
    }
    if (error instanceof RateLimitError) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (error instanceof SecurityError) {
      return 'A security error occurred. The incident has been logged.';
    }
    
    // Generic message for all other errors in production
    return 'An error occurred while processing your request.';
  }

  // For development and other environments, apply redaction patterns
  let sanitized = message;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // Remove stack traces from error messages
  sanitized = sanitized.split('\n')[0];

  // Always return generic message unless it's a validation error in development
  if (!isDevelopment || !(error instanceof ValidationError)) {
    return 'An error occurred while processing your request.';  
  }

  return sanitized;
}

/**
 * Logs security events with proper audit trail
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const timestamp = event.timestamp || new Date();
  const logEntry = {
    ...event,
    timestamp: timestamp.toISOString(),
    environment: process.env.NODE_ENV || 'development'
  };

  // Redact sensitive information from log entry
  if (logEntry.details) {
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      logEntry.details = logEntry.details.replace(pattern, replacement);
    }
  }

  // Determine log level based on severity and event type
  const severity = event.severity || ErrorSeverity.MEDIUM; // Default to MEDIUM for security events
  const correlationId = event.correlationId || 'no-correlation-id';
  
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      console.error(`CRITICAL SECURITY EVENT [${correlationId}]:`, logEntry);
      break;
    case ErrorSeverity.HIGH:
      console.error(`HIGH SECURITY EVENT [${correlationId}]:`, logEntry);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn(`SECURITY EVENT [${correlationId}]:`, logEntry);
      break;
    case ErrorSeverity.LOW:
    default:
      console.warn(`SECURITY EVENT [${correlationId}]:`, logEntry);
      break;
  }
}

/**
 * Creates a secure error response for API endpoints
 */
export function createSecureErrorResponse(error: Error, context: SecurityContext = {}): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response: ErrorResponse = {
    success: false,
    message: isDevelopment && !(error as any).isSecurityRelated ? error.message : sanitizeErrorMessage(error),
    code: getErrorCode(error),
    type: error.name || 'Error',
    requestId: context.requestId,
    timestamp: new Date()
  };

  // Include additional details only in development
  if (isDevelopment) {
    response.details = {
      originalMessage: error.message,
      userId: context.userId
    };
    
    // Include stack trace only for non-security errors in development
    if (!(error as any).isSecurityRelated) {
      response.stack = error.stack;
    }
  }

  return response;
}

/**
 * Gets standardized error codes for different error types
 */
function getErrorCode(error: Error): string {
  if (error instanceof ValidationError) return 'VALIDATION_ERROR';
  if (error instanceof AuthenticationError) return 'AUTHENTICATION_ERROR';
  if (error instanceof AuthorizationError) return 'AUTHORIZATION_ERROR';
  if (error instanceof RateLimitError) return 'RATE_LIMIT_ERROR';
  if (error instanceof SecurityError) return 'SECURITY_ERROR';
  return 'INTERNAL_ERROR';
}

/**
 * Error statistics for monitoring and attack detection
 */
interface ErrorStats {
  totalErrors: number;
  securityErrors: number;
  topErrorSources: Record<string, number>;
  errorsByType: Record<string, number>;
  errorsByUser: Record<string, number>;
}

/**
 * Configuration for SecureErrorHandler
 */
interface ErrorHandlerConfig {
  logLevel: 'error' | 'warn' | 'info' | 'log';
  includeStackTrace: boolean;
  redactPatterns?: Array<{ pattern: RegExp; replacement: string }>;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeWindow?: number;
}

/**
 * Centralized secure error handler with advanced features
 */
export class SecureErrorHandler {
  private errorStats: ErrorStats = {
    totalErrors: 0,
    securityErrors: 0,
    topErrorSources: {},
    errorsByType: {},
    errorsByUser: {}
  };
  
  private circuitBreakerCount = 0;
  private circuitBreakerResetTime = 0;
  private config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      logLevel: 'warn',
      includeStackTrace: false,
      circuitBreakerThreshold: 10,
      circuitBreakerTimeWindow: 60000, // 1 minute
      ...config
    };
  }

  /**
   * Handles errors through the centralized handler
   */
  handle(error: Error, context: SecurityContext = {}): ErrorResponse {
    // Update error statistics
    this.updateErrorStats(error, context);
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      return {
        success: false,
        message: 'Service temporarily unavailable. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
        type: 'CircuitBreakerError',
        requestId: context.requestId,
        timestamp: new Date()
      };
    }

    // Log security events
    if ((error as any).isSecurityRelated) {
      logSecurityEvent({
        type: error.name.toUpperCase().replace('ERROR', '_ERROR'),
        severity: (error as any).severity || ErrorSeverity.MEDIUM,
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.correlationId || context.requestId,
        details: error.message,
        timestamp: new Date()
      });
    }

    // Always apply redaction patterns first (including built-in patterns)
    let message = error.message;
    
    // Apply built-in sensitive patterns
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      message = message.replace(pattern, replacement);
    }
    
    // Apply custom redaction patterns if configured
    if (this.config.redactPatterns) {
      for (const { pattern, replacement } of this.config.redactPatterns) {
        message = message.replace(pattern, replacement);
      }
    }

    // Create response with redacted message
    return {
      success: false,
      message: message,
      code: getErrorCode(error),
      type: error.name || 'Error',
      requestId: context.requestId,
      timestamp: new Date()
    };
  }

  /**
   * Updates error statistics for monitoring
   */
  private updateErrorStats(error: Error, context: SecurityContext): void {
    this.errorStats.totalErrors++;
    
    if ((error as any).isSecurityRelated) {
      this.errorStats.securityErrors++;
    }
    
    // Track by error type
    const errorType = error.name || 'Unknown';
    this.errorStats.errorsByType[errorType] = (this.errorStats.errorsByType[errorType] || 0) + 1;
    
    // Track by user
    if (context.userId) {
      this.errorStats.errorsByUser[context.userId] = (this.errorStats.errorsByUser[context.userId] || 0) + 1;
    }
    
    // Track by IP address for attack detection
    if (context.ipAddress) {
      this.errorStats.topErrorSources[context.ipAddress] = (this.errorStats.topErrorSources[context.ipAddress] || 0) + 1;
    }

    // Update circuit breaker
    this.circuitBreakerCount++;
    if (this.circuitBreakerCount === 1) {
      this.circuitBreakerResetTime = Date.now() + (this.config.circuitBreakerTimeWindow || 60000);
    }
  }

  /**
   * Checks if circuit breaker is open
   */
  isCircuitBreakerOpen(): boolean {
    if (Date.now() > this.circuitBreakerResetTime) {
      this.circuitBreakerCount = 0;
      return false;
    }
    
    return this.circuitBreakerCount >= (this.config.circuitBreakerThreshold || 10);
  }

  /**
   * Gets current error statistics
   */
  getErrorStats(): ErrorStats {
    return { ...this.errorStats };
  }

  /**
   * Resets error statistics (useful for testing)
   */
  resetStats(): void {
    this.errorStats = {
      totalErrors: 0,
      securityErrors: 0,
      topErrorSources: {},
      errorsByType: {},
      errorsByUser: {}
    };
    this.circuitBreakerCount = 0;
    this.circuitBreakerResetTime = 0;
  }
}