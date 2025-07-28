/**
 * @fileoverview Enhanced Session Security Manager for AP_Tool_V1
 * 
 * Implements comprehensive session management with security controls:
 * - Session timeout enforcement (4 hours maximum)
 * - Failed login attempt tracking with progressive lockout
 * - Concurrent session management and limits
 * - Educational interest validation within sessions
 * - Session activity monitoring and logging
 * - Secure session storage with Redis support
 * - Session hijacking detection and prevention
 * 
 * SECURITY REQUIREMENTS:
 * - Maximum session duration of 4 hours
 * - Progressive lockout for failed login attempts
 * - Concurrent session limits per user
 * - Educational interest validation for FERPA compliance
 * - Comprehensive audit logging for all session events
 * - Session fixation protection through ID regeneration
 */

import crypto from 'crypto';
import { 
  AuthenticationError,
  AuthorizationError,
  SecurityError,
  logSecurityEvent,
  ErrorSeverity
} from './error-handler';

/**
 * Session configuration options
 */
export interface SessionConfig {
  maxConcurrentSessions?: number;
  sessionRotationEnabled?: boolean;
  hijackingDetection?: boolean;
  storage?: 'memory' | 'redis';
  redisClient?: any;
  fallbackToMemory?: boolean;
  locationAlertCallback?: (alert: LocationAlert) => void;
  securityAlertCallback?: (alert: SecurityAlert) => void;
  ferpaLogger?: (event: FERPAEvent) => void;
  auditLogger?: (event: AuditEvent) => void;
  maxFailedAttempts?: number;
  lockoutDuration?: number;
  ipFailedAttemptLimit?: number;
  knownLocations?: string[];
}

/**
 * Session data structure
 */
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
  fingerprint?: string;
}

/**
 * Login attempt record
 */
export interface LoginAttempt {
  userId: string;
  ipAddress: string;
  timestamp: Date;
  success: boolean;
  reason?: string;
  userAgent?: string;
  location?: string;
}

/**
 * Session security context
 */
export interface SessionSecurity {
  hijackingDetected?: boolean;
  locationAnomaly?: boolean;
  concurrentSessions?: number;
  riskScore?: number;
  lastSecurityCheck?: Date;
}

/**
 * Alert interfaces
 */
interface LocationAlert {
  type: string;
  userId: string;
  ipAddress: string;
  location: string;
  timestamp: Date;
}

interface SecurityAlert {
  type: string;
  severity: string;
  sessionId: string;
  userId: string;
  originalIP: string;
  suspiciousIP: string;
  originalUserAgent: string;
  suspiciousUserAgent: string;
  timestamp: Date;
}

interface FERPAEvent {
  type: string;
  severity: string;
  userId: string;
  sessionId: string;
  educationalInterest: string;
  requestedResource: string;
  timestamp: Date;
}

interface AuditEvent {
  type: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  action: string;
  timestamp: Date;
  details?: any;
}

/**
 * Failed attempt tracking
 */
interface FailedAttempts {
  count: number;
  attempts: LoginAttempt[];
  lockoutUntil?: Date;
  lockoutCount?: number;
}

/**
 * Session storage interface
 */
interface SessionStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  scan(pattern: string): Promise<string[]>;
  cleanup(): Promise<number>;
}

/**
 * In-memory session storage
 */
