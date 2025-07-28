/**
 * @fileoverview Failing tests for MetricsOverview.tsx component
 * Following TDD red-green-refactor cycle - these tests should FAIL initially
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MetricsOverview } from '../../../../presentation/components/metrics-overview';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children, ...props }) => <div data-testid="line-chart" {...props}>{children}</div>,
  BarChart: ({ children, ...props }) => <div data-testid="bar-chart" {...props}>{children}</div>,
  PieChart: ({ children, ...props }) => <div data-testid="pie-chart" {...props}>{children}</div>,
  XAxis: (props) => <div data-testid="x-axis" {...props}></div>,
  YAxis: (props) => <div data-testid="y-axis" {...props}></div>,
  CartesianGrid: (props) => <div data-testid="cartesian-grid" {...props}></div>,
  Tooltip: (props) => <div data-testid="tooltip" {...props}></div>,
  Legend: (props) => <div data-testid="legend" {...props}></div>,
  Line: (props) => <div data-testid="line" {...props}></div>,
  Bar: (props) => <div data-testid="bar" {...props}></div>,
  Cell: (props) => <div data-testid="cell" {...props}></div>,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
}));

describe('MetricsOverview Component', () => {
  const mockAttendanceData = [
    { period: 'Week 1', percentage: 95.2 },
    { period: 'Week 2', percentage: 93.8 },
    { period: 'Week 3', percentage: 96.1 },
    { period: 'Week 4', percentage: 94.5 },
  ];

  const mockGradeData = [
    { grade: 'K', absences: 25, students: 120 },
    { grade: '1', absences: 32, students: 115 },
    { grade: '2', absences: 28, students: 118 },
    { grade: '3', absences: 41, students: 125 },
    { grade: '4', absences: 38, students: 122 },
    { grade: '5', absences: 45, students: 128 },
  ];

  const mockDayData = [
    { day: 'Monday', absences: 45 },
    { day: 'Tuesday', absences: 38 },
    { day: 'Wednesday', absences: 42 },
    { day: 'Thursday', absences: 51 },
    { day: 'Friday', absences: 67 },
  ];

  const mockTopStudents = [
    { id: '1', name: 'John Smith', grade: '3', absences: 15, percentage: 25.0 },
    { id: '2', name: 'Jane Doe', grade: '4', absences: 14, percentage: 23.3 },
    { id: '3', name: 'Mike Johnson', grade: '2', absences: 13, percentage: 21.7 },
    { id: '4', name: 'Sarah Wilson', grade: '5', absences: 12, percentage: 20.0 },
    { id: '5', name: 'Tom Brown', grade: '1', absences: 12, percentage: 20.0 },
  ];

  const mockImprovedStudents = [
    { id: '6', name: 'Amy Davis', grade: '3', improvement: 8.5, currentRate: 92.1 },
    { id: '7', name: 'Chris Lee', grade: '4', improvement: 7.2, currentRate: 94.3 },
    { id: '8', name: 'Lisa Garcia', grade: '2', improvement: 6.8, currentRate: 93.7 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Structure', () => {
    test('should render main metrics overview container', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByTestId('metrics-overview')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /metrics overview/i })).toBeInTheDocument();
    });

    test('should display section headers', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByRole('heading', { name: /attendance trends/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /absences by grade/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /absences by day/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /students needing intervention/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /most improved attendance/i })).toBeInTheDocument();
    });
  });

  describe('Attendance Percentage Trends', () => {
    test('should render attendance trend line chart', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('attendance-chart-container')).toBeInTheDocument();
    });

    test('should support time period selection (weekly/monthly/annual)', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const periodSelector = screen.getByRole('combobox', { name: /time period/i });
      expect(periodSelector).toBeInTheDocument();

      fireEvent.click(periodSelector);
      
      expect(screen.getByRole('option', { name: /weekly/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /monthly/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /annual/i })).toBeInTheDocument();
    });

    test('should display current attendance percentage', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
          currentAttendance={94.7}
        />
      );

      expect(screen.getByText('94.7%')).toBeInTheDocument();
      expect(screen.getByText(/current attendance rate/i)).toBeInTheDocument();
    });

    test('should show trend direction indicator', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
          trendDirection="up"
        />
      );

      const trendIndicator = screen.getByTestId('trend-indicator');
      expect(trendIndicator).toBeInTheDocument();
      expect(trendIndicator).toHaveAttribute('data-direction', 'up');
    });
  });

  describe('Absences by Grade Level Chart', () => {
    test('should render grade level bar chart', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByTestId('grade-bar-chart')).toBeInTheDocument();
    });

    test('should display grade level data correctly', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      // Check that grade data is displayed
      expect(screen.getByText('Grade K')).toBeInTheDocument();
      expect(screen.getByText('Grade 5')).toBeInTheDocument();
    });

    test('should show absence rate per grade', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      // Check tooltip displays rate calculation
      const chartElement = screen.getByTestId('grade-bar-chart');
      fireEvent.mouseOver(chartElement);

      await waitFor(() => {
        expect(screen.getByText(/absence rate/i)).toBeInTheDocument();
      });
    });

    test('should highlight grades with concerning absence rates', async () => {
      const highAbsenceGradeData = [
        ...mockGradeData,
        { grade: '6', absences: 85, students: 120 }, // >70% absence rate
      ];

      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={highAbsenceGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const warningIndicator = screen.getByTestId('high-absence-warning');
      expect(warningIndicator).toBeInTheDocument();
    });
  });

  describe('Absences by Day of Week', () => {
    test('should render day of week breakdown chart', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByTestId('day-bar-chart')).toBeInTheDocument();
    });

    test('should display all weekdays', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
    });

    test('should highlight highest absence day', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const fridayBar = screen.getByTestId('day-bar-friday');
      expect(fridayBar).toHaveClass('highest-absences');
    });
  });

  describe('Top 10 Students Needing Intervention', () => {
    test('should display intervention student list', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const interventionList = screen.getByTestId('intervention-student-list');
      expect(interventionList).toBeInTheDocument();
    });

    test('should show student details in correct order', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      // Should be ordered by absence percentage (highest first)
      const studentItems = screen.getAllByTestId(/intervention-student-/);
      expect(studentItems[0]).toHaveTextContent('John Smith');
      expect(studentItems[0]).toHaveTextContent('25.0%');
      expect(studentItems[1]).toHaveTextContent('Jane Doe');
      expect(studentItems[1]).toHaveTextContent('23.3%');
    });

    test('should display student information correctly', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Grade 3')).toBeInTheDocument();
      expect(screen.getByText('15 absences')).toBeInTheDocument();
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    test('should provide click-to-view student details', async () => {
      const mockOnStudentClick = jest.fn();

      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
          onStudentClick={mockOnStudentClick}
        />
      );

      const studentItem = screen.getByTestId('intervention-student-1');
      fireEvent.click(studentItem);

      expect(mockOnStudentClick).toHaveBeenCalledWith('1');
    });

    test('should show intervention status indicators', async () => {
      const studentsWithStatus = mockTopStudents.map(student => ({
        ...student,
        interventionStatus: 'active'
      }));

      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={studentsWithStatus}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getAllByTestId('intervention-status-active')).toHaveLength(5);
    });
  });

  describe('Most Improved Attendance', () => {
    test('should display improved students list', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const improvedList = screen.getByTestId('improved-student-list');
      expect(improvedList).toBeInTheDocument();
    });

    test('should show improvement metrics', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByText('Amy Davis')).toBeInTheDocument();
      expect(screen.getByText('+8.5%')).toBeInTheDocument();
      expect(screen.getByText('92.1%')).toBeInTheDocument();
    });

    test('should order by improvement amount', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const improvedItems = screen.getAllByTestId(/improved-student-/);
      expect(improvedItems[0]).toHaveTextContent('Amy Davis'); // +8.5%
      expect(improvedItems[1]).toHaveTextContent('Chris Lee'); // +7.2%
      expect(improvedItems[2]).toHaveTextContent('Lisa Garcia'); // +6.8%
    });
  });

  describe('Performance Requirements', () => {
    test('should load in under 2 seconds', async () => {
      const startTime = performance.now();

      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('metrics-overview')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(2000);
    });

    test('should implement virtualization for large datasets', async () => {
      const largeStudentList = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        name: `Student ${i}`,
        grade: Math.floor(i / 167).toString(),
        absences: Math.floor(Math.random() * 20),
        percentage: Math.random() * 30
      }));

      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={largeStudentList}
          improvedStudents={mockImprovedStudents}
        />
      );

      // Should only render visible items
      const renderedItems = screen.getAllByTestId(/intervention-student-/);
      expect(renderedItems.length).toBeLessThanOrEqual(20); // Only visible items
    });
  });

  describe('Data Refresh and Updates', () => {
    test('should handle data refresh', async () => {
      const { rerender } = render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const updatedAttendanceData = [
        { period: 'Week 5', percentage: 97.1 },
        ...mockAttendanceData
      ];

      rerender(
        <MetricsOverview
          attendanceData={updatedAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      expect(screen.getByText('Week 5')).toBeInTheDocument();
    });

    test('should show loading state during data fetch', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('metrics-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading metrics/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing data gracefully', async () => {
      render(
        <MetricsOverview
          attendanceData={[]}
          gradeData={[]}
          dayData={[]}
          topStudents={[]}
          improvedStudents={[]}
        />
      );

      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });

    test('should display error state when data fetch fails', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
          error="Failed to load metrics data"
        />
      );

      expect(screen.getByText(/failed to load metrics data/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper ARIA labels for charts', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const attendanceChart = screen.getByLabelText(/attendance trends chart/i);
      expect(attendanceChart).toBeInTheDocument();

      const gradeChart = screen.getByLabelText(/grade level absences chart/i);
      expect(gradeChart).toBeInTheDocument();
    });

    test('should provide alternative text for visual data', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const chartSummary = screen.getByTestId('chart-text-summary');
      expect(chartSummary).toBeInTheDocument();
      expect(chartSummary).toHaveTextContent(/attendance rate trends/i);
    });
  });

  describe('Responsive Design', () => {
    test('should adapt layout for mobile devices', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const mobileLayout = screen.getByTestId('metrics-mobile-layout');
      expect(mobileLayout).toBeInTheDocument();
    });

    test('should stack charts vertically on small screens', async () => {
      render(
        <MetricsOverview
          attendanceData={mockAttendanceData}
          gradeData={mockGradeData}
          dayData={mockDayData}
          topStudents={mockTopStudents}
          improvedStudents={mockImprovedStudents}
        />
      );

      const chartsContainer = screen.getByTestId('charts-container');
      expect(chartsContainer).toHaveClass('flex-col', 'md:flex-row');
    });
  });
});