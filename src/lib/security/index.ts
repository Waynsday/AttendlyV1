/**
 * @fileoverview Security Framework Index for AP_Tool_V1
 * 
 * Comprehensive security system with FERPA compliance:
 * - Authentication and authorization
 * - Session management and MFA
 * - Input validation and sanitization
 * - Rate limiting and DDoS protection
 * - Security monitoring and alerting
 * - FERPA compliance and PII protection
 * - Row-level security and data access controls
 * - Comprehensive audit logging
 * 
 * ARCHITECTURE:
 * - Layered defense strategy
 * - Zero-trust security model
 * - Educational data protection focus
 * - Real-time threat detection
 * - Compliance-first design
 */

// Core Authentication & Authorization
export {
  authMiddleware,
  configure as configureAuthMiddleware,
  getJWTSecret,
  UserRole,
  EducationalInterestLevel,
  type AuthenticationContext,
  type JWTPayload,
  type MiddlewareConfig
} from './auth-middleware';

// JWT Authentication Service
export {
  JWTAuthService,
  jwtAuthService,
  type JWTConfig,
  type TokenPair,
  type UserAuthContext,
  type TokenBlacklistStorage
} from './jwt-auth';

// Multi-Factor Authentication
export {
  MFAService,
  mfaService,
  MFAMethod,
  MFAStatus,
  type MFAConfig,
  type MFAUserData,
  type MFAVerificationResult,
  type MFAEnrollmentData
} from './mfa-service';

// Session Management
export {
  sessionManager,
  type SessionConfig,
  type SessionData,
  type LoginAttempt,
  type SessionSecurity
} from './session-manager';

// Rate Limiting
export {
  rateLimiter,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitWindow
} from './rate-limiter';

// Security Monitoring
export {
  SecurityMonitor,
  securityMonitor,
  SecurityEventCategory,
  AlertSeverity,
  type SecurityEvent,
  type SecurityAlert,
  type SecurityMetrics,
  type SecurityMonitorConfig
} from './security-monitor';

// Error Handling & Logging
export {
  SecurityError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ErrorSeverity,
  sanitizeErrorMessage,
  logSecurityEvent,
  createSecureErrorResponse,
  SecureErrorHandler
} from './error-handler';

// Input Validation & Sanitization
export {
  InputSanitizer,
  InputValidator,
  StudentDataSchemas,
  APIInputSchemas
} from './input-validator';

// FERPA Compliance
export {
  FERPAComplianceService,
  ferpaComplianceService,
  FERPAAnonymizer,
  FERPADataClass,
  EducationalAccessLevel,
  type FERPAAccessContext,
  type FERPAConsent,
  type RetentionPolicy,
  type EncryptedField,
  type DataAccessAudit
} from './ferpa-compliance';

// Row-Level Security
export {
  RowLevelSecurityService,
  rowLevelSecurityService,
  RLSPolicyType,
  type RLSPolicy,
  type RLSCondition,
  type RLSAction,
  type DataAccessContext,
  type RLSResult,
  type TeacherAssignment,
  type SchoolBoundary
} from './row-level-security';

// Security Middleware
export {
  SecurityMiddleware,
  securityMiddleware,
  type SecurityMiddlewareConfig,
  type RequestSecurityContext,
  type SecurityValidationResult
} from './security-middleware';

/**
 * Security Framework Configuration
 */
export interface SecurityFrameworkConfig {
  authentication: {
    jwtSecret: string;
    refreshSecret: string;
    algorithm: 'HS256' | 'RS256';
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    mfaRequired: boolean;
  };
  session: {
    maxConcurrentSessions: number;
    sessionTimeout: number;
    requireSecureCookies: boolean;
  };
  rateLimiting: {
    enabled: boolean;
    userLimit: number;
    ipLimit: number;
    windowMs: number;
  };
  ferpa: {
    enableEncryption: boolean;
    requireEducationalInterest: boolean;
    auditAllAccess: boolean;
    retentionPeriod: number;
  };
  monitoring: {
    enabled: boolean;
    alertThresholds: Record<string, number>;
    realTimeAlerts: boolean;
  };
  middleware: {
    enableCSRF: boolean;
    enableSanitization: boolean;
    enableSecurityHeaders: boolean;
    trustedOrigins: string[];
  };
}

/**
 * Security Framework Initialization
 */
export class SecurityFramework {
  private static instance: SecurityFramework;
  private config: SecurityFrameworkConfig;
  private initialized = false;

