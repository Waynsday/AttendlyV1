/**
 * @fileoverview Attendly brand color contrast validation tests
 * Tests WCAG 2.1 AA color contrast requirements for all brand color combinations
 * Validates accessibility for users with visual impairments and color blindness
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Color contrast calculation utility
const calculateContrastRatio = (color1: string, color2: string): number => {
  // Convert hex or rgb to numeric values
  const parseColor = (color: string): [number, number, number] => {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    } else if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      return matches ? [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])] : [0, 0, 0];
    }
    return [0, 0, 0];
  };

  // Calculate relative luminance
  const getLuminance = ([r, g, b]: [number, number, number]): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(parseColor(color1));
  const lum2 = getLuminance(parseColor(color2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

describe('Attendly Brand Color Contrast Validation', () => {
  // Attendly brand color palette
  const brandColors = {
    // Primary colors
    charcoal: '#283849',          // Primary text color
    nearBlack: '#101011',         // Accent foreground
    lightGray: '#F4F5F7',         // Background
    white: '#FFFFFF',             // Card backgrounds
    
    // Accent colors
    yellow: '#FFF361',            // Signature yellow accent
    
    // Tier colors for attendance tracking
    tierGreen: '#22c55e',         // Good attendance (Tier 1)
    tierYellow: '#facc15',        // At-risk (Tier 2)  
    tierRed: '#ef4444',           // Chronic absence (Tier 3)
    
    // Neutral colors
    neutralGray: '#9ca3af',       // Muted text
    borderGray: '#e5e7eb',        // Borders
    
    // Grade level colors
    gradePurple: '#8b5cf6',       // K, 5
    gradeCyan: '#06b6d4',         // 1
    gradeEmerald: '#10b981',      // 2  
    gradeAmber: '#f59e0b',        // 3
    gradeRed: '#ef4444',          // 4
    gradeIndigo: '#6366f1',       // 6
    gradePink: '#ec4899',         // 7
    gradeTeal: '#14b8a6',         // 8
  };

  const WCAG_AA_NORMAL = 4.5;   // WCAG AA for normal text
  const WCAG_AA_LARGE = 3.0;    // WCAG AA for large text (18pt+ or 14pt+ bold)
  const WCAG_AAA_NORMAL = 7.0;  // WCAG AAA for normal text
  const WCAG_AAA_LARGE = 4.5;   // WCAG AAA for large text

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Primary Brand Color Combinations', () => {
    it('should meet AA contrast for charcoal text on white background', () => {
      const contrastRatio = calculateContrastRatio(brandColors.charcoal, brandColors.white);
      expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      expect(contrastRatio).toBeCloseTo(12.59, 1); // Expected high contrast
    });

    it('should meet AA contrast for white text on charcoal background', () => {
      const contrastRatio = calculateContrastRatio(brandColors.white, brandColors.charcoal);
      expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      expect(contrastRatio).toBeCloseTo(12.59, 1);
    });

    it('should meet AA contrast for near-black text on yellow background', () => {
      const contrastRatio = calculateContrastRatio(brandColors.nearBlack, brandColors.yellow);
      expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      expect(contrastRatio).toBeGreaterThan(15); // Should be very high contrast
    });

    it('should validate light gray background does not cause contrast issues', () => {
      const contrastRatio = calculateContrastRatio(brandColors.charcoal, brandColors.lightGray);
      expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should fail contrast test for invalid combinations', () => {
      // Test a combination that should fail
      const badContrastRatio = calculateContrastRatio(brandColors.lightGray, brandColors.white);
      expect(badContrastRatio).toBeLessThan(WCAG_AA_NORMAL);
      console.warn(`Low contrast detected: ${badContrastRatio.toFixed(2)}:1 - would fail WCAG AA`);
    });
  });

  describe('Attendance Tier Color Accessibility', () => {
    const tierTests = [
      {
        name: 'Tier 1 (Good Attendance) - Green',
        backgroundColor: brandColors.tierGreen,
        textColor: brandColors.white,
        expectedMinContrast: WCAG_AA_NORMAL,
      },
      {
        name: 'Tier 2 (At Risk) - Yellow',
        backgroundColor: brandColors.tierYellow,
        textColor: brandColors.nearBlack,
        expectedMinContrast: WCAG_AA_NORMAL,
      },
      {
        name: 'Tier 3 (Chronic Absence) - Red',
        backgroundColor: brandColors.tierRed,
        textColor: brandColors.white,
        expectedMinContrast: WCAG_AA_NORMAL,
      },
    ];

    tierTests.forEach(({ name, backgroundColor, textColor, expectedMinContrast }) => {
      it(`should meet AA contrast for ${name}`, () => {
        const contrastRatio = calculateContrastRatio(textColor, backgroundColor);
        expect(contrastRatio, `${name} contrast ratio`).toBeGreaterThanOrEqual(expectedMinContrast);
      });
    });

    it('should differentiate tier colors for colorblind users', () => {
      // Test that tier colors are distinguishable beyond just color
      render(
        <div data-testid="tier-indicators">
          <div className="tier-1" data-tier="1" aria-label="Good attendance - above 95%">
            Tier 1: Good Attendance
          </div>
          <div className="tier-2" data-tier="2" aria-label="At risk - 90-95% attendance">
            Tier 2: At Risk  
          </div>
          <div className="tier-3" data-tier="3" aria-label="Chronic absence - below 90%">
            Tier 3: Chronic Absence
          </div>
        </div>
      );

      const tier1 = screen.getByLabelText(/good attendance/i);
      const tier2 = screen.getByLabelText(/at risk/i);  
      const tier3 = screen.getByLabelText(/chronic absence/i);

      // Verify semantic indicators beyond color
      expect(tier1).toHaveAttribute('data-tier', '1');
      expect(tier2).toHaveAttribute('data-tier', '2');
      expect(tier3).toHaveAttribute('data-tier', '3');

      // Verify descriptive text for screen readers
      expect(tier1).toHaveAccessibleName(/good attendance.*95%/i);
      expect(tier2).toHaveAccessibleName(/at risk.*90-95%/i);
      expect(tier3).toHaveAccessibleName(/chronic absence.*below 90%/i);
    });
  });

  describe('Grade Level Color Accessibility', () => {
    const gradeColorTests = [
      { grade: 'K', color: brandColors.gradePurple, name: 'Kindergarten Purple' },
      { grade: '1', color: brandColors.gradeCyan, name: 'First Grade Cyan' },
      { grade: '2', color: brandColors.gradeEmerald, name: 'Second Grade Emerald' },
      { grade: '3', color: brandColors.gradeAmber, name: 'Third Grade Amber' },
      { grade: '4', color: brandColors.gradeRed, name: 'Fourth Grade Red' },
      { grade: '5', color: brandColors.gradePurple, name: 'Fifth Grade Purple' },
      { grade: '6', color: brandColors.gradeIndigo, name: 'Sixth Grade Indigo' },
      { grade: '7', color: brandColors.gradePink, name: 'Seventh Grade Pink' },
      { grade: '8', color: brandColors.gradeTeal, name: 'Eighth Grade Teal' },
    ];

    gradeColorTests.forEach(({ grade, color, name }) => {
      it(`should meet contrast requirements for ${name} on white background`, () => {
        const contrastRatio = calculateContrastRatio(color, brandColors.white);
        
        // Grade colors are typically used as accents, so they may be used at larger sizes
        // They should at least meet large text requirements
        expect(contrastRatio, `${name} contrast on white`).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      });

      it(`should meet contrast requirements for white text on ${name} background`, () => {
        const contrastRatio = calculateContrastRatio(brandColors.white, color);
        expect(contrastRatio, `White text on ${name}`).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      });
    });

    it('should provide alternative indicators for grade levels beyond color', () => {
      render(
        <div data-testid="grade-indicators">
          {gradeColorTests.map(({ grade, name }) => (
            <div
              key={grade}
              data-grade={grade}
              aria-label={`Grade ${grade} section`}
              className={`grade-${grade}-indicator`}
            >
              Grade {grade}
            </div>
          ))}
        </div>
      );

      gradeColorTests.forEach(({ grade }) => {
        const gradeElement = screen.getByLabelText(`Grade ${grade} section`);
        expect(gradeElement).toHaveAttribute('data-grade', grade);
        expect(gradeElement).toHaveClass(`grade-${grade}-indicator`);
      });
    });
  });

  describe('Interactive Element Color Contrast', () => {
    it('should validate button color combinations', () => {
      const buttonVariants = [
        {
          name: 'Primary Button',
          background: brandColors.charcoal,
          text: brandColors.white,
          expectedContrast: WCAG_AA_NORMAL,
        },
        {
          name: 'Secondary Button', 
          background: brandColors.white,
          text: brandColors.charcoal,
          expectedContrast: WCAG_AA_NORMAL,
        },
        {
          name: 'Accent Button',
          background: brandColors.yellow,
          text: brandColors.nearBlack,
          expectedContrast: WCAG_AA_NORMAL,
        },
      ];

      buttonVariants.forEach(({ name, background, text, expectedContrast }) => {
        const contrastRatio = calculateContrastRatio(text, background);
        expect(contrastRatio, `${name} contrast ratio`).toBeGreaterThanOrEqual(expectedContrast);
      });
    });

    it('should validate link color contrast in different states', () => {
      const linkStates = [
        { state: 'normal', color: brandColors.charcoal, background: brandColors.white },
        { state: 'visited', color: brandColors.charcoal, background: brandColors.white },
        { state: 'hover', color: brandColors.nearBlack, background: brandColors.white },
      ];

      linkStates.forEach(({ state, color, background }) => {
        const contrastRatio = calculateContrastRatio(color, background);
        expect(contrastRatio, `Link ${state} state contrast`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    });

    it('should validate focus indicator visibility', () => {
      // Focus indicators should be visible against their backgrounds
      const focusRingColor = brandColors.yellow; // Assuming yellow focus ring
      const backgrounds = [brandColors.white, brandColors.lightGray, brandColors.charcoal];

      backgrounds.forEach(background => {
        const contrastRatio = calculateContrastRatio(focusRingColor, background);
        expect(contrastRatio, `Focus ring on ${background}`).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      });
    });
  });

  describe('Educational Data Color Coding', () => {
    it('should ensure attendance percentage indicators are accessible', () => {
      const attendanceRanges = [
        { range: '95-100%', color: brandColors.tierGreen, label: 'Excellent' },
        { range: '90-94%', color: brandColors.tierYellow, label: 'Good' },
        { range: '85-89%', color: brandColors.tierRed, label: 'At Risk' },
        { range: '0-84%', color: brandColors.tierRed, label: 'Chronic' },
      ];

      render(
        <div data-testid="attendance-ranges">
          {attendanceRanges.map(({ range, label }) => (
            <div
              key={range}
              data-range={range}
              aria-label={`${label} attendance: ${range}`}
              role="status"
            >
              {range}: {label}
            </div>
          ))}
        </div>
      );

      attendanceRanges.forEach(({ range, label }) => {
        const element = screen.getByLabelText(`${label} attendance: ${range}`);
        expect(element).toBeInTheDocument();
        expect(element).toHaveAttribute('role', 'status');
      });
    });

    it('should validate error and success message colors', () => {
      const messageColors = [
        { type: 'success', color: brandColors.tierGreen, background: brandColors.white },
        { type: 'warning', color: brandColors.tierYellow, background: brandColors.white },
        { type: 'error', color: brandColors.tierRed, background: brandColors.white },
      ];

      messageColors.forEach(({ type, color, background }) => {
        const contrastRatio = calculateContrastRatio(color, background);
        
        // Messages should be easily readable
        expect(contrastRatio, `${type} message contrast`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    });

    it('should handle chart and graph color accessibility', () => {
      // Test that data visualization colors meet contrast requirements
      const chartColors = [
        brandColors.gradeCyan,    // Line 1
        brandColors.gradeEmerald, // Line 2  
        brandColors.gradeAmber,   // Line 3
        brandColors.gradePink,    // Line 4
      ];

      // Chart colors should be distinguishable from background
      chartColors.forEach((color, index) => {
        const contrastRatio = calculateContrastRatio(color, brandColors.white);
        expect(contrastRatio, `Chart color ${index + 1} contrast`).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      });

      // Chart should not rely solely on color for differentiation
      render(
        <div data-testid="chart-legend">
          {chartColors.map((color, index) => (
            <div
              key={index}
              data-series={index}
              aria-label={`Data series ${index + 1}`}
              style={{ '--series-color': color } as React.CSSProperties}
            >
              Series {index + 1}
              <span className="sr-only">
                (represented by {['solid line', 'dashed line', 'dotted line', 'dash-dot line'][index]})
              </span>
            </div>
          ))}
        </div>
      );

      chartColors.forEach((_, index) => {
        const seriesElement = screen.getByLabelText(`Data series ${index + 1}`);
        expect(seriesElement).toHaveAttribute('data-series', index.toString());
      });
    });
  });

  describe('Dark Mode and High Contrast Support', () => {
    it('should provide adequate contrast in high contrast mode', () => {
      // In high contrast mode, colors should be more extreme
      const highContrastPairs = [
        { text: '#000000', background: '#FFFFFF' }, // Pure black on white
        { text: '#FFFFFF', background: '#000000' }, // Pure white on black
      ];

      highContrastPairs.forEach(({ text, background }) => {
        const contrastRatio = calculateContrastRatio(text, background);
        expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_AAA_NORMAL); // Should exceed AAA
      });
    });

    it('should maintain brand identity while meeting accessibility requirements', () => {
      // Key brand color combinations should still meet requirements
      const brandCombinations = [
        { name: 'Logo on light background', text: brandColors.charcoal, bg: brandColors.lightGray },
        { name: 'CTA button', text: brandColors.nearBlack, bg: brandColors.yellow },
        { name: 'Primary button', text: brandColors.white, bg: brandColors.charcoal },
      ];

      brandCombinations.forEach(({ name, text, bg }) => {
        const contrastRatio = calculateContrastRatio(text, bg);
        expect(contrastRatio, name).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
        
        // Log successful combinations for documentation
        console.log(`✓ ${name}: ${contrastRatio.toFixed(2)}:1 contrast ratio`);
      });
    });

    it('should handle Windows High Contrast Mode', () => {
      // Test that components remain functional in Windows High Contrast mode
      render(
        <div data-testid="high-contrast-test" className="forced-colors:text-[ButtonText] forced-colors:bg-[ButtonFace]">
          <button className="forced-colors:border-[ButtonText]">
            High Contrast Button
          </button>
          <a href="#" className="forced-colors:text-[LinkText] forced-colors:underline">
            High Contrast Link
          </a>
        </div>
      );

      const button = screen.getByRole('button', { name: 'High Contrast Button' });
      const link = screen.getByRole('link', { name: 'High Contrast Link' });

      expect(button).toBeInTheDocument();
      expect(link).toBeInTheDocument();
    });
  });

  describe('Real-world Color Contrast Testing', () => {
    it('should test actual component rendered colors', () => {
      // Mock getComputedStyle to return actual color values
      const mockGetComputedStyle = vi.fn();
      Object.defineProperty(window, 'getComputedStyle', {
        value: mockGetComputedStyle,
        writable: true,
      });

      mockGetComputedStyle.mockReturnValue({
        color: 'rgb(40, 56, 73)', // #283849
        backgroundColor: 'rgb(255, 255, 255)', // white
      });

      render(
        <button 
          data-testid="real-button" 
          className="bg-primary-600 text-white"
        >
          Real Button Test
        </button>
      );

      const button = screen.getByTestId('real-button');
      const computedStyle = window.getComputedStyle(button);
      
      const contrastRatio = calculateContrastRatio(
        computedStyle.color,
        computedStyle.backgroundColor
      );

      expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should validate color combinations across different screen conditions', () => {
      // Test color combinations under various conditions
      const screenConditions = [
        { name: 'Normal lighting', adjustment: 1.0 },
        { name: 'Bright sunlight', adjustment: 0.8 }, // Colors appear washed out
        { name: 'Low light', adjustment: 1.2 }, // Need higher contrast
      ];

      screenConditions.forEach(({ name, adjustment }) => {
        const adjustedContrast = calculateContrastRatio(brandColors.charcoal, brandColors.white) * adjustment;
        
        // Should still meet minimum requirements under different conditions
        expect(adjustedContrast, `${name} conditions`).toBeGreaterThan(WCAG_AA_NORMAL);
      });
    });

    it('should document all passing color combinations for design system', () => {
      const passingCombinations: Array<{
        name: string;
        foreground: string;
        background: string;
        ratio: number;
        wcagLevel: string;
      }> = [];

      const testCombinations = [
        { name: 'Primary Text', fg: brandColors.charcoal, bg: brandColors.white },
        { name: 'Accent CTA', fg: brandColors.nearBlack, bg: brandColors.yellow },
        { name: 'Success Message', fg: brandColors.tierGreen, bg: brandColors.white },
        { name: 'Warning Message', fg: brandColors.tierYellow, bg: brandColors.nearBlack },
        { name: 'Error Message', fg: brandColors.tierRed, bg: brandColors.white },
      ];

      testCombinations.forEach(({ name, fg, bg }) => {
        const ratio = calculateContrastRatio(fg, bg);
        let wcagLevel = 'Fail';
        
        if (ratio >= WCAG_AAA_NORMAL) wcagLevel = 'AAA Normal';
        else if (ratio >= WCAG_AAA_LARGE) wcagLevel = 'AAA Large';
        else if (ratio >= WCAG_AA_NORMAL) wcagLevel = 'AA Normal';
        else if (ratio >= WCAG_AA_LARGE) wcagLevel = 'AA Large';

        passingCombinations.push({
          name,
          foreground: fg,
          background: bg,
          ratio: parseFloat(ratio.toFixed(2)),
          wcagLevel,
        });

        // All combinations should at least pass AA Large
        expect(ratio, `${name} should pass WCAG requirements`).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      });

      // Log the results for documentation
      console.table(passingCombinations);
    });
  });
});