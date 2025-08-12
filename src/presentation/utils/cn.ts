/**
 * @fileoverview Utility function for combining class names
 * Merges Tailwind CSS classes using clsx and tailwind-merge
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names intelligently, handling Tailwind CSS conflicts
 * @param inputs - Class values to combine
 * @returns Combined class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}