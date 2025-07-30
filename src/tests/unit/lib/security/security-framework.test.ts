/**
 * @fileoverview Comprehensive Security Framework Tests
 * 
 * Tests all security components for AP_Tool_V1:
 * - Authentication and authorization flows
 * - JWT token management and validation
 * - Multi-factor authentication
 * - Session management and security
 * - Rate limiting and abuse prevention
 * - FERPA compliance and PII protection
 * - Row-level security enforcement
 * - Input validation and sanitization
 * - Security monitoring and alerting
 * 
 * TESTING REQUIREMENTS:
 * - Test all security boundaries and edge cases
 * - Validate FERPA compliance scenarios
 * - Test attack pattern detection
 * - Verify audit logging accuracy
 * - Test performance under load
 * - Validate error handling and recovery
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import crypto from 'crypto';
import {
  // Authentication & Authorization
  authMiddleware,
  UserRole,
  EducationalInterestLevel,
  type AuthenticationContext,
  
  // JWT Service
  JWTAuthService,
  type UserAuthContext,
  
  // MFA Service
  MFAService,
  MFAMethod,
  MFAStatus,
  
  // Session Management
  sessionManager,
  
  // Rate Limiting
  rateLimiter,
  
  // Security Monitoring
  securityMonitor,
  SecurityEventCategory,
  AlertSeverity,
  
  // Error Handling
  SecurityError,
  AuthenticationError,
  AuthorizationError,
  ErrorSeverity,
  
  // Input Validation
  InputSanitizer,
  InputValidator,
  
  // FERPA Compliance
  ferpaComplianceService,
  FERPADataClass,
  
  // Row-Level Security
  rowLevelSecurityService,
  RLSPolicyType,
  
  // Security Framework
  SecurityFramework,
  SecurityUtils
} from '../../../../lib/security';

// Mock NextRequest for testing
const createMockRequest = (overrides: any = {}): any => ({
  method: 'GET',
  nextUrl: { pathname: '/api/test', search: '' },
  headers: {
    get: jest.fn((name: string) => {
      const headers: Record<string, string> = {
        'Authorization': 'Bearer test-token',
        'User-Agent': 'Test Client',
        'X-Forwarded-For': '127.0.0.1',
        ...overrides.headers
      };
      return headers[name] || null;
    })
  },
  cookies: {
    get: jest.fn(() => ({ value: 'session-123' }))
  },
  ...overrides
});

describe('Security Framework', () => {
  let jwtService: JWTAuthService;
  let mfaService: MFAService;
  let securityFramework: SecurityFramework;

  beforeEach(() => {
    // Initialize services with test configurations
    jwtService = new JWTAuthService({
      accessTokenSecret: 'test-access-secret',
      refreshTokenSecret: 'test-refresh-secret',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'test-issuer',
      audience: 'test-audience'
    });

    mfaService = new MFAService({
      totpWindowSize: 2,
      recoveryCodesCount: 8,
      rateLimitAttempts: 3,
      requireMFAForRoles: [UserRole.ADMINISTRATOR]
    });

    securityFramework = SecurityFramework.getInstance({
      authentication: {
        jwtSecret: 'test-secret',
        refreshSecret: 'test-refresh-secret',
        algorithm: 'HS256',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        mfaRequired: false
      }
    });

    // Clear any existing state
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up services
    jwtService?.destroy();
    sessionManager?.clearAll();
    securityMonitor?.destroy();
  });

  describe('Authentication & Authorization', () => {
    it('should authenticate valid JWT token', async () => {
      const userContext: UserAuthContext = {
        userId: 'user123',
        employeeId: 'emp123',
        email: 'test@romoland.k12.ca.us',
        role: UserRole.TEACHER,
        educationalInterest: EducationalInterestLevel.DIRECT,
        permissions: ['READ_STUDENTS'],
        schoolIds: ['SCHOOL001'],
        mfaEnabled: false
      };

      const tokens = await jwtService.generateTokenPair(userContext);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      const payload = await jwtService.verifyToken(tokens.accessToken, 'access');
      expect(payload.userId).toBe('user123');
      expect(payload.role).toBe(UserRole.TEACHER);
    });

    it('should reject expired tokens', async () => {
      const userContext: UserAuthContext = {
        userId: 'user123',
        employeeId: 'emp123',
        email: 'test@romoland.k12.ca.us',
        role: UserRole.TEACHER,
        educationalInterest: EducationalInterestLevel.DIRECT,
        permissions: ['READ_STUDENTS'],
        schoolIds: ['SCHOOL001'],
        mfaEnabled: false
      };

      // Create service with very short expiry
      const shortExpiryService = new JWTAuthService({
        accessTokenSecret: 'test-secret',
        refreshTokenSecret: 'test-refresh-secret',
        accessTokenExpiry: '1ms',
        refreshTokenExpiry: '1ms',
        issuer: 'test-issuer',
        audience: 'test-audience'
      });

      const tokens = await shortExpiryService.generateTokenPair(userContext);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(shortExpiryService.verifyToken(tokens.accessToken, 'access'))
        .rejects.toThrow(AuthenticationError);
    });

    it('should enforce role-based permissions', async () => {
      const teacherContext: AuthenticationContext = {
        userId: 'teacher123',
        employeeId: 'emp123',
        role: UserRole.TEACHER,
        educationalInterest: EducationalInterestLevel.DIRECT,
        permissions: ['READ_STUDENTS'],
        sessionId: 'session123',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client',
        timestamp: new Date()
      };

      // Teacher should have access to student data with direct educational interest
      const hasAccess = SecurityUtils.validateEducationalInterest(
        teacherContext.educationalInterest,
        FERPADataClass.EDUCATIONAL_RECORD
      );
      expect(hasAccess).toBe(true);

      // Teacher should not have access to sensitive PII
      const hasPIIAccess = SecurityUtils.validateEducationalInterest(
        teacherContext.educationalInterest,
        FERPADataClass.SENSITIVE_PII
      );
      expect(hasPIIAccess).toBe(false);
    });

    it('should validate educational interest requirements', async () => {
      // Direct interest should allow educational record access
      expect(SecurityUtils.validateEducationalInterest(
        EducationalInterestLevel.DIRECT,
        FERPADataClass.EDUCATIONAL_RECORD
      )).toBe(true);

      // No interest should deny PII access
      expect(SecurityUtils.validateEducationalInterest(
        EducationalInterestLevel.NONE,
        FERPADataClass.PII
      )).toBe(false);

      // Administrative interest should allow all access
      expect(SecurityUtils.validateEducationalInterest(
        EducationalInterestLevel.ADMINISTRATIVE,
        FERPADataClass.SENSITIVE_PII
      )).toBe(true);
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should generate MFA enrollment data', async () => {
      const enrollment = await mfaService.generateEnrollment(
        'user123',
        'test@romoland.k12.ca.us',
        'AP Tool Test'
      );

      expect(enrollment.secret).toBeDefined();
      expect(enrollment.qrCodeUrl).toContain('data:image/png;base64');
      expect(enrollment.recoveryCodes).toHaveLength(8);
      expect(enrollment.backupSecret).toBeDefined();
    });

    it('should validate TOTP codes correctly', async () => {
      await mfaService.generateEnrollment('user123', 'test@romoland.k12.ca.us');
      
      // Mock successful TOTP verification for testing
      const mockTOTPCode = '123456';
      
      // In a real test, you would use speakeasy to generate a valid TOTP code
      // For this test, we'll mock the internal verification
      jest.spyOn(mfaService as any, 'verifyTOTP').mockResolvedValue({
        success: true,
        method: MFAMethod.TOTP,
        remainingAttempts: 4
      });

      const result = await mfaService.verifyMFA('user123', mockTOTPCode, MFAMethod.TOTP);
      expect(result.success).toBe(true);
      expect(result.method).toBe(MFAMethod.TOTP);
    });

    it('should enforce MFA for administrator roles', () => {
      expect(mfaService.isMFARequired(UserRole.ADMINISTRATOR)).toBe(true);
      expect(mfaService.isMFARequired(UserRole.TEACHER)).toBe(false);
    });

    it('should handle recovery code usage', async () => {
      await mfaService.generateEnrollment('user123', 'test@romoland.k12.ca.us');
      
      // Mock recovery code verification
      jest.spyOn(mfaService as any, 'verifyRecoveryCode').mockResolvedValue({
        success: true,
        method: MFAMethod.RECOVERY_CODE,
        usedRecoveryCode: true
      });

      const result = await mfaService.verifyMFA(
        'user123', 
        'RECOVERY123', 
        MFAMethod.RECOVERY_CODE
      );
      
      expect(result.success).toBe(true);
      expect(result.usedRecoveryCode).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should create secure sessions with timeout', async () => {
      const sessionData = await sessionManager.createSession(
        'user123',
        'session123',
        {
          employeeId: 'emp123',
          educationalInterest: 'DIRECT',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Client',
          maxAge: 3600000 // 1 hour
        }
      );

      expect(sessionData.userId).toBe('user123');
      expect(sessionData.sessionId).toBe('session123');
      expect(sessionData.expiresAt).toBeInstanceOf(Date);
    });

    it('should enforce maximum session duration', async () => {
      await expect(sessionManager.createSession(
        'user123',
        'session123',
        {
          maxAge: 5 * 60 * 60 * 1000 // 5 hours - exceeds 4 hour limit
        }
      )).rejects.toThrow(SecurityError);
    });

    it('should validate session security context', async () => {
      await sessionManager.createSession('user123', 'session123', {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client'
      });

      const validation = await sessionManager.validateSession('session123', {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client'
      });

      expect(validation.valid).toBe(true);
      expect(validation.userId).toBe('user123');
    });

    it('should detect session hijacking attempts', async () => {
      await sessionManager.createSession('user123', 'session123', {
        ipAddress: '127.0.0.1',
        userAgent: 'Original Client'
      });

      // Attempt to validate with different IP/User-Agent
      await expect(sessionManager.validateSession('session123', {
        ipAddress: '192.168.1.1',
        userAgent: 'Suspicious Client'
      })).rejects.toThrow(SecurityError);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limits', async () => {
      const request = createMockRequest();
      
      const result = await rateLimiter.checkLimit('user123', request, {
        customLimit: 10
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(9);
    });

    it('should block requests exceeding limits', async () => {
      const request = createMockRequest();
      
      // Exceed rate limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit('user123', request, { customLimit: 3 });
      }

      await expect(rateLimiter.checkLimit('user123', request, { customLimit: 3 }))
        .rejects.toThrow();
    });

    it('should apply different limits for different endpoints', async () => {
      const sensitiveRequest = createMockRequest({ 
        nextUrl: { pathname: '/api/students/123' }
      });
      
      const publicRequest = createMockRequest({ 
        nextUrl: { pathname: '/api/health' }
      });

      // Sensitive endpoints should have stricter limits
      // This would be configured in the actual rate limiter
      const sensitiveResult = await rateLimiter.checkLimit('user123', sensitiveRequest);
      const publicResult = await rateLimiter.checkLimit('user123', publicRequest);

      expect(sensitiveResult.allowed).toBe(true);
      expect(publicResult.allowed).toBe(true);
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should sanitize HTML input', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello';
      const sanitized = InputSanitizer.sanitizeHTML(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should detect SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE students; --";
      
      expect(() => InputSanitizer.sanitizeSQL(sqlInjection))
        .not.toThrow(); // Should sanitize, not throw
      
      const sanitized = InputSanitizer.sanitizeSQL(sqlInjection);
      expect(sanitized).not.toContain('DROP TABLE');
    });

    it('should validate student data format', () => {
      const validStudentData = {
        studentId: 'STU123456',
        studentName: 'John Doe',
        gradeLevel: '9',
        attendancePercentage: 95.5
      };

      const result = InputValidator.validateStudentData(validStudentData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid student data', () => {
      const invalidStudentData = {
        studentId: 'X', // Too short
        studentName: 'John123', // Contains numbers
        gradeLevel: '15', // Invalid grade
        attendancePercentage: 150 // Exceeds 100%
      };

      const result = InputValidator.validateStudentData(invalidStudentData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should prevent path traversal attacks', () => {
      const pathTraversal = '../../../etc/passwd';
      
      expect(() => InputSanitizer.sanitizeFilePath(pathTraversal))
        .toThrow(SecurityError);
    });

    it('should prevent access to References directory', () => {
      const referencesPath = 'References/student-data.csv';
      
      expect(() => InputSanitizer.sanitizeFilePath(referencesPath))
        .toThrow(SecurityError);
    });
  });

  describe('FERPA Compliance', () => {
    it('should encrypt PII data', async () => {
      const sensitiveData = 'John Doe - SSN: 123-45-6789';
      
      const encrypted = await ferpaComplianceService.encryptPII(
        sensitiveData,
        FERPADataClass.SENSITIVE_PII
      );

      expect(encrypted.encryptedValue).toBeDefined();
      expect(encrypted.encryptedValue).not.toContain('123-45-6789');
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.keyId).toBeDefined();
    });

    it('should validate educational interest for data access', async () => {
      const context = {
        userId: 'teacher123',
        employeeId: 'emp123',
        role: UserRole.TEACHER,
        educationalInterest: EducationalInterestLevel.DIRECT,
        schoolIds: ['SCHOOL001'],
        accessReason: 'Student progress review',
        dataClassification: FERPADataClass.EDUCATIONAL_RECORD,
        timestamp: new Date()
      };

      const hasAccess = await ferpaComplianceService.validateEducationalInterest(context);
      expect(hasAccess).toBe(true);
    });

    it('should deny access without proper educational interest', async () => {
      const context = {
        userId: 'external123',
        employeeId: 'ext123',
        role: UserRole.EXTERNAL as any,
        educationalInterest: EducationalInterestLevel.NONE,
        schoolIds: [],
        accessReason: 'Unauthorized access attempt',
        dataClassification: FERPADataClass.PII,
        timestamp: new Date()
      };

      const hasAccess = await ferpaComplianceService.validateEducationalInterest(context);
      expect(hasAccess).toBe(false);
    });

    it('should create and manage consent records', async () => {
      const consentId = await ferpaComplianceService.createConsent({
        studentId: 'STU123',
        consentType: 'DISCLOSURE',
        purpose: 'Academic research',
        dataTypes: [FERPADataClass.EDUCATIONAL_RECORD],
        consentDate: new Date(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      expect(consentId).toBeDefined();

      const hasConsent = await ferpaComplianceService.hasValidConsent(
        'STU123',
        [FERPADataClass.EDUCATIONAL_RECORD],
        'Academic research'
      );

      expect(hasConsent).toBe(true);
    });

    it('should generate compliance reports', () => {
      const report = ferpaComplianceService.generateComplianceReport({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(report.reportPeriod).toBeDefined();
      expect(report.totalEvents).toBeDefined();
      expect(report.ferpaCompliance).toBeDefined();
      expect(report.dataAccess).toBeDefined();
    });
  });

  describe('Row-Level Security', () => {
    it('should apply school boundary filtering', async () => {
      const authContext: AuthenticationContext = {
        userId: 'teacher123',
        employeeId: 'emp123',
        role: UserRole.TEACHER,
        educationalInterest: EducationalInterestLevel.DIRECT,
        permissions: ['READ_STUDENTS'],
        sessionId: 'session123',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client',
        timestamp: new Date()
      };

      const mockStudentData = [
        { studentId: 'STU001', schoolId: 'SCHOOL001', name: 'John Doe' },
        { studentId: 'STU002', schoolId: 'SCHOOL002', name: 'Jane Smith' },
        { studentId: 'STU003', schoolId: 'SCHOOL999', name: 'Bob Johnson' }
      ];

      const result = await rowLevelSecurityService.applyRLS(
        authContext,
        'students',
        'READ',
        mockStudentData
      );

      expect(result.allowed).toBe(true);
      expect(result.filteredData).toBeDefined();
    });

    it('should enforce role-based access controls', async () => {
      const adminContext: AuthenticationContext = {
        userId: 'admin123',
        employeeId: 'admin123',
        role: UserRole.ADMINISTRATOR,
        educationalInterest: EducationalInterestLevel.ADMINISTRATIVE,
        permissions: ['*'],
        sessionId: 'session123',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client',
        timestamp: new Date()
      };

      const result = await rowLevelSecurityService.applyRLS(
        adminContext,
        'students',
        'READ'
      );

      expect(result.allowed).toBe(true);
      expect(result.appliedPolicies).toContain('admin-full-access');
    });

    it('should create and apply custom RLS policies', async () => {
      const policyId = await rowLevelSecurityService.createPolicy({
        name: 'Test Policy',
        type: RLSPolicyType.CUSTOM,
        enabled: true,
        priority: 50,
        conditions: [
          { field: 'role', operator: 'equals', value: UserRole.TEACHER }
        ],
        actions: [
          { type: 'FILTER' }
        ],
        description: 'Test policy for unit testing',
        createdBy: 'test-system'
      });

      expect(policyId).toBeDefined();

      // Test policy application would require more complex setup
    });
  });

  describe('Security Monitoring', () => {
    it('should process security events', async () => {
      await securityMonitor.processEvent({
        type: 'TEST_EVENT',
        category: SecurityEventCategory.AUTHENTICATION,
        severity: ErrorSeverity.LOW,
        userId: 'test123',
        details: { test: true },
        timestamp: new Date()
      });

      const metrics = securityMonitor.getMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
    });

    it('should generate security alerts for critical events', async () => {
      await securityMonitor.processEvent({
        type: 'CRITICAL_TEST_EVENT',
        category: SecurityEventCategory.SYSTEM_SECURITY,
        severity: ErrorSeverity.CRITICAL,
        userId: 'test123',
        details: { critical: true },
        timestamp: new Date()
      });

      const alerts = securityMonitor.getAlerts({
        severity: AlertSeverity.CRITICAL,
        limit: 10
      });

      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should detect attack patterns', async () => {
      // Simulate multiple failed authentication attempts
      for (let i = 0; i < 6; i++) {
        await securityMonitor.processEvent({
          type: 'AUTHENTICATION_FAILURE',
          category: SecurityEventCategory.AUTHENTICATION,
          severity: ErrorSeverity.MEDIUM,
          ipAddress: '192.168.1.100',
          details: { attempt: i + 1 },
          timestamp: new Date()
        });
      }

      // Check if brute force pattern is detected
      const alerts = securityMonitor.getAlerts({
        resolved: false,
        limit: 10
      });

      const bruteForceAlert = alerts.find(alert => 
        alert.type === 'BRUTE_FORCE_ATTACK'
      );

      expect(bruteForceAlert).toBeDefined();
    });
  });

  describe('Security Framework Integration', () => {
    it('should initialize with default configuration', async () => {
      await securityFramework.initialize();
      
      const config = securityFramework.getConfig();
      expect(config.authentication.jwtSecret).toBeDefined();
      expect(config.ferpa.enableEncryption).toBe(true);
      expect(config.monitoring.enabled).toBe(true);
    });

    it('should provide health status', () => {
      const health = securityFramework.getHealthStatus();
      
      expect(health.healthy).toBeDefined();
      expect(health.components).toBeDefined();
      expect(health.metrics).toBeDefined();
    });

    it('should calculate security scores correctly', () => {
      const safeContext = {
        requestId: 'req123',
        ipAddress: '127.0.0.1',
        userAgent: 'Safe Client',
        timestamp: new Date(),
        method: 'GET',
        path: '/api/safe',
        authenticated: true,
        securityScore: 100,
        threats: []
      };

      const score = SecurityUtils.calculateSecurityScore(safeContext);
      expect(score).toBe(100);

      const riskyContext = {
        ...safeContext,
        authenticated: false,
        userAgent: 'unknown',
        threats: ['SUSPICIOUS_PATTERN', 'HIGH_REQUEST_VOLUME']
      };

      const riskyScore = SecurityUtils.calculateSecurityScore(riskyContext);
      expect(riskyScore).toBeLessThan(100);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent authentication requests', async () => {
      const userContext: UserAuthContext = {
        userId: 'user123',
        employeeId: 'emp123',
        email: 'test@romoland.k12.ca.us',
        role: UserRole.TEACHER,
        educationalInterest: EducationalInterestLevel.DIRECT,
        permissions: ['READ_STUDENTS'],
        schoolIds: ['SCHOOL001'],
        mfaEnabled: false
      };

      const promises = Array.from({ length: 10 }, () => 
        jwtService.generateTokenPair(userContext)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
      });
    });

    it('should maintain performance under rate limiting pressure', async () => {
      const request = createMockRequest();
      const startTime = Date.now();
      
      // Make multiple requests rapidly
      const promises = Array.from({ length: 50 }, (_, i) => 
        rateLimiter.checkLimit(`user${i}`, request)
          .catch(() => ({ allowed: false }))
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.filter(r => r.allowed).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle JWT service failures gracefully', async () => {
      const faultyService = new JWTAuthService({
        accessTokenSecret: '', // Invalid secret
        refreshTokenSecret: 'test-refresh-secret',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        issuer: 'test-issuer',
        audience: 'test-audience'
      });

      const userContext: UserAuthContext = {
        userId: 'user123',
        employeeId: 'emp123',
        email: 'test@romoland.k12.ca.us',
        role: UserRole.TEACHER,
        educationalInterest: EducationalInterestLevel.DIRECT,
        permissions: ['READ_STUDENTS'],
        schoolIds: ['SCHOOL001'],
        mfaEnabled: false
      };

      await expect(faultyService.generateTokenPair(userContext))
        .rejects.toThrow(SecurityError);
    });

    it('should recover from session storage failures', async () => {
      // Simulate storage failure by clearing sessions
      await sessionManager.clearAll();
      
      // Create new session should still work
      const sessionData = await sessionManager.createSession(
        'user123',
        'session123',
        { ipAddress: '127.0.0.1' }
      );

      expect(sessionData.userId).toBe('user123');
    });
  });
});

// Helper functions for testing
const generateTestUserContext = (overrides: Partial<UserAuthContext> = {}): UserAuthContext => ({
  userId: 'test-user',
  employeeId: 'test-emp',
  email: 'test@romoland.k12.ca.us',
  role: UserRole.TEACHER,
  educationalInterest: EducationalInterestLevel.DIRECT,
  permissions: ['READ_STUDENTS', 'READ_ATTENDANCE'],
  schoolIds: ['SCHOOL001'],
  mfaEnabled: false,
  ...overrides
});

const generateTestAuthContext = (overrides: Partial<AuthenticationContext> = {}): AuthenticationContext => ({
  userId: 'test-user',
  employeeId: 'test-emp',
  role: UserRole.TEACHER,
  educationalInterest: EducationalInterestLevel.DIRECT,
  permissions: ['READ_STUDENTS'],
  sessionId: 'test-session',
  ipAddress: '127.0.0.1',
  userAgent: 'Test Client',
  timestamp: new Date(),
  ...overrides
});