class MemorySessionStorage implements SessionStorage {
  private storage = new Map<string, { value: any; expiry?: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  async get(key: string): Promise<any> {
    const entry = this.storage.get(key);
    if (!entry) return null;
    
    if (entry.expiry && Date.now() > entry.expiry) {
      this.storage.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const entry = { 
      value,
      expiry: ttl ? Date.now() + ttl : undefined
    };
    this.storage.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async scan(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.storage.keys()).filter(key => regex.test(key));
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.storage.entries()) {
      if (entry.expiry && now > entry.expiry) {
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
 * Redis session storage
 */
class RedisSessionStorage implements SessionStorage {
  constructor(private redisClient: any) {}

  async get(key: string): Promise<any> {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redisClient.set(key, serialized, 'EX', Math.ceil(ttl / 1000));
      } else {
        await this.redisClient.set(key, serialized);
      }
    } catch (error) {
      throw new Error('Redis session storage error');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      // Ignore delete errors
    }
  }

  async scan(pattern: string): Promise<string[]> {
    try {
      const keys = await this.redisClient.keys(pattern);
      return keys || [];
    } catch (error) {
      return [];
    }
  }

  async cleanup(): Promise<number> {
    // Redis handles TTL cleanup automatically
    return 0;
  }
}

/**
 * Main session manager class
 */
class SessionManager {
  private config: SessionConfig;
  private storage: SessionStorage;
  private fallbackStorage?: MemorySessionStorage;

  constructor(config: SessionConfig = {}) {
    this.config = {
      maxConcurrentSessions: 3,
      sessionRotationEnabled: false,
      hijackingDetection: true,
      storage: 'memory',
      fallbackToMemory: true,
      maxFailedAttempts: 5,
      lockoutDuration: 300000, // 5 minutes initial lockout
      ipFailedAttemptLimit: 15,
      ...config
    };

    this.initializeStorage();
  }

  private initializeStorage(): void {
    if (this.config.storage === 'redis' && this.config.redisClient) {
      this.storage = new RedisSessionStorage(this.config.redisClient);
      
      if (this.config.fallbackToMemory) {
        this.fallbackStorage = new MemorySessionStorage();
      }
    } else {
      this.storage = new MemorySessionStorage();
    }
  }

  /**
   * Create a new session with security validation
   */
  async createSession(
    userId: string, 
    sessionId: string, 
    options: {
      employeeId?: string;
      educationalInterest?: string;
      ipAddress?: string;
      userAgent?: string;
      location?: string;
      maxAge?: number;
    } = {}
  ): Promise<SessionData> {
    // Validate session timeout (maximum 4 hours)
    const maxAge = options.maxAge || 4 * 60 * 60 * 1000; // 4 hours default
    const maxAllowedAge = 4 * 60 * 60 * 1000; // 4 hours maximum
    
    if (maxAge > maxAllowedAge) {
      throw new SecurityError('Session timeout cannot exceed 4 hours', {
        severity: ErrorSeverity.MEDIUM,
        userId,
        requestedTimeout: maxAge,
        maxAllowedTimeout: maxAllowedAge,
        timestamp: new Date()
      });
    }

    // Check concurrent session limits
    const activeSessions = await this.getActiveSessions(userId);
    if (activeSessions.length >= (this.config.maxConcurrentSessions || 3)) {
      if (this.config.sessionRotationEnabled) {
        // Invalidate oldest session
        const oldestSession = activeSessions.sort((a, b) => 
          a.createdAt.getTime() - b.createdAt.getTime()
        )[0];
        
        await this.invalidateSession(oldestSession.sessionId);
        
        // Log session rotation
        this.auditLog({
          type: 'SESSION_ROTATED',
          userId,
          sessionId: oldestSession.sessionId,
          action: 'Oldest session invalidated due to concurrent limit',
          timestamp: new Date()
        });
      } else {
        throw new AuthenticationError('Maximum concurrent sessions exceeded', {
          userId,
          maxSessions: this.config.maxConcurrentSessions,
          currentSessions: activeSessions.length,
          timestamp: new Date()
        });
      }
    }

    // Check for unusual location (if configured)
    if (options.ipAddress && this.config.knownLocations) {
      const isKnownLocation = this.config.knownLocations.some(location => 
        this.isIPInRange(options.ipAddress!, location)
      );
      
      if (!isKnownLocation && this.config.locationAlertCallback) {
        this.config.locationAlertCallback({
          type: 'UNUSUAL_LOCATION_LOGIN',
          userId,
          ipAddress: options.ipAddress,
          location: options.location || 'Unknown',
          timestamp: new Date()
        });
      }
    }

    // Create session data
    const now = new Date();
    const sessionData: SessionData = {
      userId,
      sessionId,
      employeeId: options.employeeId,
      educationalInterest: options.educationalInterest,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      location: options.location,
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + maxAge),
      fingerprint: this.generateFingerprint(options.ipAddress, options.userAgent)
    };

    // Store session
    await this.storeSession(sessionData);

    // Log session creation
    this.auditLog({
      type: 'SESSION_CREATED',
      userId,
      sessionId,
      ipAddress: options.ipAddress,
      action: 'New session created',
      timestamp: now,
      details: {
        educationalInterest: options.educationalInterest,
        location: options.location,
        expiresAt: sessionData.expiresAt
      }
    });

    return sessionData;
  }

  /**
   * Validate session with security checks
   */
  async validateSession(
    sessionId: string, 
    context?: { 
      ipAddress?: string; 
      userAgent?: string; 
    }
  ): Promise<{ valid: boolean; userId?: string; session?: SessionData }> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new AuthenticationError('Session not found', {
        sessionId,
        timestamp: new Date()
      });
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      await this.invalidateSession(sessionId);
      throw new AuthenticationError('Session expired', {
        sessionId,
        userId: session.userId,
        expiredAt: session.expiresAt,
        timestamp: new Date()
      });
    }

    // Session hijacking detection
    if (this.config.hijackingDetection && context) {
      const hijackingDetected = this.detectSessionHijacking(session, context);
      
      if (hijackingDetected && this.config.securityAlertCallback) {
        this.config.securityAlertCallback({
          type: 'POSSIBLE_SESSION_HIJACKING',
          severity: 'HIGH',
          sessionId,
          userId: session.userId,
          originalIP: session.ipAddress || 'unknown',
          suspiciousIP: context.ipAddress || 'unknown',
          originalUserAgent: session.userAgent || 'unknown',
          suspiciousUserAgent: context.userAgent || 'unknown',
          timestamp: new Date()
        });
        
        // Invalidate suspicious session
        await this.invalidateSession(sessionId);
        
        throw new SecurityError('Session hijacking detected', {
          severity: ErrorSeverity.CRITICAL,
          sessionId,
          userId: session.userId,
          timestamp: new Date()
        });
      }
    }

    // Log successful validation
    this.auditLog({
      type: 'SESSION_VALIDATED',
      userId: session.userId,
      sessionId,
      ipAddress: context?.ipAddress,
      action: 'Session validated successfully',
      timestamp: new Date()
    });

    return {
      valid: true,
      userId: session.userId,
      session
    };
  }

