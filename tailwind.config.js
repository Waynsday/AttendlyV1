/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Attendly Brand Colors (Exact match from website)
      colors: {
        // Primary Brand Colors - Attendly Grays and Blues
        primary: {
          50: '#F4F5F7',    // Background gray (from website)
          100: '#E5E7EB',   // Light gray
          200: '#D1D5DB',   // Medium light gray
          300: '#9CA3AF',   // Medium gray
          400: '#6B7280',   // Dark medium gray
          500: '#4B5563',   // Dark gray
          600: '#364959',   // Slate blue (medium brand color)
          700: '#283849',   // Body text blue (primary text color)
          800: '#1F2937',   // Very dark gray
          900: '#101011',   // Charcoal dark (heading color)
          DEFAULT: '#283849', // Default primary color
        },
        
        // Charcoal variants (for consistency)
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
          900: '#101011',   // Exact Attendly charcoal
          DEFAULT: '#101011',
        },
        
        // Attendly Signature Yellow (extracted from website)
        accent: {
          50: '#FFFEF0',    // Very light yellow
          100: '#FFFBD0',   // Light yellow  
          200: '#FFF8A0',   // Medium light yellow
          300: '#FFF570',   // Medium yellow
          400: '#FFF361',   // Signature yellow (exact from website)
          500: '#F4E542',   // Medium dark yellow
          600: '#D4C422',   // Dark yellow
          700: '#B4A018',   // Very dark yellow
          800: '#8B7914',   // Very dark yellow
          900: '#6B5A10',   // Darkest yellow
          DEFAULT: '#FFF361', // Default accent color
        },
        
        // Yellow variants (for CTA buttons)
        yellow: {
          50: '#FFFEF0',
          100: '#FFFBD0', 
          200: '#FFF8A0',
          300: '#FFF570',
          400: '#FFF361',   // Exact Attendly CTA color
          500: '#F4E542',
          600: '#D4C422',
          700: '#B4A018',
          800: '#8B7914',
          900: '#6B5A10',
          DEFAULT: '#FFF361',
        },
        
        // Neutral Colors
        neutral: {
          0: '#FFFFFF',     // Pure white
          50: '#F9FAFB',    // Off white
          100: '#F4F5F7',   // Background gray
          200: '#E5E7EB',   // Light gray
          300: '#D1D5DB',   // Medium light gray
          400: '#9CA3AF',   // Medium gray
          500: '#6B7280',   // Dark medium gray
          600: '#4B5563',   // Dark gray
          700: '#374151',   // Very dark gray
          800: '#1F2937',   // Almost black
          900: '#111827',   // Near black
        },
        
        // Semantic Colors for Educational Platform
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',   // Primary success
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
          500: '#F59E0B',   // Primary warning
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
          500: '#EF4444',   // Primary error
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',   // Primary info
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        
        // Educational Data States
        attendance: {
          present: '#10B981',    // Green for present
          absent: '#EF4444',     // Red for absent
          tardy: '#F59E0B',      // Orange for tardy
          excused: '#6B7280',    // Gray for excused
        }
      },
      
      // Typography - Inter Font System (matching Attendly website)
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
        'display': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      
      // Font Sizes - Attendly Scale
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
        '5xl': ['48px', { lineHeight: '1.3' }],
        '6xl': ['54px', { lineHeight: '1.2' }],
        
        // Semantic sizes
        'display': ['54px', { lineHeight: '64.8px', fontWeight: '500' }],
        'h1': ['48px', { lineHeight: '62.4px', fontWeight: '500' }],
        'h2': ['24px', { lineHeight: '30px', fontWeight: '700' }],
        'h3': ['20px', { lineHeight: '24px', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'caption': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      },
      
      // Font Weights
      fontWeight: {
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
      },
      
      // Spacing Scale (8px grid system)
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.2': '12.8px',    // Attendly specific
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '28': '112px',
        '32': '128px',
        '36': '144px',
        '40': '160px',
        '44': '176px',
        '48': '192px',
        '52': '208px',
        '56': '224px',
        '60': '240px',
        '64': '256px',
        '72': '288px',
        '80': '320px',
        '96': '384px',
        
        // Semantic spacing
        'btn-y': '12.8px',    // Button vertical padding
        'btn-x': '24px',      // Button horizontal padding
        'card': '24px',       // Card padding
        'section': '64px',    // Section padding
      },
      
      // Border Radius Scale
      borderRadius: {
        'none': '0',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
        'full': '9999px',
        
        // Component specific
        'btn': '12px',        // Button border radius
        'card': '16px',       // Card border radius
        'input': '8px',       // Input border radius
      },
      
      // Box Shadows - Attendly Specific
      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        'none': 'none',
        
        // Brand specific shadows
        'brand': '0 4px 12px rgba(54, 73, 89, 0.15)',
        'brand-lg': '0 8px 24px rgba(54, 73, 89, 0.2)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 12px rgba(54, 73, 89, 0.15)',
      },
      
      // Animation & Transitions
      transitionProperty: {
        'brand': 'all',
      },
      
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
      },
      
      transitionTimingFunction: {
        'brand': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      // Layout & Grid
      maxWidth: {
        'container': '1200px',
        'container-lg': '1440px',
      },
      
      // Educational Platform Specific
      screens: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      
      // Z-index scale
      zIndex: {
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        'dropdown': '100',
        'sticky': '200',
        'fixed': '300',
        'modal': '400',
        'popover': '500',
        'tooltip': '600',
        'toast': '700',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    
    // Custom plugin for Attendly-specific utilities
    function({ addUtilities, addComponents, theme }) {
      // Button Components
      addComponents({
        '.btn': {
          '@apply inline-flex items-center justify-center px-6 py-3.2 text-base font-normal rounded-btn transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-primary': {
          '@apply btn bg-primary-600 text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2': {},
        },
        '.btn-secondary': {
          '@apply btn bg-white text-primary-900 border border-neutral-200 hover:bg-neutral-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2': {},
        },
        '.btn-accent': {
          '@apply btn bg-accent-400 text-primary-900 hover:bg-accent-500 focus:ring-2 focus:ring-accent-400 focus:ring-offset-2': {},
        },
        '.btn-ghost': {
          '@apply btn bg-transparent text-primary-700 hover:bg-neutral-100 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2': {},
        },
        
        // Card Components
        '.card': {
          '@apply bg-white rounded-card p-card border border-neutral-200 shadow-card transition-all duration-200': {},
        },
        '.card-hover': {
          '@apply card hover:shadow-card-hover hover:-translate-y-0.5': {},
        },
        
        // Stats Card for Dashboard
        '.stats-card': {
          '@apply card text-center': {},
        },
        '.stats-number': {
          '@apply text-5xl font-medium text-primary-900 leading-none': {},
        },
        '.stats-label': {
          '@apply text-sm text-primary-700 mt-2': {},
        },
        
        // Navigation
        '.nav-link': {
          '@apply text-primary-700 hover:text-primary-900 px-2.5 py-1.5 text-base font-normal transition-colors duration-200': {},
        },
        
        // Form Elements
        '.form-input': {
          '@apply block w-full px-3 py-2 border border-neutral-300 rounded-input shadow-sm placeholder-neutral-500 focus:ring-primary-500 focus:border-primary-500': {},
        },
        '.form-label': {
          '@apply block text-sm font-medium text-primary-900 mb-1': {},
        },
        
        // Educational Data Indicators
        '.status-present': {
          '@apply bg-attendance-present text-white': {},
        },
        '.status-absent': {
          '@apply bg-attendance-absent text-white': {},
        },
        '.status-tardy': {
          '@apply bg-attendance-tardy text-white': {},
        },
        '.status-excused': {
          '@apply bg-attendance-excused text-white': {},
        },
      });
      
      // Custom utilities
      addUtilities({
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.bg-pattern-grid': {
          'background-image': 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          'background-size': '20px 20px',
        },
      });
    }
  ],
};