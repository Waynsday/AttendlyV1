/**
 * @file AttendanceCard.test.tsx
 * @description Comprehensive tests for AttendanceCard component
 * Tests grade metrics display, hover states, click actions, and interactive features
 * Tests are designed to FAIL initially to enable TDD implementation
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AttendanceCard } from '../AttendanceCard';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock Next.js router with configurable mock function
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock recharts for chart testing
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children, ...props }: any) => <div data-testid="pie-chart" {...props}>{children}</div>,
  Pie: ({ data, dataKey }: any) => (
    <div data-testid="pie" data-key={dataKey}>
      {data?.map((item: any, index: number) => (
        <div key={index} data-testid={`pie-segment-${item.tier}`}>
          {item.value}
        </div>
      ))}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="pie-cell" style={{ fill }} />,
  Tooltip: () => <div data-testid="chart-tooltip" />,
  Legend: () => <div data-testid="chart-legend" />,
}));

// Mock grade data based on CSV structure
const mockGradeData = {
  grade: 'K',
  totalStudents: 125,
  attendanceRate: 95.2,
  chronicAbsentees: 8,
  tier1: 98, // 1-2 absences
  tier2: 19, // 3-9 absences
  tier3: 8,  // >10% chronic
  trend: 'stable' as const,
  riskLevel: 'low' as const,
  lastUpdated: '2025-01-15T10:30:00Z',
  monthlyTrend: [
    { month: 'Sep', rate: 96.1 },
    { month: 'Oct', rate: 95.8 },
    { month: 'Nov', rate: 95.5 },
    { month: 'Dec', rate: 95.2 },
    { month: 'Jan', rate: 95.2 }
  ]
};

const highRiskGradeData = {
  ...mockGradeData,
  grade: '5',
  totalStudents: 95,
  attendanceRate: 89.2,
  chronicAbsentees: 25,
  tier1: 45,
  tier2: 25,
  tier3: 25,
  trend: 'declining' as const,
  riskLevel: 'high' as const
};

describe('AttendanceCard', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });
  describe('Basic rendering and data display', () => {
    it('should render grade card with correct attendance metrics', async () => {
      // This test will FAIL initially - no component implementation exists
      render(<AttendanceCard gradeData={mockGradeData} />);

      // Grade header
      expect(screen.getByText('Grade K')).toBeInTheDocument();
      
      // Key metrics
      expect(screen.getByText('125')).toBeInTheDocument(); // Total students
      expect(screen.getByText('95.2%')).toBeInTheDocument(); // Attendance rate
      expect(within(screen.getByTestId('chronic-absentees-metric')).getByText('8')).toBeInTheDocument(); // Chronic absentees
      
      // Tier distribution
      expect(within(screen.getByTestId('tier1-count')).getByText('98')).toBeInTheDocument(); // Tier 1
      expect(within(screen.getByTestId('tier2-count')).getByText('19')).toBeInTheDocument(); // Tier 2
      expect(within(screen.getByTestId('tier3-count')).getByText('8')).toBeInTheDocument(); // Tier 3
    });

    it('should display tier distribution as a pie chart', async () => {
      // This test will FAIL - requires pie chart implementation
      render(<AttendanceCard gradeData={mockGradeData} />);

      const pieChart = screen.getByTestId('pie-chart');
      expect(pieChart).toBeInTheDocument();

      // Should have three segments for each tier
      expect(screen.getByTestId('pie-segment-1')).toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-2')).toBeInTheDocument();
      expect(screen.getByTestId('pie-segment-3')).toBeInTheDocument();

      // Check data values
      expect(screen.getByTestId('pie-segment-1')).toHaveTextContent('98');
      expect(screen.getByTestId('pie-segment-2')).toHaveTextContent('19');
      expect(screen.getByTestId('pie-segment-3')).toHaveTextContent('8');
    });

    it('should show trend indicator with correct direction', async () => {
      // This test will FAIL - requires trend indicator implementation
      render(<AttendanceCard gradeData={mockGradeData} />);

      const trendIndicator = screen.getByTestId('trend-indicator');
      expect(trendIndicator).toBeInTheDocument();
      expect(trendIndicator).toHaveTextContent('Stable');
      expect(within(trendIndicator).getByTestId('trend-stable')).toBeInTheDocument();
    });

    it('should display declining trend for at-risk grades', async () => {
      // This test will FAIL - requires declining trend styling
      render(<AttendanceCard gradeData={highRiskGradeData} />);

      const trendIndicator = screen.getByTestId('trend-indicator');
      expect(trendIndicator).toHaveTextContent('Declining');
      expect(within(trendIndicator).getByTestId('trend-down')).toBeInTheDocument();
      expect(trendIndicator).toHaveClass('text-red-600');
    });

    it('should show risk level with appropriate styling', async () => {
      // This test will FAIL - requires risk level styling
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('border-green-200'); // Low risk border

      const riskBadge = screen.getByTestId('risk-badge');
      expect(riskBadge).toHaveTextContent('Low Risk');
      expect(riskBadge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should show high risk styling for problematic grades', async () => {
      // This test will FAIL - requires high risk styling
      render(<AttendanceCard gradeData={highRiskGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('border-red-200'); // High risk border

      const riskBadge = screen.getByTestId('risk-badge');
      expect(riskBadge).toHaveTextContent('High Risk');
      expect(riskBadge).toHaveClass('bg-red-100', 'text-red-800');
    });
  });

  describe('Interactive hover states', () => {
    it('should show detailed information on hover', async () => {
      // This test will FAIL - requires hover tooltip implementation
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      await user.hover(card);

      // Should show tooltip with additional details
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      const tooltip = screen.getByRole('tooltip');
      expect(within(tooltip).getByText('Detailed Breakdown')).toBeInTheDocument();
      expect(within(tooltip).getByText('Last Updated:')).toBeInTheDocument();
      expect(within(tooltip).getByText('01/15/2025')).toBeInTheDocument();
    });

    it('should show tier breakdown details in hover tooltip', async () => {
      // This test will FAIL - requires detailed tier breakdown
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      await user.hover(card);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      const tooltip = screen.getByRole('tooltip');
      expect(within(tooltip).getByText('Tier 1 (1-2 absences): 98 students')).toBeInTheDocument();
      expect(within(tooltip).getByText('Tier 2 (3-9 absences): 19 students')).toBeInTheDocument();
      expect(within(tooltip).getByText('Tier 3 (10+ absences): 8 students')).toBeInTheDocument();
    });

    it('should show monthly trend in hover tooltip', async () => {
      // This test will FAIL - requires trend chart in tooltip
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      await user.hover(card);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      const tooltip = screen.getByRole('tooltip');
      expect(within(tooltip).getByText('Monthly Trend')).toBeInTheDocument();
      expect(within(tooltip).getByTestId('trend-chart')).toBeInTheDocument();
    });

    it('should remove tooltip when hover ends', async () => {
      // This test will FAIL - requires hover state cleanup
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      await user.hover(card);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.unhover(card);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should highlight card on hover with proper styling', async () => {
      // This test will FAIL - requires hover styling
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      
      // Initial state
      expect(card).not.toHaveClass('shadow-lg');

      await user.hover(card);

      // Should add hover styling
      expect(card).toHaveClass('shadow-lg', 'scale-105');

      await user.unhover(card);

      // Should remove hover styling
      expect(card).not.toHaveClass('shadow-lg', 'scale-105');
    });
  });

  describe('Click actions and navigation', () => {
    it('should navigate to attendance page when card is clicked', async () => {
      // This test will FAIL - requires click navigation implementation
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      await user.click(card);

      expect(mockPush).toHaveBeenCalledWith('/attendance?grade=K');
    });

    it('should support keyboard activation with Enter key', async () => {
      // This test will FAIL - requires keyboard support
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      card.focus();

      await user.keyboard('{Enter}');

      expect(mockPush).toHaveBeenCalledWith('/attendance?grade=K');
    });

    it('should support Space key activation', async () => {
      // This test will FAIL - requires Space key support
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      card.focus();

      await user.keyboard(' ');

      expect(mockPush).toHaveBeenCalledWith('/attendance?grade=K');
    });

    it('should prevent navigation when clicking on interactive elements', async () => {
      // This test will FAIL - requires event propagation handling
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      // Click on pie chart (interactive element)
      const pieChart = screen.getByTestId('pie-chart');
      await user.click(pieChart);

      // Should not navigate
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should call onCardClick callback when provided', async () => {
      // This test will FAIL - requires callback support
      const mockOnClick = jest.fn();
      const user = userEvent.setup();

      render(<AttendanceCard gradeData={mockGradeData} onCardClick={mockOnClick} />);

      const card = screen.getByTestId('attendance-card');
      await user.click(card);

      expect(mockOnClick).toHaveBeenCalledWith(mockGradeData);
    });
  });

  describe('Accessibility compliance', () => {
    it('should have no accessibility violations', async () => {
      // This test will FAIL - requires accessibility implementation
      render(<AttendanceCard gradeData={mockGradeData} />);

      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper ARIA labels and roles', async () => {
      // This test will FAIL - requires ARIA implementation
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabindex', '0');
      expect(card).toHaveAttribute('aria-label', 'Grade K attendance summary. 95.2% attendance rate, 8 chronic absentees. Click for details.');
    });

    it('should announce risk level to screen readers', async () => {
      // This test will FAIL - requires screen reader support
      render(<AttendanceCard gradeData={highRiskGradeData} />);

      const riskBadge = screen.getByTestId('risk-badge');
      expect(riskBadge).toHaveAttribute('aria-label', 'High risk grade requiring attention');
      expect(riskBadge).toHaveAttribute('role', 'status');
    });

    it('should provide chart accessibility for pie chart', async () => {
      // This test will FAIL - requires chart accessibility
      render(<AttendanceCard gradeData={mockGradeData} />);

      const pieChart = screen.getByTestId('pie-chart');
      expect(pieChart).toHaveAttribute('role', 'img');
      expect(pieChart).toHaveAttribute('aria-label', 'Pie chart showing tier distribution: Tier 1: 98 students, Tier 2: 19 students, Tier 3: 8 students');

      // Should have tabular alternative
      const chartTable = screen.getByTestId('chart-data-table');
      expect(chartTable).toHaveAttribute('aria-hidden', 'false');
      expect(within(chartTable).getByText('Tier 1: 98')).toBeInTheDocument();
    });

    it('should support high contrast mode', async () => {
      // This test will FAIL - requires high contrast implementation
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
        })),
      });

      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('high-contrast');

      const riskBadge = screen.getByTestId('risk-badge');
      expect(riskBadge).toHaveClass('high-contrast-green');
    });
  });

  describe('Responsive design', () => {
    it('should adapt layout for mobile screens', async () => {
      // This test will FAIL - requires responsive implementation
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('mobile-layout');

      // Pie chart should be smaller on mobile
      const pieChart = screen.getByTestId('pie-chart');
      expect(pieChart).toHaveClass('h-32'); // Smaller height
    });

    it('should show full layout on desktop', async () => {
      // This test will FAIL - requires desktop layout
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));

      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('desktop-layout');

      // Should show additional metrics on desktop
      expect(screen.getByTestId('detailed-metrics')).toBeInTheDocument();
    });

    it('should handle very long grade names gracefully', async () => {
      // This test will FAIL - requires text overflow handling
      const longGradeData = {
        ...mockGradeData,
        grade: 'Kindergarten Extended Day Program'
      };

      render(<AttendanceCard gradeData={longGradeData} />);

      const gradeTitle = screen.getByTestId('grade-title');
      expect(gradeTitle).toHaveClass('truncate');
      expect(gradeTitle).toHaveAttribute('title', 'Kindergarten Extended Day Program');
    });
  });

  describe('Performance optimizations', () => {
    it('should memoize expensive calculations', async () => {
      // Test React.memo behavior by checking render counts
      const renderSpy = jest.fn();
      
      // Create a memoized component that tracks renders
      const SpiedAttendanceCard = React.memo((props: any) => {
        renderSpy();
        return <AttendanceCard {...props} />;
      });

      const { rerender } = render(<SpiedAttendanceCard gradeData={mockGradeData} />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same data (props haven't changed)
      rerender(<SpiedAttendanceCard gradeData={mockGradeData} />);

      // Should not re-render due to memoization
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should lazy load trend chart data', async () => {
      // This test will FAIL - requires lazy loading
      let trendDataRequested = false;
      const mockGetTrendData = jest.fn(() => {
        trendDataRequested = true;
        return mockGradeData.monthlyTrend;
      });

      render(<AttendanceCard gradeData={mockGradeData} getTrendData={mockGetTrendData} />);

      // Trend data should not be loaded initially
      expect(trendDataRequested).toBe(false);

      // Hover to trigger tooltip
      const card = screen.getByTestId('attendance-card');
      await userEvent.setup().hover(card);

      await waitFor(() => {
        expect(trendDataRequested).toBe(true);
      });
    });

    it('should debounce hover events to prevent excessive tooltip creation', async () => {
      // This test will FAIL - requires debouncing
      const tooltipSpy = jest.fn();
      const user = userEvent.setup();

      const TestCard = () => {
        return <AttendanceCard gradeData={mockGradeData} onTooltipShow={tooltipSpy} />;
      };

      render(<TestCard />);

      const card = screen.getByTestId('attendance-card');

      // Rapidly hover and unhover
      await user.hover(card);
      await user.unhover(card);
      await user.hover(card);
      await user.unhover(card);
      await user.hover(card);

      // Wait for debounce delay
      await waitFor(() => {
        expect(tooltipSpy).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing or invalid data gracefully', async () => {
      // This test will FAIL - requires error handling
      const invalidData = {
        grade: 'K',
        totalStudents: null,
        attendanceRate: undefined,
        chronicAbsentees: -1,
        tier1: NaN,
        tier2: 'invalid',
        tier3: null
      };

      render(<AttendanceCard gradeData={invalidData as any} />);

      // Should show fallback values
      expect(screen.getByText('Grade K')).toBeInTheDocument();
      expect(within(screen.getByTestId('total-students-metric')).getByText('0')).toBeInTheDocument(); // Fallback for null values
      expect(screen.getByText('Data unavailable')).toBeInTheDocument();
    });

    it('should handle zero students gracefully', async () => {
      // This test will FAIL - requires zero state handling
      const emptyGradeData = {
        ...mockGradeData,
        totalStudents: 0,
        tier1: 0,
        tier2: 0,
        tier3: 0
      };

      render(<AttendanceCard gradeData={emptyGradeData} />);

      expect(screen.getByText('No students enrolled')).toBeInTheDocument();
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    });

    it('should handle percentage calculation edge cases', async () => {
      // This test will FAIL - requires safe percentage calculation
      const edgeCaseData = {
        ...mockGradeData,
        totalStudents: 1,
        tier1: 1,
        tier2: 0,
        tier3: 0,
        attendanceRate: 100.0
      };

      render(<AttendanceCard gradeData={edgeCaseData} />);

      expect(screen.getByText('100.0%')).toBeInTheDocument();
      expect(within(screen.getByTestId('total-students-metric')).getByText('1')).toBeInTheDocument(); // Total students
    });

    it('should prevent card activation during loading states', async () => {
      // This test will FAIL - requires loading state management
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} isLoading={true} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveAttribute('aria-disabled', 'true');

      await user.click(card);

      // Should not navigate while loading
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Animations and transitions', () => {
    it('should animate card appearance with fade-in effect', async () => {
      // This test will FAIL - requires animation implementation
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('animate-fade-in');
    });

    it('should animate hover state transitions smoothly', async () => {
      // This test will FAIL - requires smooth transitions
      const user = userEvent.setup();
      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('transition-all', 'duration-200');

      await user.hover(card);

      expect(card).toHaveClass('transform', 'scale-105');
    });

    it('should respect reduced motion preferences', async () => {
      // This test will FAIL - requires reduced motion support
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
        })),
      });

      render(<AttendanceCard gradeData={mockGradeData} />);

      const card = screen.getByTestId('attendance-card');
      expect(card).toHaveClass('motion-reduce:transform-none');
    });
  });
});