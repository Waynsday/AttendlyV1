import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/supabase'

/**
 * Supabase Middleware
 * 
 * Handles authentication and session management for the AP Romoland system.
 * This middleware ensures proper session handling and role-based access control.
 * 
 * @param request - The incoming request
 * @returns NextResponse with updated session
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Define protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/students',
    '/attendance',
    '/interventions',
    '/reports',
    '/admin'
  ]

  // Define public routes that should redirect authenticated users
  const publicRoutes = [
    '/login',
    '/signin',
    '/signup'
  ]

  // Define admin-only routes
  const adminRoutes = [
    '/admin',
    '/teachers',
    '/settings'
  ]

  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  )
  const isAdminRoute = adminRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users from public auth routes to dashboard
  if (isPublicRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Check admin permissions for admin routes
  if (isAdminRoute && user) {
    try {
      // Get user's role from the teachers table
      const { data: teacher } = await supabase
        .from('teachers')
        .select('role')
        .eq('employee_id', user.email?.split('@')[0] || '')
        .single()

      const isAdmin = teacher?.role === 'ADMINISTRATOR' || teacher?.role === 'ASSISTANT_PRINCIPAL'

      if (!isAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    } catch (error) {
      console.error('Error checking admin permissions:', error)
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}

/**
 * Enhanced session update with role-based access control
 * 
 * @param request - The incoming request
 * @param requiredRole - Optional role requirement
 * @returns NextResponse with session and role validation
 */
export async function updateSessionWithRole(
  request: NextRequest, 
  requiredRole?: 'TEACHER' | 'ASSISTANT_PRINCIPAL' | 'ADMINISTRATOR'
) {
  const response = await updateSession(request)
  
  // If role is required and we have a user, check their role
  if (requiredRole) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // No-op in this context
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('role')
        .eq('employee_id', user.email?.split('@')[0] || '')
        .single()

      const hasPermission = teacher?.role === requiredRole || 
                          (requiredRole === 'TEACHER' && 
                           (teacher?.role === 'ASSISTANT_PRINCIPAL' || teacher?.role === 'ADMINISTRATOR'))

      if (!hasPermission) {
        const url = request.nextUrl.clone()
        url.pathname = '/unauthorized'
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}