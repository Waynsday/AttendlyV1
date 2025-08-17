import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/presentation/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // iReady placement colors
    'text-red-600',
    'bg-red-50',
    'text-green-600',
    'bg-green-50',
    'text-blue-600',
    'bg-blue-50',
    'text-gray-600',
    'bg-gray-50',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['3rem', { lineHeight: '1.2' }],
        '4xl': ['3.375rem', { lineHeight: '1.2' }],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
}

export default config