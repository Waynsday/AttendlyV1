/**
 * @fileoverview Tests for secure error handling system
 * 
 * These tests verify that error handling provides:
 * - Sanitized error messages that don't leak sensitive information
 * - Proper audit logging for security events
 * - Different behavior in production vs development environments
 * - Protection against information disclosure attacks
 * 
 * SECURITY REQUIREMENT: Error messages must not leak sensitive student data
 * or system information that could be used by attackers.
 */

import {
  SecureErrorHandler,
  ErrorSeverity,
  SecurityError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  sanitizeErrorMessage,
  logSecurityEvent,
  createSecureErrorResponse
} from '@/lib/security/error-handler';

// Mock console methods for testing
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

describe('Secure Error Handler - Critical Security Controls', () => {
  beforeEach(() => {
    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
    
    // Reset environment
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });

  describe('Error Message Sanitization', () => {
    it('should sanitize error messages to prevent data leakage', () => {
      const sensitiveError = new Error('Database error: User john.doe@school.edu not found in table students_pii');
      const sanitized = sanitizeErrorMessage(sensitiveError);

      // Should not contain sensitive information
      expect(sanitized).not.toContain('john.doe@school.edu');
      expect(sanitized).not.toContain('students_pii');
      expect(sanitized).not.toContain('Database error');
      
      // Should contain generic message
      expect(sanitized).toContain('An error occurred');
    });

    it('should remove file paths and system information from errors', () => {
      const systemError = new Error('ENOENT: no such file or directory, open \'/Users/admin/secrets/student_data.csv\'');
      const sanitized = sanitizeErrorMessage(systemError);

      expect(sanitized).not.toContain('/Users/admin/secrets');
      expect(sanitized).not.toContain('student_data.csv');
      expect(sanitized).not.toContain('ENOENT');
    });

    it('should strip SQL error details that could reveal schema', () => {
      const sqlError = new Error('Column \'student_ssn\' doesn\'t exist in table \'confidential_data\'');
      const sanitized = sanitizeErrorMessage(sqlError);

      expect(sanitized).not.toContain('student_ssn');
      expect(sanitized).not.toContain('confidential_data');
      expect(sanitized).not.toContain('Column');
    });

    it('should handle stack traces securely', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at processStudentData (/app/src/sensitive/student-processor.js:42:15)
    at /app/src/controllers/student-controller.js:128:23`;
      
      const sanitized = sanitizeErrorMessage(error);
      
      expect(sanitized).not.toContain('/app/src/sensitive');
      expect(sanitized).not.toContain('student-processor.js');
      expect(sanitized).not.toContain('student-controller.js');
    });

    it('should preserve safe error types for debugging in development', () => {
      process.env.NODE_ENV = 'development';
      
      const validationError = new ValidationError('First name is required');
      const sanitized = sanitizeErrorMessage(validationError);

      // In development, validation errors should be preserved as they're safe
      expect(sanitized).toContain('First name is required');
    });

    it('should always sanitize in production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const validationError = new ValidationError('Student ID 12345 is invalid');
      const sanitized = sanitizeErrorMessage(validationError);

      // In production, even validation errors should be generic
      expect(sanitized).not.toContain('12345');
      expect(sanitized).toContain('Validation failed');
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events with proper audit trail', () => {
      const securityEvent = {
        type: 'AUTHENTICATION_FAILURE',
        userId: 'user123',
        ipAddress: '192.168.1.100',
        userAgent: 'Test User Agent',
        timestamp: new Date(),
        details: 'Invalid password attempt'
      };

      logSecurityEvent(securityEvent);

      // Should log to appropriate level
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY EVENT'),
        expect.objectContaining({
          type: 'AUTHENTICATION_FAILURE',
          userId: 'user123',
          ipAddress: '192.168.1.100'
        })
      );
    });

    it('should redact sensitive information from security logs', () => {
      const securityEvent = {
        type: 'DATA_ACCESS_VIOLATION',
        severity: ErrorSeverity.HIGH, // This will make it log to console.error
        userId: 'teacher123',
        details: 'Attempted to access student SSN: 123-45-6789',
        studentId: '12345',
        timestamp: new Date()
      };

      logSecurityEvent(securityEvent);

      const loggedCall = (console.error as jest.Mock).mock.calls[0];
      const loggedData = loggedCall[1];

      // Should not contain actual SSN
      expect(JSON.stringify(loggedData)).not.toContain('123-45-6789');
      expect(loggedData.details).toContain('[SSN_REDACTED]');
    });

    it('should include correlation IDs for tracing attacks', () => {
      const correlationId = 'attack-trace-12345';
      const securityEvent = {
        type: 'RATE_LIMIT_EXCEEDED',
        correlationId,
        ipAddress: '10.0.0.1',
        timestamp: new Date()
      };

      logSecurityEvent(securityEvent);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(correlationId),
        expect.any(Object)
      );
    });

    it('should escalate critical security events', () => {
      const criticalEvent = {
        type: 'POTENTIAL_DATA_BREACH',
        severity: ErrorSeverity.CRITICAL,
        userId: 'admin123',
        details: 'Bulk student data download detected',
        timestamp: new Date()
      };

      logSecurityEvent(criticalEvent);

      // Critical events should be logged as errors
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL SECURITY EVENT'),
        expect.any(Object)
      );
    });
  });

  describe('Environment-Specific Error Handling', () => {
    it('should provide detailed errors in development environment', () => {
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Detailed database connection failed');
      const response = createSecureErrorResponse(error, {
        userId: 'dev-user',
        requestId: 'req-123'
      });

      expect(response.message).toContain('Detailed database connection failed');
      expect(response.details).toBeDefined();
      expect(response.stack).toBeDefined();
    });

    it('should provide generic errors in production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Database connection failed with credentials admin:password123');
      const response = createSecureErrorResponse(error, {
        userId: 'prod-user',
        requestId: 'req-456'
      });

      expect(response.message).not.toContain('admin:password123');
      expect(response.message).toContain('An error occurred');
      expect(response.details).toBeUndefined();
      expect(response.stack).toBeUndefined();
    });

    it('should always include request correlation ID for debugging', () => {
      const requestId = 'req-correlation-789';
      const error = new Error('Test error');
      
      const response = createSecureErrorResponse(error, {
        requestId,
        userId: 'test-user'
      });

      expect(response.requestId).toBe(requestId);
    });
  });

  describe('Specific Error Types', () => {
    it('should handle SecurityError with proper severity', () => {
      const securityError = new SecurityError('Unauthorized access attempt', {
        userId: 'attacker123',
        ipAddress: '192.168.1.200',
        severity: ErrorSeverity.HIGH
      });

      expect(securityError.severity).toBe(ErrorSeverity.HIGH);
      expect(securityError.isSecurityRelated).toBe(true);
      expect(securityError.context.userId).toBe('attacker123');
    });

    it('should handle ValidationError with field information', () => {
      const validationError = new ValidationError('Invalid student data', {
        field: 'studentId',
        value: 'invalid-id',
        rule: 'format'
      });

      expect(validationError.field).toBe('studentId');
      expect(validationError.rule).toBe('format');
      expect(validationError.isSecurityRelated).toBe(false);
    });

    it('should handle AuthenticationError with login attempt tracking', () => {
      const authError = new AuthenticationError('Invalid credentials', {
        userId: 'john.doe',
        attemptCount: 3,
        lockoutTime: new Date(Date.now() + 300000) // 5 minutes
      });

      expect(authError.attemptCount).toBe(3);
      expect(authError.lockoutTime).toBeDefined();
      expect(authError.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should handle AuthorizationError with permission details', () => {
      const authzError = new AuthorizationError('Access denied', {
        userId: 'teacher123',
        resource: '/api/admin/students',
        requiredPermission: 'admin:read',
        userPermissions: ['teacher:read']
      });

      expect(authzError.resource).toBe('/api/admin/students');
      expect(authzError.requiredPermission).toBe('admin:read');
      expect(authzError.userPermissions).toContain('teacher:read');
    });

    it('should handle RateLimitError with threshold information', () => {
      const rateLimitError = new RateLimitError('Rate limit exceeded', {
        userId: 'api-user',
        limit: 100,
        current: 150,
        resetTime: new Date(Date.now() + 3600000) // 1 hour
      });

      expect(rateLimitError.limit).toBe(100);
      expect(rateLimitError.current).toBe(150);
      expect(rateLimitError.resetTime).toBeDefined();
    });
  });

  describe('SecureErrorHandler Class', () => {
    let errorHandler: SecureErrorHandler;

    beforeEach(() => {
      errorHandler = new SecureErrorHandler({
        logLevel: 'warn',
        includeStackTrace: false,
        redactPatterns: [/\b\d{3}-\d{2}-\d{4}\b/g, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g]
      });
    });

    it('should handle errors through the centralized handler', () => {
      const error = new Error('Student record not found for SSN 123-45-6789');
      const context = { userId: 'teacher123', requestId: 'req-abc' };

      const result = errorHandler.handle(error, context);

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('123-45-6789');
      expect(result.requestId).toBe('req-abc');
    });

    it('should apply custom redaction patterns', () => {
      const error = new Error('Failed to process john.doe@school.edu');
      const result = errorHandler.handle(error, { requestId: 'req-def' });

      expect(result.message).not.toContain('john.doe@school.edu');
      expect(result.message).toContain('[EMAIL_REDACTED]');
    });

    it('should track error frequency for attack detection', () => {
      const error = new SecurityError('Repeated unauthorized access');
      
      // Simulate multiple errors from same source
      for (let i = 0; i < 5; i++) {
        errorHandler.handle(error, { 
          userId: 'attacker', 
          ipAddress: '192.168.1.100',
          requestId: `req-${i}`
        });
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(5);
      expect(stats.securityErrors).toBe(5);
      expect(stats.topErrorSources['192.168.1.100']).toBe(5);
    });

    it('should implement circuit breaker for repeated failures', () => {
      const error = new Error('System failure');
      
      // Trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        errorHandler.handle(error, { requestId: `req-${i}` });
      }

      const isCircuitOpen = errorHandler.isCircuitBreakerOpen();
      expect(isCircuitOpen).toBe(true);
    });
  });

  describe('Error Response Security', () => {
    it('should never include sensitive data in API error responses', () => {
      const error = new Error('Database query failed: SELECT * FROM students WHERE ssn = "123-45-6789"');
      const response = createSecureErrorResponse(error, { requestId: 'req-ghi' });

      expect(response.message).not.toContain('123-45-6789');
      expect(response.message).not.toContain('SELECT * FROM students');
      expect(response.message).not.toContain('ssn');
    });

    it('should include error codes for client handling', () => {
      const validationError = new ValidationError('Field required');
      const response = createSecureErrorResponse(validationError, { requestId: 'req-jkl' });

      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.type).toBe('ValidationError');
    });

    it('should provide consistent error structure', () => {
      const error = new Error('Test error');
      const response = createSecureErrorResponse(error, { 
        requestId: 'req-mno',
        userId: 'user123'
      });

      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('requestId');
      expect(response).toHaveProperty('timestamp');
      expect(response.timestamp).toBeInstanceOf(Date);
    });
  });
});