  /**
   * Attempt login with failed attempt tracking
   */
  async attemptLogin(
    userId: string, 
    password: string, 
    ipAddress: string,
    userAgent?: string
  ): Promise<{ success: boolean; sessionId?: string; lockoutTime?: Date }> {
    // Check if user is locked out
    const failedAttempts = await this.getFailedAttempts(userId);
    
    if (failedAttempts.lockoutUntil && new Date() < failedAttempts.lockoutUntil) {
      throw new AuthenticationError('Account temporarily locked due to failed login attempts', {
        userId,
        lockoutTime: failedAttempts.lockoutUntil,
        attemptCount: failedAttempts.count,
        timestamp: new Date()
      });
    }

    // Check IP-based lockout
    const ipAttempts = await this.getIPFailedAttempts(ipAddress);
    if (ipAttempts.count >= (this.config.ipFailedAttemptLimit || 15)) {
      throw new AuthenticationError('IP address temporarily blocked due to suspicious activity', {
        ipAddress,
        blockReason: 'Too many failed attempts',
        timestamp: new Date()
      });
    }

    // Simulate password validation (replace with actual authentication)
    const loginSuccess = await this.validateCredentials(userId, password);

    const attempt: LoginAttempt = {
      userId,
      ipAddress,
      timestamp: new Date(),
      success: loginSuccess,
      userAgent,
      reason: loginSuccess ? 'Successful login' : 'Invalid credentials'
    };

    if (loginSuccess) {
      // Reset failed attempts on successful login
      await this.resetFailedAttempts(userId);
      
      // Create new session
      const sessionId = this.generateSessionId();
      await this.createSession(userId, sessionId, {
        ipAddress,
        userAgent,
        maxAge: 4 * 60 * 60 * 1000 // 4 hours
      });

      // Log successful login
      this.auditLog({
        type: 'SUCCESSFUL_LOGIN',
        userId,
        sessionId,
        ipAddress,
        action: 'User logged in successfully',
        timestamp: new Date()
      });

      return { success: true, sessionId };
    } else {
      // Track failed attempt
      await this.recordFailedAttempt(userId, attempt);
      
      // Check if lockout should be triggered
      const updatedAttempts = await this.getFailedAttempts(userId);
      if (updatedAttempts.count >= (this.config.maxFailedAttempts || 5)) {
        const lockoutTime = await this.triggerLockout(userId, updatedAttempts.lockoutCount || 0);
        
        // Log lockout
        logSecurityEvent({
          type: 'ACCOUNT_LOCKOUT',
          severity: ErrorSeverity.HIGH,
          userId,
          ipAddress,
          details: `Account locked after ${updatedAttempts.count} failed attempts`,
          timestamp: new Date()
        });

        throw new AuthenticationError('Account temporarily locked due to failed login attempts', {
          userId,
          lockoutTime,
          attemptCount: updatedAttempts.count,
          timestamp: new Date()
        });
      }

      // Log failed attempt
      this.auditLog({
        type: 'FAILED_LOGIN_ATTEMPT',
        userId,
        ipAddress,
        action: 'Login attempt failed',
        timestamp: new Date(),
        details: {
          attemptCount: updatedAttempts.count,
          remainingAttempts: (this.config.maxFailedAttempts || 5) - updatedAttempts.count
        }
      });

      throw new AuthenticationError('Invalid credentials', {
        userId,
        ipAddress,
        attemptsRemaining: (this.config.maxFailedAttempts || 5) - updatedAttempts.count,
        timestamp: new Date()
      });
    }
  }

