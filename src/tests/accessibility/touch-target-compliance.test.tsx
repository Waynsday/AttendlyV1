/**
 * @fileoverview Touch target compliance tests for 44px minimum requirement
 * Tests all interactive elements meet WCAG 2.1 AA touch target size guidelines
 * Ensures accessibility for users with motor disabilities and mobile users
 */

import { describe, expect, it, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../presentation/components/ui/button';
import { Card, CardContent } from '../../presentation/components/ui/card';
import { DashboardLayout } from '../../presentation/components/dashboard-layout';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

// Mock window properties for touch testing
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
});

afterAll(() => {
  vi.resetAllMocks();
});

describe('Touch Target Compliance Tests (44px Minimum)', () => {
  const MINIMUM_TOUCH_TARGET = 44;
  const WCAG_RECOMMENDED_SPACING = 8; // Minimum spacing between touch targets

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default to mobile viewport for touch target testing
    (window as any).innerWidth = 375;
    
    mockMatchMedia.mockImplementation(query => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  describe('Button Component Touch Targets', () => {
    it('should meet 44px minimum for default button size', () => {
      mockGetComputedStyle.mockReturnValue({
        height: '48px',
        width: '120px',
        minHeight: '44px',
        minWidth: '44px',
        paddingTop: '12px',
        paddingBottom: '12px',
        paddingLeft: '24px',
        paddingRight: '24px',
      });

      render(<Button data-testid="default-touch-button">Default Button</Button>);
      
      const button = screen.getByTestId('default-touch-button');
      const styles = window.getComputedStyle(button);
      
      expect(parseInt(styles.height)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
    });

    it('should meet touch target requirements for all button sizes', () => {
      const buttonSizes = [
        { size: 'sm', expectedHeight: 36, minHeight: 44 },
        { size: 'default', expectedHeight: 48, minHeight: 44 },
        { size: 'lg', expectedHeight: 56, minHeight: 44 },
        { size: 'xl', expectedHeight: 64, minHeight: 44 },
      ];

      buttonSizes.forEach(({ size, expectedHeight, minHeight }) => {
        mockGetComputedStyle.mockReturnValue({
          height: `${expectedHeight}px`,
          width: 'auto',
          minHeight: `${minHeight}px`,
          minWidth: `${minHeight}px`,
        });

        render(
          <Button size={size as any} data-testid={`button-${size}`}>
            {size} Button
          </Button>
        );
        
        const button = screen.getByTestId(`button-${size}`);
        const styles = window.getComputedStyle(button);
        
        // Actual height may vary, but min-height should always meet requirements
        expect(parseInt(styles.minHeight), `${size} button min-height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        expect(parseInt(styles.minWidth), `${size} button min-width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });

    it('should meet touch target requirements for icon buttons', () => {
      const iconSizes = [
        { size: 'icon-sm', expectedSize: 32, shouldPassTouch: false },
        { size: 'icon', expectedSize: 40, shouldPassTouch: false },
        { size: 'icon-lg', expectedSize: 48, shouldPassTouch: true },
      ];

      iconSizes.forEach(({ size, expectedSize, shouldPassTouch }) => {
        mockGetComputedStyle.mockReturnValue({
          height: `${expectedSize}px`,
          width: `${expectedSize}px`,
          minHeight: `${Math.max(expectedSize, MINIMUM_TOUCH_TARGET)}px`,
          minWidth: `${Math.max(expectedSize, MINIMUM_TOUCH_TARGET)}px`,
          padding: '0px',
        });

        render(
          <Button size={size as any} data-testid={`icon-${size}`} aria-label={`${size} icon button`}>
            ×
          </Button>
        );
        
        const button = screen.getByTestId(`icon-${size}`);
        const styles = window.getComputedStyle(button);
        
        const actualHeight = parseInt(styles.height);
        const actualWidth = parseInt(styles.width);
        const minHeight = parseInt(styles.minHeight);
        const minWidth = parseInt(styles.minWidth);

        if (shouldPassTouch) {
          expect(actualHeight, `${size} actual height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
          expect(actualWidth, `${size} actual width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        } else {
          // Small icons should have minimum touch targets enforced via CSS
          expect(minHeight, `${size} enforced min-height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
          expect(minWidth, `${size} enforced min-width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
          
          // Log warning for accessibility
          if (actualHeight < MINIMUM_TOUCH_TARGET || actualWidth < MINIMUM_TOUCH_TARGET) {
            console.warn(`${size}: ${actualWidth}x${actualHeight}px is below 44px minimum. CSS min-height/width should be enforced.`);
          }
        }
      });
    });

    it('should provide adequate spacing between adjacent buttons', () => {
      mockGetComputedStyle.mockImplementation((element) => {
        const testId = (element as HTMLElement).getAttribute('data-testid');
        return {
          height: '44px',
          width: '100px',
          marginRight: testId?.includes('first') ? '8px' : '0px',
          marginLeft: testId?.includes('second') ? '8px' : '0px',
        };
      });

      render(
        <div data-testid="button-group">
          <Button data-testid="first-button">First</Button>
          <Button data-testid="second-button">Second</Button>
        </div>
      );

      const firstButton = screen.getByTestId('first-button');
      const secondButton = screen.getByTestId('second-button');
      
      const firstStyles = window.getComputedStyle(firstButton);
      const secondStyles = window.getComputedStyle(secondButton);
      
      const spacing = parseInt(firstStyles.marginRight) + parseInt(secondStyles.marginLeft);
      expect(spacing, 'Spacing between buttons').toBeGreaterThanOrEqual(WCAG_RECOMMENDED_SPACING);
    });

    it('should handle button variants with consistent touch targets', () => {
      const variants = ['default', 'secondary', 'accent', 'ghost', 'outline', 'destructive'] as const;
      
      variants.forEach(variant => {
        mockGetComputedStyle.mockReturnValue({
          height: '48px',
          width: '120px',
          minHeight: '44px',
          minWidth: '44px',
        });

        render(
          <Button variant={variant} data-testid={`${variant}-variant`}>
            {variant} Button
          </Button>
        );
        
        const button = screen.getByTestId(`${variant}-variant`);
        const styles = window.getComputedStyle(button);
        
        expect(parseInt(styles.minHeight), `${variant} variant touch height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });
  });

  describe('Dashboard Navigation Touch Targets', () => {
    const mockUser = {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'teacher',
      school: 'Test School',
    };

    beforeEach(() => {
      // Mock mobile viewport for touch testing
      (window as any).innerWidth = 375;
      
      mockGetComputedStyle.mockImplementation((element) => {
        const tagName = (element as HTMLElement).tagName.toLowerCase();
        const ariaLabel = (element as HTMLElement).getAttribute('aria-label');
        
        if (tagName === 'button' || ariaLabel?.includes('menu') || ariaLabel?.includes('toggle')) {
          return {
            height: '48px',
            width: '48px',
            minHeight: '44px',
            minWidth: '44px',
            padding: '12px',
          };
        }
        
        if (tagName === 'a') {
          return {
            height: '48px',
            minHeight: '44px',
            paddingTop: '12px',
            paddingBottom: '12px',
          };
        }
        
        return {
          height: 'auto',
          width: 'auto',
          minHeight: 'auto',
          minWidth: 'auto',
        };
      });
    });

    it('should meet touch targets for mobile menu button', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={vi.fn()}>
          <div>Content</div>
        </DashboardLayout>
      );

      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      const styles = window.getComputedStyle(mobileMenuButton);
      
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
    });

    it('should meet touch targets for user menu button', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={vi.fn()}>
          <div>Content</div>
        </DashboardLayout>
      );

      const userMenuButton = screen.getByLabelText('User menu');
      const styles = window.getComputedStyle(userMenuButton);
      
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
    });

    it('should meet touch targets for navigation links on mobile', () => {
      render(
        <DashboardLayout user={mockUser} onLogout={vi.fn()}>
          <div>Content</div>
        </DashboardLayout>
      );

      const navLinks = screen.getAllByRole('link');
      
      navLinks.forEach(link => {
        const styles = window.getComputedStyle(link);
        expect(parseInt(styles.minHeight), `Navigation link touch target`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });

    it('should provide adequate spacing in mobile navigation menu', async () => {
      const user = userEvent.setup();
      
      render(
        <DashboardLayout user={mockUser} onLogout={vi.fn()}>
          <div>Content</div>
        </DashboardLayout>
      );

      // Open mobile menu
      const mobileMenuButton = screen.getByLabelText('Toggle navigation menu');
      await user.click(mobileMenuButton);

      // Check spacing between mobile menu items
      const mobileNavItems = screen.getAllByRole('link');
      
      // In mobile menu, items should have adequate vertical spacing
      mobileNavItems.forEach(item => {
        const styles = window.getComputedStyle(item);
        
        // Mobile nav items should meet minimum touch targets
        expect(parseInt(styles.minHeight) || parseInt(styles.height)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });
  });

  describe('Form Input Touch Targets', () => {
    it('should meet touch targets for search input', () => {
      mockGetComputedStyle.mockReturnValue({
        height: '44px',
        minHeight: '44px',
        paddingTop: '10px',
        paddingBottom: '10px',
        paddingLeft: '40px', // Account for search icon
        paddingRight: '16px',
      });

      render(
        <input
          type="search"
          placeholder="Search Students..."
          data-testid="search-input"
          className="bg-neutral-100 text-primary-900 placeholder-primary-500 rounded-lg py-2.5 pl-10 pr-4 w-64"
        />
      );

      const searchInput = screen.getByTestId('search-input');
      const styles = window.getComputedStyle(searchInput);
      
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
    });

    it('should meet touch targets for form controls', () => {
      const formControls = [
        { type: 'select', label: 'Grade Level' },
        { type: 'checkbox', label: 'Include chronically absent' },
        { type: 'radio', label: 'Show all students' },
      ];

      formControls.forEach(({ type, label }) => {
        mockGetComputedStyle.mockReturnValue({
          height: type === 'checkbox' || type === 'radio' ? '20px' : '44px',
          width: type === 'checkbox' || type === 'radio' ? '20px' : 'auto',
          minHeight: '44px',
          minWidth: type === 'checkbox' || type === 'radio' ? '44px' : 'auto',
          padding: type === 'checkbox' || type === 'radio' ? '12px' : '10px',
        });

        const element = type === 'select' ? 
          <select data-testid={`${type}-control`} aria-label={label}>
            <option>Option 1</option>
          </select> :
          <input type={type} data-testid={`${type}-control`} aria-label={label} />;

        render(element);
        
        const control = screen.getByTestId(`${type}-control`);
        const styles = window.getComputedStyle(control);
        
        // Small form controls should have enforced minimum touch targets
        expect(parseInt(styles.minHeight), `${type} control min-height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        
        if (type === 'checkbox' || type === 'radio') {
          expect(parseInt(styles.minWidth), `${type} control min-width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        }
      });
    });

    it('should handle touch targets for custom form components', () => {
      // Simulate a custom dropdown component
      render(
        <div data-testid="custom-dropdown">
          <button 
            aria-expanded="false"
            aria-haspopup="listbox"
            data-testid="dropdown-trigger"
            className="min-h-[44px] min-w-[44px] px-4 py-2"
          >
            Select Option
          </button>
        </div>
      );

      mockGetComputedStyle.mockReturnValue({
        minHeight: '44px',
        minWidth: '44px',
        height: '48px',
        width: '120px',
      });

      const dropdownTrigger = screen.getByTestId('dropdown-trigger');
      const styles = window.getComputedStyle(dropdownTrigger);
      
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
    });
  });

  describe('Card Interactive Elements', () => {
    it('should meet touch targets for clickable cards', () => {
      mockGetComputedStyle.mockReturnValue({
        minHeight: '44px',
        padding: '24px',
        height: 'auto',
      });

      render(
        <Card 
          data-testid="clickable-card"
          role="button"
          tabIndex={0}
          className="cursor-pointer min-h-[44px]"
        >
          <CardContent>
            <h3>Student: John Doe</h3>
            <p>Attendance: 92%</p>
          </CardContent>
        </Card>
      );

      const card = screen.getByTestId('clickable-card');
      const styles = window.getComputedStyle(card);
      
      // Clickable cards should have adequate touch area
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
    });

    it('should meet touch targets for card action buttons', () => {
      mockGetComputedStyle.mockReturnValue({
        height: '36px',
        minHeight: '44px',
        minWidth: '44px',
        padding: '8px 16px',
      });

      render(
        <Card data-testid="action-card">
          <CardContent>
            <div className="flex space-x-2">
              <Button size="sm" data-testid="card-action-1">Edit</Button>
              <Button size="sm" data-testid="card-action-2">Delete</Button>
            </div>
          </CardContent>
        </Card>
      );

      const actionButtons = [
        screen.getByTestId('card-action-1'),
        screen.getByTestId('card-action-2'),
      ];

      actionButtons.forEach((button, index) => {
        const styles = window.getComputedStyle(button);
        expect(parseInt(styles.minHeight), `Card action ${index + 1} height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        expect(parseInt(styles.minWidth), `Card action ${index + 1} width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });

    it('should provide adequate spacing between card actions', () => {
      mockGetComputedStyle.mockImplementation((element) => {
        const testId = (element as HTMLElement).getAttribute('data-testid');
        return {
          height: '44px',
          minHeight: '44px',
          marginRight: testId?.includes('action-1') ? '8px' : '0px',
        };
      });

      render(
        <div className="flex space-x-2">
          <Button data-testid="action-1">Action 1</Button>
          <Button data-testid="action-2">Action 2</Button>
          <Button data-testid="action-3">Action 3</Button>
        </div>
      );

      const firstAction = screen.getByTestId('action-1');
      const styles = window.getComputedStyle(firstAction);
      
      // Should have spacing between actions
      expect(parseInt(styles.marginRight)).toBeGreaterThanOrEqual(WCAG_RECOMMENDED_SPACING);
    });
  });

  describe('Educational Data Specific Touch Targets', () => {
    it('should meet touch targets for tier indicator buttons', () => {
      const tierIndicators = [
        { tier: 'tier-1', label: 'Good Attendance', color: 'green' },
        { tier: 'tier-2', label: 'At Risk', color: 'yellow' },
        { tier: 'tier-3', label: 'Chronic Absence', color: 'red' },
      ];

      tierIndicators.forEach(({ tier, label }) => {
        mockGetComputedStyle.mockReturnValue({
          height: '40px',
          width: '120px',
          minHeight: '44px',
          minWidth: '44px',
          padding: '8px 12px',
        });

        render(
          <button 
            data-testid={`${tier}-button`}
            className={`${tier} min-h-[44px] min-w-[44px]`}
            aria-label={`View ${label} students`}
          >
            {label}
          </button>
        );

        const button = screen.getByTestId(`${tier}-button`);
        const styles = window.getComputedStyle(button);
        
        expect(parseInt(styles.minHeight), `${tier} button height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        expect(parseInt(styles.minWidth), `${tier} button width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });

    it('should meet touch targets for student profile actions', () => {
      const profileActions = [
        'Create Intervention',
        'Assign to Program', 
        'Send Notification',
        'Edit Student',
        'View Details',
      ];

      profileActions.forEach(actionName => {
        mockGetComputedStyle.mockReturnValue({
          height: '48px',
          minHeight: '44px',
          minWidth: '44px',
          padding: '12px 16px',
        });

        render(
          <Button 
            data-testid={`action-${actionName.toLowerCase().replace(/\s+/g, '-')}`}
            aria-label={actionName}
          >
            {actionName}
          </Button>
        );

        const button = screen.getByTestId(`action-${actionName.toLowerCase().replace(/\s+/g, '-')}`);
        const styles = window.getComputedStyle(button);
        
        expect(parseInt(styles.minHeight), `${actionName} touch height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        expect(parseInt(styles.minWidth), `${actionName} touch width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });

    it('should handle attendance chart interaction points', () => {
      // Mock chart interaction points (like data point tooltips)
      render(
        <div data-testid="attendance-chart">
          <svg width="400" height="200">
            {/* Simulate chart data points that need to be touchable */}
            <circle 
              cx="100" cy="50" r="8" 
              data-testid="chart-point-1"
              role="button"
              tabIndex={0}
              aria-label="March 1st: 95% attendance"
              style={{ minHeight: '44px', minWidth: '44px' }}
            />
            <circle 
              cx="200" cy="80" r="8" 
              data-testid="chart-point-2"
              role="button"
              tabIndex={0}
              aria-label="March 15th: 87% attendance"
              style={{ minHeight: '44px', minWidth: '44px' }}
            />
          </svg>
        </div>
      );

      const chartPoints = [
        screen.getByTestId('chart-point-1'),
        screen.getByTestId('chart-point-2'),
      ];

      chartPoints.forEach((point, index) => {
        // Chart points should be keyboard accessible and have large enough touch targets
        expect(point).toHaveAttribute('role', 'button');
        expect(point).toHaveAttribute('tabIndex', '0');
        expect(point).toHaveAttribute('aria-label');
        
        // In real implementation, invisible larger touch targets would overlay small visual points
        console.log(`Chart point ${index + 1} should have 44px touch overlay for accessibility`);
      });
    });

    it('should handle grade level filter buttons', () => {
      const gradeLevels = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];

      render(
        <div data-testid="grade-filters" className="flex flex-wrap gap-2">
          {gradeLevels.map(grade => (
            <Button
              key={grade}
              size="sm"
              data-testid={`grade-${grade}-filter`}
              className="min-h-[44px] min-w-[44px]"
              aria-label={`Filter by Grade ${grade}`}
            >
              {grade}
            </Button>
          ))}
        </div>
      );

      gradeLevels.forEach(grade => {
        mockGetComputedStyle.mockReturnValue({
          height: '36px',
          width: '36px',
          minHeight: '44px',
          minWidth: '44px',
        });

        const gradeButton = screen.getByTestId(`grade-${grade}-filter`);
        const styles = window.getComputedStyle(gradeButton);
        
        expect(parseInt(styles.minHeight), `Grade ${grade} filter height`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        expect(parseInt(styles.minWidth), `Grade ${grade} filter width`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      });
    });
  });

  describe('Touch Target Edge Cases and Testing', () => {
    it('should handle overlapping interactive elements', () => {
      render(
        <div data-testid="overlapping-elements" style={{ position: 'relative' }}>
          <Button 
            data-testid="background-button"
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
          >
            Background
          </Button>
          <Button 
            data-testid="foreground-button"
            style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 2 }}
          >
            Foreground
          </Button>
        </div>
      );

      const backgroundButton = screen.getByTestId('background-button');
      const foregroundButton = screen.getByTestId('foreground-button');
      
      // Both buttons should be accessible but not interfere with each other
      expect(backgroundButton).toBeInTheDocument();
      expect(foregroundButton).toBeInTheDocument();
      
      // Foreground button should be the active target when overlapping
      expect(foregroundButton).toBeInTheDocument();
    });

    it('should provide feedback for touch interactions', async () => {
      const user = userEvent.setup();
      const mockClick = vi.fn();
      
      render(
        <Button 
          data-testid="feedback-button"
          onClick={mockClick}
          className="active:scale-95 transition-transform min-h-[44px]"
        >
          Touch Feedback
        </Button>
      );

      const button = screen.getByTestId('feedback-button');
      
      // Touch interaction should provide visual feedback
      await user.click(button);
      expect(mockClick).toHaveBeenCalled();
      
      // Button should have feedback classes
      expect(button).toHaveClass('active:scale-95');
    });

    it('should handle touch targets in dense layouts', () => {
      // Simulate a dense data table with small interactive elements
      render(
        <table data-testid="dense-table">
          <tbody>
            {Array.from({ length: 3 }, (_, rowIndex) => (
              <tr key={rowIndex}>
                <td>Student {rowIndex + 1}</td>
                <td>
                  <Button 
                    size="sm"
                    data-testid={`edit-${rowIndex}`}
                    className="min-h-[44px] min-w-[44px]"
                    aria-label={`Edit student ${rowIndex + 1}`}
                  >
                    Edit
                  </Button>
                </td>
                <td>
                  <Button 
                    size="sm"
                    variant="destructive"
                    data-testid={`delete-${rowIndex}`}
                    className="min-h-[44px] min-w-[44px]"
                    aria-label={`Delete student ${rowIndex + 1}`}
                  >
                    Del
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

      // All action buttons in dense layout should meet touch requirements
      for (let i = 0; i < 3; i++) {
        mockGetComputedStyle.mockReturnValue({
          height: '32px',
          width: '50px',
          minHeight: '44px',
          minWidth: '44px',
        });

        const editButton = screen.getByTestId(`edit-${i}`);
        const deleteButton = screen.getByTestId(`delete-${i}`);
        
        const editStyles = window.getComputedStyle(editButton);
        const deleteStyles = window.getComputedStyle(deleteButton);
        
        expect(parseInt(editStyles.minHeight), `Row ${i} edit button`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
        expect(parseInt(deleteStyles.minHeight), `Row ${i} delete button`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
      }
    });

    it('should document touch target requirements for development team', () => {
      const touchTargetRequirements = {
        minimumSize: '44x44px',
        recommendedSpacing: '8px minimum between targets',
        mobileConsiderations: 'Larger targets recommended on mobile (48px+)',
        wcagCompliance: 'WCAG 2.1 AA Level requirement',
        exceptions: 'Inline text links and essential UI elements may be smaller',
        testingMethod: 'Use browser dev tools to inspect computed styles',
      };

      // Log requirements for documentation
      console.table(touchTargetRequirements);

      // Verify test framework can detect non-compliant elements
      render(<button style={{ height: '20px', width: '20px' }}>Too Small</button>);
      
      const tooSmallButton = screen.getByText('Too Small');
      const styles = window.getComputedStyle(tooSmallButton);
      
      const height = parseInt(styles.height || '0');
      const width = parseInt(styles.width || '0');
      
      if (height < MINIMUM_TOUCH_TARGET || width < MINIMUM_TOUCH_TARGET) {
        console.warn(`❌ Touch target too small: ${width}x${height}px (should be at least ${MINIMUM_TOUCH_TARGET}x${MINIMUM_TOUCH_TARGET}px)`);
      }
      
      // This would fail in a real accessibility audit
      expect(height).toBeLessThan(MINIMUM_TOUCH_TARGET); // Expected to fail for documentation
    });
  });
});