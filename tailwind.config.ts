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
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
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
          1: 'var(--tier-1)',  // Green - Good attendance
          2: 'var(--tier-2)',  // Yellow - At-risk
          3: 'var(--tier-3)',  // Red - Chronic absenteeism
        },

        // Grade-level accent colors
        grade: {
          'k': '#8b5cf6',   // Purple
          '1': '#06b6d4',   // Cyan
          '2': '#10b981',   // Emerald
          '3': '#f59e0b',   // Amber
          '4': '#ef4444',   // Red
          '5': '#8b5cf6',   // Purple
          '6': '#6366f1',   // Indigo
          '7': '#ec4899',   // Pink
          '8': '#14b8a6',   // Teal
        },
        // Grade-level accent colors
        grade: {
          'k': '#8b5cf6',   // Purple
          '1': '#06b6d4',   // Cyan
          '2': '#10b981',   // Emerald
          '3': '#f59e0b',   // Amber
          '4': '#ef4444',   // Red
          '5': '#8b5cf6',   // Purple
          '6': '#6366f1',   // Indigo
          '7': '#ec4899',   // Pink
          '8': '#14b8a6',   // Teal
        },
      },
      fontFamily: {
        // Romoland design system fonts
        sans: ['var(--font-montserrat)', 'Montserrat', 'system-ui', 'sans-serif'],
        heading: ['var(--font-syne)', 'Syne', 'system-ui', 'sans-serif'],
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