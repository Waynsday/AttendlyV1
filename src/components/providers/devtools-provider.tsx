'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import React Hook Form DevTools with SSR disabled
const ReactHookFormDevTools = dynamic(
  () => import('@hookform/devtools').then((mod) => ({ default: mod.DevTool })),
  {
    ssr: false,
    loading: () => null,
  }
);

interface DevToolsProviderProps {
  children: ReactNode;
  control?: any; // React Hook Form control object
}

/**
 * Development Tools Provider
 * 
 * Conditionally renders React Hook Form DevTools only in development
 * and only on the client side to prevent SSR hydration issues
 */
export function DevToolsProvider({ children, control }: DevToolsProviderProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isClient = typeof window !== 'undefined';

  return (
    <>
      {children}
      {isDevelopment && isClient && control && (
        <ReactHookFormDevTools control={control} />
      )}
    </>
  );
}