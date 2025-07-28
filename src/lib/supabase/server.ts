import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

/**
 * Supabase Server Client
 * 
 * Creates a Supabase client for use in server-side code (API routes, Server Components).
 * This client properly handles cookies for authentication in the AP Romoland system.
 * 
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/server'
 * 
 * export async function getStudents() {
 *   const supabase = createClient()
 *   const { data, error } = await supabase
 *     .from('students')
 *     .select('*')
 *     .eq('is_active', true)
 *   
 *   return { data, error }
 * }
 * ```
 */

export function createClient() {
  const cookieStore = cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      // Configure server client options
      auth: {
        // Disable automatic token refresh on server
        autoRefreshToken: false,
        // Don't persist session on server
        persistSession: false,
        // Don't detect sessions from URL on server
        detectSessionInUrl: false,
      },
      // Configure database options
      db: {
        schema: 'public'
      }
    }
  )
}

/**
 * Creates a Supabase client for use in Server Actions
 * 
 * @returns A configured Supabase client for server actions
 */
export function createActionClient() {
  return createClient()
}

/**
 * Creates a Supabase admin client with elevated privileges
 * Use with extreme caution and only for administrative operations
 * 
 * @returns A configured Supabase admin client
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for admin client
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      }
    }
  )
}