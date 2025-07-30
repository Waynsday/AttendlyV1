/**
 * @fileoverview Comprehensive Security Middleware for AP_Tool_V1
 * 
 * Implements layered security controls:
 * - Request sanitization and validation
 * - Security headers enforcement
 * - CSRF protection
 * - Rate limiting with sophisticated algorithms
 * - Request/response monitoring
 * - Attack pattern detection
 * - Educational data protection
 * 
 * SECURITY REQUIREMENTS:
 * - OWASP ASVS L2 compliance
 * - FERPA educational data protection
 * - Defense in depth architecture
 * - Real-time threat detection
 * - Comprehensive audit logging
 * - Zero-trust security model
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  SecurityError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  logSecurityEvent,
  ErrorSeverity,
  createSecureErrorResponse
} from './error-handler';
import { authMiddleware, AuthenticationContext } from './auth-middleware';
import { rateLimiter } from './rate-limiter';
import { sessionManager } from './session-manager';
import { securityMonitor } from './security-monitor';
import { InputSanitizer, InputValidator } from './input-validator';
import { ferpaComplianceService, FERPADataClass } from './ferpa-compliance';

/**
 * Security middleware configuration
 */
export interface SecurityMiddlewareConfig {
  enableCSRFProtection: boolean;
  enableRateLimiting: boolean;
  enableRequestSanitization: boolean;
  enableSecurityHeaders: boolean;
  enableFERPAValidation: boolean;
  enableAttackDetection: boolean;
  trustedOrigins: string[];
  maxRequestSize: number; // bytes
  allowedMethods: string[];
  sensitiveEndpoints: string[];
  publicEndpoints: string[];
  csrfTokenHeader: string;
  sessionCookieName: string;
}

/**
 * Request security context
 */
export interface RequestSecurityContext {
  requestId: string;
  ipAddress: string;
  userAgent: string;
  origin?: string;
  referer?: string;
  timestamp: Date;
  method: string;
  path: string;
  authenticated: boolean;
  authContext?: AuthenticationContext;
  securityScore: number;
  threats: string[];
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  allowed: boolean;
  context: RequestSecurityContext;
  headers: Record<string, string>;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive Security Middleware
 */
export class SecurityMiddleware {
  private config: SecurityMiddlewareConfig;
  private csrfTokens: Map<string, { token: string; expiry: Date }> = new Map();
  private suspiciousIPs: Set<string> = new Set();
  private requestCount: Map<string, number> = new Map();

  constructor(config: Partial<SecurityMiddlewareConfig> = {}) {
    this.config = {
      enableCSRFProtection: true,
      enableRateLimiting: true,
      enableRequestSanitization: true,
      enableSecurityHeaders: true,
      enableFERPAValidation: true,
      enableAttackDetection: true,
      trustedOrigins: ['https://ap-tool.romoland.k12.ca.us'],
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      sensitiveEndpoints: ['/api/students', '/api/attendance', '/api/interventions'],
      publicEndpoints: ['/api/health', '/api/auth/login'],
      csrfTokenHeader: 'X-CSRF-Token',
      sessionCookieName: 'ap-tool-session',
      ...config
    };

    // Start cleanup intervals
    this.startCleanupTasks();
  }

  /**
   * Main middleware handler
   */
  async handleRequest(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    let securityContext: RequestSecurityContext;
    let response: NextResponse;

    try {
      // 1. Initialize security context
      securityContext = await this.initializeSecurityContext(request);
      
      // 2. Perform security validations
      const validationResult = await this.validateRequest(request, securityContext);
      
      if (!validationResult.allowed) {
        return this.createSecurityErrorResponse(
          new SecurityError('Request blocked by security middleware', {
            severity: ErrorSeverity.HIGH,
            errors: validationResult.errors,
            timestamp: new Date()
          }),
          securityContext
        );
      }

      // 3. Process request through security layers
      response = await this.processSecureRequest(request, securityContext);

      // 4. Apply security headers
      if (this.config.enableSecurityHeaders) {
        this.applySecurityHeaders(response, securityContext);
      }

      // 5. Log successful request
      const duration = Date.now() - startTime;
      await securityMonitor.processEvent({
        type: 'REQUEST_PROCESSED',
        category: 'SYSTEM_SECURITY',
        severity: ErrorSeverity.LOW,
        userId: securityContext.authContext?.userId,
        ipAddress: securityContext.ipAddress,
        userAgent: securityContext.userAgent,
        resource: securityContext.path,
        method: securityContext.method,
        correlationId: securityContext.requestId,
        details: { duration, securityScore: securityContext.securityScore },
        timestamp: new Date()
      });

      return response;

    } catch (error) {
      // Handle security errors
      const duration = Date.now() - startTime;
      
      if (error instanceof SecurityError || 
          error instanceof AuthenticationError || 
          error instanceof AuthorizationError ||
          error instanceof RateLimitError) {
        
        // Log security incident
        await securityMonitor.processEvent({
          type: 'SECURITY_VIOLATION',
          category: 'SYSTEM_SECURITY',
          severity: (error as any).severity || ErrorSeverity.HIGH,
          userId: securityContext?.authContext?.userId,
          ipAddress: securityContext?.ipAddress,
          userAgent: securityContext?.userAgent,
          resource: securityContext?.path,
          method: securityContext?.method,
          correlationId: securityContext?.requestId,
          details: { 
            error: error.message, 
            errorType: error.constructor.name,
            duration 
          },
          timestamp: new Date()
        });

        return this.createSecurityErrorResponse(error, securityContext);
      }

      // Handle unexpected errors
      logSecurityEvent({
        type: 'MIDDLEWARE_ERROR',
        severity: ErrorSeverity.CRITICAL,
        error: error instanceof Error ? error.message : String(error),
        correlationId: securityContext?.requestId,
        timestamp: new Date()
      });

      return NextResponse.json(
        createSecureErrorResponse(
          new SecurityError('Security middleware error'),
          { requestId: securityContext?.requestId }
        ),
        { status: 500 }
      );
    }
  }

