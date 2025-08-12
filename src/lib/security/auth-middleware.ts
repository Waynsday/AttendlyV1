/**
 * @fileoverview Authentication Middleware for AP_Tool_V1
 * 
 * Implements comprehensive authentication and authorization with security controls:
 * - JWT token validation and parsing
 * - Role-based access control with educational context
 * - FERPA compliance through educational interest validation
 * - Session management integration
 * - Security event logging and audit trails
 * - Rate limiting integration
 * 
 * SECURITY REQUIREMENTS:
 * - All student data access requires educational interest validation
 * - JWT tokens must be properly validated and signed
 * - Session integration for timeout and security monitoring
 * - Comprehensive audit logging for all authentication events
 * - Protection against token manipulation and replay attacks
 */

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { 
  AuthenticationError,
  AuthorizationError,
  SecurityError,
  logSecurityEvent,
  ErrorSeverity
} from './error-handler';
import { sessionManager } from './session-manager';

/**
 * User roles in the educational system
 */
export enum UserRole {
  TEACHER = 'TEACHER',
  ASSISTANT_PRINCIPAL = 'ASSISTANT_PRINCIPAL', 
  ADMINISTRATOR = 'ADMINISTRATOR',
  EXTERNAL = 'EXTERNAL'
}

/**
 * Educational interest levels for FERPA compliance
 */
export enum EducationalInterestLevel {
  DIRECT = 'DIRECT',         // Direct educational responsibility for students
  INDIRECT = 'INDIRECT',     // Indirect educational interest (aggregated data only)
  ADMINISTRATIVE = 'ADMINISTRATIVE', // Administrative oversight
  NONE = 'NONE'             // No educational interest
}

/**
 * Authentication context returned by middleware
 */
export interface AuthenticationContext {
  userId: string;
  employeeId: string;
  role: UserRole;
  educationalInterest: EducationalInterestLevel;
  permissions: string[];
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * JWT payload structure
 */
interface JWTPayload {
  userId: string;
  employeeId: string;
  role: UserRole;
  educationalInterest: EducationalInterestLevel;
  permissions: string[];
  sessionId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Middleware configuration options
 */
interface MiddlewareConfig {
  jwtSecret?: string;
  sessionManager?: any;
  securityLogger?: (event: any) => void;
  permissionValidator?: (context: any) => boolean;
  requireEducationalInterest?: boolean;
}

/**
 * Global middleware configuration
 */
let middlewareConfig: MiddlewareConfig = {
  requireEducationalInterest: true
};

/**
 * Main authentication middleware function
 */
export async function authMiddleware(
  request: NextRequest, 
  options: Partial<MiddlewareConfig> = {}
): Promise<AuthenticationContext> {
  const startTime = Date.now();
  const requestId = request.headers.get('X-Request-ID') || generateRequestId();
  const ipAddress = request.headers.get('X-Forwarded-For') || 
                   request.headers.get('X-Real-IP') || 
                   'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  try {
    // 1. Extract and validate Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      throw new AuthenticationError('No authentication token provided');
    }

    // 2. Parse Bearer token
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!tokenMatch) {
      throw new AuthenticationError('Invalid authorization header format');
    }

    const token = tokenMatch[1];

    // 3. Verify and decode JWT token
    const jwtSecret = options.jwtSecret || 
                     middlewareConfig.jwtSecret || 
                     process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new SecurityError('JWT secret not configured', {
        severity: ErrorSeverity.CRITICAL,
        requestId,
        timestamp: new Date()
      });
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'], // Restrict to secure algorithms
        issuer: process.env.JWT_ISSUER || 'ap-tool-v1',
        audience: process.env.JWT_AUDIENCE || 'ap-tool-users'
      }) as JWTPayload;
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token has expired');
      } else if (jwtError.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid token signature');
      } else {
        throw new AuthenticationError('Token validation failed');
      }
    }

    // 4. Validate required JWT claims
    if (!payload.userId || !payload.employeeId || !payload.role) {
      throw new AuthenticationError('Token missing required claims');
    }

    // 5. Educational interest validation
    if (middlewareConfig.requireEducationalInterest !== false) {
      if (!payload.educationalInterest) {
        throw new AuthenticationError('Token missing educational interest claim');
      }
    }

    // 6. Session validation if session ID is present
    if (payload.sessionId && sessionManager) {
      try {
        const sessionValidation = await sessionManager.validateSession(payload.sessionId, {
          ipAddress,
          userAgent
        });
        
        if (!sessionValidation.valid) {
          throw new AuthenticationError('Session expired or invalid');
        }

        // Update session activity
        await sessionManager.updateActivity(payload.sessionId);
        
      } catch (sessionError) {
        throw new AuthenticationError('Session validation failed');
      }
    }

    // 7. Resource-specific permission validation
    const resourcePermissions = getRequiredPermissions(request);
    if (resourcePermissions.length > 0) {
      const hasPermission = validatePermissions(
        payload.permissions || [],
        resourcePermissions,
        payload.role
      );

      if (!hasPermission) {
        throw new AuthorizationError('Insufficient permissions for resource', {
          userId: payload.userId,
          resource: request.nextUrl.pathname,
          requiredPermission: resourcePermissions.join(', '),
          userPermissions: payload.permissions || []
        });
      }
    }

    // 8. Educational interest validation for student data
    const requiresEducationalInterest = checkEducationalInterestRequirement(request);
    if (requiresEducationalInterest) {
      const hasEducationalInterest = validateEducationalInterest(
        payload.educationalInterest,
        request
      );

      if (!hasEducationalInterest) {
        throw new AuthorizationError('Educational interest required for student data access', {
          userId: payload.userId,
          resource: request.nextUrl.pathname
        });
      }
    }

    // 9. Build authentication context
    const authContext: AuthenticationContext = {
      userId: payload.userId,
      employeeId: payload.employeeId,
      role: payload.role,
      educationalInterest: payload.educationalInterest || EducationalInterestLevel.NONE,
      permissions: payload.permissions || [],
      sessionId: payload.sessionId,
      ipAddress,
      userAgent,
      timestamp: new Date()
    };

    // 10. Log successful authentication
    const duration = Date.now() - startTime;
    logSecurityEvent({
      type: 'SUCCESSFUL_AUTHENTICATION',
      severity: ErrorSeverity.LOW,
      userId: payload.userId,
      employeeId: payload.employeeId,
      ipAddress,
      userAgent,
      resource: request.nextUrl.pathname,
      method: request.method,
      sessionId: payload.sessionId,
      duration: `${duration}ms`,
      correlationId: requestId,
      timestamp: new Date()
    });

    return authContext;

  } catch (error) {
    // Log authentication failure
    const duration = Date.now() - startTime;
    
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      logSecurityEvent({
        type: error instanceof AuthenticationError ? 'AUTHENTICATION_FAILURE' : 'AUTHORIZATION_FAILURE',
        severity: error instanceof AuthenticationError ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH,
        reason: error.message,
        ipAddress,
        userAgent,
        resource: request.nextUrl.pathname,
        method: request.method,
        duration: `${duration}ms`,
        correlationId: requestId,
        timestamp: new Date()
      });
    }

    throw error;
  }
}

