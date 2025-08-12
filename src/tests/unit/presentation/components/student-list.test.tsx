/**
 * @fileoverview Failing tests for StudentList.tsx component
 * Following TDD red-green-refactor cycle - these tests should FAIL initially
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StudentList } from '../../../../presentation/components/student-list';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock virtual scrolling library - using virtual modules
jest.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height, width }) => (
    <div 
      data-testid="virtual-list" 
      style={{ height, width }}
      data-item-count={itemCount}
      data-item-size={itemSize}
    >
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => 
        children({ index, style: {} })
      )}
    </div>
  ),
}), { virtual: true });

describe('StudentList Component', () => {
  const mockStudents = [
    {
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
      chronicallyAbsent: true
    },
    {
      id: '2',
      name: 'Jane Doe',
      grade: '4',
      teacher: 'Mr. Williams',
      attendancePercentage: 76.7,
      daysAbsent: 14,
      recoveryDays: 1,
      interventionStatus: 'pending',
      tardyCount: 5,
      tier: '3-9 days',
      lastAbsence: '2024-01-12',
      chronicallyAbsent: true
    },
    {
      id: '3',
      name: 'Mike Johnson',
      grade: '2',
      teacher: 'Ms. Davis',
      attendancePercentage: 78.3,
      daysAbsent: 13,
      recoveryDays: 0,
      interventionStatus: 'none',
      tardyCount: 3,
      tier: '3-9 days',
      lastAbsence: '2024-01-10',
      chronicallyAbsent: false
    },
    {
      id: '4',
      name: 'Sarah Wilson',
      grade: '5',
      teacher: 'Mrs. Brown',
      attendancePercentage: 95.0,
      daysAbsent: 3,
      recoveryDays: 0,
      interventionStatus: 'none',
      tardyCount: 1,
      tier: '1-2 days',
      lastAbsence: '2024-01-08',
      chronicallyAbsent: false
    },
  ];

  const defaultProps = {
    students: mockStudents,
    isLoading: false,
    error: null,
    onStudentClick: jest.fn(),
    onBulkAssignment: jest.fn(),
    onExportData: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Structure', () => {
    test('should render student list container', async () => {
      render(<StudentList {...defaultProps} />);

      expect(screen.getByTestId('student-list')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    test('should display column headers', async () => {
      render(<StudentList {...defaultProps} />);

      expect(screen.getByRole('columnheader', { name: /student name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /grade/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /teacher/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /attendance %/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /days absent/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /recovery days/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /intervention status/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /tardy count/i })).toBeInTheDocument();
    });

    test('should render bulk selection checkbox', async () => {
      render(<StudentList {...defaultProps} />);

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all students/i });
      expect(selectAllCheckbox).toBeInTheDocument();
    });
  });

  describe('Student Data Display', () => {
    test('should display students ranked by absence percentage', async () => {
      render(<StudentList {...defaultProps} />);

      const studentRows = screen.getAllByTestId(/student-row-/);
      expect(studentRows).toHaveLength(4);

      // Should be ordered by attendance percentage (lowest first)
      expect(studentRows[0]).toHaveTextContent('John Smith'); // 75.0%
      expect(studentRows[1]).toHaveTextContent('Jane Doe'); // 76.7%
      expect(studentRows[2]).toHaveTextContent('Mike Johnson'); // 78.3%
      expect(studentRows[3]).toHaveTextContent('Sarah Wilson'); // 95.0%
    });

    test('should display complete student information', async () => {
      render(<StudentList {...defaultProps} />);

      const firstRow = screen.getByTestId('student-row-1');
      
      expect(firstRow).toHaveTextContent('John Smith');
      expect(firstRow).toHaveTextContent('Grade 3');
      expect(firstRow).toHaveTextContent('Mrs. Johnson');
      expect(firstRow).toHaveTextContent('75.0%');
      expect(firstRow).toHaveTextContent('15 days');
      expect(firstRow).toHaveTextContent('2 recovery');
      expect(firstRow).toHaveTextContent('8 tardies');
    });

    test('should show intervention status indicators', async () => {
      render(<StudentList {...defaultProps} />);

      expect(screen.getByTestId('intervention-status-active')).toBeInTheDocument();
      expect(screen.getByTestId('intervention-status-pending')).toBeInTheDocument();
      expect(screen.getAllByTestId('intervention-status-none')).toHaveLength(2);
    });

    test('should highlight chronically absent students', async () => {
      render(<StudentList {...defaultProps} />);

      const chronicRow1 = screen.getByTestId('student-row-1');
      const chronicRow2 = screen.getByTestId('student-row-2');
      const regularRow = screen.getByTestId('student-row-3');

      expect(chronicRow1).toHaveClass('chronic-absent');
      expect(chronicRow2).toHaveClass('chronic-absent');
      expect(regularRow).not.toHaveClass('chronic-absent');
    });

    test('should display last absence date', async () => {
      render(<StudentList {...defaultProps} />);

      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('Jan 12, 2024')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    test('should render search input', async () => {
      render(<StudentList {...defaultProps} />);

      const searchInput = screen.getByRole('searchbox', { name: /search students/i });
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', expect.stringContaining('Search'));
    });

    test('should filter students by name search', async () => {
      render(<StudentList {...defaultProps} />);

      const searchInput = screen.getByRole('searchbox', { name: /search students/i });
      fireEvent.change(searchInput, { target: { value: 'John' } });

      await waitFor(() => {
        expect(screen.getByTestId('student-row-1')).toBeInTheDocument();
        expect(screen.queryByTestId('student-row-2')).not.toBeInTheDocument();
      });
    });

    test('should support tier filtering', async () => {
      render(<StudentList {...defaultProps} />);

      const tierFilter = screen.getByRole('combobox', { name: /filter by tier/i });
      fireEvent.click(tierFilter);

      expect(screen.getByRole('option', { name: /1-2 days/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /3-9 days/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: />10% chronic/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('option', { name: /1-2 days/i }));

      await waitFor(() => {
        expect(screen.getByTestId('student-row-4')).toBeInTheDocument();
        expect(screen.queryByTestId('student-row-1')).not.toBeInTheDocument();
      });
    });

    test('should filter by grade level', async () => {
      render(<StudentList {...defaultProps} />);

      const gradeFilter = screen.getByRole('combobox', { name: /filter by grade/i });
      fireEvent.click(gradeFilter);
      fireEvent.click(screen.getByRole('option', { name: /grade 3/i }));

      await waitFor(() => {
        expect(screen.getByTestId('student-row-1')).toBeInTheDocument();
        expect(screen.queryByTestId('student-row-2')).not.toBeInTheDocument();
      });
    });

    test('should filter by teacher', async () => {
      render(<StudentList {...defaultProps} />);

      const teacherFilter = screen.getByRole('combobox', { name: /filter by teacher/i });
      fireEvent.click(teacherFilter);
      fireEvent.click(screen.getByRole('option', { name: /mrs. johnson/i }));

      await waitFor(() => {
        expect(screen.getByTestId('student-row-1')).toBeInTheDocument();
        expect(screen.queryByTestId('student-row-2')).not.toBeInTheDocument();
      });
    });

    test('should clear all filters', async () => {
      render(<StudentList {...defaultProps} />);

      // Apply some filters
      const searchInput = screen.getByRole('searchbox', { name: /search students/i });
      fireEvent.change(searchInput, { target: { value: 'John' } });

      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(screen.getAllByTestId(/student-row-/)).toHaveLength(4);
      });
    });
  });

  describe('Sorting Functionality', () => {
    test('should support sorting by attendance percentage', async () => {
      render(<StudentList {...defaultProps} />);

      const attendanceHeader = screen.getByRole('columnheader', { name: /attendance %/i });
      fireEvent.click(attendanceHeader);

      await waitFor(() => {
        const studentRows = screen.getAllByTestId(/student-row-/);
        expect(studentRows[0]).toHaveTextContent('Sarah Wilson'); // 95.0%
      });
    });

    test('should support sorting by days absent', async () => {
      render(<StudentList {...defaultProps} />);

      const absencesHeader = screen.getByRole('columnheader', { name: /days absent/i });
      fireEvent.click(absencesHeader);

      await waitFor(() => {
        const studentRows = screen.getAllByTestId(/student-row-/);
        expect(studentRows[0]).toHaveTextContent('John Smith'); // 15 days
      });
    });

    test('should toggle sort direction', async () => {
      render(<StudentList {...defaultProps} />);

      const nameHeader = screen.getByRole('columnheader', { name: /student name/i });
      
      // First click - ascending
      fireEvent.click(nameHeader);
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

      // Second click - descending
      fireEvent.click(nameHeader);
      expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    });

    test('should show sort indicators', async () => {
      render(<StudentList {...defaultProps} />);

      const nameHeader = screen.getByRole('columnheader', { name: /student name/i });
      fireEvent.click(nameHeader);

      const sortIcon = screen.getByTestId('sort-icon-asc');
      expect(sortIcon).toBeInTheDocument();
    });
  });

  describe('Bulk Selection', () => {
    test('should support individual student selection', async () => {
      render(<StudentList {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /select john smith/i });
      fireEvent.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    test('should support select all functionality', async () => {
      render(<StudentList {...defaultProps} />);

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all students/i });
      fireEvent.click(selectAllCheckbox);

      const individualCheckboxes = screen.getAllByRole('checkbox');
      individualCheckboxes.slice(1).forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    test('should show selected count', async () => {
      render(<StudentList {...defaultProps} />);

      const checkbox1 = screen.getByRole('checkbox', { name: /select john smith/i });
      const checkbox2 = screen.getByRole('checkbox', { name: /select jane doe/i });
      
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      expect(screen.getByText('2 students selected')).toBeInTheDocument();
    });

    test('should enable bulk action buttons when students selected', async () => {
      render(<StudentList {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /select john smith/i });
      fireEvent.click(checkbox);

      const assignButton = screen.getByRole('button', { name: /assign to program/i });
      expect(assignButton).not.toBeDisabled();
    });

    test('should call onBulkAssignment with selected students', async () => {
      const mockOnBulkAssignment = jest.fn();
      render(<StudentList {...defaultProps} onBulkAssignment={mockOnBulkAssignment} />);

      const checkbox1 = screen.getByRole('checkbox', { name: /select john smith/i });
      const checkbox2 = screen.getByRole('checkbox', { name: /select jane doe/i });
      
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      const assignButton = screen.getByRole('button', { name: /assign to program/i });
      fireEvent.click(assignButton);

      expect(mockOnBulkAssignment).toHaveBeenCalledWith(['1', '2']);
    });
  });

  describe('Student Interaction', () => {
    test('should support click-to-view student details', async () => {
      const mockOnStudentClick = jest.fn();
      render(<StudentList {...defaultProps} onStudentClick={mockOnStudentClick} />);

      const studentRow = screen.getByTestId('student-row-1');
      fireEvent.click(studentRow);

      expect(mockOnStudentClick).toHaveBeenCalledWith('1');
    });

    test('should show student quick actions', async () => {
      render(<StudentList {...defaultProps} />);

      const actionsButton = screen.getByRole('button', { name: /actions for john smith/i });
      fireEvent.click(actionsButton);

      expect(screen.getByRole('menuitem', { name: /view details/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /create intervention/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /send notification/i })).toBeInTheDocument();
    });

    test('should handle row keyboard navigation', async () => {
      render(<StudentList {...defaultProps} />);

      const firstRow = screen.getByTestId('student-row-1');
      firstRow.focus();

      fireEvent.keyDown(firstRow, { key: 'ArrowDown' });
      
      const secondRow = screen.getByTestId('student-row-2');
      expect(secondRow).toHaveFocus();
    });
  });

  describe('Data Export', () => {
    test('should provide export functionality', async () => {
      const mockOnExportData = jest.fn();
      render(<StudentList {...defaultProps} onExportData={mockOnExportData} />);

      const exportButton = screen.getByRole('button', { name: /export data/i });
      fireEvent.click(exportButton);

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /export to csv/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /export to pdf/i })).toBeInTheDocument();
    });

    test('should export filtered data', async () => {
      const mockOnExportData = jest.fn();
      render(<StudentList {...defaultProps} onExportData={mockOnExportData} />);

      // Apply filter
      const searchInput = screen.getByRole('searchbox', { name: /search students/i });
      fireEvent.change(searchInput, { target: { value: 'John' } });

      const exportButton = screen.getByRole('button', { name: /export data/i });
      fireEvent.click(exportButton);
      
      const csvOption = screen.getByRole('menuitem', { name: /export to csv/i });
      fireEvent.click(csvOption);

      expect(mockOnExportData).toHaveBeenCalledWith('csv', expect.arrayContaining([
        expect.objectContaining({ name: 'John Smith' })
      ]));
    });
  });

  describe('Performance and Virtualization', () => {
    test('should implement virtual scrolling for large datasets', async () => {
      const largeStudentList = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        name: `Student ${i}`,
        grade: Math.floor(i / 167).toString(),
        teacher: `Teacher ${i % 20}`,
        attendancePercentage: Math.random() * 100,
        daysAbsent: Math.floor(Math.random() * 20),
        recoveryDays: Math.floor(Math.random() * 5),
        interventionStatus: 'none',
        tardyCount: Math.floor(Math.random() * 10),
        tier: '1-2 days',
        lastAbsence: '2024-01-15',
        chronicallyAbsent: false
      }));

      render(<StudentList {...defaultProps} students={largeStudentList} />);

      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();
      expect(virtualList).toHaveAttribute('data-item-count', '1000');
    });

    test('should load efficiently with large datasets', async () => {
      const startTime = performance.now();

      const largeStudentList = Array.from({ length: 5000 }, (_, i) => ({
        id: i.toString(),
        name: `Student ${i}`,
        grade: Math.floor(i / 834).toString(),
        teacher: `Teacher ${i % 50}`,
        attendancePercentage: Math.random() * 100,
        daysAbsent: Math.floor(Math.random() * 20),
        recoveryDays: Math.floor(Math.random() * 5),
        interventionStatus: 'none',
        tardyCount: Math.floor(Math.random() * 10),
        tier: '1-2 days',
        lastAbsence: '2024-01-15',
        chronicallyAbsent: false
      }));

      render(<StudentList {...defaultProps} students={largeStudentList} />);

      await waitFor(() => {
        expect(screen.getByTestId('student-list')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(2000);
    });
  });

  describe('Loading and Error States', () => {
    test('should show loading state', async () => {
      render(<StudentList {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('student-list-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading students/i)).toBeInTheDocument();
    });

    test('should show empty state when no students', async () => {
      render(<StudentList {...defaultProps} students={[]} />);

      expect(screen.getByTestId('empty-student-list')).toBeInTheDocument();
      expect(screen.getByText(/no students found/i)).toBeInTheDocument();
    });

    test('should display error state', async () => {
      render(<StudentList {...defaultProps} error="Failed to load students" />);

      expect(screen.getByText(/failed to load students/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('FERPA Compliance', () => {
    test('should implement data access controls', async () => {
      render(<StudentList {...defaultProps} />);

      const secureTable = screen.getByTestId('student-list');
      expect(secureTable).toHaveAttribute('data-secure', 'true');
    });

    test('should mask sensitive data appropriately', async () => {
      render(<StudentList {...defaultProps} userRole="limited" />);

      // Should show initials instead of full names for limited access
      expect(screen.getByText('J.S.')).toBeInTheDocument();
      expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(<StudentList {...defaultProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper table accessibility', async () => {
      render(<StudentList {...defaultProps} />);

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'Student attendance list');

      const rowHeaders = screen.getAllByRole('rowheader');
      expect(rowHeaders.length).toBeGreaterThan(0);
    });

    test('should support screen reader announcements', async () => {
      render(<StudentList {...defaultProps} />);

      const searchInput = screen.getByRole('searchbox', { name: /search students/i });
      fireEvent.change(searchInput, { target: { value: 'John' } });

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/1 student found/i);
      });
    });

    test('should provide keyboard shortcuts', async () => {
      render(<StudentList {...defaultProps} />);

      // Test Ctrl+A for select all
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all students/i });
      expect(selectAllCheckbox).toBeChecked();
    });
  });

  describe('Responsive Design', () => {
    test('should adapt for mobile devices', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(<StudentList {...defaultProps} />);

      const mobileLayout = screen.getByTestId('student-list-mobile');
      expect(mobileLayout).toBeInTheDocument();
    });

    test('should show horizontal scroll on small screens', async () => {
      render(<StudentList {...defaultProps} />);

      const tableContainer = screen.getByTestId('table-container');
      expect(tableContainer).toHaveClass('overflow-x-auto');
    });

    test('should prioritize essential columns on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(<StudentList {...defaultProps} />);

      // Essential columns should be visible
      expect(screen.getByRole('columnheader', { name: /student name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /attendance %/i })).toBeInTheDocument();
      
      // Less essential columns should be hidden
      expect(screen.queryByRole('columnheader', { name: /recovery days/i })).not.toBeInTheDocument();
    });
  });
});