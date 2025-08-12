/**
 * @fileoverview Unit tests for rate limiting implementation
 * 
 * Tests comprehensive rate limiting features:
 * - Per-user rate limiting (100 requests/minute)
 * - IP-based rate limiting for security
 * - Administrative bypass functionality
 * - Rate limit monitoring and alerting
 * - Sliding window implementation
 * - Redis-based distributed rate limiting
 * 
 * These tests MUST fail initially to drive proper TDD implementation.
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import the rate limiter we need to implement
import { 
  rateLimiter,
  RateLimitConfig,
  RateLimitResult,
  RateLimitWindow
} from '@/lib/security/rate-limiter';

// Import security errors
import { RateLimitError } from '@/lib/security/error-handler';

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset rate limiter state
    rateLimiter.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('User-Based Rate Limiting', () => {
    it('should enforce 100 requests per minute per user limit', async () => {
      const userId = 'test-user-123';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-User-ID': userId
        }
      });

      // Should fail because rateLimiter doesn't exist yet
      expect(async () => {
        await rateLimiter.checkLimit(userId, request);
      }).rejects.toThrow('rateLimiter is not defined');

      // Make 100 requests - all should succeed
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(await rateLimiter.checkLimit(userId, request));
      }

      expect(results.every(result => result.allowed)).toBe(true);

      // 101st request should fail
      expect(async () => {
        await rateLimiter.checkLimit(userId, request);
      }).rejects.toThrow(RateLimitError);
    });

    it('should reset rate limit after time window expires', async () => {
      const userId = 'test-user-123';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-User-ID': userId
        }
      });

      // Exhaust the rate limit
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkLimit(userId, request);
      }

      // Next request should fail
      expect(async () => {
        await rateLimiter.checkLimit(userId, request);
      }).rejects.toThrow(RateLimitError);

      // Fast-forward time by 1 minute
      vi.advanceTimersByTime(60 * 1000);

      // Request should now succeed
      const result = await rateLimiter.checkLimit(userId, request);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should implement sliding window rate limiting', async () => {
      const userId = 'test-user-123';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Make 50 requests at start of window
      for (let i = 0; i < 50; i++) {
        await rateLimiter.checkLimit(userId, request);
      }

      // Advance time by 30 seconds (half window)
      vi.advanceTimersByTime(30 * 1000);

      // Make 50 more requests - should succeed
      for (let i = 0; i < 50; i++) {
        await rateLimiter.checkLimit(userId, request);
      }

      // Next request should fail (window hasn't fully slid yet)
      expect(async () => {
        await rateLimiter.checkLimit(userId, request);
      }).rejects.toThrow(RateLimitError);

      // Advance another 30 seconds (first batch should expire)
      vi.advanceTimersByTime(30 * 1000);

      // Should now have capacity again
      const result = await rateLimiter.checkLimit(userId, request);
      expect(result.allowed).toBe(true);
    });

    it('should track separate limits for different users', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';
      
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Exhaust user1's limit
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkLimit(user1, request);
      }

      // user1 should be rate limited
      expect(async () => {
        await rateLimiter.checkLimit(user1, request);
      }).rejects.toThrow(RateLimitError);

      // user2 should still have full capacity
      const result = await rateLimiter.checkLimit(user2, request);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });
  });

  describe('IP-Based Rate Limiting', () => {
    it('should enforce IP-based rate limiting (200 requests/minute)', async () => {
      const ipAddress = '192.168.1.100';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-Forwarded-For': ipAddress
        }
      });

      // Make 200 requests - all should succeed
      for (let i = 0; i < 200; i++) {
        await rateLimiter.checkIPLimit(ipAddress, request);
      }

      // 201st request should fail
      expect(async () => {
        await rateLimiter.checkIPLimit(ipAddress, request);
      }).rejects.toThrow(RateLimitError);
    });

    it('should apply stricter limits for suspicious IP patterns', async () => {
      const suspiciousIP = '10.0.0.1'; // Private IP making external requests
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-Forwarded-For': suspiciousIP
        }
      });

      // Configure stricter limits for suspicious IPs
      rateLimiter.configure({
        suspiciousIPLimit: 50, // Lower limit
        suspiciousIPPatterns: [/^10\.0\.0\./]
      });

      // Should only allow 50 requests
      for (let i = 0; i < 50; i++) {
        await rateLimiter.checkIPLimit(suspiciousIP, request);
      }

      expect(async () => {
        await rateLimiter.checkIPLimit(suspiciousIP, request);
      }).rejects.toThrow('Suspicious IP rate limit exceeded');
    });

    it('should track IP geolocation for enhanced security', async () => {
      const foreignIP = '203.0.113.1'; // Example foreign IP
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-Forwarded-For': foreignIP
        }
      });

      const mockGeoLookup = vi.fn().mockResolvedValue({
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        isSuspicious: true
      });

      rateLimiter.configure({
        geoLookupService: mockGeoLookup,
        foreignIPLimit: 25
      });

      // Should apply stricter limits for foreign IPs
      for (let i = 0; i < 25; i++) {
        await rateLimiter.checkIPLimit(foreignIP, request);
      }

      expect(async () => {
        await rateLimiter.checkIPLimit(foreignIP, request);
      }).rejects.toThrow('Foreign IP rate limit exceeded');

      expect(mockGeoLookup).toHaveBeenCalledWith(foreignIP);
    });
  });

  describe('Administrative Bypass', () => {
    it('should allow admin users to bypass rate limits', async () => {
      const adminUserId = 'admin-123';
      const request = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET',
        headers: {
          'X-User-ID': adminUserId,
          'X-Admin-Override': 'true'
        }
      });

      // Make more than normal limit with admin bypass
      for (let i = 0; i < 150; i++) {
        const result = await rateLimiter.checkLimit(adminUserId, request, {
          bypassForAdmin: true
        });
        expect(result.allowed).toBe(true);
        expect(result.bypassed).toBe(true);
      }
    });

    it('should require proper admin authentication for bypass', async () => {
      const regularUserId = 'user-123';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-User-ID': regularUserId,
          'X-Admin-Override': 'true' // Attempting bypass without proper auth
        }
      });

      // Should ignore bypass request for non-admin
      expect(async () => {
        const result = await rateLimiter.checkLimit(regularUserId, request, {
          bypassForAdmin: true,
          adminValidator: () => false // Not actually admin
        });
      }).rejects.toThrow('Invalid admin bypass attempt');
    });

    it('should log admin bypass usage for audit', async () => {
      const mockLogger = vi.fn();
      const adminUserId = 'admin-123';
      
      rateLimiter.configure({
        auditLogger: mockLogger
      });

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET',
        headers: {
          'X-User-ID': adminUserId
        }
      });

      await rateLimiter.checkLimit(adminUserId, request, {
        bypassForAdmin: true,
        adminValidator: () => true
      });

      expect(mockLogger).toHaveBeenCalledWith({
        type: 'RATE_LIMIT_BYPASS',
        userId: adminUserId,
        resource: '/api/students',
        timestamp: expect.any(Date),
        reason: 'Administrative override'
      });
    });
  });

  describe('Rate Limit Monitoring and Alerts', () => {
    it('should trigger alerts at configurable thresholds', async () => {
      const mockAlert = vi.fn();
      const userId = 'monitored-user';
      
      rateLimiter.configure({
        alertCallback: mockAlert,
        alertThreshold: 80 // Alert at 80% of limit
      });

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Make 80 requests to trigger alert
      for (let i = 0; i < 80; i++) {
        await rateLimiter.checkLimit(userId, request);
      }

      expect(mockAlert).toHaveBeenCalledWith({
        type: 'RATE_LIMIT_WARNING',
        userId: userId,
        currentCount: 80,
        limit: 100,
        percentageUsed: 80,
        timeWindow: '1 minute',
        timestamp: expect.any(Date)
      });
    });

    it('should provide detailed rate limit statistics', async () => {
      const userId = 'stats-user';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Make some requests
      for (let i = 0; i < 50; i++) {
        await rateLimiter.checkLimit(userId, request);
      }

      const stats = await rateLimiter.getStats(userId);
      
      expect(stats).toMatchObject({
        userId: userId,
        currentCount: 50,
        limit: 100,
        remaining: 50,
        resetTime: expect.any(Date),
        windowStart: expect.any(Date),
        averageRequestsPerSecond: expect.any(Number)
      });
    });

    it('should detect and alert on unusual usage patterns', async () => {
      const mockAlert = vi.fn();
      const userId = 'pattern-user';
      
      rateLimiter.configure({
        patternDetection: true,
        patternAlertCallback: mockAlert
      });

      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Simulate burst pattern (all requests in 5 seconds)
      for (let i = 0; i < 90; i++) {
        await rateLimiter.checkLimit(userId, request);
      }
      
      vi.advanceTimersByTime(5 * 1000);

      expect(mockAlert).toHaveBeenCalledWith({
        type: 'SUSPICIOUS_USAGE_PATTERN',
        userId: userId,
        pattern: 'burst',
        requestCount: 90,
        timeSpan: 5000,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Distributed Rate Limiting (Redis)', () => {
    it('should support Redis-based distributed rate limiting', async () => {
      const mockRedis = {
        get: vi.fn().mockResolvedValue('50'),
        set: vi.fn().mockResolvedValue('OK'),
        incr: vi.fn().mockResolvedValue(51),
        expire: vi.fn().mockResolvedValue(1)
      };

      rateLimiter.configure({
        storage: 'redis',
        redisClient: mockRedis
      });

      const userId = 'distributed-user';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      const result = await rateLimiter.checkLimit(userId, request);

      expect(mockRedis.incr).toHaveBeenCalledWith(`rate_limit:user:${userId}`);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49); // 100 - 51
    });

    it('should handle Redis connection failures gracefully', async () => {
      const mockRedis = {
        incr: vi.fn().mockRejectedValue(new Error('Redis connection failed'))
      };

      rateLimiter.configure({
        storage: 'redis',
        redisClient: mockRedis,
        fallbackToMemory: true
      });

      const userId = 'fallback-user';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Should fall back to in-memory storage
      const result = await rateLimiter.checkLimit(userId, request);
      expect(result.allowed).toBe(true);
      expect(result.usingFallback).toBe(true);
    });
  });

  describe('Custom Rate Limit Rules', () => {
    it('should support endpoint-specific rate limits', async () => {
      rateLimiter.configure({
        endpointRules: {
          '/api/students': { limit: 50, window: 60000 }, // Stricter for sensitive data
          '/api/dashboard': { limit: 200, window: 60000 }, // More lenient for dashboards
          '/api/health': { limit: 1000, window: 60000 } // Very lenient for health checks
        }
      });

      const userId = 'rule-user';
      
      // Test students endpoint with stricter limit
      const studentRequest = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      for (let i = 0; i < 50; i++) {
        await rateLimiter.checkLimit(userId, studentRequest);
      }

      expect(async () => {
        await rateLimiter.checkLimit(userId, studentRequest);
      }).rejects.toThrow(RateLimitError);

      // Test dashboard endpoint should still work
      const dashboardRequest = new NextRequest('http://localhost:3000/api/dashboard', {
        method: 'GET'
      });

      const result = await rateLimiter.checkLimit(userId, dashboardRequest);
      expect(result.allowed).toBe(true);
    });

    it('should support method-specific rate limits', async () => {
      rateLimiter.configure({
        methodRules: {
          'POST': { limit: 20, window: 60000 }, // Stricter for creates
          'PUT': { limit: 30, window: 60000 },  // Stricter for updates  
          'DELETE': { limit: 10, window: 60000 }, // Very strict for deletes
          'GET': { limit: 100, window: 60000 } // Normal for reads
        }
      });

      const userId = 'method-user';
      
      // Test DELETE method with very strict limit
      const deleteRequest = new NextRequest('http://localhost:3000/api/students/STU001', {
        method: 'DELETE'
      });

      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(userId, deleteRequest);
      }

      expect(async () => {
        await rateLimiter.checkLimit(userId, deleteRequest);
      }).rejects.toThrow(RateLimitError);

      // GET should still work
      const getRequest = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      const result = await rateLimiter.checkLimit(userId, getRequest);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should provide standard rate limit headers in response', async () => {
      const userId = 'header-user';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      const result = await rateLimiter.checkLimit(userId, request);
      
      expect(result.headers).toMatchObject({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
        'X-RateLimit-Reset': expect.any(String),
        'X-RateLimit-Window': '60'
      });
    });

    it('should include retry-after header when rate limited', async () => {
      const userId = 'retry-user';
      const request = new NextRequest('http://localhost:3000/api/students', {
        method: 'GET'
      });

      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkLimit(userId, request);
      }

      try {
        await rateLimiter.checkLimit(userId, request);
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect(error.headers).toHaveProperty('Retry-After');
        expect(parseInt(error.headers['Retry-After'])).toBeGreaterThan(0);
      }
    });
  });
});

// Type definitions that need to be implemented
export interface RateLimitConfig {
  userLimit?: number;
  ipLimit?: number;
  windowMs?: number;
  storage?: 'memory' | 'redis';
  alertThreshold?: number;
  alertCallback?: (alert: any) => void;
  patternDetection?: boolean;
  suspiciousIPLimit?: number;
  suspiciousIPPatterns?: RegExp[];
  endpointRules?: Record<string, { limit: number; window: number }>;
  methodRules?: Record<string, { limit: number; window: number }>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  headers?: Record<string, string>;
  bypassed?: boolean;
  usingFallback?: boolean;
}

export interface RateLimitWindow {
  start: Date;
  end: Date;
  count: number;
  requests: Date[];
}