  /**
   * Initialize security context for request
   */
  private async initializeSecurityContext(request: NextRequest): Promise<RequestSecurityContext> {
    const requestId = crypto.randomUUID();
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');
    const method = request.method;
    const path = request.nextUrl.pathname;
    
    // Calculate initial security score
    let securityScore = 100;
    const threats: string[] = [];

    // Check for suspicious IP
    if (this.suspiciousIPs.has(ipAddress)) {
      securityScore -= 20;
      threats.push('SUSPICIOUS_IP');
    }

    // Check for suspicious user agent
    if (this.isSuspiciousUserAgent(userAgent)) {
      securityScore -= 15;
      threats.push('SUSPICIOUS_USER_AGENT');
    }

    // Check for unusual request patterns
    const requestCount = this.requestCount.get(ipAddress) || 0;
    if (requestCount > 100) { // More than 100 requests from same IP
      securityScore -= 10;
      threats.push('HIGH_REQUEST_VOLUME');
    }

    return {
      requestId,
      ipAddress,
      userAgent,
      origin,
      referer,
      timestamp: new Date(),
      method,
      path,
      authenticated: false,
      securityScore,
      threats
    };
  }

  /**
   * Validate request security
   */
  private async validateRequest(
    request: NextRequest, 
    context: RequestSecurityContext
  ): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const headers: Record<string, string> = {};

    // 1. Method validation
    if (!this.config.allowedMethods.includes(context.method)) {
      errors.push(`HTTP method ${context.method} not allowed`);
    }

    // 2. Request size validation
    const contentLength = parseInt(request.headers.get('Content-Length') || '0');
    if (contentLength > this.config.maxRequestSize) {
      errors.push('Request size exceeds maximum allowed');
    }

    // 3. Origin validation for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(context.method)) {
      if (!this.isOriginTrusted(context.origin)) {
        errors.push('Untrusted origin for state-changing request');
      }
    }

    // 4. Rate limiting
    if (this.config.enableRateLimiting && !this.isPublicEndpoint(context.path)) {
      try {
        const rateLimitResult = await rateLimiter.checkIPLimit(context.ipAddress, request);
        
        if (!rateLimitResult.allowed) {
          errors.push('Rate limit exceeded');
        }
        
        // Add rate limit headers
        if (rateLimitResult.headers) {
          Object.assign(headers, rateLimitResult.headers);
        }
      } catch (error) {
        if (error instanceof RateLimitError) {
          errors.push('Rate limit exceeded');
        }
      }
    }

    // 5. CSRF protection for state-changing requests
    if (this.config.enableCSRFProtection && 
        ['POST', 'PUT', 'DELETE', 'PATCH'].includes(context.method) &&
        !this.isPublicEndpoint(context.path)) {
      
      const csrfValid = await this.validateCSRFToken(request, context);
      if (!csrfValid) {
        errors.push('Invalid CSRF token');
      }
    }

    // 6. Input sanitization validation
    if (this.config.enableRequestSanitization) {
      const sanitationResult = await this.validateInputSanitation(request);
      if (!sanitationResult.valid) {
        errors.push(...sanitationResult.errors);
      }
    }

