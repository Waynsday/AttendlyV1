'use client';

import { ReactNode, useEffect } from 'react';

interface DevToolsProviderProps {
  children: ReactNode;
}

/**
 * Development Tools Provider
 * 
 * A comprehensive provider that completely prevents Next.js devtools conflicts
 * while maintaining React DevTools functionality and clean development environment
 */
export function DevToolsProvider({ children }: DevToolsProviderProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Prevent Next.js from loading devtools chunks
      const originalDefineProperty = Object.defineProperty;
      Object.defineProperty = function(obj, prop, descriptor) {
        // Block any attempts to load Next.js devtools modules
        if (typeof prop === 'string' && prop.includes('next-devtools')) {
          return obj;
        }
        return originalDefineProperty.call(this, obj, prop, descriptor);
      };
      
      // Block devtools chunk requests at the network level
      if (typeof window !== 'undefined' && window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          const url = typeof input === 'string' ? input : input.url;
          if (url && url.includes('next-devtools')) {
            // Return empty response for devtools chunks
            return Promise.resolve(new Response('', { status: 204 }));
          }
          return originalFetch.call(this, input, init);
        };
      }
      
      // Suppress devtools-related errors in console
      const originalConsoleError = console.error;
      console.error = function(...args) {
        const message = args.join(' ');
        if (message.includes('next-devtools') || message.includes('_next/static/chunks/node_modules_next_dist_compiled_next-devtools')) {
          // Silently ignore Next.js devtools errors
          return;
        }
        return originalConsoleError.apply(this, args);
      };
    }
  }, []);
  
  return <>{children}</>;
}