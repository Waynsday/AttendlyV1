/**
 * @fileoverview Badge component with shadcn-ui styling patterns
 * Provides consistent badge interface across the application
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Default badge - primary colors
        default: 'bg-primary-100 text-primary-800 border border-primary-200',
        
        // Secondary badge - neutral colors
        secondary: 'bg-neutral-100 text-neutral-800 border border-neutral-200',
        
        // Success badge - green colors
        success: 'bg-green-100 text-green-800 border border-green-200',
        
        // Warning badge - yellow colors
        warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        
        // Error badge - red colors
        destructive: 'bg-red-100 text-red-800 border border-red-200',
        
        // Accent badge - Attendly yellow
        accent: 'bg-accent-100 text-accent-800 border border-accent-200',
        
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