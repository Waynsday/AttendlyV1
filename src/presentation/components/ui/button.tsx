/**
 * @fileoverview Button component with shadcn-ui styling patterns
 * Provides consistent button interface across the application
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-base font-normal ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary button - Attendly charcoal background
        default: 'bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus-visible:ring-primary-500 shadow-sm',
        
        // Secondary button - White background with border
        secondary: 'bg-white text-primary-900 border border-neutral-200 rounded-lg hover:bg-neutral-50 focus-visible:ring-primary-500 shadow-sm',
        
        // Accent CTA button - Attendly signature yellow
        accent: 'bg-accent-400 text-primary-900 rounded-lg hover:bg-accent-500 focus-visible:ring-accent-400 shadow-sm font-medium',
        
        // Ghost button - transparent background
        ghost: 'bg-transparent text-primary-700 rounded-lg hover:bg-neutral-100 focus-visible:ring-primary-500',
        
        // Outline button - border only
        outline: 'border border-primary-300 bg-background text-primary-700 rounded-lg hover:bg-primary-50 hover:text-primary-900 focus-visible:ring-primary-500',
        
        // Destructive button - for deletion actions
        destructive: 'bg-error-500 text-white rounded-lg hover:bg-error-600 focus-visible:ring-error-500 shadow-sm',
        
        // Link button - text only
        link: 'text-primary-600 underline-offset-4 hover:underline focus-visible:ring-primary-500 rounded-md',
      },
      size: {
        // Default size - matches Attendly CTA buttons (12.8px vertical padding)
        default: 'px-6 py-3.2',
        
        // Small size
        sm: 'px-4 py-2 text-sm',
        
        // Large size
        lg: 'px-8 py-4 text-lg',
        
        // Extra large - for hero CTAs
        xl: 'px-10 py-5 text-lg',
        
        // Icon only
        icon: 'h-10 w-10 p-0',
        
        // Icon small
        'icon-sm': 'h-8 w-8 p-0',
        
        // Icon large  
        'icon-lg': 'h-12 w-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };