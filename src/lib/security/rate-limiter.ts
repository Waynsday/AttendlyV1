/**
 * @fileoverview Rate Limiter for AP_Tool_V1
 * 
 * Implements comprehensive rate limiting with security controls:
 * - Per-user rate limiting (100 requests/minute default)
 * - IP-based rate limiting for security protection
 * - Administrative bypass functionality
 * - Rate limit monitoring and alerting
 * - Sliding window implementation for accuracy
 * - Redis-based distributed rate limiting support
 * 
 * SECURITY REQUIREMENTS:
 * - Prevent DoS attacks through request throttling
 * - Sliding window for accurate rate limiting
 * - Administrative bypass with proper validation
 * - Comprehensive monitoring and alerting
 * - Distributed support for horizontal scaling
 */

import { NextRequest } from 'next/server';
import { 
  RateLimitError,
  logSecurityEvent,
  ErrorSeverity
} from './error-handler';

/**
 * Rate limit configuration options
 */
export interface RateLimitConfig {
  userLimit?: number;
  ipLimit?: number;
  windowMs?: number;
  storage?: 'memory' | 'redis';
  redisClient?: any;
  fallbackToMemory?: boolean;
  alertThreshold?: number;
  alertCallback?: (alert: RateLimitAlert) => void;
  patternDetection?: boolean;
  patternAlertCallback?: (alert: PatternAlert) => void;
  suspiciousIPLimit?: number;
  suspiciousIPPatterns?: RegExp[];
  foreignIPLimit?: number;
  geoLookupService?: (ip: string) => Promise<GeoLocation>;
  endpointRules?: Record<string, EndpointRule>;
  methodRules?: Record<string, MethodRule>;
  auditLogger?: (event: any) => void;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  headers?: Record<string, string>;
  bypassed?: boolean;
  usingFallback?: boolean;
}

/**
 * Rate limit window for sliding window implementation
 */
export interface RateLimitWindow {
  start: Date;
  end: Date;
  count: number;
  requests: Date[];
}

/**
 * Alert interfaces
 */
interface RateLimitAlert {
  type: string;
  userId?: string;
  ipAddress?: string;
  currentCount: number;
  limit: number;
  percentageUsed: number;
  timeWindow: string;
  timestamp: Date;
}

interface PatternAlert {
  type: string;
  userId?: string;
  ipAddress?: string;
  pattern: string;
  requestCount: number;
  timeSpan: number;
  timestamp: Date;
}

interface GeoLocation {
  country: string;
  region: string;
  city: string;
  isSuspicious: boolean;
}

interface EndpointRule {
  limit: number;
  window: number;
}

interface MethodRule {
  limit: number;
  window: number;
}

/**
 * Storage interface for rate limit data
 */
interface RateLimitStorage {
  get(key: string): Promise<RateLimitWindow | null>;
  set(key: string, window: RateLimitWindow, ttl: number): Promise<void>;
  increment(key: string): Promise<number>;
  delete(key: string): Promise<void>;
  cleanup(): Promise<number>;
}

/**
 * In-memory storage implementation
 */
class MemoryStorage implements RateLimitStorage {
  private storage = new Map<string, { window: RateLimitWindow; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<RateLimitWindow | null> {
    const entry = this.storage.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this.storage.delete(key);
      return null;
    }
    return entry.window;
  }

  async set(key: string, window: RateLimitWindow, ttl: number): Promise<void> {
    this.storage.set(key, {
      window,
      expiry: Date.now() + ttl
    });
  }

  async increment(key: string): Promise<number> {
    const window = await this.get(key);
    if (window) {
      window.count++;
      window.requests.push(new Date());
      await this.set(key, window, 60000); // 1 minute TTL
      return window.count;
    }
    
    // Create new window
    const newWindow: RateLimitWindow = {
      start: new Date(),
      end: new Date(Date.now() + 60000), // 1 minute window
      count: 1,
      requests: [new Date()]
    };
    await this.set(key, newWindow, 60000);
    return 1;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.storage.entries()) {
      if (now > entry.expiry) {
        this.storage.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.storage.clear();
  }
}

/**
 * Redis storage implementation
 */
class RedisStorage implements RateLimitStorage {
  constructor(private redisClient: any) {}

  async get(key: string): Promise<RateLimitWindow | null> {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  async set(key: string, window: RateLimitWindow, ttl: number): Promise<void> {
    try {
      await this.redisClient.set(key, JSON.stringify(window), 'EX', Math.ceil(ttl / 1000));
    } catch (error) {
      throw new Error('Redis storage error');
    }
  }

  async increment(key: string): Promise<number> {
    try {
      return await this.redisClient.incr(key);
    } catch (error) {
      throw new Error('Redis increment error');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      // Ignore delete errors
    }
  }

  async cleanup(): Promise<number> {
    // Redis handles TTL cleanup automatically
    return 0;
  }
}

/**
 * Main rate limiter class
 */
class RateLimiter {
  private config: RateLimitConfig;
  private storage: RateLimitStorage;
  private fallbackStorage?: MemoryStorage;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      userLimit: 100,
      ipLimit: 200,
      windowMs: 60000, // 1 minute
      storage: 'memory',
      fallbackToMemory: true,
      alertThreshold: 80,
      suspiciousIPLimit: 50,
      foreignIPLimit: 25,
      ...config
    };

    this.initializeStorage();
  }

  private initializeStorage(): void {
    if (this.config.storage === 'redis' && this.config.redisClient) {
      this.storage = new RedisStorage(this.config.redisClient);
      
      if (this.config.fallbackToMemory) {
        this.fallbackStorage = new MemoryStorage();
      }
    } else {
      this.storage = new MemoryStorage();
    }
  }

  /**
   * Check rate limit for a user
   */
  async checkLimit(
    userId: string, 
    request: NextRequest, 
    options: { 
      customLimit?: number; 
      window?: number; 
      bypassForAdmin?: boolean;
      adminValidator?: () => boolean;
    } = {}
  ): Promise<RateLimitResult> {
    try {
      // Admin bypass check
      if (options.bypassForAdmin) {
        const isAdmin = options.adminValidator ? options.adminValidator() : false;
        if (!isAdmin) {
          throw new RateLimitError('Invalid admin bypass attempt', {
            userId,
            limit: 0,
            current: 0,
            resetTime: new Date()
          });
        }

        // Log admin bypass
        if (this.config.auditLogger) {
          this.config.auditLogger({
            type: 'RATE_LIMIT_BYPASS',
            userId,
            resource: request.nextUrl.pathname,
            timestamp: new Date(),
            reason: 'Administrative override'
          });
        }

        return {
          allowed: true,
          remaining: 999,
          resetTime: new Date(Date.now() + 60000),
          bypassed: true
        };
      }

      // Determine effective limit
      const effectiveLimit = this.getEffectiveLimit(request, options.customLimit);
      const windowMs = options.window || this.config.windowMs || 60000;

      // Check current usage
      const key = `rate_limit:user:${userId}`;
      const currentWindow = await this.getCurrentWindow(key, windowMs);
      const currentCount = this.calculateCurrentCount(currentWindow, windowMs);

      // Check if limit exceeded
      if (currentCount >= effectiveLimit) {
        const resetTime = new Date(currentWindow.start.getTime() + windowMs);
        
        throw new RateLimitError('User rate limit exceeded', {
          userId,
          limit: effectiveLimit,
          current: currentCount,
          resetTime
        });
      }

      // Increment counter
      await this.incrementCounter(key, currentWindow, windowMs);

      // Check for alerts
      this.checkAlerts(userId, currentCount + 1, effectiveLimit, 'user');

      // Pattern detection
      if (this.config.patternDetection) {
        this.detectPatterns(userId, currentWindow);
      }

      return {
        allowed: true,
        remaining: effectiveLimit - currentCount - 1,
        resetTime: new Date(currentWindow.start.getTime() + windowMs),
        headers: this.generateHeaders(effectiveLimit, currentCount + 1, windowMs)
      };

    } catch (error) {
      if (error instanceof RateLimitError) {
        // Add retry-after header
        error.headers = {
          'Retry-After': Math.ceil((error.resetTime.getTime() - Date.now()) / 1000).toString()
        };
      }
      throw error;
    }
  }

