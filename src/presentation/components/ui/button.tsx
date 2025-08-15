/**
 * @fileoverview Button component with shadcn-ui styling patterns
 * Provides consistent button interface across the application
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-base font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary button - Attendly blue background
        default: 'bg-primary-500 text-white rounded-button hover:bg-primary-600 focus-visible:ring-primary-500 shadow-button hover:shadow-md hover:transform hover:-translate-y-0.5',
        
        // Secondary button - White background with border
        secondary: 'bg-white text-gray-700 border border-gray-300 rounded-button hover:bg-gray-50 hover:border-gray-400 focus-visible:ring-primary-500 shadow-sm',
        
        // Accent CTA button - Also uses primary blue
        accent: 'bg-primary-500 text-white rounded-button hover:bg-primary-600 focus-visible:ring-primary-500 shadow-button hover:shadow-md font-semibold',
        
        // Ghost button - transparent background
        ghost: 'bg-transparent text-gray-700 rounded-button hover:bg-gray-50 focus-visible:ring-primary-500',
        
        // Outline button - border only
        outline: 'border border-primary-500 bg-transparent text-primary-500 rounded-button hover:bg-primary-50 hover:text-primary-600 focus-visible:ring-primary-500',
        
        // Destructive button - for deletion actions
        destructive: 'bg-error-500 text-white rounded-button hover:bg-error-600 focus-visible:ring-error-500 shadow-button',
        
        // Link button - text only
        link: 'text-primary-500 underline-offset-4 hover:underline focus-visible:ring-primary-500 rounded',
      },
      size: {
        // Default size - matches Attendly buttons
        default: 'px-6 py-2.5',
        
        // Small size
        sm: 'px-4 py-2 text-sm',
        
        // Large size
        lg: 'px-8 py-3 text-lg',
        
        // Extra large - for hero CTAs
        xl: 'px-10 py-4 text-lg',
        
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