/**
 * @fileoverview Badge component with shadcn-ui styling patterns
 * Provides consistent badge interface across the application
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Default badge - primary colors
        default: 'bg-primary-100 text-primary-700 border border-transparent',
        
        // Secondary badge - neutral colors
        secondary: 'bg-gray-100 text-gray-700 border border-transparent',
        
        // Success badge - green colors
        success: 'bg-success-50 text-success-700 border border-transparent',
        
        // Warning badge - yellow colors
        warning: 'bg-warning-50 text-warning-700 border border-transparent',
        
        // Error badge - red colors
        destructive: 'bg-error-50 text-error-700 border border-transparent',
        
        // Info badge - blue colors
        info: 'bg-primary-100 text-primary-700 border border-transparent',
        
        // Outline badge - transparent background
        outline: 'text-primary-600 border border-primary-300 bg-transparent',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };