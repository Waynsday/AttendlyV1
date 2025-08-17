/**
 * @fileoverview Button component with shadcn-ui styling patterns
 * Provides consistent button interface across the application
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-base font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary button - Attendly charcoal blue
        default: 'bg-primary text-primary-foreground hover:bg-primary-700 shadow-md hover:shadow-lg transform hover:scale-105',
        
        // Secondary button - White background with border
        secondary: 'bg-white text-primary border-2 border-primary hover:bg-primary hover:text-white',
        
        // Accent CTA button - Attendly yellow
        accent: 'bg-accent text-accent-foreground hover:bg-yellow-300 shadow-md hover:shadow-lg transform hover:scale-105',
        
        // Ghost button - transparent background
        ghost: 'bg-transparent text-primary hover:bg-neutral-100 hover:text-primary-800',
        
        // Outline button - border only
        outline: 'border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-white',
        
        // Destructive button - for deletion actions
        destructive: 'bg-red-500 text-white hover:bg-red-600 shadow-md',
        
        // Link button - text only
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Default size - matches Attendly buttons
        default: 'px-6 py-3',
        
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