  /**
   * Validate educational interest for resource access
   */
  async validateEducationalAccess(
    sessionId: string, 
    resourceType: string
  ): Promise<{ allowed: boolean; reason: string }> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new AuthenticationError('Session not found', { sessionId, timestamp: new Date() });
    }

    const educationalInterest = session.educationalInterest || 'NONE';

    // Define resource requirements
    const resourceRequirements: Record<string, string[]> = {
      'student-pii': ['DIRECT', 'ADMINISTRATIVE'],
      'student-data': ['DIRECT', 'INDIRECT', 'ADMINISTRATIVE'],
      'aggregated-data': ['INDIRECT', 'DIRECT', 'ADMINISTRATIVE'],
      'public-data': ['NONE', 'INDIRECT', 'DIRECT', 'ADMINISTRATIVE']
    };

    const allowedInterests = resourceRequirements[resourceType] || [];
    const allowed = allowedInterests.includes(educationalInterest);

    if (!allowed) {
      // Log FERPA violation attempt
      if (this.config.ferpaLogger) {
        this.config.ferpaLogger({
          type: 'FERPA_VIOLATION_ATTEMPT',
          severity: 'HIGH',
          userId: session.userId,
          sessionId,
          educationalInterest,
          requestedResource: resourceType,
          timestamp: new Date()
        });
      }

      const requiredInterest = resourceType === 'student-pii' ? 'Direct' : 'Some';
      throw new AuthorizationError(`${requiredInterest} educational interest required for ${resourceType} access`, {
        userId: session.userId,
        sessionId,
        educationalInterest,
        resourceType,
        timestamp: new Date()
      });
    }

    return {
      allowed: true,
      reason: educationalInterest === 'DIRECT' ? 'Direct educational interest verified' : 
              educationalInterest === 'ADMINISTRATIVE' ? 'Administrative access verified' :
              'Educational interest verified'
    };
  }

  /**
   * Update session activity timestamp
   */
  async updateActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (session) {
      session.lastActivity = new Date();
      await this.storeSession(session);
      
      // Log activity update
      this.auditLog({
        type: 'SESSION_ACTIVITY_UPDATED',
        userId: session.userId,
        sessionId,
        action: 'Session activity updated',
        timestamp: new Date()
      });
    }
  }

  /**
   * Regenerate session ID for security
   */
  async regenerateSessionId(
    oldSessionId: string, 
    options: { reason?: string } = {}
  ): Promise<string> {
    const session = await this.getSession(oldSessionId);
    
    if (!session) {
      throw new AuthenticationError('Session not found', { sessionId: oldSessionId, timestamp: new Date() });
    }

    const newSessionId = this.generateSessionId();
    
    // Update session with new ID
    session.sessionId = newSessionId;
    session.lastActivity = new Date();
    
    // Store with new ID and remove old
    await this.storeSession(session);
    await this.storage.delete(`session:${oldSessionId}`);

    // Log session ID regeneration
    this.auditLog({
      type: 'SESSION_ID_REGENERATED',
      userId: session.userId,
      sessionId: newSessionId,
      action: 'Session ID regenerated',
      timestamp: new Date(),
      details: {
        oldSessionId,
        reason: options.reason || 'Security regeneration'
      }
    });

    return newSessionId;
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<SessionData[]> {
    const sessionKeys = await this.storage.scan(`session:user:${userId}:*`);
    const sessions: SessionData[] = [];
    
    for (const key of sessionKeys) {
      const session = await this.storage.get(key);
      if (session && new Date() < new Date(session.expiresAt)) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (session) {
      await this.storage.delete(`session:${sessionId}`);
      await this.storage.delete(`session:user:${session.userId}:${sessionId}`);
      
      // Log session invalidation
      this.auditLog({
        type: 'SESSION_INVALIDATED',
        userId: session.userId,
        sessionId,
        action: 'Session invalidated',
        timestamp: new Date()
      });
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const sessionKeys = await this.storage.scan('session:*');
    let cleanedCount = 0;
    
    for (const key of sessionKeys) {
      const session = await this.storage.get(key);
      if (session && new Date() > new Date(session.expiresAt)) {
        await this.storage.delete(key);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Clear all sessions (for testing)
   */
  async clearAll(): Promise<void> {
    const sessionKeys = await this.storage.scan('session:*');
    const attemptKeys = await this.storage.scan('failed_attempts:*');
    
    for (const key of [...sessionKeys, ...attemptKeys]) {
      await this.storage.delete(key);
    }
  }

  /**
   * Configure session manager
   */
  configure(newConfig: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.storage || newConfig.redisClient) {
      this.initializeStorage();
    }
  }

  // Private helper methods
  private async storeSession(session: SessionData): Promise<void> {
    const ttl = session.expiresAt.getTime() - Date.now();
    
    try {
      await this.storage.set(`session:${session.sessionId}`, session, ttl);
      await this.storage.set(`session:user:${session.userId}:${session.sessionId}`, session, ttl);
    } catch (error) {
      if (this.fallbackStorage) {
        await this.fallbackStorage.set(`session:${session.sessionId}`, session, ttl);
        await this.fallbackStorage.set(`session:user:${session.userId}:${session.sessionId}`, session, ttl);
        session.usingFallback = true;
      } else {
        throw error;
      }
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      return await this.storage.get(`session:${sessionId}`);
    } catch (error) {
      if (this.fallbackStorage) {
        return await this.fallbackStorage.get(`session:${sessionId}`);
      }
      return null;
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateFingerprint(ipAddress?: string, userAgent?: string): string {
    const data = `${ipAddress || 'unknown'}:${userAgent || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private detectSessionHijacking(session: SessionData, context: { ipAddress?: string; userAgent?: string }): boolean {
    if (!session.fingerprint || !context.ipAddress || !context.userAgent) {
      return false;
    }

    const currentFingerprint = this.generateFingerprint(context.ipAddress, context.userAgent);
    return session.fingerprint !== currentFingerprint;
  }

  private async validateCredentials(userId: string, password: string): Promise<boolean> {
    // Mock implementation - replace with actual credential validation
    // This should integrate with your authentication system
    return password === 'correct-password';
  }

  private async getFailedAttempts(userId: string): Promise<FailedAttempts> {
    const attempts = await this.storage.get(`failed_attempts:user:${userId}`);
    return attempts || { count: 0, attempts: [] };
  }

  private async getIPFailedAttempts(ipAddress: string): Promise<{ count: number; uniqueUsers: number }> {
    const attempts = await this.storage.get(`failed_attempts:ip:${ipAddress}`);
    if (!attempts) {
      return { count: 0, uniqueUsers: 0 };
    }

    const uniqueUsers = new Set(attempts.map((a: LoginAttempt) => a.userId)).size;
    return { count: attempts.length, uniqueUsers };
  }

  private async recordFailedAttempt(userId: string, attempt: LoginAttempt): Promise<void> {
    const failedAttempts = await this.getFailedAttempts(userId);
    failedAttempts.count++;
    failedAttempts.attempts.push(attempt);

    // Keep only last 10 attempts
    if (failedAttempts.attempts.length > 10) {
      failedAttempts.attempts = failedAttempts.attempts.slice(-10);
    }

    await this.storage.set(`failed_attempts:user:${userId}`, failedAttempts, 24 * 60 * 60 * 1000); // 24 hour TTL

    // Also track by IP
    const ipAttempts = (await this.getIPFailedAttempts(attempt.ipAddress)).count;
    const ipAttemptsArray = await this.storage.get(`failed_attempts:ip:${attempt.ipAddress}`) || [];
    ipAttemptsArray.push(attempt);
    
    await this.storage.set(`failed_attempts:ip:${attempt.ipAddress}`, ipAttemptsArray, 24 * 60 * 60 * 1000);
  }

  private async resetFailedAttempts(userId: string): Promise<void> {
    await this.storage.delete(`failed_attempts:user:${userId}`);
  }

  private async triggerLockout(userId: string, previousLockouts: number): Promise<Date> {
    // Progressive lockout: 5min, 15min, 30min, 1hr, 2hr, 4hr
    const lockoutDurations = [300000, 900000, 1800000, 3600000, 7200000, 14400000]; // milliseconds
    const duration = lockoutDurations[Math.min(previousLockouts, lockoutDurations.length - 1)];
    
    const lockoutUntil = new Date(Date.now() + duration);
    
    const failedAttempts = await this.getFailedAttempts(userId);
    failedAttempts.lockoutUntil = lockoutUntil;
    failedAttempts.lockoutCount = (failedAttempts.lockoutCount || 0) + 1;
    
    await this.storage.set(`failed_attempts:user:${userId}`, failedAttempts, 24 * 60 * 60 * 1000);
    
    return lockoutUntil;
  }

  async getLockoutInfo(userId: string): Promise<{ active: boolean; until?: Date; duration?: number }> {
    const failedAttempts = await this.getFailedAttempts(userId);
    
    if (failedAttempts.lockoutUntil && new Date() < failedAttempts.lockoutUntil) {
      return {
        active: true,
        until: failedAttempts.lockoutUntil,
        duration: failedAttempts.lockoutUntil.getTime() - Date.now()
      };
    }
    
    return { active: false };
  }

  private isIPInRange(ip: string, range: string): boolean {
    // Simple CIDR matching - implement proper CIDR validation in production
    if (range.includes('/')) {
      return ip.startsWith(range.split('/')[0].substring(0, range.split('/')[0].lastIndexOf('.')));
    }
    return ip === range;
  }

  private auditLog(event: AuditEvent): void {
    if (this.config.auditLogger) {
      this.config.auditLogger(event);
    }
  }

  /**
   * Destroy session manager resources
   */
  destroy(): void {
    if (this.storage instanceof MemorySessionStorage) {
      this.storage.destroy();
    }
    
    if (this.fallbackStorage) {
      this.fallbackStorage.destroy();
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Export types
export type { 
  SessionConfig, 
  SessionData, 
  LoginAttempt, 
  SessionSecurity 
};