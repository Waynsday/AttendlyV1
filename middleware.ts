import { type NextRequest, NextResponse } from 'next/server';

/**
 * Simplified Development Middleware for AttendlyV1
 * 
 * This is a lightweight middleware for development that prevents
 * the complex security middleware from causing devtools issues.
 * 
 * In development mode, we:
 * - Allow all requests to pass through
 * - Add basic CORS headers for localhost
 * - Skip authentication and rate limiting
 * - Log basic request information
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add CORS headers for development
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200 });
  }

  // Log requests in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] ${request.method} ${request.url}`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files in development
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};