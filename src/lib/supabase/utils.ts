import { AuthError, PostgrestError } from '@supabase/supabase-js'

/**
 * Supabase Utilities
 * 
 * Helper functions for working with Supabase in the AP Romoland system.
 * Includes error handling, type guards, and common operations.
 */

/**
 * Type guard to check if an error is a PostgrestError
 * 
 * @param error - The error to check
 * @returns true if error is a PostgrestError
 */
export function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'details' in error &&
    'hint' in error &&
    'message' in error
  )
}

/**
 * Type guard to check if an error is an AuthError
 * 
 * @param error - The error to check
 * @returns true if error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as AuthError).name === 'AuthError'
  )
}

/**
 * Formats a Supabase error for user display
 * 
 * @param error - The error to format
 * @returns A user-friendly error message
 */
export function formatSupabaseError(error: unknown): string {
  if (isPostgrestError(error)) {
    switch (error.code) {
      case '23505': // Unique violation
        return 'A record with this information already exists.'
      case '23503': // Foreign key violation
        return 'Cannot delete this record because it is referenced by other data.'
      case '23514': // Check violation
        return 'The data provided does not meet the required constraints.'
      case '42P01': // Undefined table
        return 'The requested resource was not found.'
      case 'PGRST116': // No rows found
        return 'No matching records were found.'
      default:
        return error.message || 'An unexpected database error occurred.'
    }
  }

  if (isAuthError(error)) {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password. Please try again.'
      case 'Email not confirmed':
        return 'Please check your email and click the confirmation link.'
      case 'User not found':
        return 'No account found with this email address.'
      default:
        return error.message || 'An authentication error occurred.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred.'
}

/**
 * Handles common Supabase response patterns
 * 
 * @param response - The Supabase response
 * @returns The data if successful, throws formatted error if not
 */
export function handleSupabaseResponse<T>(response: {
  data: T | null
  error: PostgrestError | null
}): T {
  if (response.error) {
    throw new Error(formatSupabaseError(response.error))
  }

  if (response.data === null) {
    throw new Error('No data returned from the database.')
  }

  return response.data
}

/**
 * Creates a safe error response for API routes
 * 
 * @param error - The error to handle
 * @param defaultMessage - Default message if error cannot be parsed
 * @returns An object with success: false and formatted error message
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = 'An unexpected error occurred.'
) {
  return {
    success: false,
    error: formatSupabaseError(error) || defaultMessage,
    data: null
  }
}

/**
 * Creates a success response for API routes
 * 
 * @param data - The data to return
 * @param message - Optional success message
 * @returns An object with success: true and the data
 */
export function createSuccessResponse<T>(data: T, message?: string) {
  return {
    success: true,
    error: null,
    data,
    message
  }
}

/**
 * Validates that required environment variables are present
 * 
 * @throws Error if required variables are missing
 */
export function validateSupabaseConfig() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    )
  }
}

/**
 * Common database error codes and their meanings
 */
export const DATABASE_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
  UNDEFINED_TABLE: '42P01',
  NO_ROWS_FOUND: 'PGRST116',
  INSUFFICIENT_PRIVILEGES: '42501'
} as const

/**
 * Retry configuration for database operations
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  backoffMultiplier: 2
} as const

/**
 * Implements exponential backoff retry logic for database operations
 * 
 * @param operation - The async operation to retry
 * @param maxAttempts - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 * @param backoffMultiplier - Multiplier for exponential backoff
 * @returns Promise resolving to the operation result
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = RETRY_CONFIG.maxAttempts,
  initialDelay = RETRY_CONFIG.initialDelay,
  backoffMultiplier = RETRY_CONFIG.backoffMultiplier
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Don't retry on certain types of errors
      if (isPostgrestError(error) && 
          [DATABASE_ERROR_CODES.UNIQUE_VIOLATION, 
           DATABASE_ERROR_CODES.CHECK_VIOLATION,
           DATABASE_ERROR_CODES.INSUFFICIENT_PRIVILEGES].includes(error.code)) {
        throw error
      }

      if (attempt === maxAttempts) {
        break
      }

      // Wait before retrying with exponential backoff
      const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}