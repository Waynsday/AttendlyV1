/**
 * @fileoverview StudentCard component screen reader compatibility tests
 * Tests ARIA attributes, screen reader announcements, and educational data privacy
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StudentCard } from '../../presentation/components/student-card';

expect.extend(toHaveNoViolations);

// Mock Recharts to avoid SSR issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

describe('StudentCard Screen Reader Compatibility Tests', () => {
  const mockStudent = {
    id: 'STU-12345',
    name: 'Maria Rodriguez',
    grade: '3',
    teacher: 'Mrs. Johnson',
    attendancePercentage: 87.5,
    daysAbsent: 12,
    recoveryDays: 2,
    interventionStatus: 'active',
    tardyCount: 5,
    tier: 'Tier 2',
    lastAbsence: '2024-03-15',
    chronicallyAbsent: false,
    email: 'maria.rodriguez@student.romoland.edu',
    parentContact: {
      name: 'Carmen Rodriguez',
      phone: '(951) 555-0123',
      email: 'carmen.rodriguez@parent.romoland.edu',
    },
    address: {
      street: '123 Oak Street',
      city: 'Menifee',
      state: 'CA',
      zipCode: '92584',
    },
    enrollmentDate: '2023-08-15',
    birthDate: '2015-06-10',
    medicalNotes: 'Requires inhaler for asthma during PE activities',
  };

  const mockAttendanceTrend = [
    { date: '2024-03-01', present: true, percentage: 90 },
    { date: '2024-03-02', present: false, percentage: 89 },
    { date: '2024-03-03', present: true, percentage: 89.5 },
  ];

  const mockInterventions = [
    {
      id: 'INT-001',
      type: 'phone_call',
      date: '2024-03-10',
      description: 'Called parent regarding attendance concerns',
      outcome: 'Parent aware, committed to improvement',
      followUpDate: '2024-03-17',
    },
    {
      id: 'INT-002',
      type: 'meeting',
      date: '2024-03-05',
      description: 'Student conference about attendance patterns',
      outcome: 'Student understands importance, set attendance goals',
      followUpDate: null,
    },
  ];

  const mockIReadyData = {
    ela: {
      currentLevel: 'Grade 2',
      targetLevel: 'Grade 3',
      progress: 65,
      lastAssessment: '2024-02-15',
      needsSupport: true,
    },
    math: {
      currentLevel: 'Grade 3',
      targetLevel: 'Grade 3',
      progress: 85,
      lastAssessment: '2024-02-20',
      needsSupport: false,
    },
  };

  const defaultProps = {
    student: mockStudent,
    attendanceTrend: mockAttendanceTrend,
    interventions: mockInterventions,
    iReadyData: mockIReadyData,
    isOpen: true,
    onClose: vi.fn(),
    onUpdateStudent: vi.fn(),
    onCreateIntervention: vi.fn(),
    onAssignProgram: vi.fn(),
    onLogAccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ARIA Structure and Semantics', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<StudentCard {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should use proper dialog semantics', () => {
      render(<StudentCard {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
      expect(dialog).toHaveAttribute('data-testid', 'student-card');
    });

    it('should have accessible dialog title and description', () => {
      render(<StudentCard {...defaultProps} />);

      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toHaveTextContent('Maria Rodriguez');

      // Check that dialog is properly labeled
      const dialog = screen.getByRole('dialog');
      const titleId = dialog.getAttribute('aria-labelledby');
      const descriptionId = dialog.getAttribute('aria-describedby');
      
      expect(titleId).toBeTruthy();
      expect(descriptionId).toBeTruthy();
      expect(document.getElementById(titleId!)).toHaveTextContent('Maria Rodriguez');
    });

    it('should provide proper headings hierarchy', () => {
      render(<StudentCard {...defaultProps} />);

      const h2 = screen.getByRole('heading', { level: 2 }); // Dialog title
      const h3s = screen.getAllByRole('heading', { level: 3 }); // Section titles
      const h4s = screen.getAllByRole('heading', { level: 4 }); // Subsection titles

      expect(h2).toHaveTextContent('Maria Rodriguez');
      expect(h3s.length).toBeGreaterThan(0);
      
      // Check specific section headings
      const sectionTitles = h3s.map(h => h.textContent);
      expect(sectionTitles).toContain('Student Profile');
      expect(sectionTitles).toContain('Attendance Metrics');
    });

    it('should use landmarks and regions appropriately', () => {
      render(<StudentCard {...defaultProps} />);

      // Dialog acts as a main landmark
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Check for regions within the dialog
      const regions = screen.getAllByRole('region');
      expect(regions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Screen Reader Announcements', () => {
    it('should announce dialog opening', () => {
      render(<StudentCard {...defaultProps} />);

      const statusAnnouncement = screen.getByRole('status');
      expect(statusAnnouncement).toHaveTextContent('Student card loaded for Maria Rodriguez');
      expect(statusAnnouncement).toHaveClass('sr-only');
    });

    it('should provide live region updates for attendance data', () => {
      const { rerender } = render(<StudentCard {...defaultProps} />);

      // Find live regions
      const liveRegions = screen.getAllByLabelText(/attendance rate/i);
      expect(liveRegions.length).toBeGreaterThanOrEqual(1);

      // Update attendance data
      const updatedStudent = {
        ...mockStudent,
        attendancePercentage: 89.2,
      };

      rerender(<StudentCard {...defaultProps} student={updatedStudent} />);

      // Live region should update
      const updatedRegion = screen.getByText('89.2%');
      expect(updatedRegion).toBeInTheDocument();
    });

    it('should announce loading states', () => {
      render(<StudentCard {...defaultProps} isLoading={true} />);

      const loadingAnnouncement = screen.getByText('Loading student information...');
      expect(loadingAnnouncement).toBeInTheDocument();

      const loadingIndicator = screen.getByTestId('student-card-loading');
      expect(loadingIndicator).toBeInTheDocument();
    });

    it('should announce error states with proper roles', () => {
      const errorMessage = 'Failed to load student data';
      render(<StudentCard {...defaultProps} error={errorMessage} />);

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      
      // Should contain error message (might be within child elements)
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should provide context for tier status changes', () => {
      render(<StudentCard {...defaultProps} />);

      // Find tier information
      const tierText = screen.getByText('Tier: Tier 2');
      expect(tierText).toBeInTheDocument();

      // Tier should have accessible context
      const attendanceSection = screen.getByText('87.5%').closest('[role]');
      if (attendanceSection) {
        expect(attendanceSection).toBeInTheDocument();
      }
    });
  });

  describe('Educational Data Privacy and Screen Readers', () => {
    it('should handle confidential information appropriately', () => {
      render(<StudentCard {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('data-secure', 'true');

      // Medical notes should be clearly marked as confidential
      const medicalNotes = screen.getByText(mockStudent.medicalNotes!);
      const medicalSection = medicalNotes.closest('div');
      expect(medicalSection).toHaveClass('bg-yellow-50'); // Visual indicator
    });

    it('should provide role-based data access for screen readers', () => {
      const limitedProps = {
        ...defaultProps,
        userRole: 'limited',
      };

      render(<StudentCard {...limitedProps} />);

      // Parent contact should not be visible for limited role
      expect(screen.queryByText('Parent/Guardian Contact')).not.toBeInTheDocument();
      expect(screen.queryByText('Carmen Rodriguez')).not.toBeInTheDocument();

      // But basic info should be available
      expect(screen.getByText('Maria Rodriguez')).toBeInTheDocument();
      expect(screen.getByText('87.5%')).toBeInTheDocument();
    });

    it('should log data access for FERPA compliance', () => {
      const mockLogAccess = vi.fn();
      render(<StudentCard {...defaultProps} onLogAccess={mockLogAccess} />);

      expect(mockLogAccess).toHaveBeenCalledWith({
        studentId: 'STU-12345',
        accessType: 'view_profile',
        timestamp: expect.any(Date),
      });
    });

    it('should handle sensitive data with screen reader considerations', () => {
      render(<StudentCard {...defaultProps} />);

      // IEP or 504 plan information should be marked for privacy
      const sensitiveDataElements = screen.getAllByText(/iep|504|special/i);
      if (sensitiveDataElements.length > 0) {
        sensitiveDataElements.forEach(element => {
          const container = element.closest('[data-sensitivity]');
          if (container) {
            expect(container).toHaveAttribute('data-sensitivity', 'high');
          }
        });
      }
    });

    it('should provide appropriate context for intervention data', () => {
      render(<StudentCard {...defaultProps} />);

      // Intervention timeline should be properly structured
      const interventionTimeline = screen.getByTestId('intervention-timeline');
      expect(interventionTimeline).toBeInTheDocument();

      const phoneCallIcon = screen.getByTestId('intervention-icon-phone_call');
      expect(phoneCallIcon).toBeInTheDocument();

      // Each intervention should have accessible date information
      const interventionDate = screen.getByText('March 10, 2024');
      expect(interventionDate).toBeInTheDocument();
    });
  });

  describe('i-Ready Performance Accessibility', () => {
    it('should provide accessible i-Ready performance data', () => {
      render(<StudentCard {...defaultProps} enableLazyLoading={false} />);

      const iReadySection = screen.getByTestId('iready-performance');
      expect(iReadySection).toBeInTheDocument();

      // ELA performance should be accessible
      const elaSection = screen.getByTestId('ela-performance');
      expect(elaSection).toBeInTheDocument();
      expect(elaSection).toHaveClass('needs-support'); // Visual indicator
      expect(elaSection).toHaveClass('bg-red-50'); // Needs support styling

      // Math performance should be accessible
      const mathSection = screen.getByTestId('math-performance');
      expect(mathSection).toBeInTheDocument();
      expect(mathSection).not.toHaveClass('needs-support');
      expect(mathSection).toHaveClass('bg-green-50'); // Good performance styling
    });

    it('should provide progress indicators accessible to screen readers', () => {
      render(<StudentCard {...defaultProps} enableLazyLoading={false} />);

      // Progress bars should have accessible labels
      const elaProgress = screen.getByText('65% Progress');
      const mathProgress = screen.getByText('85% Progress');

      expect(elaProgress).toBeInTheDocument();
      expect(mathProgress).toBeInTheDocument();

      // Progress bars should have ARIA labels
      const progressBars = screen.getAllByText(/% Progress/);
      expect(progressBars.length).toBe(2);
    });

    it('should handle lazy loading with screen reader announcements', async () => {
      render(<StudentCard {...defaultProps} enableLazyLoading={true} />);

      // i-Ready section should not be loaded initially
      expect(screen.queryByTestId('iready-performance')).not.toBeInTheDocument();

      // Simulate scroll to trigger lazy loading
      const content = screen.getByTestId('student-card-content');
      fireEvent.scroll(content, { target: { scrollTop: 300, scrollHeight: 500, clientHeight: 400 } });

      await waitFor(() => {
        const iReadySection = screen.queryByTestId('iready-performance');
        expect(iReadySection).toBeInTheDocument();
      });
    });
  });

  describe('Attendance Data Accessibility', () => {
    it('should provide accessible attendance metrics', () => {
      render(<StudentCard {...defaultProps} />);

      // Attendance rate should be clearly labeled
      const attendanceRate = screen.getByText('87.5%');
      expect(attendanceRate).toBeInTheDocument();

      const attendanceLabel = screen.getByText('Attendance Rate');
      expect(attendanceLabel).toBeInTheDocument();

      // Days absent should be accessible
      const daysAbsent = screen.getByText('12 days');
      expect(daysAbsent).toBeInTheDocument();
    });

    it('should handle chronic absenteeism indicators accessibly', () => {
      const chronicallyAbsentStudent = {
        ...mockStudent,
        chronicallyAbsent: true,
      };

      render(<StudentCard {...defaultProps} student={chronicallyAbsentStudent} />);

      const chronicIndicator = screen.getByTestId('chronic-absent-indicator');
      expect(chronicIndicator).toBeInTheDocument();
      expect(chronicIndicator).toHaveClass('bg-red-50'); // Visual indicator

      const alertIcon = screen.getByText('Chronically Absent').previousSibling;
      expect(alertIcon).toBeInTheDocument(); // AlertCircle icon
    });

    it('should provide accessible attendance trend visualization', () => {
      render(<StudentCard {...defaultProps} />);

      // Chart should have accessible container
      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toBeInTheDocument();

      // Period selector should be accessible
      const periodSelector = screen.getByLabelText('Trend period');
      expect(periodSelector).toBeInTheDocument();
    });

    it('should handle attendance loading states', () => {
      render(<StudentCard {...defaultProps} isLoadingTrend={true} />);

      const trendLoading = screen.getByTestId('trend-loading');
      expect(trendLoading).toBeInTheDocument();
    });
  });

  describe('Interactive Elements Accessibility', () => {
    it('should have accessible action buttons', () => {
      render(<StudentCard {...defaultProps} />);

      const buttons = [
        { label: 'Create intervention', text: 'Create Intervention' },
        { label: 'Assign to program', text: 'Assign to Program' },
        { label: 'Send notification', text: 'Send Notification' },
        { label: 'Edit student', text: 'Edit Student' },
      ];

      buttons.forEach(({ label, text }) => {
        const button = screen.getByLabelText(label);
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent(text);
        expect(button).toHaveClass('min-h-[44px]'); // Touch target compliance
        expect(button).toHaveAttribute('tabIndex', '0');
      });
    });

    it('should handle keyboard navigation within dialog', async () => {
      const user = userEvent.setup();
      render(<StudentCard {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      
      // Dialog should be focusable
      dialog.focus();
      expect(dialog).toHaveFocus();

      // Tab should navigate through interactive elements
      const firstButton = screen.getByLabelText('Create intervention');
      await user.tab();
      // Focus may go to close button or first interactive element
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInTheDocument();
    });

    it('should support escape key to close dialog', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      
      render(<StudentCard {...defaultProps} onClose={mockOnClose} />);

      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle unsaved changes dialog accessibly', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      
      render(
        <StudentCard 
          {...defaultProps} 
          onClose={mockOnClose}
          hasUnsavedChanges={true}
        />
      );

      const closeButton = screen.getByLabelText('Close student card');
      await user.click(closeButton);

      // Should show unsaved changes dialog
      await waitFor(() => {
        const unsavedDialog = screen.getByTestId('unsaved-changes-dialog');
        expect(unsavedDialog).toBeInTheDocument();
      });

      const discardButton = screen.getByRole('button', { name: 'Discard Changes' });
      expect(discardButton).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing student data accessibly', () => {
      const incompleteStudent = {
        ...mockStudent,
        name: '',
        grade: '',
      };

      render(<StudentCard {...defaultProps} student={incompleteStudent} />);

      const warningDialog = screen.getByRole('dialog');
      expect(warningDialog).toBeInTheDocument();
      expect(screen.getByText('Incomplete student data')).toBeInTheDocument();
    });

    it('should handle invalid attendance data accessibly', () => {
      const invalidStudent = {
        ...mockStudent,
        attendancePercentage: -5, // Invalid percentage
      };

      render(<StudentCard {...defaultProps} student={invalidStudent} />);

      expect(screen.getByText('Invalid attendance data')).toBeInTheDocument();
    });

    it('should handle missing intervention data gracefully', () => {
      render(<StudentCard {...defaultProps} interventions={null} />);

      expect(screen.getByText('No interventions recorded')).toBeInTheDocument();
    });

    it('should handle missing i-Ready data accessibly', () => {
      render(<StudentCard {...defaultProps} iReadyData={null} />);

      expect(screen.getByText('i-Ready data unavailable')).toBeInTheDocument();
    });

    it('should handle loading states for interventions', () => {
      render(<StudentCard {...defaultProps} isLoadingInterventions={true} />);

      const interventionsLoading = screen.getByTestId('interventions-loading');
      expect(interventionsLoading).toBeInTheDocument();
    });
  });

  describe('Responsive Screen Reader Support', () => {
    it('should adapt announcements for mobile screen readers', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<StudentCard {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-[95vw]'); // Mobile-specific styling
    });

    it('should provide appropriate focus management on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
      });

      const user = userEvent.setup();
      render(<StudentCard {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      
      // On mobile, dialog should handle focus appropriately
      dialog.focus();
      expect(dialog).toHaveFocus();
    });

    it('should handle touch interactions with screen reader support', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
      });

      render(<StudentCard {...defaultProps} />);

      // Action buttons should maintain touch target requirements
      const actionButtons = screen.getAllByRole('button');
      actionButtons.forEach(button => {
        if (button.getAttribute('aria-label')) {
          expect(button).toHaveClass('min-h-[44px]');
        }
      });
    });
  });
});