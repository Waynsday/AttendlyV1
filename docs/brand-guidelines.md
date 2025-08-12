# Attendly Brand Guidelines & Design System

## Overview

This document provides comprehensive brand guidelines extracted from Attendly.com's website design system. These guidelines ensure consistent brand application across the AP_Tool_V1 educational platform while maintaining security and compliance standards for student data handling.

## Color System

### Primary Colors

#### Charcoal Dark (Primary)
- **Hex**: #101011
- **RGB**: rgb(16, 16, 17)
- **Usage**: Primary text, headings, dark logo variant
- **Accessibility**: WCAG AAA compliant on light backgrounds

#### Slate Blue (Primary Dark)
- **Hex**: #364959
- **RGB**: rgb(54, 73, 89)
- **Usage**: Primary buttons, footer background, navigation accents
- **Accessibility**: WCAG AA compliant with white text

#### Body Text Blue
- **Hex**: #283849
- **RGB**: rgb(40, 56, 73)
- **Usage**: Body text, secondary text, navigation links
- **Accessibility**: WCAG AA compliant on light backgrounds

### Secondary Colors

#### Accent Yellow (Signature Color)
- **Hex**: #FFF361
- **RGB**: rgb(255, 243, 97)
- **Usage**: Call-to-action accents, interactive elements, highlights
- **Accessibility**: Requires dark text overlay for readability

### Neutral Colors

#### Background Gray
- **Hex**: #F4F5F7
- **RGB**: rgb(244, 245, 247)
- **Usage**: Page backgrounds, section dividers

#### Pure White
- **Hex**: #FFFFFF
- **RGB**: rgb(255, 255, 255)
- **Usage**: Card backgrounds, button text, content areas

### Semantic Colors

#### Success Green
- **Hex**: #22C55E (Inferred from common practices)
- **Usage**: Success states, confirmations, positive indicators

#### Warning Orange
- **Hex**: #F59E0B (Inferred from common practices)
- **Usage**: Warning states, attention indicators

#### Error Red
- **Hex**: #EF4444 (Inferred from common practices)
- **Usage**: Error states, validation failures

## Typography System

### Primary Font Family
- **Font**: Satoshi, sans-serif
- **Fallback**: system-ui, -apple-system, sans-serif
- **License**: Commercial (ensure proper licensing)

### Type Scale

#### Display (H1)
- **Font Size**: 54px (3.375rem)
- **Line Height**: 64.8px (1.2)
- **Font Weight**: 500 (Medium)
- **Usage**: Hero headlines, primary page titles

#### Large Heading (H2)
- **Font Size**: 48px (3rem)
- **Line Height**: 62.4px (1.3)
- **Font Weight**: 500 (Medium)
- **Usage**: Section headers, feature titles

#### Medium Heading (H3)
- **Font Size**: 24px (1.5rem)
- **Line Height**: 30px (1.25)
- **Font Weight**: 700 (Bold)
- **Usage**: Card titles, subsection headers

#### Body Text
- **Font Size**: 16px (1rem)
- **Line Height**: 24px (1.5)
- **Font Weight**: 400 (Regular)
- **Usage**: General content, descriptions

### Font Weights Available
- 400 (Regular) - Body text
- 500 (Medium) - Headings, emphasis
- 700 (Bold) - Strong emphasis, labels

## Spacing System

### Base Scale (8px grid system)
- **4px**: 0.25rem - Micro spacing
- **8px**: 0.5rem - Small gaps
- **12px**: 0.75rem - Component padding
- **16px**: 1rem - Standard spacing
- **24px**: 1.5rem - Section spacing
- **32px**: 2rem - Large gaps
- **40px**: 2.5rem - Section padding
- **48px**: 3rem - Large section spacing
- **64px**: 4rem - Major section breaks
- **96px**: 6rem - Large vertical spacing

### Component Spacing
- **Button Padding**: 12.8px 24px (0.8rem 1.5rem)
- **Card Padding**: 24px (1.5rem)
- **Section Padding**: 64px 0 (4rem 0)

## Component Patterns

### Buttons

#### Primary Button (Dark)
```css
.btn-primary {
  background-color: #364959;
  color: #ffffff;
  padding: 12.8px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background-color: #283849;
  transform: translateY(-1px);
}
```

#### Secondary Button (White)
```css
.btn-secondary {
  background-color: #ffffff;
  color: #101011;
  padding: 6.4px 24px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 400;
  border: 1px solid #f4f5f7;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background-color: #f4f5f7;
  border-color: #364959;
}
```

#### Yellow Accent Icon
```css
.btn-accent-icon {
  background-color: #FFF361;
  color: #101011;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-accent-icon:hover {
  transform: scale(1.05);
}
```

### Cards

#### Standard Card
```css
.card {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #f4f5f7;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(54, 73, 89, 0.15);
  transform: translateY(-2px);
}
```

#### Stats Card
```css
.stats-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #f4f5f7;
  text-align: center;
}

.stats-number {
  font-size: 48px;
  font-weight: 500;
  color: #101011;
  line-height: 1;
}

.stats-label {
  font-size: 14px;
  color: #283849;
  margin-top: 8px;
}
```

### Navigation

#### Navigation Bar
```css
.navbar {
  background-color: transparent;
  padding: 16px 0;
  border-bottom: 1px solid #f4f5f7;
}

.nav-link {
  color: #283849;
  font-size: 16px;
  font-weight: 400;
  text-decoration: none;
  padding: 6.4px 9.6px;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: #101011;
}
```

## Layout & Grid System

### Breakpoints
- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px - 1440px
- **Large Desktop**: 1440px+

