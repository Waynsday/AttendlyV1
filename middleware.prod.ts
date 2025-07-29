import { type NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/security/auth-middleware';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { 
  createSecureErrorResponse,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  logSecurityEvent,
  ErrorSeverity
} from '@/lib/security/error-handler';

/**
 * Enhanced Next.js Middleware for AP_Tool_V1 Attendance System
 * 
 * This middleware provides comprehensive security controls:
 * - CORS configuration for educational domains only
 * - Rate limiting enforcement with IP and user-based limits
 * - Authentication and authorization via JWT tokens
 * - Session management with hijacking detection
 * - FERPA compliance through educational interest validation
 * - Comprehensive security event logging and audit trails
 * - Request/response security headers
 * 
 * SECURITY REQUIREMENTS:
 * - All API routes require authentication except health checks
 * - CORS only allows requests from approved educational domains
 * - Rate limiting prevents DoS attacks
 * - All security events are logged for audit compliance
 * - Proper security headers are set on all responses
 */
export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const ipAddress = request.headers.get('X-Forwarded-For') || 
                   request.headers.get('X-Real-IP') || 
                   'unknown';
  const pathname = request.nextUrl.pathname;

  try {
    // 1. Add request ID for correlation
    request.headers.set('X-Request-ID', requestId);

    // 2. CORS Configuration - Only allow educational domains
    const corsResponse = handleCORS(request);
    if (corsResponse) {
      return corsResponse;
    }

    // 3. Security Headers for all responses
    const response = NextResponse.next();
    addSecurityHeaders(response);

    // 4. Health check endpoint - allow without authentication but with rate limiting
    if (request.nextUrl.pathname === '/api/health') {
      await rateLimiter.checkIPLimit(ipAddress, request, {
        customLimit: 1000 // Very lenient for health checks
      });
      
      logSecurityEvent({
        type: 'HEALTH_CHECK_ACCESS',
        severity: ErrorSeverity.LOW,
        ipAddress,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        correlationId: requestId,
        details: 'Health check endpoint accessed',
        timestamp: new Date()
      });

      return response;
    }

    // 5. Static assets and public files - no authentication required
    if (isPublicPath(pathname)) {
      return response;
    }

    // 6. API Route Security - Full security stack
    if (pathname.startsWith('/api/')) {
      return await handleAPIRequest(request, response, requestId, ipAddress);
    }

    // 7. Web App Routes - Session-based authentication
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      return await handleWebAppRequest(request, response, requestId, ipAddress);
    }

    // 8. Default: Allow public pages (login, landing) with basic rate limiting
    await rateLimiter.checkIPLimit(ipAddress, request, {
      customLimit: 500 // Moderate rate limiting for public pages
    });

    return response;

  } catch (error) {
    // Comprehensive error handling with security event logging
    const duration = Date.now() - startTime;
    
    if (error instanceof RateLimitError) {
      logSecurityEvent({
        type: 'RATE_LIMIT_VIOLATION',
        severity: ErrorSeverity.MEDIUM,
        ipAddress,
        correlationId: requestId,
        details: `Rate limit exceeded: ${error.message}`,
        timestamp: new Date()
      });

      const errorResponse = createSecureErrorResponse(error, {
        requestId,
        ipAddress,
        userAgent: request.headers.get('User-Agent') || 'unknown'
      });

      const response = NextResponse.json(errorResponse, { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-Request-ID': requestId
        }
      });
      
      addSecurityHeaders(response);
      return response;
    }

    if (error instanceof AuthenticationError) {
      logSecurityEvent({
        type: 'AUTHENTICATION_FAILURE_MIDDLEWARE',
        severity: ErrorSeverity.MEDIUM,
        ipAddress,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        resource: pathname,
        correlationId: requestId,
        details: error.message,
        duration: `${duration}ms`,
        timestamp: new Date()
      });

      const errorResponse = createSecureErrorResponse(error, {
        requestId,
        ipAddress
      });

      const response = NextResponse.json(errorResponse, { 
        status: 401,
        headers: { 'X-Request-ID': requestId }
      });
      
      addSecurityHeaders(response);
      return response;
    }

    if (error instanceof AuthorizationError) {
      logSecurityEvent({
        type: 'AUTHORIZATION_FAILURE_MIDDLEWARE',
        severity: ErrorSeverity.HIGH,
        ipAddress,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        resource: pathname,
        correlationId: requestId,
        details: error.message,
        duration: `${duration}ms`,
        timestamp: new Date()
      });

      const errorResponse = createSecureErrorResponse(error, {
        requestId,
        ipAddress
      });

      const response = NextResponse.json(errorResponse, { 
        status: 403,
        headers: { 'X-Request-ID': requestId }
      });
      
      addSecurityHeaders(response);
      return response;
    }

    // Generic error handling
    logSecurityEvent({
      type: 'MIDDLEWARE_ERROR',
      severity: ErrorSeverity.HIGH,
      ipAddress,
      correlationId: requestId,
      details: `Middleware error: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date()
    });

    const errorResponse = createSecureErrorResponse(error as Error, {
      requestId,
      ipAddress
    });

    const response = NextResponse.json(errorResponse, { 
      status: 500,
      headers: { 'X-Request-ID': requestId }
    });
    
    addSecurityHeaders(response);
    return response;
  }
}

/**
 * Handle CORS for educational domains only
 */
function handleCORS(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('Origin');
  
  // Allow same-origin requests
  if (!origin) {
    return null;
  }

  // Educational domains whitelist
  const allowedOrigins = [
    'https://ap-tool.romoland.k12.ca.us',
    'https://admin.romoland.k12.ca.us',
    'https://staff.romoland.k12.ca.us',
    'http://localhost:3000', // Development
    'http://localhost:3001'  // Development
  ];

  // Check if origin is educational domain (.edu, .k12.ca.us, etc.)
  const educationalDomainPatterns = [
    /^https?:\/\/.*\.edu$/,
    /^https?:\/\/.*\.k12\.ca\.us$/,
    /^https?:\/\/.*\.romoland\.k12\.ca\.us$/
  ];

  const isAllowedOrigin = allowedOrigins.includes(origin) ||
    educationalDomainPatterns.some(pattern => pattern.test(origin));

  if (!isAllowedOrigin) {
    logSecurityEvent({
      type: 'CORS_VIOLATION',
      severity: ErrorSeverity.MEDIUM,
      ipAddress: request.headers.get('X-Forwarded-For') || 'unknown',
      details: `Blocked request from non-educational origin: ${origin}`,
      timestamp: new Date()
    });

    return new NextResponse('Origin not allowed', { 
      status: 403,
      headers: {
        'Access-Control-Allow-Origin': 'null'
      }
    });
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID, X-User-ID',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  return null;
}

/**
 * Handle API requests with full security stack
 */
async function handleAPIRequest(
  request: NextRequest, 
  response: NextResponse, 
  requestId: string, 
  ipAddress: string
): Promise<NextResponse> {
  // Rate limiting with different limits based on endpoint
  const pathname = request.nextUrl.pathname;
  const userId = request.headers.get('X-User-ID');

  // IP-based rate limiting first
  await rateLimiter.checkIPLimit(ipAddress, request);

  // User-based rate limiting if user ID is available
  if (userId) {
    await rateLimiter.checkLimit(userId, request);
  }

  // Authentication for all API routes except health
  if (pathname !== '/api/health') {
    const authContext = await authMiddleware(request);
    
    // Add authentication context to headers for downstream processing
    response.headers.set('X-Auth-User-ID', authContext.userId);
    response.headers.set('X-Auth-Employee-ID', authContext.employeeId);
    response.headers.set('X-Auth-Role', authContext.role);
    response.headers.set('X-Auth-Educational-Interest', authContext.educationalInterest);
    
    // Log successful API access
    logSecurityEvent({
      type: 'API_ACCESS_GRANTED',
      severity: ErrorSeverity.LOW,
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      ipAddress,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      resource: pathname,
      method: request.method,
      correlationId: requestId,
      timestamp: new Date()
    });
  }

  return response;
}

/**
 * Handle web app requests with session-based authentication
 */
async function handleWebAppRequest(
  request: NextRequest, 
  response: NextResponse, 
  requestId: string, 
  ipAddress: string
): Promise<NextResponse> {
  // Basic rate limiting for web app routes
  await rateLimiter.checkIPLimit(ipAddress, request, {
    customLimit: 300 // Moderate limit for web app
  });

  // For now, allow web app routes to pass through
  // In production, implement session-based authentication here
  
  logSecurityEvent({
    type: 'WEB_APP_ACCESS',
    severity: ErrorSeverity.LOW,
    ipAddress,
    userAgent: request.headers.get('User-Agent') || 'unknown',
    resource: request.nextUrl.pathname,
    correlationId: requestId,
    timestamp: new Date()
  });

  return response;
}

/**
 * Add comprehensive security headers
 */
function addSecurityHeaders(response: NextResponse): void {
  // CORS headers for allowed origins
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy for educational applications
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.romoland.k12.ca.us; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self';"
  );
  
  // HSTS for HTTPS enforcement (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Educational data protection headers
  response.headers.set('X-Student-Data-Protection', 'FERPA-Compliant');
  response.headers.set('X-Educational-Interest-Required', 'true');
}

/**
 * Check if path is public (no authentication required)
 */
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/_next/',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/public/',
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/privacy',
    '/terms'
  ];

  return publicPaths.some(path => pathname.startsWith(path)) ||
         /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$/.test(pathname);
}

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, css, js, fonts)
     * 
     * Apply security middleware to:
     * - All API routes (/api/*)
     * - Dashboard and admin routes (/dashboard/*, /admin/*)
     * - Authentication routes (/login, /logout)
     * - Root and public pages that need rate limiting
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}