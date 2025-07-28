/**
 * @fileoverview Health Check API Route
 * 
 * Implements health check endpoint with security considerations:
 * - No authentication required (public endpoint)
 * - No sensitive information exposure
 * - Basic system status without revealing infrastructure details
 * - Rate limiting to prevent abuse
 * - Audit logging for monitoring
 * 
 * SECURITY REQUIREMENTS:
 * - Never expose database connection strings, API keys, or secrets
 * - Minimal system information disclosure
 * - Rate limiting to prevent DoS attacks
 * - No PII or educational data in responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/security/rate-limiter';
import { 
  logSecurityEvent,
  ErrorSeverity,
  createSecureErrorResponse
} from '@/lib/security/error-handler';

/**
 * GET /api/health - Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Rate limiting for health check (lenient but present)
    const ipAddress = request.headers.get('X-Forwarded-For') || 
                     request.headers.get('X-Real-IP') || 
                     'unknown';
    
    await rateLimiter.checkIPLimit(ipAddress, request, {
      customLimit: 1000, // Very lenient for health checks
      window: 60000
    });

    // 2. Basic health status check (no sensitive information)
    const healthStatus = await performHealthChecks();

    // 3. Log health check access (for monitoring patterns)
    logSecurityEvent({
      type: 'HEALTH_CHECK_ACCESS',
      severity: ErrorSeverity.LOW,
      ipAddress: ipAddress,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      correlationId: request.headers.get('X-Request-ID') || 'unknown',
      details: `Health check accessed from ${ipAddress}`,
      timestamp: new Date()
    });

    // 4. Return secure health response
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: healthStatus,
      uptime: process.uptime(),
      // Never include sensitive information like:
      // - Database connection strings
      // - API keys or secrets  
      // - Internal IP addresses
      // - Student or user data
      // - Infrastructure details
    });

  } catch (error) {
    // Even health check errors should be handled securely
    const errorResponse = createSecureErrorResponse(error as Error, {
      requestId: request.headers.get('X-Request-ID') || 'unknown',
      ipAddress: request.headers.get('X-Forwarded-For') || 'unknown'
    });

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service temporarily unavailable'
    }, { status: 503 });
  }
}

/**
 * Perform basic health checks without exposing sensitive information
 */
async function performHealthChecks() {
  const checks = {
    api: 'healthy',
    timestamp: new Date().toISOString()
  };

  try {
    // Database connectivity check (without exposing connection details)
    const dbStatus = await checkDatabaseConnectivity();
    checks.database = dbStatus ? 'healthy' : 'unhealthy';
  } catch (error) {
    checks.database = 'unhealthy';
  }

  try {
    // Cache/Redis connectivity check (if applicable)
    const cacheStatus = await checkCacheConnectivity();
    checks.cache = cacheStatus ? 'healthy' : 'unhealthy';
  } catch (error) {
    checks.cache = 'unhealthy';
  }

  return checks;
}

/**
 * Check database connectivity without exposing sensitive information
 */
async function checkDatabaseConnectivity(): Promise<boolean> {
  try {
    // Mock implementation - replace with actual database ping
    // DO NOT expose connection strings, usernames, or other sensitive data
    
    // Example of what NOT to do:
    // return { connectionString: process.env.DATABASE_URL, status: 'connected' };
    
    // Example of correct implementation:
    return true; // Simple boolean indicating connectivity
  } catch (error) {
    return false;
  }
}

/**
 * Check cache connectivity without exposing sensitive information
 */
async function checkCacheConnectivity(): Promise<boolean> {
  try {
    // Mock implementation - replace with actual cache ping
    // DO NOT expose Redis URLs, passwords, or configuration details
    return true;
  } catch (error) {
    return false;
  }
}