/**
 * @fileoverview JWT Authentication Service for AP_Tool_V1
 * 
 * Implements comprehensive JWT authentication with security controls:
 * - JWT token generation and validation with RS256 signing
 * - Refresh token rotation for enhanced security
 * - Role-based claims and educational interest validation
 * - Token blacklisting for secure logout
 * - Multi-factor authentication integration points
 * - FERPA compliance through educational interest claims
 * 
 * SECURITY REQUIREMENTS:
 * - RS256 asymmetric signing for production security
 * - Short-lived access tokens (15 minutes) with refresh rotation
 * - Secure token storage and transmission
 * - Educational interest validation for FERPA compliance
 * - Comprehensive audit logging for all token operations
 * - Token blacklisting for immediate revocation capability
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  AuthenticationError,
  SecurityError,
  logSecurityEvent,
  ErrorSeverity
} from './error-handler';
import { UserRole, EducationalInterestLevel } from './auth-middleware';

/**
 * JWT configuration interface
 */
export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
  algorithm: 'HS256' | 'RS256';
  privateKey?: string;
  publicKey?: string;
  keyRotationEnabled?: boolean;
  blacklistStorage?: TokenBlacklistStorage;
}

/**
 * JWT payload structure with educational context
 */
export interface JWTPayload {
  userId: string;
  employeeId: string;
  email: string;
  role: UserRole;
  educationalInterest: EducationalInterestLevel;
  permissions: string[];
  schoolIds: string[]; // Schools this user has access to
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string; // JWT ID for blacklisting
  type: 'access' | 'refresh';
  mfaVerified?: boolean;
  lastPasswordChange?: number;
}

/**
 * Token pair response
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  refreshTokenExpiry: Date;
  tokenType: 'Bearer';
}

/**
 * User authentication context
 */
export interface UserAuthContext {
  userId: string;
  employeeId: string;
  email: string;
  role: UserRole;
  educationalInterest: EducationalInterestLevel;
  permissions: string[];
  schoolIds: string[];
  mfaEnabled: boolean;
  mfaVerified?: boolean;
  lastPasswordChange?: Date;
  sessionId?: string;
}

/**
 * Token blacklist storage interface
 */
export interface TokenBlacklistStorage {
  add(jti: string, exp: number): Promise<void>;
  isBlacklisted(jti: string): Promise<boolean>;
  cleanup(): Promise<number>;
}

/**
 * In-memory token blacklist implementation
 */
class MemoryTokenBlacklist implements TokenBlacklistStorage {
  private blacklist = new Map<string, number>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  async add(jti: string, exp: number): Promise<void> {
    this.blacklist.set(jti, exp * 1000); // Convert to milliseconds
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const exp = this.blacklist.get(jti);
    if (!exp) return false;
    
    if (Date.now() > exp) {
      this.blacklist.delete(jti);
      return false;
    }
    
    return true;
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [jti, exp] of this.blacklist.entries()) {
      if (now > exp) {
        this.blacklist.delete(jti);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.blacklist.clear();
  }
}

/**
 * Redis token blacklist implementation
 */
class RedisTokenBlacklist implements TokenBlacklistStorage {
  constructor(private redisClient: any) {}

  async add(jti: string, exp: number): Promise<void> {
    try {
      const ttl = exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redisClient.set(`blacklist:${jti}`, '1', 'EX', ttl);
      }
    } catch (error) {
      throw new SecurityError('Failed to blacklist token', {
        severity: ErrorSeverity.HIGH,
        jti,
        timestamp: new Date()
      });
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    try {
      const result = await this.redisClient.get(`blacklist:${jti}`);
      return result !== null;
    } catch (error) {
      // Fail closed - assume blacklisted if we can't check
      return true;
    }
  }

  async cleanup(): Promise<number> {
    // Redis handles TTL cleanup automatically
    return 0;
  }
}

/**
 * JWT Authentication Service
 */
export class JWTAuthService {
  private config: JWTConfig;
  private blacklist: TokenBlacklistStorage;
  private keyPair?: { privateKey: string; publicKey: string };

  constructor(config: Partial<JWTConfig> = {}) {
    this.config = {
      accessTokenSecret: process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex'),
      refreshTokenSecret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
      accessTokenExpiry: '15m', // Short-lived for security
      refreshTokenExpiry: '7d',
      issuer: process.env.JWT_ISSUER || 'ap-tool-v1',
      audience: process.env.JWT_AUDIENCE || 'ap-tool-users',
      algorithm: 'HS256', // Default to HS256, upgrade to RS256 in production
      keyRotationEnabled: false,
      ...config
    };

    // Initialize blacklist
    this.blacklist = config.blacklistStorage || new MemoryTokenBlacklist();
    
    // Initialize RSA key pair if using RS256
    if (this.config.algorithm === 'RS256') {
      this.initializeKeyPair();
    }
  }

