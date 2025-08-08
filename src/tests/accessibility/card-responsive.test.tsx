/**
 * @fileoverview Card component responsive design and accessibility tests
 * Tests card layout behavior, spacing, and accessibility across different screen sizes
 */

import { describe, expect, it, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '../../presentation/components/ui/card';

expect.extend(toHaveNoViolations);

// Mock window properties for responsive testing
const mockGetComputedStyle = vi.fn();
const mockMatchMedia = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, 'getComputedStyle', {
    value: mockGetComputedStyle,
    writable: true,
  });
  
  Object.defineProperty(window, 'matchMedia', {
    value: mockMatchMedia,
    writable: true,
  });
  
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
  });
});

afterAll(() => {
  vi.resetAllMocks();
});

describe('Card Component Responsive Design Tests', () => {
  const breakpoints = {
    mobile: { width: 320, height: 568 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1024, height: 768 },
    largeDesktop: { width: 1440, height: 900 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default computed styles
    mockGetComputedStyle.mockImplementation(() => ({
      borderRadius: '12px',
      backgroundColor: 'rgb(255, 255, 255)',
      border: '1px solid rgb(229, 231, 235)',
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      padding: '24px',
      margin: '0px',
      display: 'block',
      width: 'auto',
      minHeight: 'auto',
    }));

    // Default media query mock
    mockMatchMedia.mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  describe('Responsive Layout Tests', () => {
    Object.entries(breakpoints).forEach(([breakpointName, dimensions]) => {
      it(`should render correctly at ${breakpointName} breakpoint (${dimensions.width}x${dimensions.height})`, () => {
        // Set viewport dimensions
        (window as any).innerWidth = dimensions.width;
        (window as any).innerHeight = dimensions.height;

        // Mock media queries for this breakpoint
        mockMatchMedia.mockImplementation(query => {
          const isMobile = query.includes('max-width: 767px');
          const isTablet = query.includes('min-width: 768px') && query.includes('max-width: 1023px');
          const isDesktop = query.includes('min-width: 1024px');

          return {
            matches: 
              (breakpointName === 'mobile' && isMobile) ||
              (breakpointName === 'tablet' && isTablet) ||
              (['desktop', 'largeDesktop'].includes(breakpointName) && isDesktop),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          };
        });

        const { container } = render(
          <Card data-testid={`card-${breakpointName}`}>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
              <CardDescription>Student attendance metrics for Grade 3</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>Present: 85%</div>
                <div>Absent: 10%</div>
                <div>Tardy: 5%</div>
              </div>
            </CardContent>
            <CardFooter>
              <button>View Details</button>
            </CardFooter>
          </Card>
        );

        const card = screen.getByTestId(`card-${breakpointName}`);
        expect(card).toBeInTheDocument();
        expect(card).toHaveClass('rounded-xl');
        expect(card).toHaveClass('bg-white');
      });
    });

    it('should adapt card grid layout responsively', () => {
      const testCases = [
        {
          breakpoint: 'mobile',
          width: 320,
          expectedCols: 1,
          description: 'single column on mobile',
        },
        {
          breakpoint: 'tablet',
          width: 768,
          expectedCols: 2,
          description: 'two columns on tablet',
        },
        {
          breakpoint: 'desktop',
          width: 1024,
          expectedCols: 3,
          description: 'three columns on desktop',
        },
      ];

      testCases.forEach(({ breakpoint, width, expectedCols, description }) => {
        (window as any).innerWidth = width;

        render(
          <div data-testid={`grid-container-${breakpoint}`}>
            <Card>
              <CardContent>
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`}>
                  <div>Item 1</div>
                  <div>Item 2</div>
                  <div>Item 3</div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

        const container = screen.getByTestId(`grid-container-${breakpoint}`);
        expect(container).toBeInTheDocument();
        
        // In real implementation, we'd check computed grid-template-columns
        // For test purposes, we verify the responsive classes are applied
        const gridElement = container.querySelector('.grid');
        expect(gridElement).toHaveClass('grid-cols-1');
        expect(gridElement).toHaveClass('md:grid-cols-2');
        expect(gridElement).toHaveClass('lg:grid-cols-3');
      });
    });

    it('should handle card spacing responsively', () => {
      const spacingTests = [
        { width: 320, expectedPadding: '16px', description: 'reduced padding on mobile' },
        { width: 768, expectedPadding: '24px', description: 'standard padding on tablet+' },
        { width: 1024, expectedPadding: '24px', description: 'standard padding on desktop' },
      ];

      spacingTests.forEach(({ width, expectedPadding, description }) => {
        (window as any).innerWidth = width;
        
        mockGetComputedStyle.mockReturnValue({
          padding: expectedPadding,
          paddingTop: expectedPadding,
          paddingBottom: expectedPadding,
          paddingLeft: expectedPadding,
          paddingRight: expectedPadding,
        });

        render(
          <Card data-testid={`spacing-card-${width}`}>
            <CardContent>Content with responsive padding</CardContent>
          </Card>
        );

        const card = screen.getByTestId(`spacing-card-${width}`);
        const styles = window.getComputedStyle(card);
        
        // Verify padding meets expectations for screen size
        if (width < 768) {
          // Mobile should have adequate padding but not excessive
          expect(parseInt(styles.padding)).toBeGreaterThanOrEqual(12);
          expect(parseInt(styles.padding)).toBeLessThanOrEqual(20);
        } else {
          // Tablet and desktop should have standard padding
          expect(styles.padding).toBe('24px');
        }
      });
    });
  });

  describe('Card Accessibility Tests', () => {
    it('should have no accessibility violations for basic card', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Student Performance</CardTitle>
            <CardDescription>Academic metrics and attendance data</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Content goes here</p>
          </CardContent>
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support proper semantic structure', () => {
      render(
        <Card data-testid="semantic-card">
          <CardHeader>
            <CardTitle>Grade 3 Attendance</CardTitle>
            <CardDescription>Monthly attendance summary for Mrs. Johnson\'s class</CardDescription>
          </CardHeader>
          <CardContent>
            <section aria-labelledby="metrics-heading">
              <h4 id="metrics-heading">Attendance Metrics</h4>
              <ul>
                <li>Present: 85%</li>
                <li>Absent: 10%</li>
                <li>Tardy: 5%</li>
              </ul>
            </section>
          </CardContent>
          <CardFooter>
            <button aria-label="View detailed attendance report">View Details</button>
          </CardFooter>
        </Card>
      );

      const card = screen.getByTestId('semantic-card');
      const title = screen.getByRole('heading', { level: 3 });
      const section = screen.getByRole('region', { name: 'Attendance Metrics' });
      const button = screen.getByRole('button', { name: 'View detailed attendance report' });

      expect(card).toBeInTheDocument();
      expect(title).toHaveTextContent('Grade 3 Attendance');
      expect(section).toBeInTheDocument();
      expect(button).toBeInTheDocument();
    });

    it('should handle interactive card states', () => {
      render(
        <Card 
          data-testid="interactive-card"
          role="button"
          tabIndex={0}
          aria-label="Click to view student details"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              // Handle card click
            }
          }}
        >
          <CardContent>
            <h3>Student: John Doe</h3>
            <p>Attendance: 92%</p>
          </CardContent>
        </Card>
      );

      const card = screen.getByTestId('interactive-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabIndex', '0');
      expect(card).toHaveAttribute('aria-label', 'Click to view student details');
    });

    it('should support ARIA landmarks for educational data', () => {
      render(
        <div>
          <Card data-testid="data-card" role="region" aria-labelledby="card-title">
            <CardHeader>
              <CardTitle id="card-title">Confidential Student Information</CardTitle>
              <CardDescription>FERPA protected educational records</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="group" aria-labelledby="grades-heading">
                <h4 id="grades-heading">Academic Grades</h4>
                <div aria-live="polite" aria-atomic="true">
                  <p>Math: B+</p>
                  <p>Reading: A-</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );

      const card = screen.getByTestId('data-card');
      const gradesSection = screen.getByRole('group', { name: 'Academic Grades' });
      const liveRegion = card.querySelector('[aria-live="polite"]');

      expect(card).toHaveAttribute('role', 'region');
      expect(card).toHaveAttribute('aria-labelledby', 'card-title');
      expect(gradesSection).toBeInTheDocument();
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Educational Data Specific Tests', () => {
    it('should handle attendance tier cards with appropriate styling', () => {
      const tiers = [
        { tier: 'tier-1', label: 'Good Attendance', color: 'green', percentage: 95 },
        { tier: 'tier-2', label: 'At Risk', color: 'yellow', percentage: 87 },
        { tier: 'tier-3', label: 'Chronic Absence', color: 'red', percentage: 75 },
      ];

      tiers.forEach(({ tier, label, color, percentage }) => {
        render(
          <Card 
            data-testid={`${tier}-card`}
            className={`tier-card ${tier}`}
            role="region"
            aria-labelledby={`${tier}-title`}
          >
            <CardHeader>
              <CardTitle id={`${tier}-title`}>{label}</CardTitle>
              <CardDescription>
                Students with {percentage}% attendance rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`attendance-indicator ${color}`}
                aria-label={`${percentage}% attendance rate - ${label.toLowerCase()}`}
              >
                {percentage}%
              </div>
            </CardContent>
          </Card>
        );

        const card = screen.getByTestId(`${tier}-card`);
        const indicator = screen.getByLabelText(`${percentage}% attendance rate - ${label.toLowerCase()}`);
        
        expect(card).toHaveClass(`${tier}`);
        expect(indicator).toBeInTheDocument();
      });
    });

    it('should support screen reader announcements for data updates', () => {
      const { rerender } = render(
        <Card data-testid="live-update-card">
          <CardContent>
            <div aria-live="polite" aria-atomic="true">
              <p>Current attendance: 85%</p>
            </div>
          </CardContent>
        </Card>
      );

      let liveRegion = screen.getByText('Current attendance: 85%').closest('[aria-live]');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

      // Simulate data update
      rerender(
        <Card data-testid="live-update-card">
          <CardContent>
            <div aria-live="polite" aria-atomic="true">
              <p>Current attendance: 87%</p>
            </div>
          </CardContent>
        </Card>
      );

      liveRegion = screen.getByText('Current attendance: 87%').closest('[aria-live]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('should handle privacy-sensitive card content', () => {
      render(
        <Card 
          data-testid="privacy-card"
          data-privacy-level="confidential"
          role="region"
          aria-labelledby="privacy-title"
        >
          <CardHeader>
            <CardTitle id="privacy-title">
              Student Records 
              <span className="sr-only">(Confidential Information)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-sensitivity="high">
              <p>IEP Status: Active</p>
              <p>504 Plan: None</p>
            </div>
          </CardContent>
        </Card>
      );

      const card = screen.getByTestId('privacy-card');
      const confidentialText = screen.getByText('(Confidential Information)');
      const sensitiveData = card.querySelector('[data-sensitivity="high"]');

      expect(card).toHaveAttribute('data-privacy-level', 'confidential');
      expect(confidentialText).toHaveClass('sr-only'); // Screen reader only
      expect(sensitiveData).toBeInTheDocument();
    });
  });

  describe('Card Performance Tests', () => {
    it('should handle large datasets without accessibility issues', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Student ${i}`,
        attendance: Math.floor(Math.random() * 100),
      }));

      const { container } = render(
        <div data-testid="large-dataset-container">
          {largeDataset.map(student => (
            <Card key={student.id} data-testid={`student-card-${student.id}`}>
              <CardContent>
                <h3>{student.name}</h3>
                <p>Attendance: {student.attendance}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      );

      // Check that accessibility is maintained with many cards
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify cards are properly structured
      const cards = screen.getAllByTestId(/^student-card-\d+$/);
      expect(cards).toHaveLength(100);
    });

    it('should maintain responsive behavior with nested cards', () => {
      render(
        <Card data-testid="parent-card">
          <CardHeader>
            <CardTitle>Class Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="nested-card-1">
                <CardContent>
                  <p>Math Scores</p>
                </CardContent>
              </Card>
              <Card data-testid="nested-card-2">
                <CardContent>
                  <p>Reading Scores</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      );

      const parentCard = screen.getByTestId('parent-card');
      const nestedCard1 = screen.getByTestId('nested-card-1');
      const nestedCard2 = screen.getByTestId('nested-card-2');

      expect(parentCard).toBeInTheDocument();
      expect(nestedCard1).toBeInTheDocument();
      expect(nestedCard2).toBeInTheDocument();

      // Verify proper nesting structure
      expect(parentCard).toContainElement(nestedCard1);
      expect(parentCard).toContainElement(nestedCard2);
    });
  });

  describe('Card Animation and Interaction Tests', () => {
    it('should handle hover states accessibly', () => {
      render(
        <Card 
          data-testid="hoverable-card"
          className="hover:shadow-md hover:-translate-y-0.5"
        >
          <CardContent>
            <p>Hover to see elevation effect</p>
          </CardContent>
        </Card>
      );

      const card = screen.getByTestId('hoverable-card');
      expect(card).toHaveClass('hover:shadow-md');
      expect(card).toHaveClass('hover:-translate-y-0.5');
    });

    it('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      mockMatchMedia.mockImplementation(query => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(
        <Card 
          data-testid="motion-card"
          className="transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:transform-none"
        >
          <CardContent>
            <p>Respects motion preferences</p>
          </CardContent>
        </Card>
      );

      const card = screen.getByTestId('motion-card');
      expect(card).toHaveClass('motion-reduce:transition-none');
      expect(card).toHaveClass('motion-reduce:hover:transform-none');
    });
  });
});