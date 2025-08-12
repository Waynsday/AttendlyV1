'use client';

import { ReactNode, useEffect } from 'react';

interface DevToolsProviderProps {
  children: ReactNode;
}

/**
 * Development Tools Provider
 * 
 * RSC-compatible provider that maintains clean development environment
 * without interfering with Next.js 15.4.4 internal bundling
 */
export function DevToolsProvider({ children }: DevToolsProviderProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Only suppress console noise - don't patch core APIs that break RSC
      const originalConsoleError = console.error;
      console.error = function(...args) {
        const message = args.join(' ');
        // Filter out non-critical development warnings that clutter console
        if (
          message.includes('Warning: Extra attributes from the server:') ||
          message.includes('Warning: Prop `') ||
          message.includes('next-dev-') // Only filter dev-specific warnings
        ) {
          // Silently ignore non-critical development warnings
          return;
        }
        return originalConsoleError.apply(this, args);
      };
    }
  }, []);
  
  return <>{children}</>;
}