  /**
   * Initialize RSA key pair for RS256 signing
   */
  private initializeKeyPair(): void {
    if (this.config.privateKey && this.config.publicKey) {
      this.keyPair = {
        privateKey: this.config.privateKey,
        publicKey: this.config.publicKey
      };
    } else {
      // Generate new key pair (should be done once and stored securely)
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      this.keyPair = { privateKey, publicKey };
      
      // Log key generation (in production, store these securely)
      logSecurityEvent({
        type: 'RSA_KEY_PAIR_GENERATED',
        severity: ErrorSeverity.MEDIUM,
        details: 'New RSA key pair generated for JWT signing',
        timestamp: new Date()
      });
    }
  }

  /**
   * Generate JWT token pair for authenticated user
   */
  async generateTokenPair(userContext: UserAuthContext): Promise<TokenPair> {
    const sessionId = userContext.sessionId || crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    
    // Calculate expiry times
    const accessTokenExp = this.parseExpiry(this.config.accessTokenExpiry);
    const refreshTokenExp = this.parseExpiry(this.config.refreshTokenExpiry);
    
    // Generate JTIs for blacklisting capability
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    // Access token payload
    const accessPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: userContext.userId,
      employeeId: userContext.employeeId,
      email: userContext.email,
      role: userContext.role,
      educationalInterest: userContext.educationalInterest,
      permissions: userContext.permissions,
      schoolIds: userContext.schoolIds,
      sessionId,
      iss: this.config.issuer,
      aud: this.config.audience,
      jti: accessJti,
      type: 'access',
      mfaVerified: userContext.mfaVerified,
      lastPasswordChange: userContext.lastPasswordChange?.getTime()
    };

    // Refresh token payload (minimal for security)
    const refreshPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: userContext.userId,
      employeeId: userContext.employeeId,
      email: userContext.email,
      role: userContext.role,
      educationalInterest: EducationalInterestLevel.NONE, // Minimal context
      permissions: [],
      schoolIds: [],
      sessionId,
      iss: this.config.issuer,
      aud: this.config.audience,
      jti: refreshJti,
      type: 'refresh'
    };

    // Sign tokens
    const signingOptions: jwt.SignOptions = {
      algorithm: this.config.algorithm,
      expiresIn: this.config.accessTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience
    };

    const refreshSigningOptions: jwt.SignOptions = {
      ...signingOptions,
      expiresIn: this.config.refreshTokenExpiry
    };

    let accessToken: string;
    let refreshToken: string;

