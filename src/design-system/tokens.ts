/**
 * Attendly Design System Tokens
 * Type-safe design tokens extracted from Attendly.com
 * For programmatic access in React components
 */

export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#F4F5F7',    // Background gray
    100: '#E5E7EB',   // Light gray
    200: '#D1D5DB',   // Medium light gray
    300: '#9CA3AF',   // Medium gray
    400: '#6B7280',   // Dark medium gray
    500: '#4B5563',   // Dark gray
    600: '#364959',   // Slate blue (primary dark)
    700: '#283849',   // Body text blue
    800: '#1F2937',   // Very dark gray
    900: '#101011',   // Charcoal dark (primary)
  },
  
  // Accent Colors
  accent: {
    50: '#FFFEF0',    // Very light yellow
    100: '#FFFBD0',   // Light yellow
    200: '#FFF8A0',   // Medium light yellow
    300: '#FFF570',   // Medium yellow
    400: '#FFF361',   // Signature yellow
    500: '#F4E542',   // Medium dark yellow
    600: '#D4C422',   // Dark yellow
    700: '#B4A018',   // Very dark yellow
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
  
  // Semantic Colors
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
  },
} as const;

export const typography = {
  fontFamily: {
    primary: ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
    display: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  },
  
  fontSize: {
    xs: ['12px', { lineHeight: '16px' }],
    sm: ['14px', { lineHeight: '20px' }],
    base: ['16px', { lineHeight: '24px' }],
    lg: ['18px', { lineHeight: '28px' }],
    xl: ['20px', { lineHeight: '28px' }],
    '2xl': ['24px', { lineHeight: '32px' }],
    '3xl': ['30px', { lineHeight: '36px' }],
    '4xl': ['36px', { lineHeight: '40px' }],
    '5xl': ['48px', { lineHeight: '1.3' }],
    '6xl': ['54px', { lineHeight: '1.2' }],
    
    // Semantic sizes
    display: ['54px', { lineHeight: '64.8px', fontWeight: '500' }],
    h1: ['48px', { lineHeight: '62.4px', fontWeight: '500' }],
    h2: ['24px', { lineHeight: '30px', fontWeight: '700' }],
    h3: ['20px', { lineHeight: '24px', fontWeight: '600' }],
    body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
    caption: ['14px', { lineHeight: '20px', fontWeight: '400' }],
  },
  
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
    
    // Semantic line heights
    display: 1.2,      // 64.8px for 54px text
    h1: 1.3,           // 62.4px for 48px text
    h2: 1.25,          // 30px for 24px text
    body: 1.5,         // 24px for 16px text
  },
} as const;

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.2: '12.8px',    // Attendly specific
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px',
  
  // Semantic spacing
  btnY: '12.8px',     // Button vertical padding
  btnX: '24px',       // Button horizontal padding
  card: '24px',       // Card padding
  section: '64px',    // Section padding
} as const;

export const borderRadius = {
  none: '0',
  sm: '4px',
  base: '8px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
  
  // Component specific
  btn: '12px',        // Button border radius
  card: '16px',       // Card border radius
  input: '8px',       // Input border radius
} as const;

export const boxShadow = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
  none: 'none',
  
  // Brand specific shadows
  brand: '0 4px 12px rgba(54, 73, 89, 0.15)',
  brandLg: '0 8px 24px rgba(54, 73, 89, 0.2)',
  card: '0 1px 3px rgba(0, 0, 0, 0.1)',
  cardHover: '0 4px 12px rgba(54, 73, 89, 0.15)',
} as const;

export const transition = {
  property: {
    none: 'none',
    all: 'all',
    default: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter',
    colors: 'color, background-color, border-color, text-decoration-color, fill, stroke',
    opacity: 'opacity',
    shadow: 'box-shadow',
    transform: 'transform',
  },
  
  duration: {
    75: '75ms',
    100: '100ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    500: '500ms',
    700: '700ms',
    1000: '1000ms',
    
    // Semantic durations
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  
  timingFunction: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const screens = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndex = {
  0: 0,
  10: 10,
  20: 20,
  30: 30,
  40: 40,
  50: 50,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  toast: 700,
} as const;

// Type exports for TypeScript usage
export type ColorToken = keyof typeof colors;
export type ColorScale = keyof typeof colors.primary;
export type SpacingToken = keyof typeof spacing;
export type FontSizeToken = keyof typeof typography.fontSize;
export type FontWeightToken = keyof typeof typography.fontWeight;
export type BorderRadiusToken = keyof typeof borderRadius;
export type ShadowToken = keyof typeof boxShadow;
export type ScreenToken = keyof typeof screens;
export type ZIndexToken = keyof typeof zIndex;

// Helper functions for type-safe token access
export const getColor = (color: ColorToken, scale?: ColorScale) => {
  if (scale && typeof colors[color] === 'object') {
    return (colors[color] as any)[scale];
  }
  return colors[color];
};

export const getSpacing = (token: SpacingToken) => spacing[token];
export const getFontSize = (token: FontSizeToken) => typography.fontSize[token];
export const getBorderRadius = (token: BorderRadiusToken) => borderRadius[token];
export const getShadow = (token: ShadowToken) => boxShadow[token];

// Component-specific token collections
export const buttonTokens = {
  padding: {
    sm: `${spacing[2]} ${spacing[4]}`,
    md: `${spacing[3.2]} ${spacing[6]}`,
    lg: `${spacing[4]} ${spacing[8]}`,
  },
  fontSize: {
    sm: typography.fontSize.sm,
    md: typography.fontSize.base,
    lg: typography.fontSize.lg,
  },
  borderRadius: borderRadius.btn,
  transition: `all ${transition.duration.base} ${transition.timingFunction.default}`,
} as const;

export const cardTokens = {
  padding: spacing.card,
  borderRadius: borderRadius.card,
  shadow: boxShadow.card,
  hoverShadow: boxShadow.cardHover,
  transition: `all ${transition.duration.base} ${transition.timingFunction.default}`,
} as const;

export const inputTokens = {
  padding: `${spacing[3]} ${spacing[3]}`,
  fontSize: typography.fontSize.base,
  borderRadius: borderRadius.input,
  borderColor: colors.neutral[300],
  focusBorderColor: colors.primary[600],
  focusRingColor: 'rgba(54, 73, 89, 0.1)',
  placeholderColor: colors.neutral[500],
} as const;

// Educational data visualization tokens
export const attendanceTokens = {
  colors: colors.attendance,
  statusLabels: {
    present: 'Present',
    absent: 'Absent', 
    tardy: 'Tardy',
    excused: 'Excused',
  } as const,
} as const;

// Dashboard-specific tokens
export const dashboardTokens = {
  cardSpacing: spacing[6],
  sectionSpacing: spacing.section,
  gridGap: spacing[6],
  statsCard: {
    padding: spacing[5],
    numberFontSize: typography.fontSize['5xl'],
    labelFontSize: typography.fontSize.sm,
  },
} as const;

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  boxShadow,
  transition,
  screens,
  zIndex,
  buttonTokens,
  cardTokens,
  inputTokens,
  attendanceTokens,
  dashboardTokens,
};