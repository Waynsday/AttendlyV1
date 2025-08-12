/**
 * @fileoverview Unit tests for authentication middleware
 * 
 * Tests comprehensive authentication and authorization features:
 * - JWT token validation and parsing
 * - Role-based access control with educational context
 * - FERPA compliance through educational interest validation
 * - Session management integration
 * - Security event logging and audit trails
 * 
 * These tests MUST fail initially to drive proper TDD implementation.
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Import the middleware we need to implement
import { 
  authMiddleware,
  AuthenticationContext,
  EducationalInterestLevel,
  UserRole
} from '@/lib/security/auth-middleware';

// Import security errors
import {
  AuthenticationError,
  AuthorizationError,
  SecurityError
} from '@/lib/security/error-handler';

describe('Authentication Middleware', () => {
  const mockJWTSecret = 'test-secret-key';
  const mockUserId = 'test-user-123';
  const mockEmployeeId = 'T001';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = mockJWTSecret;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.JWT_SECRET;
  });

  describe('Token Validation', () => {
    it('should reject requests without Authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Should fail because authMiddleware doesn't exist yet
      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow(AuthenticationError);
    });

    it('should reject malformed Authorization headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': 'InvalidFormat token-here'
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Invalid authorization header format');
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { 
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT'
        },
        mockJWTSecret,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Token has expired');
    });

    it('should reject tokens with invalid signatures', async () => {
      const invalidToken = jwt.sign(
        { 
          userId: mockUserId,
          role: 'TEACHER'
        },
        'wrong-secret-key'
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${invalidToken}`
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Invalid token signature');
    });

    it('should validate required JWT claims', async () => {
      const incompleteToken = jwt.sign(
        { 
          userId: mockUserId
          // Missing required claims: employeeId, role, educationalInterest
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${incompleteToken}`
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Token missing required claims');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow teachers to read student data', async () => {
      const teacherToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT',
          permissions: ['READ_STUDENTS', 'READ_ATTENDANCE']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${teacherToken}`
        }
      });

      // Should pass authorization check
      const result = await authMiddleware(request);
      expect(result.userId).toBe(mockUserId);
      expect(result.role).toBe('TEACHER');
    });

    it('should prevent teachers from deleting student records', async () => {
      const teacherToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT',
          permissions: ['READ_STUDENTS', 'READ_ATTENDANCE']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students/STU001', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${teacherToken}`
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow(AuthorizationError);
    });

    it('should allow administrators full access to all resources', async () => {
      const adminToken = jwt.sign(
        {
          userId: 'admin-user',
          employeeId: 'A001',
          role: 'ADMINISTRATOR',
          educationalInterest: 'ADMINISTRATIVE',
          permissions: ['*'] // Full permissions
        },
        mockJWTSecret
      );

      const deleteRequest = new NextRequest('http://localhost:3000/api/students/STU001', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      // Should pass all authorization checks
      const result = await authMiddleware(deleteRequest);
      expect(result.role).toBe('ADMINISTRATOR');
      expect(result.permissions).toContain('*');
    });

    it('should enforce resource-specific permissions', async () => {
      const limitedToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT',
          permissions: ['READ_ATTENDANCE'] // Only attendance, not students
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${limitedToken}`
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Insufficient permissions for resource');
    });
  });

  describe('Educational Interest Validation (FERPA Compliance)', () => {
    it('should require direct educational interest for student PII access', async () => {
      const indirectToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'INDIRECT', // Not direct
          permissions: ['READ_STUDENTS']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students/STU001/details', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${indirectToken}`
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Direct educational interest required for PII access');
    });

    it('should allow aggregated data access with indirect interest', async () => {
      const indirectToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'INDIRECT',
          permissions: ['READ_ATTENDANCE_AGGREGATED']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/dashboard/attendance-summary', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${indirectToken}`
        }
      });

      // Should pass for aggregated data
      const result = await authMiddleware(request);
      expect(result.educationalInterest).toBe('INDIRECT');
    });

    it('should validate educational interest level against resource sensitivity', async () => {
      const noInterestToken = jwt.sign(
        {
          userId: 'external-user',
          employeeId: 'EXT001',
          role: 'EXTERNAL',
          educationalInterest: 'NONE',
          permissions: ['READ_PUBLIC']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${noInterestToken}`
        }
      });

      expect(async () => {
        await authMiddleware(request);
      }).rejects.toThrow('Educational interest required for student data access');
    });

    it('should document educational interest in access logs', async () => {
      const mockLogger = vi.fn();
      
      const directToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT',
          permissions: ['READ_STUDENTS']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students/STU001', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${directToken}`
        }
      });

      // Configure middleware with logging
      authMiddleware.configure({ logger: mockLogger });
      
      await authMiddleware(request);

      expect(mockLogger).toHaveBeenCalledWith({
        type: 'STUDENT_DATA_ACCESS',
        userId: mockUserId,
        employeeId: mockEmployeeId,
        educationalInterest: 'DIRECT',
        resource: '/api/students/STU001',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Session Integration', () => {
    it('should validate session is active and not expired', async () => {
      const tokenWithSession = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT',
          sessionId: 'session-123',
          permissions: ['READ_STUDENTS']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenWithSession}`
        }
      });

      // Mock session manager to return expired session
      const mockSessionManager = {
        validateSession: vi.fn().mockRejectedValue(new Error('Session expired'))
      };

      expect(async () => {
        await authMiddleware(request, { sessionManager: mockSessionManager });
      }).rejects.toThrow('Session expired');
    });

    it('should update session activity timestamp on successful auth', async () => {
      const tokenWithSession = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT',
          sessionId: 'session-123',
          permissions: ['READ_STUDENTS']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenWithSession}`
        }
      });

      const mockSessionManager = {
        validateSession: vi.fn().mockResolvedValue({ valid: true }),
        updateActivity: vi.fn()
      };

      await authMiddleware(request, { sessionManager: mockSessionManager });

      expect(mockSessionManager.updateActivity).toHaveBeenCalledWith('session-123');
    });
  });

  describe('Security Event Logging', () => {
    it('should log successful authentication events', async () => {
      const mockLogger = vi.fn();
      
      const validToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'DIRECT',
          permissions: ['READ_STUDENTS']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'X-Forwarded-For': '192.168.1.100',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      authMiddleware.configure({ securityLogger: mockLogger });
      
      await authMiddleware(request);

      expect(mockLogger).toHaveBeenCalledWith({
        type: 'SUCCESSFUL_AUTHENTICATION',
        severity: 'LOW',
        userId: mockUserId,
        employeeId: mockEmployeeId,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        resource: '/api/students',
        method: 'GET',
        timestamp: expect.any(Date)
      });
    });

    it('should log authentication failures with details', async () => {
      const mockLogger = vi.fn();
      
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'X-Forwarded-For': '192.168.1.100'
        }
      });

      authMiddleware.configure({ securityLogger: mockLogger });
      
      try {
        await authMiddleware(request);
      } catch (error) {
        // Expected failure
      }

      expect(mockLogger).toHaveBeenCalledWith({
        type: 'AUTHENTICATION_FAILURE',
        severity: 'MEDIUM',
        reason: 'Invalid token signature',
        ipAddress: '192.168.1.100',
        resource: '/api/students',
        timestamp: expect.any(Date)
      });
    });

    it('should log authorization failures with context', async () => {
      const mockLogger = vi.fn();
      
      const unauthorizedToken = jwt.sign(
        {
          userId: mockUserId,
          employeeId: mockEmployeeId,
          role: 'TEACHER',
          educationalInterest: 'INDIRECT',
          permissions: ['READ_ATTENDANCE']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${unauthorizedToken}`
        }
      });

      authMiddleware.configure({ securityLogger: mockLogger });
      
      try {
        await authMiddleware(request);
      } catch (error) {
        // Expected authorization failure
      }

      expect(mockLogger).toHaveBeenCalledWith({
        type: 'AUTHORIZATION_FAILURE',
        severity: 'HIGH',
        userId: mockUserId,
        employeeId: mockEmployeeId,
        requiredPermissions: ['DELETE_STUDENTS'],
        userPermissions: ['READ_ATTENDANCE'],
        resource: '/api/students',
        method: 'DELETE',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Middleware Configuration', () => {
    it('should support configurable JWT secret sources', async () => {
      // Test with environment variable
      process.env.JWT_SECRET = 'env-secret';
      
      const token = jwt.sign({ userId: mockUserId }, 'env-secret');
      
      const request = new NextRequest('http://localhost:3000/api/health', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Should use environment variable secret
      expect(authMiddleware.getJWTSecret()).toBe('env-secret');
    });

    it('should support custom permission validation logic', async () => {
      const customValidator = vi.fn().mockReturnValue(true);
      
      authMiddleware.configure({
        permissionValidator: customValidator
      });

      const token = jwt.sign(
        {
          userId: mockUserId,
          role: 'CUSTOM_ROLE',
          permissions: ['CUSTOM_PERMISSION']
        },
        mockJWTSecret
      );

      const request = new NextRequest('http://localhost:3000/api/custom', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      await authMiddleware(request);

      expect(customValidator).toHaveBeenCalledWith({
        userPermissions: ['CUSTOM_PERMISSION'],
        requiredPermissions: expect.any(Array),
        resource: '/api/custom',
        method: 'GET'
      });
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error context for debugging', async () => {
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      try {
        await authMiddleware(request);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.context).toMatchObject({
          resource: '/api/students',
          method: 'GET',
          timestamp: expect.any(Date)
        });
      }
    });

    it('should sanitize sensitive information from error messages', async () => {
      const tokenWithSecret = jwt.sign(
        { 
          userId: mockUserId,
          databasePassword: 'secret-password'
        },
        'wrong-secret'
      );

      const request = new NextRequest('http://localhost:3000/api/students', {
        headers: {
          'Authorization': `Bearer ${tokenWithSecret}`
        }
      });

      try {
        await authMiddleware(request);
      } catch (error) {
        expect(error.message).not.toContain('secret-password');
        expect(error.message).not.toContain('wrong-secret');
      }
    });
  });
});

// Type definitions that need to be implemented
export interface AuthenticationContext {
  userId: string;
  employeeId: string;
  role: UserRole;
  educationalInterest: EducationalInterestLevel;
  permissions: string[];
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export enum UserRole {
  TEACHER = 'TEACHER',
  ASSISTANT_PRINCIPAL = 'ASSISTANT_PRINCIPAL', 
  ADMINISTRATOR = 'ADMINISTRATOR',
  EXTERNAL = 'EXTERNAL'
}

export enum EducationalInterestLevel {
  DIRECT = 'DIRECT',
  INDIRECT = 'INDIRECT',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  NONE = 'NONE'
}