  private constructor(config: Partial<SecurityFrameworkConfig> = {}) {
    this.config = {
      authentication: {
        jwtSecret: process.env.JWT_SECRET || '',
        refreshSecret: process.env.JWT_REFRESH_SECRET || '',
        algorithm: 'HS256',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        mfaRequired: false,
        ...config.authentication
      },
      session: {
        maxConcurrentSessions: 3,
        sessionTimeout: 4 * 60 * 60 * 1000, // 4 hours
        requireSecureCookies: true,
        ...config.session
      },
      rateLimiting: {
        enabled: true,
        userLimit: 100,
        ipLimit: 200,
        windowMs: 60000,
        ...config.rateLimiting
      },
      ferpa: {
        enableEncryption: true,
        requireEducationalInterest: true,
        auditAllAccess: true,
        retentionPeriod: 7 * 365, // 7 years
        ...config.ferpa
      },
      monitoring: {
        enabled: true,
        alertThresholds: {
          'AUTHENTICATION_FAILURE': 5,
          'AUTHORIZATION_FAILURE': 3,
          'RATE_LIMIT_EXCEEDED': 10
        },
        realTimeAlerts: true,
        ...config.monitoring
      },
      middleware: {
        enableCSRF: true,
        enableSanitization: true,
        enableSecurityHeaders: true,
        trustedOrigins: ['https://ap-tool.romoland.k12.ca.us'],
        ...config.middleware
      }
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<SecurityFrameworkConfig>): SecurityFramework {
    if (!SecurityFramework.instance) {
      SecurityFramework.instance = new SecurityFramework(config);
    }
    return SecurityFramework.instance;
  }

  /**
   * Initialize security framework
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Configure authentication middleware
      configureAuthMiddleware({
        jwtSecret: this.config.authentication.jwtSecret,
        requireEducationalInterest: this.config.ferpa.requireEducationalInterest
      });

      // Configure session manager
      sessionManager.configure({
        maxConcurrentSessions: this.config.session.maxConcurrentSessions
      });

      // Configure rate limiter
      rateLimiter.configure({
        userLimit: this.config.rateLimiting.userLimit,
        ipLimit: this.config.rateLimiting.ipLimit,
        windowMs: this.config.rateLimiting.windowMs
      });

      // Configure MFA service
      mfaService.configure({
        requireMFAForRoles: [UserRole.ADMINISTRATOR],
        rateLimitAttempts: 5
      });

      // Start security monitoring
      if (this.config.monitoring.enabled) {
        // Security monitor is automatically started on import
        logSecurityEvent({
          type: 'SECURITY_FRAMEWORK_INITIALIZED',
          severity: ErrorSeverity.MEDIUM,
          details: 'Security framework successfully initialized',
          timestamp: new Date()
        });
      }

      this.initialized = true;

    } catch (error) {
      logSecurityEvent({
        type: 'SECURITY_FRAMEWORK_INIT_FAILED',
        severity: ErrorSeverity.CRITICAL,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): SecurityFrameworkConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<SecurityFrameworkConfig>): void {
    this.config = { ...this.config, ...updates };
    
    logSecurityEvent({
      type: 'SECURITY_CONFIG_UPDATED',
      severity: ErrorSeverity.MEDIUM,
      details: 'Security framework configuration updated',
      timestamp: new Date()
    });
  }

  /**
   * Get security health status
   */
  public getHealthStatus(): {
    healthy: boolean;
    components: Record<string, { status: 'UP' | 'DOWN' | 'DEGRADED'; message?: string }>;
    metrics: any;
  } {
    const components = {
      authentication: { status: 'UP' as const },
      sessionManagement: { status: 'UP' as const },
      rateLimiting: { status: 'UP' as const },
      monitoring: { status: 'UP' as const },
      ferpaCompliance: { status: 'UP' as const },
      rowLevelSecurity: { status: 'UP' as const }
    };

    // In production, check actual component health
    const allHealthy = Object.values(components).every(c => c.status === 'UP');

    return {
      healthy: allHealthy,
      components,
      metrics: securityMonitor.getMetrics()
    };
  }

  /**
   * Emergency security lockdown
   */
  public async emergencyLockdown(reason: string, initiatedBy: string): Promise<void> {
    logSecurityEvent({
      type: 'EMERGENCY_LOCKDOWN_INITIATED',
      severity: ErrorSeverity.CRITICAL,
      initiatedBy,
      reason,
      timestamp: new Date()
    });

    // Implement emergency procedures
    // - Revoke all active sessions
    // - Disable non-essential endpoints
    // - Increase monitoring sensitivity
    // - Send immediate alerts

    // This would be implemented based on specific emergency procedures
  }
}

/**
 * Default security framework instance
 */
export const securityFramework = SecurityFramework.getInstance();

/**
 * Security utilities and helpers
 */
export const SecurityUtils = {
  /**
   * Validate educational interest for data access
   */
  validateEducationalInterest: (
    interest: EducationalInterestLevel,
    dataClass: FERPADataClass
  ): boolean => {
    switch (dataClass) {
      case FERPADataClass.PUBLIC:
        return true;
      case FERPADataClass.EDUCATIONAL_RECORD:
        return interest !== EducationalInterestLevel.NONE;
      case FERPADataClass.PII:
        return interest === EducationalInterestLevel.DIRECT || 
               interest === EducationalInterestLevel.ADMINISTRATIVE;
      case FERPADataClass.SENSITIVE_PII:
        return interest === EducationalInterestLevel.ADMINISTRATIVE;
      default:
        return false;
    }
  },

  /**
   * Generate secure random token
   */
  generateSecureToken: (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Hash sensitive data
   */
  hashSensitiveData: (data: string): string => {
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  /**
   * Check if endpoint requires authentication
   */
  requiresAuthentication: (path: string): boolean => {
    const publicPaths = ['/api/health', '/api/auth/login', '/api/auth/register'];
    return !publicPaths.some(publicPath => path.startsWith(publicPath));
  },

  /**
   * Get security score for request
   */
  calculateSecurityScore: (context: RequestSecurityContext): number => {
    let score = 100;
    
    // Deduct points for various risk factors
    if (context.threats.length > 0) score -= context.threats.length * 10;
    if (!context.authenticated && SecurityUtils.requiresAuthentication(context.path)) score -= 20;
    if (context.userAgent === 'unknown') score -= 5;
    if (!context.origin) score -= 5;
    
    return Math.max(0, score);
  }
};

/**
 * Export convenience functions for common operations
 */
export const authenticate = authMiddleware;
export const checkRateLimit = rateLimiter.checkLimit.bind(rateLimiter);
export const validateInput = InputValidator.validateStudentData;
export const sanitizeHTML = InputSanitizer.sanitizeHTML;
export const applyRLS = rowLevelSecurityService.applyRLS.bind(rowLevelSecurityService);
export const encryptPII = ferpaComplianceService.encryptPII.bind(ferpaComplianceService);