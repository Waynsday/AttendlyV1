/**
 * @fileoverview Failing tests for InterventionPanel.tsx component
 * Following TDD red-green-refactor cycle - these tests should FAIL initially
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
// Mock the component import since it doesn't exist yet
const InterventionPanel = () => <div data-testid="intervention-panel">Intervention Panel Component</div>;

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock date picker component - using virtual modules
jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: ({ onChange, selected, placeholderText, ...props }) => (
    <input
      data-testid="date-picker"
      type="date"
      value={selected ? selected.toISOString().split('T')[0] : ''}
      onChange={(e) => onChange(new Date(e.target.value))}
      placeholder={placeholderText}
      {...props}
    />
  ),
}), { virtual: true });

describe('InterventionPanel Component', () => {
  const mockInterventions = [
    {
      id: '1',
      studentId: '1',
      studentName: 'John Smith',
      type: 'phone_call',
      status: 'active',
      priority: 'high',
      date: '2024-01-15',
      description: 'Called parent about attendance concerns',
      outcome: 'Parent agreed to work on morning routine',
      followUpDate: '2024-01-22',
      assignedTo: 'Mrs. Johnson',
      createdBy: 'Principal Smith',
      createdAt: '2024-01-15T10:30:00Z',
      letters: [
        {
          id: '1',
          type: 'first_notice',
          dateSent: '2024-01-10',
          method: 'email'
        }
      ],
      conferences: [
        {
          id: '1',
          date: '2024-01-12',
          attendees: ['parent', 'teacher', 'student'],
          outcome: 'Agreed on intervention plan'
        }
      ]
    },
    {
      id: '2',
      studentId: '2',
      studentName: 'Jane Doe',
      type: 'meeting',
      status: 'pending',
      priority: 'medium',
      date: '2024-01-20',
      description: 'Schedule parent conference',
      outcome: null,
      followUpDate: null,
      assignedTo: 'Mr. Williams',
      createdBy: 'Mrs. Johnson',
      createdAt: '2024-01-20T14:15:00Z',
      letters: [],
      conferences: []
    },
    {
      id: '3',
      studentId: '3',
      studentName: 'Mike Johnson',
      type: 'sart',
      status: 'completed',
      priority: 'high',
      date: '2024-01-18',
      description: 'SART meeting for chronic absenteeism',
      outcome: 'Referral to SARB approved',
      followUpDate: '2024-02-01',
      assignedTo: 'Principal Smith',
      createdBy: 'Mrs. Davis',
      createdAt: '2024-01-18T09:00:00Z',
      letters: [
        {
          id: '2',
          type: 'sart_notice',
          dateSent: '2024-01-15',
          method: 'mail'
        }
      ],
      conferences: [
        {
          id: '2',
          date: '2024-01-18',
          attendees: ['parent', 'teacher', 'principal', 'counselor'],
          outcome: 'SARB referral recommended'
        }
      ]
    }
  ];

  const mockStudents = [
    { id: '1', name: 'John Smith', grade: '3' },
    { id: '2', name: 'Jane Doe', grade: '4' },
    { id: '3', name: 'Mike Johnson', grade: '2' },
  ];

  const defaultProps = {
    interventions: mockInterventions,
    students: mockStudents,
    isLoading: false,
    error: null,
    onCreateIntervention: jest.fn(),
    onUpdateIntervention: jest.fn(),
    onDeleteIntervention: jest.fn(),
    onSendLetter: jest.fn(),
    onScheduleConference: jest.fn(),
    onExportData: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Structure', () => {
    test('should render intervention panel container', async () => {
      render(<InterventionPanel {...defaultProps} />);

      expect(screen.getByTestId('intervention-panel')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /intervention management/i })).toBeInTheDocument();
    });

    test('should display panel header with controls', async () => {
      render(<InterventionPanel {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /intervention management/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create intervention/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
    });

    test('should show intervention filters', async () => {
      render(<InterventionPanel {...defaultProps} />);

      expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /filter by type/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /filter by priority/i })).toBeInTheDocument();
    });
  });

  describe('Intervention List Display', () => {
    test('should display all interventions', async () => {
      render(<InterventionPanel {...defaultProps} />);

      expect(screen.getByTestId('intervention-1')).toBeInTheDocument();
      expect(screen.getByTestId('intervention-2')).toBeInTheDocument();
      expect(screen.getByTestId('intervention-3')).toBeInTheDocument();
    });

    test('should show intervention details correctly', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const firstIntervention = screen.getByTestId('intervention-1');
      
      expect(firstIntervention).toHaveTextContent('John Smith');
      expect(firstIntervention).toHaveTextContent('Phone Call');
      expect(firstIntervention).toHaveTextContent('Active');
      expect(firstIntervention).toHaveTextContent('High Priority');
      expect(firstIntervention).toHaveTextContent('Jan 15, 2024');
    });

    test('should display intervention status indicators', async () => {
      render(<InterventionPanel {...defaultProps} />);

      expect(screen.getByTestId('status-indicator-active')).toBeInTheDocument();
      expect(screen.getByTestId('status-indicator-pending')).toBeInTheDocument();
      expect(screen.getByTestId('status-indicator-completed')).toBeInTheDocument();
    });

    test('should show priority levels with appropriate styling', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const highPriorityElements = screen.getAllByTestId('priority-high');
      expect(highPriorityElements).toHaveLength(2);
      expect(highPriorityElements[0]).toHaveClass('priority-high');

      const mediumPriorityElement = screen.getByTestId('priority-medium');
      expect(mediumPriorityElement).toHaveClass('priority-medium');
    });

    test('should display follow-up dates', async () => {
      render(<InterventionPanel {...defaultProps} />);

      expect(screen.getByText('Follow-up: Jan 22, 2024')).toBeInTheDocument();
      expect(screen.getByText('Follow-up: Feb 1, 2024')).toBeInTheDocument();
    });
  });

  describe('Create Intervention Modal', () => {
    test('should open create intervention modal', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const createButton = screen.getByRole('button', { name: /create intervention/i });
      fireEvent.click(createButton);

      expect(screen.getByRole('dialog', { name: /create intervention/i })).toBeInTheDocument();
    });

    test('should display intervention form fields', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const createButton = screen.getByRole('button', { name: /create intervention/i });
      fireEvent.click(createButton);

      expect(screen.getByRole('combobox', { name: /select student/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /intervention type/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /priority level/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
      expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    });

    test('should validate required fields', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const createButton = screen.getByRole('button', { name: /create intervention/i });
      fireEvent.click(createButton);

      const submitButton = screen.getByRole('button', { name: /create intervention/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/student is required/i)).toBeInTheDocument();
        expect(screen.getByText(/intervention type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      });
    });

    test('should create intervention with valid data', async () => {
      const mockOnCreateIntervention = jest.fn();
      render(<InterventionPanel {...defaultProps} onCreateIntervention={mockOnCreateIntervention} />);

      const createButton = screen.getByRole('button', { name: /create intervention/i });
      fireEvent.click(createButton);

      // Fill form
      const studentSelect = screen.getByRole('combobox', { name: /select student/i });
      fireEvent.click(studentSelect);
      fireEvent.click(screen.getByRole('option', { name: /john smith/i }));

      const typeSelect = screen.getByRole('combobox', { name: /intervention type/i });
      fireEvent.click(typeSelect);
      fireEvent.click(screen.getByRole('option', { name: /phone call/i }));

      const descriptionField = screen.getByRole('textbox', { name: /description/i });
      fireEvent.change(descriptionField, { target: { value: 'Test intervention' } });

      const submitButton = screen.getByRole('button', { name: /create intervention/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateIntervention).toHaveBeenCalledWith(
          expect.objectContaining({
            studentId: '1',
            type: 'phone_call',
            description: 'Test intervention'
          })
        );
      });
    });
  });

  describe('Intervention Status Updates', () => {
    test('should allow status updates', async () => {
      const mockOnUpdateIntervention = jest.fn();
      render(<InterventionPanel {...defaultProps} onUpdateIntervention={mockOnUpdateIntervention} />);

      const statusDropdown = screen.getByTestId('status-dropdown-1');
      fireEvent.click(statusDropdown);
      fireEvent.click(screen.getByRole('option', { name: /completed/i }));

      expect(mockOnUpdateIntervention).toHaveBeenCalledWith('1', { status: 'completed' });
    });

    test('should handle outcome updates', async () => {
      const mockOnUpdateIntervention = jest.fn();
      render(<InterventionPanel {...defaultProps} onUpdateIntervention={mockOnUpdateIntervention} />);

      const outcomeButton = screen.getByRole('button', { name: /update outcome/i });
      fireEvent.click(outcomeButton);

      const outcomeField = screen.getByRole('textbox', { name: /outcome/i });
      fireEvent.change(outcomeField, { target: { value: 'Successfully resolved' } });

      const saveButton = screen.getByRole('button', { name: /save outcome/i });
      fireEvent.click(saveButton);

      expect(mockOnUpdateIntervention).toHaveBeenCalledWith('1', { 
        outcome: 'Successfully resolved',
        status: 'completed' 
      });
    });

    test('should schedule follow-up dates', async () => {
      const mockOnUpdateIntervention = jest.fn();
      render(<InterventionPanel {...defaultProps} onUpdateIntervention={mockOnUpdateIntervention} />);

      const followUpButton = screen.getByRole('button', { name: /schedule follow-up/i });
      fireEvent.click(followUpButton);

      const datePicker = screen.getByTestId('date-picker');
      fireEvent.change(datePicker, { target: { value: '2024-02-01' } });

      const scheduleButton = screen.getByRole('button', { name: /schedule/i });
      fireEvent.click(scheduleButton);

      expect(mockOnUpdateIntervention).toHaveBeenCalledWith('1', { 
        followUpDate: '2024-02-01' 
      });
    });
  });

  describe('Letter Management', () => {
    test('should display sent letters', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const intervention = screen.getByTestId('intervention-1');
      const lettersSection = screen.getByTestId('letters-section-1');
      
      expect(lettersSection).toHaveTextContent('First Notice');
      expect(lettersSection).toHaveTextContent('Sent: Jan 10, 2024');
      expect(lettersSection).toHaveTextContent('Method: Email');
    });

    test('should allow sending new letters', async () => {
      const mockOnSendLetter = jest.fn();
      render(<InterventionPanel {...defaultProps} onSendLetter={mockOnSendLetter} />);

      const sendLetterButton = screen.getByRole('button', { name: /send letter/i });
      fireEvent.click(sendLetterButton);

      const letterTypeSelect = screen.getByRole('combobox', { name: /letter type/i });
      fireEvent.click(letterTypeSelect);
      fireEvent.click(screen.getByRole('option', { name: /second notice/i }));

      const methodSelect = screen.getByRole('combobox', { name: /delivery method/i });
      fireEvent.click(methodSelect);
      fireEvent.click(screen.getByRole('option', { name: /mail/i }));

      const sendButton = screen.getByRole('button', { name: /send letter/i });
      fireEvent.click(sendButton);

      expect(mockOnSendLetter).toHaveBeenCalledWith('1', {
        type: 'second_notice',
        method: 'mail'
      });
    });

    test('should show letter types based on intervention stage', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const sendLetterButton = screen.getByRole('button', { name: /send letter/i });
      fireEvent.click(sendLetterButton);

      const letterTypeSelect = screen.getByRole('combobox', { name: /letter type/i });
      fireEvent.click(letterTypeSelect);

      expect(screen.getByRole('option', { name: /first notice/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /second notice/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /final notice/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /sart notice/i })).toBeInTheDocument();
    });
  });

  describe('Conference Management', () => {
    test('should display scheduled conferences', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const conferencesSection = screen.getByTestId('conferences-section-1');
      
      expect(conferencesSection).toHaveTextContent('Jan 12, 2024');
      expect(conferencesSection).toHaveTextContent('Parent, Teacher, Student');
      expect(conferencesSection).toHaveTextContent('Agreed on intervention plan');
    });

    test('should allow scheduling new conferences', async () => {
      const mockOnScheduleConference = jest.fn();
      render(<InterventionPanel {...defaultProps} onScheduleConference={mockOnScheduleConference} />);

      const scheduleButton = screen.getByRole('button', { name: /schedule conference/i });
      fireEvent.click(scheduleButton);

      const datePicker = screen.getByTestId('date-picker');
      fireEvent.change(datePicker, { target: { value: '2024-02-15' } });

      const attendeesCheckboxes = screen.getAllByRole('checkbox');
      fireEvent.click(attendeesCheckboxes[0]); // Parent
      fireEvent.click(attendeesCheckboxes[1]); // Teacher

      const confirmButton = screen.getByRole('button', { name: /schedule conference/i });
      fireEvent.click(confirmButton);

      expect(mockOnScheduleConference).toHaveBeenCalledWith('1', {
        date: '2024-02-15',
        attendees: ['parent', 'teacher']
      });
    });

    test('should show different conference types', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const scheduleButton = screen.getByRole('button', { name: /schedule conference/i });
      fireEvent.click(scheduleButton);

      expect(screen.getByRole('checkbox', { name: /parent/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /teacher/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /student/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /principal/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /counselor/i })).toBeInTheDocument();
    });
  });

  describe('SART/SARB Workflow', () => {
    test('should display SART workflow status', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const sartIntervention = screen.getByTestId('intervention-3');
      expect(sartIntervention).toHaveTextContent('SART');
      expect(sartIntervention).toHaveTextContent('SARB referral recommended');
    });

    test('should show SART progression stages', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const sartProgression = screen.getByTestId('sart-progression-3');
      
      expect(sartProgression).toHaveTextContent('Stage 1: Initial Notice');
      expect(sartProgression).toHaveTextContent('Stage 2: SART Meeting');
      expect(sartProgression).toHaveTextContent('Stage 3: SARB Referral');
    });

    test('should allow SARB referral creation', async () => {
      const mockOnCreateReferral = jest.fn();
      render(<InterventionPanel {...defaultProps} onCreateReferral={mockOnCreateReferral} />);

      const createReferralButton = screen.getByRole('button', { name: /create sarb referral/i });
      fireEvent.click(createReferralButton);

      const reasonField = screen.getByRole('textbox', { name: /referral reason/i });
      fireEvent.change(reasonField, { target: { value: 'Chronic absenteeism despite interventions' } });

      const submitButton = screen.getByRole('button', { name: /submit referral/i });
      fireEvent.click(submitButton);

      expect(mockOnCreateReferral).toHaveBeenCalledWith('3', {
        reason: 'Chronic absenteeism despite interventions'
      });
    });
  });

  describe('Filtering and Search', () => {
    test('should filter by status', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const statusFilter = screen.getByRole('combobox', { name: /filter by status/i });
      fireEvent.click(statusFilter);
      fireEvent.click(screen.getByRole('option', { name: /active/i }));

      await waitFor(() => {
        expect(screen.getByTestId('intervention-1')).toBeInTheDocument();
        expect(screen.queryByTestId('intervention-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('intervention-3')).not.toBeInTheDocument();
      });
    });

    test('should filter by intervention type', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const typeFilter = screen.getByRole('combobox', { name: /filter by type/i });
      fireEvent.click(typeFilter);
      fireEvent.click(screen.getByRole('option', { name: /phone call/i }));

      await waitFor(() => {
        expect(screen.getByTestId('intervention-1')).toBeInTheDocument();
        expect(screen.queryByTestId('intervention-2')).not.toBeInTheDocument();
      });
    });

    test('should filter by priority', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const priorityFilter = screen.getByRole('combobox', { name: /filter by priority/i });
      fireEvent.click(priorityFilter);
      fireEvent.click(screen.getByRole('option', { name: /high/i }));

      await waitFor(() => {
        expect(screen.getByTestId('intervention-1')).toBeInTheDocument();
        expect(screen.getByTestId('intervention-3')).toBeInTheDocument();
        expect(screen.queryByTestId('intervention-2')).not.toBeInTheDocument();
      });
    });

    test('should search by student name', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const searchInput = screen.getByRole('searchbox', { name: /search interventions/i });
      fireEvent.change(searchInput, { target: { value: 'John' } });

      await waitFor(() => {
        expect(screen.getByTestId('intervention-1')).toBeInTheDocument();
        expect(screen.queryByTestId('intervention-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('intervention-3')).not.toBeInTheDocument();
      });
    });
  });

  describe('Activity Logging', () => {
    test('should log all intervention activities', async () => {
      const mockOnLogActivity = jest.fn();
      render(<InterventionPanel {...defaultProps} onLogActivity={mockOnLogActivity} />);

      const statusDropdown = screen.getByTestId('status-dropdown-1');
      fireEvent.click(statusDropdown);
      fireEvent.click(screen.getByRole('option', { name: /completed/i }));

      expect(mockOnLogActivity).toHaveBeenCalledWith({
        interventionId: '1',
        action: 'status_update',
        oldValue: 'active',
        newValue: 'completed',
        timestamp: expect.any(Date),
        userId: expect.any(String)
      });
    });

    test('should display activity timeline', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const timelineButton = screen.getByRole('button', { name: /view timeline/i });
      fireEvent.click(timelineButton);

      const timeline = screen.getByTestId('activity-timeline-1');
      expect(timeline).toBeInTheDocument();
      expect(timeline).toHaveTextContent('Created by Principal Smith');
      expect(timeline).toHaveTextContent('Status changed to Active');
    });
  });

  describe('Data Export', () => {
    test('should export intervention data', async () => {
      const mockOnExportData = jest.fn();
      render(<InterventionPanel {...defaultProps} onExportData={mockOnExportData} />);

      const exportButton = screen.getByRole('button', { name: /export data/i });
      fireEvent.click(exportButton);

      const csvOption = screen.getByRole('menuitem', { name: /export to csv/i });
      fireEvent.click(csvOption);

      expect(mockOnExportData).toHaveBeenCalledWith('csv', mockInterventions);
    });

    test('should export filtered data', async () => {
      const mockOnExportData = jest.fn();
      render(<InterventionPanel {...defaultProps} onExportData={mockOnExportData} />);

      // Apply filter
      const statusFilter = screen.getByRole('combobox', { name: /filter by status/i });
      fireEvent.click(statusFilter);
      fireEvent.click(screen.getByRole('option', { name: /active/i }));

      const exportButton = screen.getByRole('button', { name: /export data/i });
      fireEvent.click(exportButton);

      const csvOption = screen.getByRole('menuitem', { name: /export to csv/i });
      fireEvent.click(csvOption);

      expect(mockOnExportData).toHaveBeenCalledWith('csv', 
        expect.arrayContaining([
          expect.objectContaining({ status: 'active' })
        ])
      );
    });
  });

  describe('Loading and Error States', () => {
    test('should show loading state', async () => {
      render(<InterventionPanel {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('intervention-panel-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading interventions/i)).toBeInTheDocument();
    });

    test('should display error state', async () => {
      render(<InterventionPanel {...defaultProps} error="Failed to load interventions" />);

      expect(screen.getByText(/failed to load interventions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('should show empty state when no interventions', async () => {
      render(<InterventionPanel {...defaultProps} interventions={[]} />);

      expect(screen.getByTestId('empty-interventions')).toBeInTheDocument();
      expect(screen.getByText(/no interventions found/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(<InterventionPanel {...defaultProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper ARIA labels', async () => {
      render(<InterventionPanel {...defaultProps} />);

      expect(screen.getByRole('region', { name: /intervention management/i })).toBeInTheDocument();
      expect(screen.getByRole('table', { name: /interventions table/i })).toBeInTheDocument();
    });

    test('should support keyboard navigation', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const firstIntervention = screen.getByTestId('intervention-1');
      firstIntervention.focus();

      fireEvent.keyDown(firstIntervention, { key: 'ArrowDown' });

      const secondIntervention = screen.getByTestId('intervention-2');
      expect(secondIntervention).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    test('should adapt layout for mobile devices', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(<InterventionPanel {...defaultProps} />);

      const mobileLayout = screen.getByTestId('intervention-panel-mobile');
      expect(mobileLayout).toBeInTheDocument();
    });

    test('should stack intervention cards on small screens', async () => {
      render(<InterventionPanel {...defaultProps} />);

      const interventionGrid = screen.getByTestId('intervention-grid');
      expect(interventionGrid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', async () => {
      const largeInterventionList = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        studentId: (i % 100).toString(),
        studentName: `Student ${i}`,
        type: 'phone_call',
        status: 'active',
        priority: 'medium',
        date: '2024-01-15',
        description: `Intervention ${i}`,
        outcome: null,
        followUpDate: null,
        assignedTo: 'Teacher',
        createdBy: 'Principal',
        createdAt: '2024-01-15T10:30:00Z',
        letters: [],
        conferences: []
      }));

      const startTime = performance.now();

      render(<InterventionPanel {...defaultProps} interventions={largeInterventionList} />);

      await waitFor(() => {
        expect(screen.getByTestId('intervention-panel')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(2000);
    });

    test('should implement virtual scrolling for large lists', async () => {
      const largeInterventionList = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        studentId: (i % 100).toString(),
        studentName: `Student ${i}`,
        type: 'phone_call',
        status: 'active',
        priority: 'medium',
        date: '2024-01-15',
        description: `Intervention ${i}`,
        outcome: null,
        followUpDate: null,
        assignedTo: 'Teacher',
        createdBy: 'Principal',
        createdAt: '2024-01-15T10:30:00Z',
        letters: [],
        conferences: []
      }));

      render(<InterventionPanel {...defaultProps} interventions={largeInterventionList} />);

      // Should only render visible items
      const renderedInterventions = screen.getAllByTestId(/intervention-\d+/);
      expect(renderedInterventions.length).toBeLessThanOrEqual(50); // Only visible items
    });
  });

  describe('Data Validation', () => {
    test('should validate intervention data integrity', async () => {
      const invalidIntervention = {
        id: '1',
        studentId: null,
        studentName: '',
        type: 'invalid_type',
        status: 'unknown_status',
      };

      render(<InterventionPanel {...defaultProps} interventions={[invalidIntervention]} />);

      expect(screen.getByText(/invalid intervention data/i)).toBeInTheDocument();
    });

    test('should handle missing required fields', async () => {
      const incompleteIntervention = {
        id: '1',
        type: 'phone_call',
        // Missing required fields
      };

      render(<InterventionPanel {...defaultProps} interventions={[incompleteIntervention]} />);

      expect(screen.getByText(/incomplete intervention data/i)).toBeInTheDocument();
    });
  });
});