### Container Widths
- **Mobile**: 100% (with 16px padding)
- **Tablet**: 100% (with 24px padding)
- **Desktop**: 1200px max-width
- **Large Desktop**: 1440px max-width

### Grid System
- **Columns**: 12-column grid
- **Gutter**: 24px
- **Margins**: Responsive (16px mobile, 24px tablet, 48px desktop)

## Shadows & Effects

### Shadow Scale
```css
.shadow-sm {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.shadow-md {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}

.shadow-lg {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}

.shadow-brand {
  box-shadow: 0 4px 12px rgba(54, 73, 89, 0.15);
}
```

### Border Radius Scale
- **Small**: 4px - Form inputs
- **Medium**: 8px - Small buttons
- **Large**: 12px - Primary buttons
- **Extra Large**: 16px - Cards, containers

## Logo Usage

### Primary Logo
- **Light Backgrounds**: Dark version (charcoal)
- **Dark Backgrounds**: White version
- **Minimum Size**: 120px width
- **Clear Space**: 2x logo height on all sides

### Logo Files
- **SVG**: Vector format for web (preferred)
- **PNG**: Raster format with transparency
- **Formats**: Light and dark variants

## Implementation Guidelines

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-primary-900: #101011;
  --color-primary-700: #283849;
  --color-primary-600: #364959;
  --color-accent-400: #FFF361;
  --color-neutral-50: #F4F5F7;
  --color-neutral-0: #FFFFFF;
  
  /* Typography */
  --font-family-primary: 'Satoshi', system-ui, sans-serif;
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */
  --font-size-4xl: 2.25rem;   /* 36px */
  --font-size-5xl: 3rem;      /* 48px */
  --font-size-6xl: 3.375rem;  /* 54px */
  
  /* Spacing */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 0.75rem;   /* 12px */
  --spacing-lg: 1rem;      /* 16px */
  --spacing-xl: 1.5rem;    /* 24px */
  --spacing-2xl: 2rem;     /* 32px */
  --spacing-3xl: 2.5rem;   /* 40px */
  --spacing-4xl: 3rem;     /* 48px */
  --spacing-5xl: 4rem;     /* 64px */
  --spacing-6xl: 6rem;     /* 96px */
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-brand: 0 4px 12px rgba(54, 73, 89, 0.15);
}
```

### Tailwind CSS Configuration

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F4F5F7',
          600: '#364959',
          700: '#283849',
          900: '#101011'
        },
        accent: {
          400: '#FFF361'
        }
      },
      fontFamily: {
        'sans': ['Satoshi', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'display': ['54px', { lineHeight: '64.8px', fontWeight: '500' }],
        'h1': ['48px', { lineHeight: '62.4px', fontWeight: '500' }],
        'h2': ['24px', { lineHeight: '30px', fontWeight: '700' }]
      },
      spacing: {
        '4.5': '18px',
        '12.8': '51.2px',
        '22.4': '89.6px'
      },
      borderRadius: {
        '4': '4px',
        '8': '8px',
        '12': '12px',
        '16': '16px'
      },
      boxShadow: {
        'brand': '0 4px 12px rgba(54, 73, 89, 0.15)'
      }
    }
  }
}
```

## Accessibility Compliance

### WCAG 2.1 AA Standards
- **Color Contrast**: All text meets minimum 4.5:1 ratio
- **Focus Indicators**: Visible focus states for keyboard navigation
- **Alt Text**: All images include descriptive alt text
- **Semantic HTML**: Proper heading hierarchy and landmarks

### Color Contrast Ratios
- **Primary on White**: 12.6:1 (AAA)
- **Body Text on White**: 8.9:1 (AAA)
- **Primary Button**: 4.8:1 (AA)
- **Yellow Accent**: Requires dark text overlay

## Educational Data Compliance

### FERPA Considerations
- **Data Visualization**: Use neutral colors for sensitive student data
- **Error States**: Clear, accessible error messaging
- **Privacy Indicators**: Visual cues for protected information

### Security Visual Indicators
- **Secure States**: Green checkmarks, lock icons
- **Warning States**: Orange indicators for attention items
- **Error States**: Red indicators for critical issues

## Brand Voice & Messaging

### Tone
- **Professional**: Educational institution appropriate
- **Approachable**: User-friendly, not intimidating
- **Efficient**: Focus on reducing administrative burden
- **Trustworthy**: Reliable handling of student data

### Key Messaging
- "End Administrative Agony"
- "From Manual Verification to Automated Excellence"
- "Purpose-built for California educators"
- "Focus on students, not paperwork"

## Implementation Checklist

### Phase 1: Foundation
- [ ] Install Satoshi font family
- [ ] Set up CSS custom properties
- [ ] Configure Tailwind with brand colors
- [ ] Create base component library

### Phase 2: Components
- [ ] Implement button variants
- [ ] Create card components
- [ ] Build navigation components
- [ ] Develop form elements

### Phase 3: Layout
- [ ] Establish grid system
- [ ] Create responsive containers
- [ ] Implement spacing utilities
- [ ] Add accessibility features

### Phase 4: Testing
- [ ] Accessibility audit
- [ ] Color contrast validation
- [ ] Responsive design testing
- [ ] Cross-browser compatibility

## Maintenance Guidelines

### Regular Reviews
- **Quarterly**: Color contrast audits
- **Bi-annually**: Accessibility compliance check
- **Annually**: Font licensing renewal
- **Ongoing**: Component consistency monitoring

### Updates & Changes
- **Version Control**: Document all design system changes
- **Stakeholder Review**: Educational compliance requirements
- **Testing**: All changes require accessibility testing
- **Documentation**: Update this guide with any modifications

---

*This brand guideline document ensures consistent application of Attendly's design system while maintaining the highest standards for educational data privacy and accessibility compliance.*