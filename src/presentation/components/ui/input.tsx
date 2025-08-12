/**
 * @fileoverview Input component with shadcn-ui styling patterns
 * Provides consistent input interface across the application
 */

import * as React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base text-primary-900 ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-primary-500 hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-100',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };