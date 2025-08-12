import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

/**
 * Supabase Browser Client
 * 
 * Creates a Supabase client for use in browser/client-side code.
 * This client is configured for the AP Romoland attendance system with
 * proper TypeScript support for the database schema.
 * 
 * @example
 * ```typescript
 * import { supabase } from '@/lib/supabase/client'
 * 
 * const { data, error } = await supabase
 *   .from('students')
 *   .select('*')
 *   .eq('grade_level', 7)
 * ```
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    // Configure client options for the AP Romoland system
    auth: {
      // Enable automatic token refresh
      autoRefreshToken: true,
      // Persist session in local storage
      persistSession: true,
      // Detect sessions from URL fragments (for OAuth flows)
      detectSessionInUrl: true,
      // Set session storage key for AP Tool
      storageKey: 'ap-tool-auth-token',
    },
    // Configure database options
    db: {
      // Set schema if using custom schemas
      schema: 'public'
    },
    // Configure realtime options for live updates
    realtime: {
      // Enable presence for collaborative features
      params: {
        eventsPerSecond: 10
      }
    }
  }
)