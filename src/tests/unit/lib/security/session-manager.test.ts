/**
 * @fileoverview Unit tests for enhanced session security manager
 * 
 * Tests comprehensive session management features:
 * - Session timeout enforcement (4 hours maximum)
 * - Failed login attempt tracking with progressive lockout
 * - Concurrent session management and limits
 * - Educational interest validation within sessions
 * - Session activity monitoring and logging
 * - Secure session storage and cleanup
 * 
 * These tests MUST fail initially to drive proper TDD implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import the session manager we need to implement
import { 
  sessionManager,
  SessionConfig,
  SessionData,
  LoginAttempt,
  SessionSecurity
} from '@/lib/security/session-manager';

// Import security errors
import {
  AuthenticationError,
  AuthorizationError,
  SecurityError
} from '@/lib/security/error-handler';

describe('Session Manager', () => {
  const mockUserId = 'test-user-123';
  const mockEmployeeId = 'T001';
  const mockSessionId = 'session-abc-123';
  const mockIPAddress = '192.168.1.100';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset session manager state
    sessionManager.clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Session Creation and Validation', () => {
    it('should create sessions with proper security context', async () => {
      // Should fail because sessionManager doesn't exist yet
      expect(async () => {
        await sessionManager.createSession(mockUserId, mockSessionId, {
          employeeId: mockEmployeeId,
          educationalInterest: 'DIRECT',
          ipAddress: mockIPAddress,
          maxAge: 4 * 60 * 60 * 1000 // 4 hours
        });
      }).rejects.toThrow('sessionManager is not defined');

      const sessionData = await sessionManager.createSession(mockUserId, mockSessionId, {
        employeeId: mockEmployeeId,
        educationalInterest: 'DIRECT',
        ipAddress: mockIPAddress,
        maxAge: 4 * 60 * 60 * 1000
      });

      expect(sessionData).toMatchObject({
        userId: mockUserId,
        sessionId: mockSessionId,
        employeeId: mockEmployeeId,
        educationalInterest: 'DIRECT',
        ipAddress: mockIPAddress,
        createdAt: expect.any(Date),
        lastActivity: expect.any(Date),
        expiresAt: expect.any(Date)
      });
    });

    it('should validate session exists and is not expired', async () => {
      await sessionManager.createSession(mockUserId, mockSessionId, {
        maxAge: 4 * 60 * 60 * 1000
      });

      // Session should be valid
      const sessionData = await sessionManager.validateSession(mockSessionId);
      expect(sessionData.valid).toBe(true);
      expect(sessionData.userId).toBe(mockUserId);
    });

    it('should reject expired sessions', async () => {
      await sessionManager.createSession(mockUserId, mockSessionId, {
        maxAge: 1000 // 1 second
      });

      // Fast-forward time past expiration
      vi.advanceTimersByTime(2000);

      expect(async () => {
        await sessionManager.validateSession(mockSessionId);
      }).rejects.toThrow('Session expired');
    });

    it('should enforce 4-hour maximum session timeout', async () => {
      // Attempt to create session with longer timeout
      expect(async () => {
        await sessionManager.createSession(mockUserId, mockSessionId, {
          maxAge: 6 * 60 * 60 * 1000 // 6 hours - should be rejected
        });
      }).rejects.toThrow('Session timeout cannot exceed 4 hours');
    });

    it('should update session activity on validation', async () => {
      await sessionManager.createSession(mockUserId, mockSessionId, {
        maxAge: 4 * 60 * 60 * 1000
      });

      const initialSession = await sessionManager.getSession(mockSessionId);
      const initialActivity = initialSession.lastActivity;

      // Advance time and validate session
      vi.advanceTimersByTime(30 * 1000); // 30 seconds
      await sessionManager.validateSession(mockSessionId);

      const updatedSession = await sessionManager.getSession(mockSessionId);
      expect(updatedSession.lastActivity).not.toEqual(initialActivity);
    });
  });

  describe('Failed Login Tracking and Lockout', () => {
    it('should track failed login attempts per user', async () => {
      const password = 'wrong-password';

      // Make 3 failed login attempts
      for (let i = 0; i < 3; i++) {
        try {
          await sessionManager.attemptLogin(mockUserId, password, mockIPAddress);
        } catch (error) {
          expect(error).toBeInstanceOf(AuthenticationError);
        }
      }

      const attempts = await sessionManager.getFailedAttempts(mockUserId);
      expect(attempts.count).toBe(3);
      expect(attempts.attempts).toHaveLength(3);
    });

    it('should implement progressive lockout for failed attempts', async () => {
      const password = 'wrong-password';

      // First 3 attempts - no lockout
      for (let i = 0; i < 3; i++) {
        try {
          await sessionManager.attemptLogin(mockUserId, password, mockIPAddress);
        } catch (error) {
          expect(error.message).not.toContain('locked');
        }
      }

      // 4th attempt - should trigger 5 minute lockout
      try {
        await sessionManager.attemptLogin(mockUserId, password, mockIPAddress);
      } catch (error) {
        expect(error.message).toContain('Account temporarily locked');
        expect(error.lockoutTime).toBeDefined();
      }

      // Even correct password should fail during lockout
      expect(async () => {
        await sessionManager.attemptLogin(mockUserId, 'correct-password', mockIPAddress);
      }).rejects.toThrow('Account temporarily locked');
    });

    it('should implement escalating lockout periods', async () => {
      const password = 'wrong-password';

      // First lockout (5 failed attempts) - 5 minutes
      for (let i = 0; i < 5; i++) {
        try {
          await sessionManager.attemptLogin(mockUserId, password, mockIPAddress);
        } catch (error) {
          // Expected failures
        }
      }

      let lockoutInfo = await sessionManager.getLockoutInfo(mockUserId);
      expect(lockoutInfo.duration).toBe(5 * 60 * 1000); // 5 minutes

      // Wait for lockout to expire
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Trigger second lockout (another 5 attempts) - should be 15 minutes
      for (let i = 0; i < 5; i++) {
        try {
          await sessionManager.attemptLogin(mockUserId, password, mockIPAddress);
        } catch (error) {
          // Expected failures
        }
      }

      lockoutInfo = await sessionManager.getLockoutInfo(mockUserId);
      expect(lockoutInfo.duration).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should track failed attempts by IP address', async () => {
      const password = 'wrong-password';
      const attackerIP = '10.0.0.1';

      // Make failed attempts from same IP for different users
      const userIds = ['user1', 'user2', 'user3'];
      
      for (const userId of userIds) {
        for (let i = 0; i < 3; i++) {
          try {
            await sessionManager.attemptLogin(userId, password, attackerIP);
          } catch (error) {
            // Expected failures
          }
        }
      }

      const ipAttempts = await sessionManager.getIPFailedAttempts(attackerIP);
      expect(ipAttempts.count).toBe(9); // 3 users × 3 attempts
      expect(ipAttempts.uniqueUsers).toBe(3);
    });

    it('should implement IP-based lockout for distributed attacks', async () => {
      const attackerIP = '10.0.0.1';
      const password = 'wrong-password';

      // Make 15 failed attempts from same IP (across different users)
      for (let i = 0; i < 15; i++) {
        const userId = `user-${i}`;
        try {
          await sessionManager.attemptLogin(userId, password, attackerIP);
        } catch (error) {
          // Expected failures
        }
      }

      // Next attempt from this IP should be blocked regardless of user
      expect(async () => {
        await sessionManager.attemptLogin('new-user', 'any-password', attackerIP);
      }).rejects.toThrow('IP address temporarily blocked due to suspicious activity');
    });

    it('should reset failed attempts after successful login', async () => {
      const password = 'wrong-password';

      // Make some failed attempts
      for (let i = 0; i < 3; i++) {
        try {
          await sessionManager.attemptLogin(mockUserId, password, mockIPAddress);
        } catch (error) {
          // Expected failures
        }
      }

      expect((await sessionManager.getFailedAttempts(mockUserId)).count).toBe(3);

      // Successful login should reset counter
      await sessionManager.attemptLogin(mockUserId, 'correct-password', mockIPAddress);
      
      expect((await sessionManager.getFailedAttempts(mockUserId)).count).toBe(0);
    });
  });

  describe('Concurrent Session Management', () => {
    it('should enforce maximum concurrent sessions per user', async () => {
      const maxSessions = 3;
      
      sessionManager.configure({
        maxConcurrentSessions: maxSessions
      });

      // Create maximum allowed sessions
      const sessionIds = ['session-1', 'session-2', 'session-3'];
      
      for (const sessionId of sessionIds) {
        await sessionManager.createSession(mockUserId, sessionId, {
          maxAge: 4 * 60 * 60 * 1000
        });
      }

      // Creating 4th session should fail
      expect(async () => {
        await sessionManager.createSession(mockUserId, 'session-4', {
          maxAge: 4 * 60 * 60 * 1000
        });
      }).rejects.toThrow('Maximum concurrent sessions exceeded');
    });

    it('should invalidate oldest session when limit exceeded with rotation', async () => {
      sessionManager.configure({
        maxConcurrentSessions: 3,
        sessionRotationEnabled: true
      });

      // Create 3 sessions
      await sessionManager.createSession(mockUserId, 'session-1', { maxAge: 4 * 60 * 60 * 1000 });
      vi.advanceTimersByTime(1000);
      await sessionManager.createSession(mockUserId, 'session-2', { maxAge: 4 * 60 * 60 * 1000 });
      vi.advanceTimersByTime(1000);
      await sessionManager.createSession(mockUserId, 'session-3', { maxAge: 4 * 60 * 60 * 1000 });

      // Creating 4th session should invalidate the oldest (session-1)
      await sessionManager.createSession(mockUserId, 'session-4', { maxAge: 4 * 60 * 60 * 1000 });

      // session-1 should be invalid
      expect(async () => {
        await sessionManager.validateSession('session-1');
      }).rejects.toThrow('Session invalidated');

      // session-4 should be valid
      const session4 = await sessionManager.validateSession('session-4');
      expect(session4.valid).toBe(true);
    });

    it('should track session locations for security monitoring', async () => {
      const sessions = [
        { id: 'session-1', ip: '192.168.1.100', location: 'Office' },
        { id: 'session-2', ip: '10.0.0.50', location: 'Home' },
        { id: 'session-3', ip: '203.0.113.1', location: 'Foreign' }
      ];

      for (const session of sessions) {
        await sessionManager.createSession(mockUserId, session.id, {
          ipAddress: session.ip,
          location: session.location,
          maxAge: 4 * 60 * 60 * 1000
        });
      }

      const activeSessions = await sessionManager.getActiveSessions(mockUserId);
      
      expect(activeSessions).toHaveLength(3);
      expect(activeSessions.map(s => s.location)).toEqual(['Office', 'Home', 'Foreign']);
    });

    it('should alert when sessions are created from unusual locations', async () => {
      const mockAlert = vi.fn();
      
      sessionManager.configure({
        locationAlertCallback: mockAlert,
        knownLocations: ['192.168.1.0/24', '10.0.0.0/24'] // Office and home networks
      });

      // Create session from unusual location
      await sessionManager.createSession(mockUserId, mockSessionId, {
        ipAddress: '203.0.113.1', // Foreign IP
        maxAge: 4 * 60 * 60 * 1000
      });

      expect(mockAlert).toHaveBeenCalledWith({
        type: 'UNUSUAL_LOCATION_LOGIN',
        userId: mockUserId,
        ipAddress: '203.0.113.1',
        location: expect.any(String),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Educational Interest Validation', () => {
    it('should validate educational interest for student data access', async () => {
      await sessionManager.createSession(mockUserId, mockSessionId, {
        educationalInterest: 'DIRECT',
        maxAge: 4 * 60 * 60 * 1000
      });

      // Should allow access to student PII with direct interest
      const accessResult = await sessionManager.validateEducationalAccess(
        mockSessionId, 
        'student-pii'
      );
      
      expect(accessResult.allowed).toBe(true);
      expect(accessResult.reason).toBe('Direct educational interest verified');
    });

    it('should restrict PII access for indirect educational interest', async () => {
      await sessionManager.createSession(mockUserId, mockSessionId, {
        educationalInterest: 'INDIRECT',
        maxAge: 4 * 60 * 60 * 1000
      });

      // Should deny access to student PII with indirect interest
      expect(async () => {
        await sessionManager.validateEducationalAccess(mockSessionId, 'student-pii');
      }).rejects.toThrow('Direct educational interest required for PII access');
    });

    it('should allow aggregated data access with indirect interest', async () => {
      await sessionManager.createSession(mockUserId, mockSessionId, {
        educationalInterest: 'INDIRECT',
        maxAge: 4 * 60 * 60 * 1000
      });

      // Should allow access to aggregated data
      const accessResult = await sessionManager.validateEducationalAccess(
        mockSessionId, 
        'aggregated-data'
      );
      
      expect(accessResult.allowed).toBe(true);
    });

    it('should log educational interest violations', async () => {
      const mockLogger = vi.fn();
      
      sessionManager.configure({
        ferpaLogger: mockLogger
      });

      await sessionManager.createSession(mockUserId, mockSessionId, {
        educationalInterest: 'NONE',
        maxAge: 4 * 60 * 60 * 1000
      });

      try {
        await sessionManager.validateEducationalAccess(mockSessionId, 'student-data');
      } catch (error) {
        // Expected failure
      }

      expect(mockLogger).toHaveBeenCalledWith({
        type: 'FERPA_VIOLATION_ATTEMPT',
        severity: 'HIGH',
        userId: mockUserId,
        sessionId: mockSessionId,
        educationalInterest: 'NONE',
        requestedResource: 'student-data',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Session Security and Monitoring', () => {
    it('should detect session hijacking attempts', async () => {
      const mockAlert = vi.fn();
      
      sessionManager.configure({
        hijackingDetection: true,
        securityAlertCallback: mockAlert
      });

      await sessionManager.createSession(mockUserId, mockSessionId, {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        maxAge: 4 * 60 * 60 * 1000
      });

      // Attempt to use session from different IP/user agent
      await sessionManager.validateSession(mockSessionId, {
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      });

      expect(mockAlert).toHaveBeenCalledWith({
        type: 'POSSIBLE_SESSION_HIJACKING',
        severity: 'HIGH',
        sessionId: mockSessionId,
        userId: mockUserId,
        originalIP: '192.168.1.100',
        suspiciousIP: '10.0.0.1',
        originalUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        suspiciousUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: expect.any(Date)
      });
    });

    it('should implement session fixation protection', async () => {
      // Create initial session
      await sessionManager.createSession(mockUserId, mockSessionId, {
        maxAge: 4 * 60 * 60 * 1000
      });

      // Regenerate session ID on privilege escalation
      const newSessionId = await sessionManager.regenerateSessionId(mockSessionId, {
        reason: 'privilege_escalation'
      });

      expect(newSessionId).not.toBe(mockSessionId);

      // Old session should be invalid
      expect(async () => {
        await sessionManager.validateSession(mockSessionId);
      }).rejects.toThrow('Session invalidated');

      // New session should be valid
      const newSession = await sessionManager.validateSession(newSessionId);
      expect(newSession.valid).toBe(true);
    });

    it('should clean up expired sessions automatically', async () => {
      // Create multiple sessions with short expiration
      const sessionIds = ['expired-1', 'expired-2', 'expired-3'];
      
      for (const sessionId of sessionIds) {
        await sessionManager.createSession(mockUserId, sessionId, {
          maxAge: 1000 // 1 second
        });
      }

      // Fast-forward time past expiration
      vi.advanceTimersByTime(2000);

      // Trigger cleanup
      const cleanedCount = await sessionManager.cleanupExpiredSessions();
      
      expect(cleanedCount).toBe(3);

      // Sessions should no longer exist
      for (const sessionId of sessionIds) {
        expect(async () => {
          await sessionManager.getSession(sessionId);
        }).rejects.toThrow('Session not found');
      }
    });

    it('should provide comprehensive session audit logs', async () => {
      const mockAuditLogger = vi.fn();
      
      sessionManager.configure({
        auditLogger: mockAuditLogger
      });

      // Create session
      await sessionManager.createSession(mockUserId, mockSessionId, {
        ipAddress: mockIPAddress,
        maxAge: 4 * 60 * 60 * 1000
      });

      // Validate session
      await sessionManager.validateSession(mockSessionId);

      // Update activity
      await sessionManager.updateActivity(mockSessionId);

      // Invalidate session
      await sessionManager.invalidateSession(mockSessionId);

      // Should have logged all session events
      expect(mockAuditLogger).toHaveBeenCalledTimes(4);
      
      const logCalls = mockAuditLogger.mock.calls;
      expect(logCalls[0][0].type).toBe('SESSION_CREATED');
      expect(logCalls[1][0].type).toBe('SESSION_VALIDATED');
      expect(logCalls[2][0].type).toBe('SESSION_ACTIVITY_UPDATED');
      expect(logCalls[3][0].type).toBe('SESSION_INVALIDATED');
    });
  });

  describe('Session Storage and Persistence', () => {
    it('should support Redis-based session storage', async () => {
      const mockRedis = {
        set: vi.fn().mockResolvedValue('OK'),
        get: vi.fn().mockResolvedValue(JSON.stringify({
          userId: mockUserId,
          sessionId: mockSessionId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000)
        })),
        del: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1)
      };

      sessionManager.configure({
        storage: 'redis',
        redisClient: mockRedis
      });

      await sessionManager.createSession(mockUserId, mockSessionId, {
        maxAge: 4 * 60 * 60 * 1000
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        `session:${mockSessionId}`,
        expect.any(String),
        'EX',
        4 * 60 * 60 // TTL in seconds
      );
    });

    it('should handle storage failures gracefully', async () => {
      const mockRedis = {
        set: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        get: vi.fn().mockRejectedValue(new Error('Redis connection failed'))
      };

      sessionManager.configure({
        storage: 'redis',
        redisClient: mockRedis,
        fallbackToMemory: true
      });

      // Should fall back to memory storage
      await sessionManager.createSession(mockUserId, mockSessionId, {
        maxAge: 4 * 60 * 60 * 1000
      });

      const session = await sessionManager.getSession(mockSessionId);
      expect(session.usingFallback).toBe(true);
    });
  });
});

// Type definitions that need to be implemented
export interface SessionConfig {
  maxConcurrentSessions?: number;
  sessionRotationEnabled?: boolean;
  hijackingDetection?: boolean;
  storage?: 'memory' | 'redis';
  redisClient?: any;
  fallbackToMemory?: boolean;
  locationAlertCallback?: (alert: any) => void;
  securityAlertCallback?: (alert: any) => void;
  ferpaLogger?: (event: any) => void;
  auditLogger?: (event: any) => void;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  employeeId?: string;
  educationalInterest?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  valid?: boolean;
  usingFallback?: boolean;
}

export interface LoginAttempt {
  userId: string;
  ipAddress: string;
  timestamp: Date;
  success: boolean;
  reason?: string;
}

export interface SessionSecurity {
  hijackingDetected?: boolean;
  locationAnomaly?: boolean;
  concurrentSessions?: number;
  riskScore?: number;
}