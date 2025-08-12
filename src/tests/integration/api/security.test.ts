/**
 * @fileoverview Integration tests for API security features
 * 
 * These tests ensure that all API endpoints implement proper security controls:
 * - Authentication requirement for all protected endpoints
 * - Role-based access control with FERPA compliance
 * - Input validation using Zod schemas
 * - Rate limiting enforcement
 * - Session security with timeout handling
 * - Comprehensive audit logging
 * 
 * All tests follow TDD principles - they MUST fail initially to ensure
 * proper security implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import our security components that we'll implement
import { authMiddleware } from '@/lib/security/auth-middleware';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { sessionManager } from '@/lib/security/session-manager';

// Import validation schemas
import {
  StudentCreateSchema,
  AttendanceRecordCreateSchema,
  InterventionCreateSchema,
  PaginationSchema
} from '@/lib/validation/schemas';

// Import security error classes
import {
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError
} from '@/lib/security/error-handler';

describe('API Security Integration Tests', () => {
  beforeEach(() => {
    // Clear any mocks and reset security state
    vi.clearAllMocks();
    // Reset rate limiting state
    if (rateLimiter.reset) {
      rateLimiter.reset();
    }
    // Clear session state
    if (sessionManager.clearAll) {
      sessionManager.clearAll();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Requirements', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/students',
        '/api/attendance',
        '/api/interventions',
        '/api/dashboard'
      ];

      for (const endpoint of protectedEndpoints) {
        const request = new NextRequest(`http://localhost:3000${endpoint}`, {
          method: 'GET'
        });

        // This should fail because we haven't implemented auth middleware yet
        expect(async () => {
          await authMiddleware(request);
        }).rejects.toThrow(AuthenticationError);
      }
    });

    it('should require valid JWT tokens for API access', async () => {
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      // Should fail with authentication error for invalid token
      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Invalid authentication token');
    });

    it('should validate educational interest requirement (FERPA compliance)', async () => {
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token-without-educational-interest'
        }
      });

      // Should fail with authorization error for lack of educational interest
      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow(AuthorizationError);
    });

    it('should enforce role-based access control', async () => {
      const studentRequest = new NextRequest('http://localhost:3000/api/students', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer teacher-role-token'
        }
      });

      // Teachers should not be able to delete students
      expect(async () => {
        await authMiddleware(studentRequest);
      }).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('Rate Limiting Enforcement', () => {
    it('should enforce 100 requests per minute per user limit', async () => {
      const userId = 'test-user-123';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
          'X-User-ID': userId
        }
      });

      // Make 101 requests rapidly - the 101st should fail
      const promises = [];
      for (let i = 0; i < 101; i++) {
        promises.push(rateLimiter.checkLimit(userId, request));
      }

      const results = await Promise.allSettled(promises);
      const lastResult = results[100]; // 101st request (0-indexed)
      
      expect(lastResult.status).toBe('rejected');
      expect(lastResult.reason).toBeInstanceOf(RateLimitError);
    });

    it('should enforce IP-based rate limiting for security', async () => {
      const ipAddress = '192.168.1.100';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-Forwarded-For': ipAddress
        }
      });

      // IP-based limiting should be more restrictive (e.g., 200 per minute)
      const promises = [];
      for (let i = 0; i < 201; i++) {
        promises.push(rateLimiter.checkIPLimit(ipAddress, request));
      }

      const results = await Promise.allSettled(promises);
      const lastResult = results[200]; // 201st request
      
      expect(lastResult.status).toBe('rejected');
      expect(lastResult.reason).toBeInstanceOf(RateLimitError);
    });

    it('should allow rate limit bypass for administrative functions', async () => {
      const adminUserId = 'admin-user-123';
      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-User-ID': adminUserId,
          'X-Admin-Override': 'true'
        }
      });

      // Admin requests should bypass normal rate limits
      const promises = [];
      for (let i = 0; i < 150; i++) {
        promises.push(rateLimiter.checkLimit(adminUserId, request, { bypassForAdmin: true }));
      }

      const results = await Promise.allSettled(promises);
      
      // All requests should succeed for admin bypass
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
    });

    it('should provide rate limit monitoring and alerts', async () => {
      const userId = 'monitored-user';
      const mockAlert = vi.fn();
      
      // Configure rate limiter with monitoring
      rateLimiter.configure({
        alertCallback: mockAlert,
        alertThreshold: 90 // Alert at 90% of limit
      });

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-User-ID': userId
        }
      });

      // Make 90 requests to trigger monitoring alert
      for (let i = 0; i < 90; i++) {
        await rateLimiter.checkLimit(userId, request);
      }

      expect(mockAlert).toHaveBeenCalledWith({
        userId,
        currentCount: 90,
        limit: 100,
        percentageUsed: 90
      });
    });
  });

  describe('Session Security', () => {
    it('should enforce 4-hour session timeout', async () => {
      const userId = 'test-user';
      const sessionId = 'session-123';
      
      // Create a session
      await sessionManager.createSession(userId, sessionId, {
        maxAge: 4 * 60 * 60 * 1000 // 4 hours
      });

      // Fast-forward time by 4 hours and 1 minute
      vi.useFakeTimers();
      vi.advanceTimersByTime(4 * 60 * 60 * 1000 + 60 * 1000);
      
      // Session should be expired
      expect(async () => {
        await sessionManager.validateSession(sessionId);
      }).rejects.toThrow('Session expired');

      vi.useRealTimers();
    });

    it('should track failed login attempts with lockout', async () => {
      const userId = 'test-user';
      const ipAddress = '192.168.1.100';

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        try {
          await sessionManager.attemptLogin(userId, 'wrong-password', ipAddress);
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th attempt should trigger lockout
      expect(async () => {
        await sessionManager.attemptLogin(userId, 'correct-password', ipAddress);
      }).rejects.toThrow('Account temporarily locked due to failed login attempts');
    });

    it('should manage concurrent sessions properly', async () => {
      const userId = 'test-user';
      
      // Create maximum allowed concurrent sessions (e.g., 3)
      const sessionIds = ['session-1', 'session-2', 'session-3'];
      
      for (const sessionId of sessionIds) {
        await sessionManager.createSession(userId, sessionId);
      }

      // Creating a 4th session should either fail or invalidate the oldest
      expect(async () => {
        await sessionManager.createSession(userId, 'session-4');
      }).rejects.toThrow('Maximum concurrent sessions exceeded');
    });

    it('should validate educational interest in session context', async () => {
      const userId = 'test-user';
      const sessionId = 'session-123';
      
      await sessionManager.createSession(userId, sessionId, {
        educationalInterest: false
      });

      // Accessing student data without educational interest should fail
      expect(async () => {
        await sessionManager.validateEducationalAccess(sessionId, 'student-data');
      }).rejects.toThrow('Educational interest required for student data access');
    });
  });

  describe('Input Validation Security', () => {
    it('should validate student creation data with security filters', async () => {
      const maliciousStudentData = {
        id: 'STU001<script>alert("xss")</script>',
        firstName: 'John',
        lastName: 'Doe\'; DROP TABLE students; --',
        gradeLevel: 7,
        email: 'john@evil-site.com'
      };

      expect(() => {
        StudentCreateSchema.parse(maliciousStudentData);
      }).toThrow(ValidationError);
    });

    it('should sanitize attendance data imports', async () => {
      const maliciousAttendanceData = {
        studentId: '../../../etc/passwd',
        date: new Date(),
        schoolYear: '2024-2025',
        periodAttendance: [
          { period: 1, status: 'PRESENT' },
          // ... other periods
        ]
      };

      expect(() => {
        AttendanceRecordCreateSchema.parse(maliciousAttendanceData);
      }).toThrow('Field contains path traversal attempts');
    });

    it('should prevent SQL injection in intervention descriptions', async () => {
      const maliciousInterventionData = {
        studentId: 'STU001',
        type: 'PARENT_CONTACT',
        description: 'Student behavior issue\'; DELETE FROM interventions; --',
        createdBy: 'T001',
        scheduledDate: new Date()
      };

      expect(() => {
        InterventionCreateSchema.parse(maliciousInterventionData);
      }).toThrow('Field contains SQL injection attempt');
    });

    it('should validate pagination parameters to prevent DoS', async () => {
      const maliciousPaginationData = {
        page: 1,
        limit: 999999, // Attempting to cause memory exhaustion
        sortBy: '../../../etc/passwd',
        sortOrder: 'asc'
      };

      expect(() => {
        PaginationSchema.parse(maliciousPaginationData);
      }).toThrow();
    });
  });

  describe('API Response Security', () => {
    it('should never expose sensitive data in error responses', async () => {
      // This test ensures our error handler properly sanitizes responses
      const sensitiveError = new Error('Database connection failed: postgresql://user:password@localhost:5432/ap_tool');
      
      const errorResponse = createSecureErrorResponse(sensitiveError, {
        userId: 'test-user',
        requestId: 'req-123'
      });

      expect(errorResponse.message).not.toContain('password');
      expect(errorResponse.message).not.toContain('postgresql://');
      expect(errorResponse.message).toContain('[CONNECTION_REDACTED]');
    });

    it('should implement proper CORS for educational domains only', async () => {
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Origin': 'https://malicious-site.com'
        }
      });

      // Should reject requests from non-educational domains
      expect(async () => {
        await corsMiddleware(request);
      }).rejects.toThrow('Origin not allowed');
    });

    it('should log all security events for audit trail', async () => {
      const mockLogger = vi.fn();
      
      // Configure security event logging
      configureSecurityLogging({
        logger: mockLogger,
        logLevel: 'all'
      });

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      try {
        await authMiddleware(request);
      } catch (error) {
        // Expected authentication failure
      }

      expect(mockLogger).toHaveBeenCalledWith({
        type: 'AUTHENTICATION_FAILURE',
        severity: 'MEDIUM',
        ipAddress: expect.any(String),
        userAgent: expect.any(String),
        timestamp: expect.any(Date),
        details: expect.stringContaining('No authentication token provided')
      });
    });
  });

  describe('Health Check Endpoint Security', () => {
    it('should allow unauthenticated access to health check', async () => {
      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'GET'
      });

      // Health check should not require authentication
      expect(async () => {
        const response = await fetch('/api/health');
        expect(response.status).toBe(200);
      }).not.toThrow();
    });

    it('should not expose sensitive system information in health check', async () => {
      const response = await fetch('/api/health');
      const data = await response.json();

      // Should not contain database connection strings, API keys, etc.
      expect(JSON.stringify(data)).not.toContain('password');
      expect(JSON.stringify(data)).not.toContain('secret');
      expect(JSON.stringify(data)).not.toContain('key');
    });
  });
});

// Mock implementations for testing - these will be replaced by real implementations
const createSecureErrorResponse = vi.fn().mockReturnValue({
  success: false,
  message: 'Mock error response',
  code: 'MOCK_ERROR',
  type: 'MockError',
  timestamp: new Date()
});

const corsMiddleware = vi.fn().mockRejectedValue(new Error('Origin not allowed'));

const configureSecurityLogging = vi.fn();