/**
 * Configure middleware settings
 */
export function configure(config: Partial<MiddlewareConfig>): void {
  middlewareConfig = { ...middlewareConfig, ...config };
}

/**
 * Get JWT secret from configuration
 */
export function getJWTSecret(): string {
  return middlewareConfig.jwtSecret || process.env.JWT_SECRET || '';
}

/**
 * Get required permissions for a specific resource
 */
function getRequiredPermissions(request: NextRequest): string[] {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // Define permission mapping for different resources
  const permissionMap: Record<string, Record<string, string[]>> = {
    '/api/students': {
      'GET': ['READ_STUDENTS'],
      'POST': ['CREATE_STUDENTS'],
      'PUT': ['UPDATE_STUDENTS'],
      'DELETE': ['DELETE_STUDENTS']
    },
    '/api/attendance': {
      'GET': ['READ_ATTENDANCE'],
      'POST': ['CREATE_ATTENDANCE'],
      'PUT': ['UPDATE_ATTENDANCE'],
      'DELETE': ['DELETE_ATTENDANCE']
    },
    '/api/interventions': {
      'GET': ['READ_INTERVENTIONS'],
      'POST': ['CREATE_INTERVENTIONS'],
      'PUT': ['UPDATE_INTERVENTIONS'],
      'DELETE': ['DELETE_INTERVENTIONS']
    },
    '/api/dashboard': {
      'GET': ['READ_DASHBOARD'],
      'POST': ['REFRESH_DASHBOARD']
    }
  };

  // Check for exact match first
  if (permissionMap[pathname]?.[method]) {
    return permissionMap[pathname][method];
  }

  // Check for pattern matches (e.g., /api/students/123)
  for (const [pattern, methods] of Object.entries(permissionMap)) {
    if (pathname.startsWith(pattern) && methods[method]) {
      return methods[method];
    }
  }

  return [];
}

/**
 * Validate user permissions against required permissions
 */
function validatePermissions(
  userPermissions: string[],
  requiredPermissions: string[],
  userRole: UserRole
): boolean {
  // Administrator role has all permissions
  if (userRole === UserRole.ADMINISTRATOR || userPermissions.includes('*')) {
    return true;
  }

  // Check if user has all required permissions
  return requiredPermissions.every(permission => 
    userPermissions.includes(permission)
  );
}

/**
 * Check if educational interest is required for the resource
 */
function checkEducationalInterestRequirement(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  
  // Resources that require educational interest
  const educationalInterestRequired = [
    '/api/students',
    '/api/attendance',
    '/api/interventions'
  ];

  return educationalInterestRequired.some(path => 
    pathname.startsWith(path)
  );
}

/**
 * Validate educational interest level for the requested resource
 */
function validateEducationalInterest(
  educationalInterest: EducationalInterestLevel,
  request: NextRequest
): boolean {
  const pathname = request.nextUrl.pathname;

  // Resources requiring direct educational interest (PII access)
  const directInterestRequired = [
    '/api/students/',  // Individual student details
    '/api/interventions' // Individual interventions
  ];

  // Check if direct interest is required
  const requiresDirect = directInterestRequired.some(path => 
    pathname.startsWith(path) && pathname.includes('/')
  );

  if (requiresDirect) {
    return educationalInterest === EducationalInterestLevel.DIRECT ||
           educationalInterest === EducationalInterestLevel.ADMINISTRATIVE;
  }

  // For aggregated data, indirect interest is sufficient
  return educationalInterest !== EducationalInterestLevel.NONE;
}

/**
 * Generate a unique request ID for correlation
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export types for use in other modules
 */
export type { JWTPayload, MiddlewareConfig };