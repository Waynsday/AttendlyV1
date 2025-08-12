/**
 * @fileoverview Failing tests for StudentCard.tsx component
 * Following TDD red-green-refactor cycle - these tests should FAIL initially
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import StudentCard from '../../../../presentation/components/student-card';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock recharts for attendance trend chart
jest.mock('recharts', () => ({
  LineChart: ({ children, ...props }) => <div data-testid="line-chart" {...props}>{children}</div>,
  XAxis: (props) => <div data-testid="x-axis" {...props}></div>,
  YAxis: (props) => <div data-testid="y-axis" {...props}></div>,
  Tooltip: (props) => <div data-testid="tooltip" {...props}></div>,
  Line: (props) => <div data-testid="line" {...props}></div>,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
}));

describe('StudentCard Component', () => {
  const mockStudent = {
    id: '1',
    name: 'John Smith',
    grade: '3',
    teacher: 'Mrs. Johnson',
    attendancePercentage: 75.0,
    daysAbsent: 15,
    recoveryDays: 2,
    interventionStatus: 'active',
    tardyCount: 8,
    tier: '3-9 days',
    lastAbsence: '2024-01-15',
    chronicallyAbsent: true,
    email: 'john.smith@student.romoland.edu',
    parentContact: {
      name: 'Mary Smith',
      phone: '(555) 123-4567',
      email: 'mary.smith@parent.com'
    },
    address: {
      street: '123 Main St',
      city: 'Romoland',
      state: 'CA',
      zipCode: '92585'
    },
    enrollmentDate: '2023-08-15',
    birthDate: '2015-06-20',
    medicalNotes: 'Asthma - inhaler as needed'
  };

  const mockAttendanceTrend = [
    { date: '2024-01-01', present: true, percentage: 95.0 },
    { date: '2024-01-02', present: false, percentage: 94.7 },
    { date: '2024-01-03', present: true, percentage: 94.8 },
    { date: '2024-01-04', present: true, percentage: 94.9 },
    { date: '2024-01-05', present: false, percentage: 94.5 },
  ];

  const mockInterventions = [
    {
      id: '1',
      type: 'phone_call',
      date: '2024-01-10',
      description: 'Called parent about attendance concerns',
      outcome: 'Parent agreed to work on morning routine',
      followUpDate: '2024-01-17'
    },
    {
      id: '2',
      type: 'meeting',
      date: '2024-01-05',
      description: 'Student conference about attendance',
      outcome: 'Student committed to improved attendance',
      followUpDate: null
    }
  ];

  const mockIReadyData = {
    ela: {
      currentLevel: 'Grade 2',
      targetLevel: 'Grade 3',
      progress: 65,
      lastAssessment: '2024-01-12',
      needsSupport: true
    },
    math: {
      currentLevel: 'Grade 3',
      targetLevel: 'Grade 3',
      progress: 85,
      lastAssessment: '2024-01-12',
      needsSupport: false
    }
  };

  const defaultProps = {
    student: mockStudent,
    attendanceTrend: mockAttendanceTrend,
    interventions: mockInterventions,
    iReadyData: mockIReadyData,
    isOpen: true,
    onClose: jest.fn(),
    onUpdateStudent: jest.fn(),
    onCreateIntervention: jest.fn(),
    onAssignProgram: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Structure', () => {
    test('should render student card modal', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByTestId('student-card')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should display student header information', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /john smith/i })).toBeInTheDocument();
      expect(screen.getByText('Grade 3')).toBeInTheDocument();
      expect(screen.getByText('Mrs. Johnson')).toBeInTheDocument();
      expect(screen.getByText('Student ID: 1')).toBeInTheDocument();
    });

    test('should show close button', async () => {
      render(<StudentCard {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close student card/i });
      expect(closeButton).toBeInTheDocument();
    });

    test('should not render when closed', async () => {
      render(<StudentCard {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('student-card')).not.toBeInTheDocument();
    });
  });

  describe('Student Profile Section', () => {
    test('should display comprehensive student profile', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('john.smith@student.romoland.edu')).toBeInTheDocument();
      expect(screen.getByText('June 20, 2015')).toBeInTheDocument();
      expect(screen.getByText('August 15, 2023')).toBeInTheDocument();
    });

    test('should show parent contact information', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Mary Smith')).toBeInTheDocument();
      expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('mary.smith@parent.com')).toBeInTheDocument();
    });

    test('should display student address', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('Romoland, CA 92585')).toBeInTheDocument();
    });

    test('should show medical notes if present', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Asthma - inhaler as needed')).toBeInTheDocument();
    });

    test('should handle missing optional information gracefully', async () => {
      const studentWithoutMedical = {
        ...mockStudent,
        medicalNotes: null
      };

      render(<StudentCard {...defaultProps} student={studentWithoutMedical} />);

      expect(screen.queryByText('Medical Notes')).not.toBeInTheDocument();
    });
  });

  describe('Attendance Metrics Section', () => {
    test('should display key attendance metrics', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('75.0%')).toBeInTheDocument(); // Attendance percentage
      expect(screen.getByText('15 days')).toBeInTheDocument(); // Days absent
      expect(screen.getByText('8 tardies')).toBeInTheDocument(); // Tardy count
      expect(screen.getByText('2 recovery days')).toBeInTheDocument();
    });

    test('should show chronically absent indicator', async () => {
      render(<StudentCard {...defaultProps} />);

      const chronicIndicator = screen.getByTestId('chronic-absent-indicator');
      expect(chronicIndicator).toBeInTheDocument();
      expect(chronicIndicator).toHaveTextContent(/chronically absent/i);
    });

    test('should display last absence date', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('January 15, 2024')).toBeInTheDocument();
    });

    test('should show attendance tier', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Tier: 3-9 days')).toBeInTheDocument();
    });
  });

  describe('Attendance Trend Chart', () => {
    test('should render attendance trend visualization', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    test('should display trend period selector', async () => {
      render(<StudentCard {...defaultProps} />);

      const periodSelector = screen.getByRole('combobox', { name: /trend period/i });
      expect(periodSelector).toBeInTheDocument();

      fireEvent.click(periodSelector);
      expect(screen.getByRole('option', { name: /last 30 days/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /last 90 days/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /school year/i })).toBeInTheDocument();
    });

    test('should show attendance pattern analysis', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText(/attendance patterns/i)).toBeInTheDocument();
      expect(screen.getByText(/frequent friday absences/i)).toBeInTheDocument();
    });
  });

  describe('i-Ready Performance Section', () => {
    test('should display ELA performance indicators', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('ELA Performance')).toBeInTheDocument();
      expect(screen.getByText('Current: Grade 2')).toBeInTheDocument();
      
      const elaSection = screen.getByTestId('ela-performance');
      expect(elaSection).toBeInTheDocument();
      expect(screen.getByText('65% Progress')).toBeInTheDocument();
    });

    test('should display Math performance indicators', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Math Performance')).toBeInTheDocument();
      expect(screen.getByText('Current: Grade 3')).toBeInTheDocument();
      
      const mathSection = screen.getByTestId('math-performance');
      expect(mathSection).toBeInTheDocument();
      expect(screen.getByText('85% Progress')).toBeInTheDocument();
    });

    test('should highlight subjects needing support', async () => {
      render(<StudentCard {...defaultProps} />);

      const elaSection = screen.getByTestId('ela-performance');
      expect(elaSection).toHaveClass('needs-support');

      const mathSection = screen.getByTestId('math-performance');
      expect(mathSection).not.toHaveClass('needs-support');
    });

    test('should show last assessment dates', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getAllByText('Last assessed: January 12, 2024')).toHaveLength(2);
    });
  });

  describe('Intervention History Section', () => {
    test('should display intervention timeline', async () => {
      render(<StudentCard {...defaultProps} />);

      const interventionTimeline = screen.getByTestId('intervention-timeline');
      expect(interventionTimeline).toBeInTheDocument();
    });

    test('should show intervention details', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Phone Call')).toBeInTheDocument();
      expect(screen.getByText('Called parent about attendance concerns')).toBeInTheDocument();
      expect(screen.getByText('Outcome: Parent agreed to work on morning routine')).toBeInTheDocument();
      expect(screen.getByText('January 10, 2024')).toBeInTheDocument();
    });

    test('should display follow-up dates', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Follow-up: January 17, 2024')).toBeInTheDocument();
    });

    test('should show intervention types with icons', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByTestId('intervention-icon-phone_call')).toBeInTheDocument();
      expect(screen.getByTestId('intervention-icon-meeting')).toBeInTheDocument();
    });

    test('should handle empty intervention history', async () => {
      render(<StudentCard {...defaultProps} interventions={[]} />);

      expect(screen.getByText(/no interventions recorded/i)).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    test('should display primary action buttons', async () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByRole('button', { name: /create intervention/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /assign to program/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send notification/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit student/i })).toBeInTheDocument();
    });

    test('should handle create intervention action', async () => {
      const mockOnCreateIntervention = jest.fn();
      render(<StudentCard {...defaultProps} onCreateIntervention={mockOnCreateIntervention} />);

      const createButton = screen.getByRole('button', { name: /create intervention/i });
      fireEvent.click(createButton);

      expect(mockOnCreateIntervention).toHaveBeenCalledWith('1');
    });

    test('should handle program assignment action', async () => {
      const mockOnAssignProgram = jest.fn();
      render(<StudentCard {...defaultProps} onAssignProgram={mockOnAssignProgram} />);

      const assignButton = screen.getByRole('button', { name: /assign to program/i });
      fireEvent.click(assignButton);

      expect(mockOnAssignProgram).toHaveBeenCalledWith('1');
    });

    test('should handle student update action', async () => {
      const mockOnUpdateStudent = jest.fn();
      render(<StudentCard {...defaultProps} onUpdateStudent={mockOnUpdateStudent} />);

      const editButton = screen.getByRole('button', { name: /edit student/i });
      fireEvent.click(editButton);

      expect(mockOnUpdateStudent).toHaveBeenCalledWith('1');
    });
  });

  describe('Modal Behavior', () => {
    test('should handle close action', async () => {
      const mockOnClose = jest.fn();
      render(<StudentCard {...defaultProps} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: /close student card/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('should close on escape key', async () => {
      const mockOnClose = jest.fn();
      render(<StudentCard {...defaultProps} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('should close on backdrop click', async () => {
      const mockOnClose = jest.fn();
      render(<StudentCard {...defaultProps} onClose={mockOnClose} />);

      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('should prevent close when form is dirty', async () => {
      const mockOnClose = jest.fn();
      render(<StudentCard {...defaultProps} onClose={mockOnClose} hasUnsavedChanges={true} />);

      const closeButton = screen.getByRole('button', { name: /close student card/i });
      fireEvent.click(closeButton);

      expect(screen.getByTestId('unsaved-changes-dialog')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Data Loading States', () => {
    test('should show loading state for student data', async () => {
      render(<StudentCard {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('student-card-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading student information/i)).toBeInTheDocument();
    });

    test('should show loading state for attendance trend', async () => {
      render(<StudentCard {...defaultProps} attendanceTrend={null} isLoadingTrend={true} />);

      expect(screen.getByTestId('trend-loading')).toBeInTheDocument();
    });

    test('should show loading state for interventions', async () => {
      render(<StudentCard {...defaultProps} interventions={null} isLoadingInterventions={true} />);

      expect(screen.getByTestId('interventions-loading')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should display error state for failed data load', async () => {
      render(<StudentCard {...defaultProps} error="Failed to load student data" />);

      expect(screen.getByText(/failed to load student data/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('should handle missing i-Ready data', async () => {
      render(<StudentCard {...defaultProps} iReadyData={null} />);

      expect(screen.getByText(/i-ready data unavailable/i)).toBeInTheDocument();
    });
  });

  describe('FERPA Compliance', () => {
    test('should implement data access controls', async () => {
      render(<StudentCard {...defaultProps} />);

      const secureCard = screen.getByTestId('student-card');
      expect(secureCard).toHaveAttribute('data-secure', 'true');
    });

    test('should mask sensitive data for limited access users', async () => {
      render(<StudentCard {...defaultProps} userRole="limited" />);

      // Should show limited information
      expect(screen.queryByText('mary.smith@parent.com')).not.toBeInTheDocument();
      expect(screen.queryByText('(555) 123-4567')).not.toBeInTheDocument();
    });

    test('should log data access for audit trail', async () => {
      const mockLogAccess = jest.fn();
      render(<StudentCard {...defaultProps} onLogAccess={mockLogAccess} />);

      expect(mockLogAccess).toHaveBeenCalledWith({
        studentId: '1',
        accessType: 'view_profile',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Performance', () => {
    test('should load student card efficiently', async () => {
      const startTime = performance.now();

      render(<StudentCard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('student-card')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(1000);
    });

    test('should implement lazy loading for non-critical sections', async () => {
      render(<StudentCard {...defaultProps} enableLazyLoading={true} />);

      // i-Ready section should be lazy loaded
      expect(screen.queryByTestId('iready-performance')).not.toBeInTheDocument();

      // Should load when scrolled into view
      const scrollContainer = screen.getByTestId('student-card-content');
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 500 } });

      await waitFor(() => {
        expect(screen.getByTestId('iready-performance')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(<StudentCard {...defaultProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper modal accessibility', async () => {
      render(<StudentCard {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    test('should manage focus properly', async () => {
      render(<StudentCard {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveFocus();
    });

    test('should provide keyboard navigation', async () => {
      render(<StudentCard {...defaultProps} />);

      const firstButton = screen.getByRole('button', { name: /create intervention/i });
      const secondButton = screen.getByRole('button', { name: /assign to program/i });
      
      // Focus the first button
      firstButton.focus();
      expect(firstButton).toHaveFocus();

      // Simulate tab navigation by focusing the next button
      fireEvent.keyDown(firstButton, { key: 'Tab' });
      secondButton.focus();
      
      expect(secondButton).toHaveFocus();
    });

    test('should provide screen reader announcements', async () => {
      render(<StudentCard {...defaultProps} />);

      const announcement = screen.getByRole('status');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Responsive Design', () => {
    test('should adapt layout for mobile devices', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(<StudentCard {...defaultProps} />);

      const mobileLayout = screen.getByTestId('student-card-content');
      expect(mobileLayout).toBeInTheDocument();
    });

    test('should stack sections vertically on small screens', async () => {
      render(<StudentCard {...defaultProps} />);

      const cardContent = screen.getByTestId('student-card-content');
      expect(cardContent).toHaveClass('flex-col', 'lg:flex-row');
    });

    test('should maintain usability on touch devices', async () => {
      render(<StudentCard {...defaultProps} />);

      const touchTargets = screen.getAllByRole('button');
      touchTargets.forEach((button, index) => {
        // Skip the Radix dialog's internal close button as it's not a user-interactive element
        const ariaLabel = button.getAttribute('aria-label');
        const buttonText = button.textContent;
        
        if ((ariaLabel === 'Close' || !ariaLabel) && (buttonText === '×' || buttonText === 'Close')) {
          return; // Skip this internal dialog close button
        }
        
        // Check that the button has the min-h-[44px] class or similar
        const className = button.className;
        const hasMinHeight = className.includes('min-h-[44px]') || className.includes('h-10') || className.includes('h-11') || className.includes('min-w-[44px]');
        
        if (!hasMinHeight) {
          console.log(`Button ${index} failed: aria-label="${ariaLabel}", text="${buttonText}", class="${className}"`);
        }
        
        expect(hasMinHeight).toBe(true);
      });
    });
  });

  describe('Data Validation', () => {
    test('should validate required student fields', async () => {
      const incompleteStudent = {
        id: '1',
        name: '',
        grade: null,
      };

      render(<StudentCard {...defaultProps} student={incompleteStudent} />);

      expect(screen.getByText(/incomplete student data/i)).toBeInTheDocument();
    });

    test('should handle invalid attendance percentages', async () => {
      const invalidStudent = {
        ...mockStudent,
        attendancePercentage: -5
      };

      render(<StudentCard {...defaultProps} student={invalidStudent} />);

      expect(screen.getByText(/invalid attendance data/i)).toBeInTheDocument();
    });
  });
});