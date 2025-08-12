import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/presentation/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design system colors with CSS variables
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        
        // Attendly Primary Brand Colors - using CSS variables
        primary: {
          50: '#F4F5F7',
          100: '#E5E7EB',
          200: '#D1D5DB',
          300: '#9CA3AF',
          400: '#6B7280',
          500: '#4B5563',
          600: '#364959',
          700: '#283849',
          800: '#1F2937',
          900: '#101011',
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        
        // Attendly Charcoal colors
        charcoal: {
          50: '#F8F9FA',
          100: '#F1F3F4',
          200: '#E8EAED',
          300: '#DADCE0',
          400: '#BDC1C6',
          500: '#9AA0A6',
          600: '#80868B',
          700: '#5F6368',
          800: '#3C4043',
          900: '#101011',
          DEFAULT: '#101011',
        },
        
        // Neutral colors
        neutral: {
          0: '#FFFFFF',
          50: '#F9FAFB',
          100: '#F4F5F7',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          50: '#FFFEF0',
          100: '#FFFBD0',
          200: '#FFF8A0',
          300: '#FFF570',
          400: '#FFF361',
          500: '#F4E542',
          600: '#D4C422',
          700: '#B4A018',
          800: '#8B7914',
          900: '#6B5A10',
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Tier-based colors for attendance tracking
        tier: {
          1: 'hsl(var(--tier-1))',  // Green - Good attendance
          2: 'hsl(var(--tier-2))',  // Yellow - At-risk
          3: 'hsl(var(--tier-3))',  // Red - Chronic absenteeism
        },

        // Educational semantic colors
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },

        // Grade-level accent colors
        grade: {
          'k': '#8b5cf6',
          '1': '#06b6d4',
          '2': '#10b981',
          '3': '#f59e0b',
          '4': '#ef4444',
          '5': '#8b5cf6',
          '6': '#6366f1',
          '7': '#ec4899',
          '8': '#14b8a6',
        },
      },
      fontFamily: {
        // Attendly brand typography - Inter font system
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Keep original fallbacks
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      spacing: {
        // Custom spacing from design tokens
        'button-x': '2.5rem',    // 40px - from buttonPadding
        'button-y': '1.5rem',    // 24px - from buttonPadding
        'card': '1.25rem',       // 20px - from cardPadding
      },
      borderRadius: {
        // Custom border radius from design tokens
        'button': '0.375rem',    // 6px
        'card': '0.5rem',        // 8px
      },
      boxShadow: {
        // Custom shadows from design tokens
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'button': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      // Custom animations for interactive elements
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config