    // 7. Attack pattern detection
    if (this.config.enableAttackDetection) {
      const threats = await this.detectAttackPatterns(request, context);
      if (threats.length > 0) {
        context.threats.push(...threats);
        context.securityScore -= threats.length * 5;
        warnings.push(`Potential threats detected: ${threats.join(', ')}`);
      }
    }

    return {
      allowed: errors.length === 0 && context.securityScore > 50,
      context,
      headers,
      errors,
      warnings
    };
  }

  /**
   * Process request through security layers
   */
  private async processSecureRequest(
    request: NextRequest, 
    context: RequestSecurityContext
  ): Promise<NextResponse> {
    // Handle authentication for protected endpoints
    if (!this.isPublicEndpoint(context.path)) {
      try {
        const authContext = await authMiddleware(request);
        context.authenticated = true;
        context.authContext = authContext;
        context.securityScore += 10; // Boost score for authenticated requests

        // Apply user-specific rate limiting
        if (this.config.enableRateLimiting) {
          await rateLimiter.checkLimit(authContext.userId, request);
        }

        // FERPA validation for sensitive endpoints
        if (this.config.enableFERPAValidation && this.isSensitiveEndpoint(context.path)) {
          await this.validateFERPACompliance(request, authContext);
        }

      } catch (error) {
        if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
          throw error;
        }
        
        // Log unexpected authentication error
        logSecurityEvent({
          type: 'AUTHENTICATION_ERROR',
          severity: ErrorSeverity.HIGH,
          error: error instanceof Error ? error.message : String(error),
          correlationId: context.requestId,
          timestamp: new Date()
        });
        
        throw new AuthenticationError('Authentication processing failed');
      }
    }

    // Continue with request processing (this would normally call the next middleware)
    return NextResponse.next();
  }

  /**
   * Apply security headers to response
   */
  private applySecurityHeaders(response: NextResponse, context: RequestSecurityContext): void {
    // Security headers for all responses
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Request-ID', context.requestId);
    
    // HSTS for HTTPS requests
    if (context.origin?.startsWith('https://')) {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Adjust based on needs
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'"
    ].join('; ');
    response.headers.set('Content-Security-Policy', csp);

    // Educational data protection headers
    if (this.isSensitiveEndpoint(context.path)) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('X-Educational-Data', 'protected');
    }
  }

  /**
   * Validate CSRF token
   */
  private async validateCSRFToken(request: NextRequest, context: RequestSecurityContext): Promise<boolean> {
    const tokenFromHeader = request.headers.get(this.config.csrfTokenHeader);
    const sessionCookie = request.cookies.get(this.config.sessionCookieName);
    
    if (!tokenFromHeader || !sessionCookie) {
      return false;
    }

    // Get stored token for session
    const storedTokenData = this.csrfTokens.get(sessionCookie.value);
    
    if (!storedTokenData || storedTokenData.expiry < new Date()) {
      return false;
    }

    return storedTokenData.token === tokenFromHeader;
  }

  /**
   * Validate input sanitation
   */
  private async validateInputSanitation(request: NextRequest): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate query parameters
      const params = Object.fromEntries(request.nextUrl.searchParams.entries());
      const paramValidation = InputValidator.validateQueryParams(params);
      
      if (!paramValidation.isValid) {
        errors.push(...paramValidation.errors);
      }

      // Validate request body if present
      if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        // Clone request to read body without consuming it
        const clonedRequest = request.clone();
        const body = await clonedRequest.json().catch(() => null);
        
        if (body) {
          // Apply input sanitization
          for (const [key, value] of Object.entries(body)) {
            if (typeof value === 'string') {
              try {
                InputSanitizer.sanitizeHTML(value);
                InputSanitizer.sanitizeSQL(value);
              } catch (error) {
                if (error instanceof SecurityError) {
                  errors.push(`Invalid input in field ${key}: ${error.message}`);
                }
              }
            }
          }
        }
      }

    } catch (error) {
      errors.push('Input validation failed');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Detect attack patterns in request
   */
  private async detectAttackPatterns(
    request: NextRequest, 
    context: RequestSecurityContext
  ): Promise<string[]> {
    const threats: string[] = [];
    const url = request.nextUrl.pathname + request.nextUrl.search;

    // SQL injection patterns
    const sqlPatterns = [
      /('|(\\'))|(-{2})|(\/\*[\s\S]*?\*\/)/gi,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(url)) {
        threats.push('SQL_INJECTION_ATTEMPT');
        break;
      }
    }

    // XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(url)) {
        threats.push('XSS_ATTEMPT');
        break;
      }
    }

    // Path traversal
    if (/\.\.\/|\.\.\\/.test(url)) {
      threats.push('PATH_TRAVERSAL_ATTEMPT');
    }

    // Command injection
    if (/[;&|`$(){}[\]]/.test(url)) {
      threats.push('COMMAND_INJECTION_ATTEMPT');
    }

    // Directory information exposure attempts
    if (/\/References\//i.test(url)) {
      threats.push('SENSITIVE_DIRECTORY_ACCESS');
    }

    return threats;
  }

  /**
   * Validate FERPA compliance for request
   */
  private async validateFERPACompliance(
    request: NextRequest, 
    authContext: AuthenticationContext
  ): Promise<void> {
    const path = request.nextUrl.pathname;
    let dataClassification = FERPADataClass.PUBLIC;

    // Determine data classification based on endpoint
    if (path.includes('/students/')) {
      dataClassification = FERPADataClass.PII;
    } else if (path.includes('/attendance/')) {
      dataClassification = FERPADataClass.EDUCATIONAL_RECORD;
    } else if (path.includes('/interventions/')) {
      dataClassification = FERPADataClass.EDUCATIONAL_RECORD;
    }

    // Validate educational interest
    const hasAccess = await ferpaComplianceService.validateEducationalInterest({
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      role: authContext.role,
      educationalInterest: authContext.educationalInterest,
      schoolIds: [], // Would be populated from user context
      accessReason: `API access to ${path}`,
      dataClassification,
      sessionId: authContext.sessionId,
      ipAddress: authContext.ipAddress,
      userAgent: authContext.userAgent,
      timestamp: new Date()
    });

    if (!hasAccess) {
      throw new AuthorizationError('Insufficient educational interest for requested data', {
        userId: authContext.userId,
        resource: path,
        educationalInterest: authContext.educationalInterest,
        resourceType: dataClassification
      });
    }
  }

  /**
   * Create security error response
   */
  private createSecurityErrorResponse(
    error: Error, 
    context?: RequestSecurityContext
  ): NextResponse {
    const errorResponse = createSecureErrorResponse(error, {
      requestId: context?.requestId,
      ipAddress: context?.ipAddress,
      timestamp: new Date()
    });

    let status = 500;
    if (error instanceof AuthenticationError) status = 401;
    else if (error instanceof AuthorizationError) status = 403;
    else if (error instanceof RateLimitError) status = 429;
    else if (error instanceof ValidationError) status = 400;

    const response = NextResponse.json(errorResponse, { status });

    // Add security headers even for error responses
    if (context) {
      this.applySecurityHeaders(response, context);
    }

    // Add retry-after header for rate limiting
    if (error instanceof RateLimitError) {
      const retryAfter = Math.ceil((error.resetTime.getTime() - Date.now()) / 1000);
      response.headers.set('Retry-After', retryAfter.toString());
    }

    return response;
  }

  /**
   * Utility methods
   */
  private getClientIP(request: NextRequest): string {
    return request.headers.get('X-Forwarded-For')?.split(',')[0] ||
           request.headers.get('X-Real-IP') ||
           request.headers.get('CF-Connecting-IP') ||
           'unknown';
  }

  private isOriginTrusted(origin?: string): boolean {
    if (!origin) return false;
    return this.config.trustedOrigins.some(trusted => origin.startsWith(trusted));
  }

  private isPublicEndpoint(path: string): boolean {
    return this.config.publicEndpoints.some(endpoint => path.startsWith(endpoint));
  }

  private isSensitiveEndpoint(path: string): boolean {
    return this.config.sensitiveEndpoints.some(endpoint => path.startsWith(endpoint));
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /python/i,
      /java/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Generate CSRF token for session
   */
  generateCSRFToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour
    
    this.csrfTokens.set(sessionId, { token, expiry });
    
    return token;
  }

  /**
   * Start cleanup tasks
   */
  private startCleanupTasks(): void {
    // Clean up expired CSRF tokens every 10 minutes
    setInterval(() => {
      const now = new Date();
      for (const [sessionId, tokenData] of this.csrfTokens.entries()) {
        if (tokenData.expiry < now) {
          this.csrfTokens.delete(sessionId);
        }
      }
    }, 600000);

    // Reset request counts every hour
    setInterval(() => {
      this.requestCount.clear();
    }, 3600000);
  }

  /**
   * Add suspicious IP to monitoring
   */
  addSuspiciousIP(ip: string): void {
    this.suspiciousIPs.add(ip);
    
    logSecurityEvent({
      type: 'SUSPICIOUS_IP_ADDED',
      severity: ErrorSeverity.HIGH,
      ipAddress: ip,
      timestamp: new Date()
    });
  }

  /**
   * Remove IP from suspicious list
   */
  removeSuspiciousIP(ip: string): void {
    this.suspiciousIPs.delete(ip);
  }
}

// Export singleton instance
export const securityMiddleware = new SecurityMiddleware();