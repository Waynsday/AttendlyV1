/**
 * @file page.test.tsx (Dashboard)
 * @description Comprehensive tests for Dashboard page server component
 * Tests server-side data fetching, KPI rendering, grade-level cards, and responsive layout
 * Tests are designed to FAIL initially to enable TDD implementation
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { server } from '../../../tests/mocks/server';
import { http, HttpResponse } from 'msw';
import DashboardPage from '../page';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock dashboard data based on CSV structure from References/
const mockDashboardData = {
  schoolMetrics: {
    totalStudents: 1250,
    overallAttendanceRate: 94.2,
    chronicAbsentees: 125, // 10% of students
    tier1Count: 850, // 68% - 1-2 absences
    tier2Count: 275, // 22% - 3-9 absences  
    tier3Count: 125, // 10% - chronic (>10%)
    lastUpdated: '2025-01-15T10:30:00Z'
  },
  gradeBreakdown: [
    {
      grade: 'K',
      totalStudents: 125,
      attendanceRate: 95.2,
      chronicAbsentees: 8,
      tier1: 98,
      tier2: 19,
      tier3: 8,
      trend: 'stable',
      riskLevel: 'low'
    },
    {
      grade: '1',
      totalStudents: 130,
      attendanceRate: 94.8,
      chronicAbsentees: 12,
      tier1: 95,
      tier2: 23,
      tier3: 12,
      trend: 'improving',
      riskLevel: 'low'
    },
    {
      grade: '2',
      totalStudents: 118,
      attendanceRate: 93.1,
      chronicAbsentees: 18,
      tier1: 78,
      tier2: 22,
      tier3: 18,
      trend: 'declining',
      riskLevel: 'medium'
    },
    {
      grade: '5',
      totalStudents: 95,
      attendanceRate: 89.2,
      chronicAbsentees: 25,
      tier1: 45,
      tier2: 25,
      tier3: 25,
      trend: 'declining',
      riskLevel: 'high'
    }
  ],
  alerts: [
    {
      id: 'ALERT001',
      type: 'chronic_absence_spike',
      grade: '5',
      message: 'Grade 5 chronic absence rate increased by 15% this month',
      severity: 'high',
      timestamp: '2025-01-15T09:00:00Z'
    },
    {
      id: 'ALERT002',
      type: 'intervention_needed',
      grade: '2',
      message: '18 students in Grade 2 require intervention',
      severity: 'medium',
      timestamp: '2025-01-15T08:30:00Z'
    }
  ],
  recentActivity: [
    {
      id: 'ACT001',
      type: 'intervention_assigned',
      studentName: 'Student A',
      grade: '5',
      description: 'Daily check-in intervention assigned',
      timestamp: '2025-01-15T10:15:00Z'
    }
  ]
};

describe('Dashboard Page', () => {
  beforeEach(() => {
    server.resetHandlers();
    // Mock successful data fetch
    server.use(
      http.get('/api/dashboard', () => {
        return HttpResponse.json(mockDashboardData);
      })
    );
  });

  describe('Server-side data loading', () => {
    it('should render dashboard with fetched data on initial load', async () => {
      // This test will FAIL initially - no dashboard page implementation exists
      render(<DashboardPage />);

      // Should show loading state initially
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Verify school-wide metrics are displayed
      expect(screen.getByText('1,250')).toBeInTheDocument(); // Total students
      expect(screen.getByText('94.2%')).toBeInTheDocument(); // Overall attendance
      expect(screen.getByText('125')).toBeInTheDocument(); // Chronic absentees
    });

    it('should handle server-side data fetching errors gracefully', async () => {
      // This test will FAIL - requires error boundary implementation
      server.use(
        http.get('/api/dashboard', () => {
          return HttpResponse.json({ error: 'Database connection failed' }, { status: 500 });
        })
      );

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should refresh data when retry button is clicked', async () => {
      // This test will FAIL - requires retry functionality
      let requestCount = 0;
      server.use(
        http.get('/api/dashboard', () => {
          requestCount++;
          if (requestCount === 1) {
            return HttpResponse.json({ error: 'Server error' }, { status: 500 });
          }
          return HttpResponse.json(mockDashboardData);
        })
      );

      const user = userEvent.setup();
      render(<DashboardPage />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should successfully load data on retry
      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      expect(requestCount).toBe(2);
    });
  });

  describe('Grade-level KPI cards', () => {
    it('should render grade cards with correct attendance metrics', async () => {
      // This test will FAIL - requires grade card implementation
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Check Grade K card
      const gradeKCard = screen.getByTestId('grade-card-K');
      expect(within(gradeKCard).getByText('Grade K')).toBeInTheDocument();
      expect(within(gradeKCard).getByText('125')).toBeInTheDocument(); // Total students
      expect(within(gradeKCard).getByText('95.2%')).toBeInTheDocument(); // Attendance rate
      expect(within(gradeKCard).getByText('8')).toBeInTheDocument(); // Chronic absentees

      // Check Grade 5 card (high risk)
      const grade5Card = screen.getByTestId('grade-card-5');
      expect(within(grade5Card).getByText('Grade 5')).toBeInTheDocument();
      expect(within(grade5Card).getByText('89.2%')).toBeInTheDocument(); // Lower attendance
      expect(grade5Card).toHaveClass('border-red-500'); // High risk styling
    });

    it('should display tier distribution visualizations correctly', async () => {
      // This test will FAIL - requires tier visualization implementation
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const gradeKCard = screen.getByTestId('grade-card-K');
      
      // Check tier distribution
      expect(within(gradeKCard).getByText('Tier 1: 98')).toBeInTheDocument();
      expect(within(gradeKCard).getByText('Tier 2: 19')).toBeInTheDocument();
      expect(within(gradeKCard).getByText('Tier 3: 8')).toBeInTheDocument();

      // Should have visual tier indicators (progress bars or charts)
      expect(within(gradeKCard).getByRole('progressbar', { name: /tier distribution/i }))
        .toBeInTheDocument();
    });

    it('should show appropriate risk level indicators', async () => {
      // This test will FAIL - requires risk level styling
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Low risk grade (K)
      const gradeKCard = screen.getByTestId('grade-card-K');
      expect(gradeKCard).toHaveClass('border-green-500');
      expect(within(gradeKCard).getByText('Low Risk')).toBeInTheDocument();

      // High risk grade (5)
      const grade5Card = screen.getByTestId('grade-card-5');
      expect(grade5Card).toHaveClass('border-red-500');
      expect(within(grade5Card).getByText('High Risk')).toBeInTheDocument();
    });

    it('should display trend arrows and indicators', async () => {
      // This test will FAIL - requires trend visualization
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Improving trend (Grade 1)
      const grade1Card = screen.getByTestId('grade-card-1');
      expect(within(grade1Card).getByTestId('trend-up')).toBeInTheDocument();
      expect(within(grade1Card).getByText('Improving')).toBeInTheDocument();

      // Declining trend (Grade 2)
      const grade2Card = screen.getByTestId('grade-card-2');
      expect(within(grade2Card).getByTestId('trend-down')).toBeInTheDocument();
      expect(within(grade2Card).getByText('Declining')).toBeInTheDocument();
    });
  });

  describe('Interactive features', () => {
    it('should navigate to grade details when card is clicked', async () => {
      // This test will FAIL - requires navigation implementation
      const mockPush = jest.fn();
      jest.mocked(require('next/navigation').useRouter).mockReturnValue({
        push: mockPush,
        refresh: jest.fn(),
      });

      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const gradeKCard = screen.getByTestId('grade-card-K');
      await user.click(gradeKCard);

      expect(mockPush).toHaveBeenCalledWith('/attendance?grade=K');
    });

    it('should show grade details popover on hover', async () => {
      // This test will FAIL - requires hover popover implementation
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const gradeKCard = screen.getByTestId('grade-card-K');
      await user.hover(gradeKCard);

      // Should show detailed popover
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      const tooltip = screen.getByRole('tooltip');
      expect(within(tooltip).getByText('Detailed Breakdown')).toBeInTheDocument();
      expect(within(tooltip).getByText('Recent Trend: Stable')).toBeInTheDocument();
    });

    it('should support keyboard navigation between grade cards', async () => {
      // This test will FAIL - requires keyboard navigation
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const gradeKCard = screen.getByTestId('grade-card-K');
      gradeKCard.focus();

      // Tab to next card
      await user.keyboard('{Tab}');
      expect(screen.getByTestId('grade-card-1')).toHaveFocus();

      // Enter should trigger navigation
      await user.keyboard('{Enter}');
      const mockPush = jest.mocked(require('next/navigation').useRouter().push);
      expect(mockPush).toHaveBeenCalledWith('/attendance?grade=1');
    });
  });

  describe('Alerts and notifications', () => {
    it('should display high-priority alerts prominently', async () => {
      // This test will FAIL - requires alert display implementation
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Should have alerts section
      const alertsSection = screen.getByTestId('alerts-section');
      expect(alertsSection).toBeInTheDocument();

      // High severity alert should be prominently displayed
      const highAlert = within(alertsSection).getByTestId('alert-ALERT001');
      expect(highAlert).toHaveClass('bg-red-50', 'border-red-200');
      expect(within(highAlert).getByText(/grade 5 chronic absence rate increased/i))
        .toBeInTheDocument();
    });

    it('should allow dismissing alerts', async () => {
      // This test will FAIL - requires alert dismissal functionality
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const alertsSection = screen.getByTestId('alerts-section');
      const highAlert = within(alertsSection).getByTestId('alert-ALERT001');
      
      // Should have dismiss button
      const dismissButton = within(highAlert).getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      // Alert should be removed
      await waitFor(() => {
        expect(screen.queryByTestId('alert-ALERT001')).not.toBeInTheDocument();
      });
    });

    it('should show alert count badge when collapsed', async () => {
      // This test will FAIL - requires collapsible alerts implementation
      const user = userEvent.setup();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const alertsToggle = screen.getByRole('button', { name: /toggle alerts/i });
      expect(within(alertsToggle).getByText('2')).toBeInTheDocument(); // Alert count badge

      await user.click(alertsToggle);

      // Alerts should collapse/expand
      const alertsSection = screen.getByTestId('alerts-section');
      expect(alertsSection).toHaveClass('collapsed');
    });
  });

  describe('Real-time updates', () => {
    it('should update metrics when real-time data is received', async () => {
      // This test will FAIL - requires real-time subscription implementation
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Initial data
      expect(screen.getByText('94.2%')).toBeInTheDocument();

      // Simulate real-time update
      const updatedData = {
        ...mockDashboardData,
        schoolMetrics: {
          ...mockDashboardData.schoolMetrics,
          overallAttendanceRate: 94.5
        }
      };

      // Mock WebSocket message or Server-Sent Event
      window.dispatchEvent(new CustomEvent('dashboardUpdate', { 
        detail: updatedData 
      }));

      // Should update display
      await waitFor(() => {
        expect(screen.getByText('94.5%')).toBeInTheDocument();
      });
    });

    it('should show real-time sync status indicator', async () => {
      // This test will FAIL - requires sync status implementation
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Should show sync status
      const syncStatus = screen.getByTestId('sync-status');
      expect(within(syncStatus).getByText('Last updated: just now')).toBeInTheDocument();
      expect(within(syncStatus).getByTestId('sync-indicator')).toHaveClass('text-green-500');
    });
  });

  describe('Responsive design', () => {
    it('should display properly on mobile devices', async () => {
      // This test will FAIL - requires responsive implementation
      // Mock narrow viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Grade cards should stack vertically on mobile
      const gradeGrid = screen.getByTestId('grade-grid');
      expect(gradeGrid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');

      // Navigation should be hamburger menu on mobile
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    });

    it('should adapt card layout for tablet screens', async () => {
      // This test will FAIL - requires tablet-specific layout
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const gradeGrid = screen.getByTestId('grade-grid');
      expect(gradeGrid).toHaveClass('md:grid-cols-2');
    });

    it('should show expanded layout on desktop', async () => {
      // This test will FAIL - requires desktop layout optimization
      global.innerWidth = 1440;
      global.dispatchEvent(new Event('resize'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const gradeGrid = screen.getByTestId('grade-grid');
      expect(gradeGrid).toHaveClass('lg:grid-cols-4');

      // Should show sidebar on desktop
      expect(screen.getByTestId('dashboard-sidebar')).toBeInTheDocument();
    });
  });

  describe('Performance with large datasets', () => {
    it('should render efficiently with 13 grade levels (K-12)', async () => {
      // This test will FAIL - requires performance optimization
      const largeGradeData = {
        ...mockDashboardData,
        gradeBreakdown: Array.from({ length: 13 }, (_, i) => ({
          grade: i === 0 ? 'K' : i.toString(),
          totalStudents: 80 + Math.floor(Math.random() * 40),
          attendanceRate: 88 + Math.random() * 10,
          chronicAbsentees: Math.floor(Math.random() * 20),
          tier1: 60 + Math.floor(Math.random() * 20),
          tier2: 15 + Math.floor(Math.random() * 10),
          tier3: 5 + Math.floor(Math.random() * 15),
          trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)],
          riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
        }))
      };

      server.use(
        http.get('/api/dashboard', () => {
          return HttpResponse.json(largeGradeData);
        })
      );

      const startTime = performance.now();
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly even with many grades
      expect(renderTime).toBeLessThan(500);
      expect(screen.getAllByTestId(/grade-card-/)).toHaveLength(13);
    });

    it('should implement virtual scrolling for large alert lists', async () => {
      // This test will FAIL - requires virtual scrolling implementation
      const manyAlerts = Array.from({ length: 100 }, (_, i) => ({
        id: `ALERT${String(i + 1).padStart(3, '0')}`,
        type: 'chronic_absence_spike',
        grade: (i % 13 === 0 ? 'K' : (i % 13).toString()),
        message: `Alert ${i + 1}: Sample attendance issue`,
        severity: ['low', 'medium', 'high'][i % 3],
        timestamp: new Date(Date.now() - i * 60000).toISOString()
      }));

      server.use(
        http.get('/api/dashboard', () => {
          return HttpResponse.json({
            ...mockDashboardData,
            alerts: manyAlerts
          });
        })
      );

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const alertsList = screen.getByTestId('alerts-list');
      expect(alertsList).toHaveClass('virtual-scroll');
      
      // Should only render visible alerts initially
      const visibleAlerts = screen.getAllByTestId(/alert-ALERT/);
      expect(visibleAlerts.length).toBeLessThan(20); // Virtual scrolling threshold
    });
  });

  describe('Accessibility compliance', () => {
    it('should have no accessibility violations', async () => {
      // This test will FAIL - requires accessibility implementation
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper ARIA labels and roles', async () => {
      // This test will FAIL - requires ARIA implementation
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Main content should have proper landmarks
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();

      // Grade cards should have proper labels
      const gradeKCard = screen.getByTestId('grade-card-K');
      expect(gradeKCard).toHaveAttribute('aria-label', 'Grade K attendance summary');
      expect(gradeKCard).toHaveAttribute('role', 'button');
    });

    it('should support screen reader navigation', async () => {
      // This test will FAIL - requires screen reader support
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Should have proper heading hierarchy
      expect(screen.getByRole('heading', { level: 1, name: /school overview/i }))
        .toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4); // One per section

      // Should announce important updates
      const liveRegion = screen.getByRole('status', { name: /live updates/i });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should provide high contrast mode support', async () => {
      // This test will FAIL - requires high contrast implementation  
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      const gradeKCard = screen.getByTestId('grade-card-K');
      expect(gradeKCard).toHaveClass('high-contrast');
    });
  });

  describe('Error boundaries and fallbacks', () => {
    it('should display fallback UI when grade card rendering fails', async () => {
      // This test will FAIL - requires error boundary implementation
      // Mock component error
      const GradeCardError = () => {
        throw new Error('Grade card rendering failed');
      };

      // This would need to be handled by an error boundary
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /reload dashboard/i })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should gracefully handle partial data failures', async () => {
      // This test will FAIL - requires partial failure handling
      server.use(
        http.get('/api/dashboard', () => {
          return HttpResponse.json({
            schoolMetrics: mockDashboardData.schoolMetrics,
            gradeBreakdown: mockDashboardData.gradeBreakdown,
            alerts: null, // Simulated partial failure
            recentActivity: mockDashboardData.recentActivity
          });
        })
      );

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('School Overview')).toBeInTheDocument();
      });

      // Should show main content but indicate missing alerts
      expect(screen.getByText('Grade K')).toBeInTheDocument();
      expect(screen.getByText(/alerts temporarily unavailable/i)).toBeInTheDocument();
    });
  });
});