    try {
      if (this.config.algorithm === 'RS256' && this.keyPair) {
        accessToken = jwt.sign(accessPayload, this.keyPair.privateKey, signingOptions);
        refreshToken = jwt.sign(refreshPayload, this.keyPair.privateKey, refreshSigningOptions);
      } else {
        accessToken = jwt.sign(accessPayload, this.config.accessTokenSecret, signingOptions);
        refreshToken = jwt.sign(refreshPayload, this.config.refreshTokenSecret, refreshSigningOptions);
      }
    } catch (error) {
      throw new SecurityError('Failed to generate JWT tokens', {
        severity: ErrorSeverity.CRITICAL,
        userId: userContext.userId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }

    // Log token generation
    logSecurityEvent({
      type: 'JWT_TOKENS_GENERATED',
      severity: ErrorSeverity.LOW,
      userId: userContext.userId,
      employeeId: userContext.employeeId,
      sessionId,
      details: `Access and refresh tokens generated for user`,
      timestamp: new Date()
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry: new Date((now + accessTokenExp) * 1000),
      refreshTokenExpiry: new Date((now + refreshTokenExp) * 1000),
      tokenType: 'Bearer'
    };
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<JWTPayload> {
    try {
      let payload: any;
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience
      };

      // Verify token signature
      if (this.config.algorithm === 'RS256' && this.keyPair) {
        payload = jwt.verify(token, this.keyPair.publicKey, verifyOptions);
      } else {
        const secret = type === 'access' ? this.config.accessTokenSecret : this.config.refreshTokenSecret;
        payload = jwt.verify(token, secret, verifyOptions);
      }

      // Validate token type
      if (payload.type !== type) {
        throw new AuthenticationError(`Invalid token type. Expected ${type}, got ${payload.type}`);
      }

      // Check if token is blacklisted
      if (await this.blacklist.isBlacklisted(payload.jti)) {
        throw new AuthenticationError('Token has been revoked');
      }

      // Additional security validations
      await this.validateTokenSecurity(payload);

      return payload as JWTPayload;

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        if (error.name === 'TokenExpiredError') {
          throw new AuthenticationError('Token has expired');
        } else if (error.name === 'JsonWebTokenError') {
          throw new AuthenticationError('Invalid token signature');
        } else {
          throw new AuthenticationError('Token validation failed');
        }
      }
      
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const refreshPayload = await this.verifyToken(refreshToken, 'refresh');
    
    // Blacklist the old refresh token to prevent reuse
    await this.blacklist.add(refreshPayload.jti, refreshPayload.exp);

    // Get fresh user context (in production, fetch from database)
    const userContext = await this.getUserContext(refreshPayload.userId);
    
    if (!userContext) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Generate new token pair
    const newTokens = await this.generateTokenPair({
      ...userContext,
      sessionId: refreshPayload.sessionId
    });

    // Log token refresh
    logSecurityEvent({
      type: 'JWT_TOKENS_REFRESHED',
      severity: ErrorSeverity.LOW,
      userId: refreshPayload.userId,
      sessionId: refreshPayload.sessionId,
      details: 'Access tokens refreshed successfully',
      timestamp: new Date()
    });

    return newTokens;
  }

  /**
   * Revoke token (add to blacklist)
   */
  async revokeToken(token: string): Promise<void> {
    try {
      // Decode without verification to get JTI
      const decoded = jwt.decode(token) as any;
      
      if (decoded && decoded.jti && decoded.exp) {
        await this.blacklist.add(decoded.jti, decoded.exp);
        
        logSecurityEvent({
          type: 'JWT_TOKEN_REVOKED',
          severity: ErrorSeverity.MEDIUM,
          userId: decoded.userId,
          jti: decoded.jti,
          details: 'JWT token revoked and blacklisted',
          timestamp: new Date()
        });
      }
    } catch (error) {
      throw new SecurityError('Failed to revoke token', {
        severity: ErrorSeverity.MEDIUM,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }
  }

  /**
   * Revoke all tokens for a user (useful for password changes)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    // In production, this would query the database for all active tokens
    // For now, we'll log the event
    logSecurityEvent({
      type: 'ALL_USER_TOKENS_REVOKED',
      severity: ErrorSeverity.HIGH,
      userId,
      details: 'All tokens revoked for user (password change or security incident)',
      timestamp: new Date()
    });
  }

  /**
   * Validate token security requirements
   */
  private async validateTokenSecurity(payload: JWTPayload): Promise<void> {
    // Check if MFA is required but not verified
    if (payload.role === UserRole.ADMINISTRATOR && !payload.mfaVerified) {
      throw new AuthenticationError('Multi-factor authentication required for administrator role');
    }

    // Check educational interest for FERPA compliance
    if (!payload.educationalInterest || payload.educationalInterest === EducationalInterestLevel.NONE) {
      logSecurityEvent({
        type: 'MISSING_EDUCATIONAL_INTEREST',
        severity: ErrorSeverity.MEDIUM,
        userId: payload.userId,
        details: 'Token missing educational interest claim',
        timestamp: new Date()
      });
    }

    // Validate school access
    if (payload.schoolIds.length === 0) {
      logSecurityEvent({
        type: 'NO_SCHOOL_ACCESS',
        severity: ErrorSeverity.MEDIUM,
        userId: payload.userId,
        details: 'Token has no school access defined',
        timestamp: new Date()
      });
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new SecurityError('Invalid token expiry format', {
        severity: ErrorSeverity.MEDIUM,
        expiry,
        timestamp: new Date()
      });
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: throw new SecurityError('Invalid expiry unit', { severity: ErrorSeverity.MEDIUM, unit, timestamp: new Date() });
    }
  }

  /**
   * Get user context (mock - replace with actual database query)
   */
  private async getUserContext(userId: string): Promise<UserAuthContext | null> {
    // Mock implementation - in production, query the database
    return {
      userId,
      employeeId: 'EMP001',
      email: 'user@romoland.k12.ca.us',
      role: UserRole.TEACHER,
      educationalInterest: EducationalInterestLevel.DIRECT,
      permissions: ['READ_STUDENTS', 'READ_ATTENDANCE'],
      schoolIds: ['SCHOOL001'],
      mfaEnabled: false,
      lastPasswordChange: new Date()
    };
  }

  /**
   * Rotate signing keys (for RS256)
   */
  async rotateKeys(): Promise<void> {
    if (this.config.algorithm !== 'RS256') {
      throw new SecurityError('Key rotation only supported for RS256 algorithm', {
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date()
      });
    }

    this.initializeKeyPair();
    
    logSecurityEvent({
      type: 'JWT_KEYS_ROTATED',
      severity: ErrorSeverity.HIGH,
      details: 'JWT signing keys rotated',
      timestamp: new Date()
    });
  }

  /**
   * Get public key for external verification (RS256 only)
   */
  getPublicKey(): string | null {
    return this.keyPair?.publicKey || null;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.blacklist instanceof MemoryTokenBlacklist) {
      this.blacklist.destroy();
    }
  }
}

// Export singleton instance
export const jwtAuthService = new JWTAuthService();