  /**
   * Check IP-based rate limit
   */
  async checkIPLimit(
    ipAddress: string, 
    request: NextRequest, 
    options: { customLimit?: number } = {}
  ): Promise<RateLimitResult> {
    try {
      // Check for suspicious IP patterns
      const isSuspicious = this.isSuspiciousIP(ipAddress);
      let effectiveLimit = options.customLimit || this.config.ipLimit || 200;

      if (isSuspicious) {
        effectiveLimit = this.config.suspiciousIPLimit || 50;
      }

      // Geo-location check for foreign IPs
      if (this.config.geoLookupService) {
        const geoInfo = await this.config.geoLookupService(ipAddress);
        if (geoInfo.isSuspicious) {
          effectiveLimit = this.config.foreignIPLimit || 25;
        }
      }

      const windowMs = this.config.windowMs || 60000;
      const key = `rate_limit:ip:${ipAddress}`;
      const currentWindow = await this.getCurrentWindow(key, windowMs);
      const currentCount = this.calculateCurrentCount(currentWindow, windowMs);

      if (currentCount >= effectiveLimit) {
        const resetTime = new Date(currentWindow.start.getTime() + windowMs);
        
        const errorMessage = isSuspicious ? 'Suspicious IP rate limit exceeded' : 
                             'IP rate limit exceeded';
        
        throw new RateLimitError(errorMessage, {
          limit: effectiveLimit,
          current: currentCount,
          resetTime
        });
      }

      await this.incrementCounter(key, currentWindow, windowMs);
      
      return {
        allowed: true,
        remaining: effectiveLimit - currentCount - 1,
        resetTime: new Date(currentWindow.start.getTime() + windowMs)
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get effective rate limit based on endpoint and method rules
   */
  private getEffectiveLimit(request: NextRequest, customLimit?: number): number {
    if (customLimit) return customLimit;

    const pathname = request.nextUrl.pathname;
    const method = request.method;

    // Check endpoint-specific rules
    if (this.config.endpointRules) {
      for (const [endpoint, rule] of Object.entries(this.config.endpointRules)) {
        if (pathname.startsWith(endpoint)) {
          return rule.limit;
        }
      }
    }

    // Check method-specific rules
    if (this.config.methodRules?.[method]) {
      return this.config.methodRules[method].limit;
    }

    return this.config.userLimit || 100;
  }

  /**
   * Get current sliding window
   */
  private async getCurrentWindow(key: string, windowMs: number): Promise<RateLimitWindow> {
    try {
      const existingWindow = await this.storage.get(key);
      const now = new Date();

      if (existingWindow && now.getTime() < existingWindow.end.getTime()) {
        return existingWindow;
      }

      // Create new window
      const newWindow: RateLimitWindow = {
        start: now,
        end: new Date(now.getTime() + windowMs),
        count: 0,
        requests: []
      };

      return newWindow;
    } catch (error) {
      // Fallback to memory storage if configured
      if (this.fallbackStorage) {
        const fallbackWindow = await this.fallbackStorage.get(key);
        if (fallbackWindow) {
          return fallbackWindow;
        }
      }

      // Create new window as last resort
      const now = new Date();
      return {
        start: now,
        end: new Date(now.getTime() + windowMs),
        count: 0,
        requests: []
      };
    }
  }

  /**
   * Calculate current count in sliding window
   */
  private calculateCurrentCount(window: RateLimitWindow, windowMs: number): number {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // Filter requests within the sliding window
    const validRequests = window.requests.filter(
      requestTime => new Date(requestTime).getTime() >= windowStart.getTime()
    );

    return validRequests.length;
  }

  /**
   * Increment request counter
   */
  private async incrementCounter(key: string, window: RateLimitWindow, windowMs: number): Promise<void> {
    const now = new Date();
    window.count++;
    window.requests.push(now);

    // Clean old requests (keep only last windowMs worth)
    const windowStart = new Date(now.getTime() - windowMs);
    window.requests = window.requests.filter(
      requestTime => new Date(requestTime).getTime() >= windowStart.getTime()
    );

    try {
      await this.storage.set(key, window, windowMs);
    } catch (error) {
      // Try fallback storage
      if (this.fallbackStorage) {
        await this.fallbackStorage.set(key, window, windowMs);
      }
    }
  }

  /**
   * Check for rate limit alerts
   */
  private checkAlerts(userId: string, currentCount: number, limit: number, type: string): void {
    if (!this.config.alertCallback || !this.config.alertThreshold) return;

    const percentageUsed = (currentCount / limit) * 100;
    
    if (percentageUsed >= this.config.alertThreshold) {
      this.config.alertCallback({
        type: 'RATE_LIMIT_WARNING',
        userId,
        currentCount,
        limit,
        percentageUsed,
        timeWindow: '1 minute',
        timestamp: new Date()
      });
    }
  }

  /**
   * Detect suspicious usage patterns
   */
  private detectPatterns(userId: string, window: RateLimitWindow): void {
    if (!this.config.patternAlertCallback) return;

    const now = new Date();
    const recentRequests = window.requests.filter(
      requestTime => now.getTime() - new Date(requestTime).getTime() < 5000 // Last 5 seconds
    );

    // Burst pattern detection
    if (recentRequests.length >= 20) { // 20 requests in 5 seconds
      this.config.patternAlertCallback({
        type: 'SUSPICIOUS_USAGE_PATTERN',
        userId,
        pattern: 'burst',
        requestCount: recentRequests.length,
        timeSpan: 5000,
        timestamp: now
      });
    }
  }

  /**
   * Check if IP is suspicious based on patterns
   */
  private isSuspiciousIP(ipAddress: string): boolean {
    if (!this.config.suspiciousIPPatterns) return false;

    return this.config.suspiciousIPPatterns.some(pattern => 
      pattern.test(ipAddress)
    );
  }

  /**
   * Generate standard rate limit headers
   */
  private generateHeaders(limit: number, current: number, windowMs: number): Record<string, string> {
    return {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, limit - current).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString(),
      'X-RateLimit-Window': Math.ceil(windowMs / 1000).toString()
    };
  }

  /**
   * Get statistics for a user
   */
  async getStats(userId: string): Promise<any> {
    const key = `rate_limit:user:${userId}`;
    const window = await this.getCurrentWindow(key, this.config.windowMs || 60000);
    const currentCount = this.calculateCurrentCount(window, this.config.windowMs || 60000);

    return {
      userId,
      currentCount,
      limit: this.config.userLimit || 100,
      remaining: Math.max(0, (this.config.userLimit || 100) - currentCount),
      resetTime: new Date(window.start.getTime() + (this.config.windowMs || 60000)),
      windowStart: window.start,
      averageRequestsPerSecond: currentCount / ((this.config.windowMs || 60000) / 1000)
    };
  }

  /**
   * Configure rate limiter
   */
  configure(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize storage if needed
    if (newConfig.storage || newConfig.redisClient) {
      this.initializeStorage();
    }
  }

  /**
   * Reset rate limiter state (for testing)
   */
  reset(): void {
    if (this.storage instanceof MemoryStorage) {
      this.storage.destroy();
      this.storage = new MemoryStorage();
    }
    
    if (this.fallbackStorage) {
      this.fallbackStorage.destroy();
      this.fallbackStorage = new MemoryStorage();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.storage instanceof MemoryStorage) {
      this.storage.destroy();
    }
    
    if (this.fallbackStorage) {
      this.fallbackStorage.destroy();
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Export types
export type { 
  RateLimitConfig, 
  RateLimitResult, 
  RateLimitWindow,
  RateLimitStorage,
  EndpointRule,
  MethodRule
};