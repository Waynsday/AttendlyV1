/**
 * @file StudentSideCard.test.tsx
 * @description Comprehensive tests for StudentSideCard component
 * Tests slide-in behavior, data display, keyboard navigation, and accessibility
 * Tests are designed to FAIL initially to enable TDD implementation
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StudentSideCard } from '../StudentSideCard';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock framer-motion for animation testing
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => (
      <div 
        data-testid="motion-div"
        data-initial={JSON.stringify(initial)}
        data-animate={JSON.stringify(animate)}
        data-exit={JSON.stringify(exit)}
        data-transition={JSON.stringify(transition)}
        {...props}
      >
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

// Mock student data
const mockStudentData = {
  id: 'STU001',
  firstName: 'John',
  lastName: 'Doe',
  grade: 'K',
  teacherName: 'Ms. Smith',
  attendanceRate: 94.5,
  totalAbsences: 8,
  chronicAbsences: 2,
  tier: 1 as const,
  lastAbsenceDate: '2025-01-14',
  
  attendanceHistory: [
    { date: '2025-01-15', status: 'present', notes: null },
    { date: '2025-01-14', status: 'absent', notes: 'Sick' },
    { date: '2025-01-13', status: 'present', notes: null },
    { date: '2025-01-12', status: 'tardy', notes: 'Traffic' },
    { date: '2025-01-11', status: 'present', notes: null }
  ],

  iReadyScores: {
    currentYear: {
      ela: { diagnostic1: { score: 485, placement: 'On Grade Level' } },
      math: { diagnostic1: { score: 456, placement: 'Below Grade Level' } }
    },
    previousYear: {
      ela: { diagnostic1: { score: 445, placement: 'On Grade Level' } },
      math: { diagnostic1: { score: 423, placement: 'Below Grade Level' } }
    }
  },

  interventions: [
    {
      id: 'INT001',
      type: 'attendance',
      status: 'active',
      description: 'Daily check-in with counselor'
    }
  ],

  conferences: [
    {
      id: 'CONF001',
      date: '2024-12-15',
      type: 'parent-teacher',
      notes: 'Discussed attendance concerns'
    }
  ]
};

// Mock fetch globally
global.fetch = jest.fn();

describe('StudentSideCard', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: mockStudentData }),
    });
  });

  describe('Slide-in animation behavior', () => {
    it('should slide in from the right when opened', async () => {
      // This test will FAIL initially - no component implementation exists
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      const motionDiv = screen.getByTestId('motion-div');
      
      // Should have correct animation properties
      expect(motionDiv).toHaveAttribute('data-initial', '{"x":"100%","opacity":0}');
      expect(motionDiv).toHaveAttribute('data-animate', '{"x":"0%","opacity":1}');
      expect(motionDiv).toHaveAttribute('data-transition', '{"type":"spring","damping":25,"stiffness":200}');
    });

    it('should slide out to the right when closed', async () => {
      // This test will FAIL - requires exit animation implementation
      const { rerender } = render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      // Initially open
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();

      // Close the card
      rerender(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={false} 
          onClose={jest.fn()} 
        />
      );

      const motionDiv = screen.getByTestId('motion-div');
      expect(motionDiv).toHaveAttribute('data-exit', '{"x":"100%","opacity":0}');
    });

    it('should not render when isOpen is false initially', () => {
      // This test will FAIL - requires conditional rendering
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={false} 
          onClose={jest.fn()} 
        />
      );

      expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument();
    });

    it('should handle animation interruption gracefully', async () => {
      // This test will FAIL - requires animation state management
      const { rerender } = render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      // Rapidly toggle open/close during animation
      rerender(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={false} 
          onClose={jest.fn()} 
        />
      );

      rerender(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      // Should handle state changes without crashing
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });
  });

  describe('Student data display', () => {
    it('should display student basic information correctly', async () => {
      // This test will FAIL - requires data loading and display implementation
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      // Should show loading initially
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.getByText(/Grade K/)).toBeInTheDocument();
      expect(screen.getByText('Ms. Smith')).toBeInTheDocument();
      expect(screen.getByText('94.5%')).toBeInTheDocument(); // Attendance rate
    });

    it('should display attendance metrics with proper formatting', async () => {
      // This test will FAIL - requires attendance metrics display
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const attendanceSection = screen.getByTestId('attendance-metrics');
      expect(within(attendanceSection).getByText('Total Absences: 8')).toBeInTheDocument();
      expect(within(attendanceSection).getByText('Chronic Absences: 2')).toBeInTheDocument();
      expect(within(attendanceSection).getByText('Tier 1')).toBeInTheDocument();
    });

    it('should show tier badge with correct styling', async () => {
      // This test will FAIL - requires tier badge implementation
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const tierBadge = screen.getByTestId('tier-badge');
      expect(tierBadge).toHaveTextContent('Tier 1');
      expect(tierBadge).toHaveClass('bg-green-100', 'text-green-800');
      expect(tierBadge).toHaveAttribute('aria-label', 'Tier 1: Low risk');
    });

    it('should display recent attendance history', async () => {
      // This test will FAIL - requires attendance history display
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const historySection = screen.getByTestId('attendance-history');
      expect(within(historySection).getByText('Recent Attendance')).toBeInTheDocument();
      
      // Should show recent days
      expect(within(historySection).getByText('01/15')).toBeInTheDocument();
      expect(within(historySection).getByText('01/14')).toBeInTheDocument();
      
      // Should show status indicators
      expect(within(historySection).getByTestId('status-present')).toBeInTheDocument();
      expect(within(historySection).getByTestId('status-absent')).toBeInTheDocument();
    });

    it('should display iReady scores with trend indicators', async () => {
      // This test will FAIL - requires iReady score display
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const scoresSection = screen.getByTestId('iready-scores');
      expect(within(scoresSection).getByText('iReady Scores')).toBeInTheDocument();
      
      // Current year scores
      expect(within(scoresSection).getByText('ELA: 485')).toBeInTheDocument();
      expect(within(scoresSection).getByText('Math: 456')).toBeInTheDocument();
      
      // Placement levels
      expect(within(scoresSection).getByText('On Grade Level')).toBeInTheDocument();
      expect(within(scoresSection).getByText('Below Grade Level')).toBeInTheDocument();
      
      // Trend indicators (compared to previous year)
      expect(within(scoresSection).getByTestId('ela-trend-up')).toBeInTheDocument();
      expect(within(scoresSection).getByTestId('math-trend-up')).toBeInTheDocument();
    });
  });

  describe('Interactive features', () => {
    it('should close when close button is clicked', async () => {
      // This test will FAIL - requires close button implementation
      const mockOnClose = jest.fn();
      const user = userEvent.setup();

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={mockOnClose} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close when clicking outside the card', async () => {
      // This test will FAIL - requires outside click detection
      const mockOnClose = jest.fn();
      const user = userEvent.setup();

      render(
        <div data-testid="container">
          <StudentSideCard 
            studentId="STU001" 
            isOpen={true} 
            onClose={mockOnClose} 
          />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click outside the card (on the overlay)
      const overlay = screen.getByTestId('overlay');
      await user.click(overlay);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking inside the card', async () => {
      // This test will FAIL - requires click event handling
      const mockOnClose = jest.fn();
      const user = userEvent.setup();

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={mockOnClose} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click inside the card content
      const studentName = screen.getByText('John Doe');
      await user.click(studentName);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should expand/collapse sections when clicked', async () => {
      // This test will FAIL - requires collapsible sections
      const user = userEvent.setup();

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Initially, attendance history should be expanded
      const historySection = screen.getByTestId('attendance-history');
      expect(within(historySection).getByText('01/15')).toBeInTheDocument();

      // Click to collapse
      const historyToggle = within(historySection).getByRole('button', { name: /toggle attendance history/i });
      await user.click(historyToggle);

      await waitFor(() => {
        expect(screen.queryByText('01/15')).not.toBeInTheDocument();
      });

      // Click to expand again
      await user.click(historyToggle);

      await waitFor(() => {
        expect(screen.getByText('01/15')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard navigation', () => {
    it('should close when Escape key is pressed', async () => {
      // This test will FAIL - requires keyboard event handling
      const mockOnClose = jest.fn();
      const user = userEvent.setup();

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={mockOnClose} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Press Escape
      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should trap focus within the card when open', async () => {
      // This test will FAIL - requires focus trap implementation
      const user = userEvent.setup();

      render(
        <div>
          <button>Outside Button</button>
          <StudentSideCard 
            studentId="STU001" 
            isOpen={true} 
            onClose={jest.fn()} 
          />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Focus should be trapped within the card
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();

      // Tab should not go to outside button
      await user.keyboard('{Tab}');
      expect(screen.getByRole('button', { name: /outside button/i })).not.toHaveFocus();
      
      // Should focus next interactive element in card
      const firstSectionToggle = screen.getAllByRole('button')[1]; // After close button
      expect(firstSectionToggle).toHaveFocus();
    });

    it('should support arrow key navigation through sections', async () => {
      // This test will FAIL - requires arrow key navigation
      const user = userEvent.setup();

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const attendanceSection = screen.getByTestId('attendance-metrics');
      attendanceSection.focus();

      // Arrow down should move to next section
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('attendance-history')).toHaveFocus();

      // Arrow up should move back
      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('attendance-metrics')).toHaveFocus();
    });

    it('should announce section changes to screen readers', async () => {
      // This test will FAIL - requires screen reader announcements
      const user = userEvent.setup();

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Should have live region for announcements
      const liveRegion = screen.getByRole('status', { name: /section updates/i });
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');

      // Toggle section
      const historySection = screen.getByTestId('attendance-history');
      const historyToggle = within(historySection).getByRole('button', { name: /toggle attendance history/i });
      await user.click(historyToggle);

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent('Attendance history collapsed');
      });
    });
  });

  describe('Accessibility compliance', () => {
    it('should have no accessibility violations', async () => {
      // This test will FAIL - requires accessibility implementation
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper ARIA labels and roles', async () => {
      // This test will FAIL - requires ARIA implementation
      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const sideCard = screen.getByTestId('motion-div');
      expect(sideCard).toHaveAttribute('role', 'dialog');
      expect(sideCard).toHaveAttribute('aria-modal', 'true');
      expect(sideCard).toHaveAttribute('aria-labelledby', 'student-name-heading');

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveAttribute('aria-label', 'Close student details');
    });

    it('should support high contrast mode', async () => {
      // This test will FAIL - requires high contrast implementation
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
        })),
      });

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const sideCard = screen.getByTestId('motion-div');
      expect(sideCard).toHaveClass('high-contrast');

      const tierBadge = screen.getByTestId('tier-badge');
      expect(tierBadge).toHaveClass('high-contrast-green');
    });

    it('should respect reduced motion preferences', async () => {
      // This test will FAIL - requires reduced motion implementation
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
        })),
      });

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      const motionDiv = screen.getByTestId('motion-div');
      expect(motionDiv).toHaveAttribute('data-transition', '{"duration":0}');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle student data loading errors gracefully', async () => {
      // This test will FAIL - requires error handling implementation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Student not found' }),
      });

      render(
        <StudentSideCard 
          studentId="STU999" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/student not found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle missing student data gracefully', async () => {
      // This test will FAIL - requires partial data handling
      const incompleteStudentData = {
        id: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        grade: 'K',
        // Missing attendance data
        attendanceRate: null,
        attendanceHistory: null,
        iReadyScores: null
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: incompleteStudentData }),
      });

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Should show placeholder for missing data
      expect(screen.getByText('Attendance data unavailable')).toBeInTheDocument();
      expect(screen.getByText('iReady scores unavailable')).toBeInTheDocument();
    });

    it('should handle network timeout gracefully', async () => {
      // This test will FAIL - requires timeout handling
      (global.fetch as jest.Mock).mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate timeout
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: mockStudentData }),
        };
      });

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
          timeout={1000}
        />
      );

      // Should show loading initially
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }, { timeout: 2000 });

      expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
    });

    it('should prevent memory leaks when component unmounts during data loading', async () => {
      // This test will FAIL - requires cleanup implementation
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      // Unmount while data is loading
      unmount();

      // Wait for any async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not log memory leak warnings
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('memory leak')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance considerations', () => {
    it('should memoize student data to prevent unnecessary re-renders', async () => {
      // This test will FAIL - requires memoization implementation
      const renderSpy = jest.fn();
      
      const TestWrapper = ({ studentId }: { studentId: string }) => {
        renderSpy();
        return (
          <StudentSideCard 
            studentId={studentId} 
            isOpen={true} 
            onClose={jest.fn()} 
          />
        );
      };

      const { rerender } = render(<TestWrapper studentId="STU001" />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const initialRenderCount = renderSpy.mock.calls.length;

      // Re-render with same props
      rerender(<TestWrapper studentId="STU001" />);

      // Should not trigger unnecessary re-renders
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount);
    });

    it('should lazy load intervention and conference data', async () => {
      // This test will FAIL - requires lazy loading implementation
      let interventionRequested = false;
      // Mock the interventions endpoint separately
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/interventions')) {
          interventionRequested = true;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockStudentData.interventions }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: mockStudentData }),
        });
      });

      render(
        <StudentSideCard 
          studentId="STU001" 
          isOpen={true} 
          onClose={jest.fn()} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Interventions should not be loaded initially
      expect(interventionRequested).toBe(false);

      // Click to expand interventions section
      const interventionsToggle = screen.getByRole('button', { name: /toggle interventions/i });
      await userEvent.setup().click(interventionsToggle);

      await waitFor(() => {
        expect(interventionRequested).toBe(true);
      });
    });
  });
});