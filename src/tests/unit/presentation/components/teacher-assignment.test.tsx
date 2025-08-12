/**
 * @fileoverview Failing tests for TeacherAssignment.tsx component
 * Following TDD red-green-refactor cycle - these tests should FAIL initially
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
// Mock the component import since it doesn't exist yet
const TeacherAssignment = () => <div data-testid="teacher-assignment">Teacher Assignment Component</div>;

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock drag and drop functionality - using virtual modules
jest.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }) => children,
  Droppable: ({ children }) => children({
    draggableProps: {},
    dragHandleProps: {},
    placeholder: null,
    innerRef: jest.fn(),
  }),
  Draggable: ({ children }) => children({
    draggableProps: {},
    dragHandleProps: {},
    innerRef: jest.fn(),
  }),
}), { virtual: true });

describe('TeacherAssignment Component', () => {
  const mockStudents = [
    {
      id: '1',
      name: 'John Smith',
      grade: '3',
      attendancePercentage: 75.0,
      daysAbsent: 15,
      needsSupport: {
        math: true,
        ela: false,
        el: false
      },
      currentTeacher: 'Mrs. Johnson',
      interventionTier: 'tier2',
      riskLevel: 'high',
      iReadyLevel: {
        math: 'Grade 2',
        ela: 'Grade 3'
      }
    },
    {
      id: '2',
      name: 'Jane Doe',
      grade: '4',
      attendancePercentage: 76.7,
      daysAbsent: 14,
      needsSupport: {
        math: false,
        ela: true,
        el: true
      },
      currentTeacher: 'Mr. Williams',
      interventionTier: 'tier2',
      riskLevel: 'medium',
      iReadyLevel: {
        math: 'Grade 4',
        ela: 'Grade 2'
      }
    },
    {
      id: '3',
      name: 'Mike Johnson',
      grade: '2',
      attendancePercentage: 78.3,
      daysAbsent: 13,
      needsSupport: {
        math: true,
        ela: true,
        el: false
      },
      currentTeacher: 'Ms. Davis',
      interventionTier: 'tier1',
      riskLevel: 'medium',
      iReadyLevel: {
        math: 'Grade 1',
        ela: 'Grade 2'
      }
    },
    {
      id: '4',
      name: 'Sarah Wilson',
      grade: '5',
      attendancePercentage: 95.0,
      daysAbsent: 3,
      needsSupport: {
        math: false,
        ela: false,
        el: true
      },
      currentTeacher: 'Mrs. Brown',
      interventionTier: 'tier1',
      riskLevel: 'low',
      iReadyLevel: {
        math: 'Grade 5',
        ela: 'Grade 5'
      }
    }
  ];

  const mockTeachers = [
    {
      id: '1',
      name: 'Mrs. Rodriguez',
      specialty: 'math',
      maxCapacity: 20,
      currentAssignments: 12,
      experience: 'senior',
      certifications: ['math_intervention', 'tier2_support'],
      gradeRange: ['K', '1', '2', '3']
    },
    {
      id: '2',
      name: 'Mr. Thompson',
      specialty: 'ela',
      maxCapacity: 20,
      currentAssignments: 18,
      experience: 'mid',
      certifications: ['ela_intervention', 'reading_specialist'],
      gradeRange: ['3', '4', '5']
    },
    {
      id: '3',
      name: 'Ms. Garcia',
      specialty: 'el',
      maxCapacity: 20,
      currentAssignments: 8,
      experience: 'senior',
      certifications: ['el_specialist', 'bilingual_education'],
      gradeRange: ['K', '1', '2', '3', '4', '5']
    },
    {
      id: '4',
      name: 'Mrs. Chen',
      specialty: 'general',
      maxCapacity: 20,
      currentAssignments: 15,
      experience: 'junior',
      certifications: ['general_intervention'],
      gradeRange: ['2', '3', '4']
    }
  ];

  const mockCurrentAssignments = [
    {
      teacherId: '1',
      students: ['1', '3'] // Math support students
    },
    {
      teacherId: '2',
      students: ['2'] // ELA support students
    },
    {
      teacherId: '3',
      students: ['4'] // EL support students
    }
  ];

  const defaultProps = {
    students: mockStudents,
    teachers: mockTeachers,
    currentAssignments: mockCurrentAssignments,
    isLoading: false,
    error: null,
    onAssignStudents: jest.fn(),
    onUnassignStudent: jest.fn(),
    onBulkAssignment: jest.fn(),
    onGenerateReport: jest.fn(),
    onSaveAssignments: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Structure', () => {
    test('should render teacher assignment container', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      expect(screen.getByTestId('teacher-assignment')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /teacher assignment/i })).toBeInTheDocument();
    });

    test('should display header with controls', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /teacher assignment/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save assignments/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
    });

    test('should show assignment filters', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      expect(screen.getByRole('combobox', { name: /filter by need/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /filter by grade/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /filter by tier/i })).toBeInTheDocument();
    });
  });

  describe('Student Ranking Display', () => {
    test('should display students ranked by need', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const studentList = screen.getByTestId('ranked-student-list');
      expect(studentList).toBeInTheDocument();

      const studentItems = screen.getAllByTestId(/ranked-student-/);
      expect(studentItems).toHaveLength(4);
    });

    test('should show student ranking criteria', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const firstStudent = screen.getByTestId('ranked-student-1');
      
      expect(firstStudent).toHaveTextContent('John Smith');
      expect(firstStudent).toHaveTextContent('Grade 3');
      expect(firstStudent).toHaveTextContent('75.0% attendance');
      expect(firstStudent).toHaveTextContent('High Risk');
      expect(firstStudent).toHaveTextContent('Math Support Needed');
    });

    test('should display intervention tier indicators', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      expect(screen.getByTestId('tier-indicator-tier2')).toBeInTheDocument();
      expect(screen.getByTestId('tier-indicator-tier1')).toBeInTheDocument();
    });

    test('should show i-Ready performance levels', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const firstStudent = screen.getByTestId('ranked-student-1');
      expect(firstStudent).toHaveTextContent('Math: Grade 2');
      expect(firstStudent).toHaveTextContent('ELA: Grade 3');
    });

    test('should highlight support needs', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const mathNeedIndicator = screen.getByTestId('support-need-math-1');
      expect(mathNeedIndicator).toHaveClass('support-needed');

      const elaNeedIndicator = screen.getByTestId('support-need-ela-2');
      expect(elaNeedIndicator).toHaveClass('support-needed');
    });
  });

  describe('Filter Functionality', () => {
    test('should filter students by support need', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const needFilter = screen.getByRole('combobox', { name: /filter by need/i });
      fireEvent.click(needFilter);
      fireEvent.click(screen.getByRole('option', { name: /math/i }));

      await waitFor(() => {
        expect(screen.getByTestId('ranked-student-1')).toBeInTheDocument(); // John needs math
        expect(screen.getByTestId('ranked-student-3')).toBeInTheDocument(); // Mike needs math
        expect(screen.queryByTestId('ranked-student-2')).not.toBeInTheDocument(); // Jane doesn't need math
      });
    });

    test('should filter students by grade level', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const gradeFilter = screen.getByRole('combobox', { name: /filter by grade/i });
      fireEvent.click(gradeFilter);
      fireEvent.click(screen.getByRole('option', { name: /grade 3/i }));

      await waitFor(() => {
        expect(screen.getByTestId('ranked-student-1')).toBeInTheDocument(); // John is grade 3
        expect(screen.queryByTestId('ranked-student-2')).not.toBeInTheDocument(); // Jane is grade 4
      });
    });

    test('should filter students by intervention tier', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const tierFilter = screen.getByRole('combobox', { name: /filter by tier/i });
      fireEvent.click(tierFilter);
      fireEvent.click(screen.getByRole('option', { name: /tier 2/i }));

      await waitFor(() => {
        expect(screen.getByTestId('ranked-student-1')).toBeInTheDocument(); // John is tier 2
        expect(screen.getByTestId('ranked-student-2')).toBeInTheDocument(); // Jane is tier 2
        expect(screen.queryByTestId('ranked-student-3')).not.toBeInTheDocument(); // Mike is tier 1
      });
    });

    test('should clear all filters', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      // Apply a filter
      const needFilter = screen.getByRole('combobox', { name: /filter by need/i });
      fireEvent.click(needFilter);
      fireEvent.click(screen.getByRole('option', { name: /math/i }));

      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.getAllByTestId(/ranked-student-/)).toHaveLength(4);
      });
    });
  });

  describe('Teacher Assignment Cards', () => {
    test('should display teacher assignment cards', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      expect(screen.getByTestId('teacher-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('teacher-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('teacher-card-3')).toBeInTheDocument();
      expect(screen.getByTestId('teacher-card-4')).toBeInTheDocument();
    });

    test('should show teacher information', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const teacherCard = screen.getByTestId('teacher-card-1');
      
      expect(teacherCard).toHaveTextContent('Mrs. Rodriguez');
      expect(teacherCard).toHaveTextContent('Math Specialist');
      expect(teacherCard).toHaveTextContent('Senior Experience');
      expect(teacherCard).toHaveTextContent('12/20 students');
    });

    test('should display teacher capacity status', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const fullCapacityTeacher = screen.getByTestId('teacher-card-2');
      expect(fullCapacityTeacher).toHaveTextContent('18/20 students');
      expect(fullCapacityTeacher).toHaveClass('near-capacity');

      const availableTeacher = screen.getByTestId('teacher-card-3');
      expect(availableTeacher).toHaveTextContent('8/20 students');
      expect(availableTeacher).toHaveClass('available');
    });

    test('should show teacher certifications', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const teacherCard = screen.getByTestId('teacher-card-1');
      expect(teacherCard).toHaveTextContent('Math Intervention');
      expect(teacherCard).toHaveTextContent('Tier 2 Support');
    });

    test('should display grade range compatibility', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const teacherCard = screen.getByTestId('teacher-card-1');
      expect(teacherCard).toHaveTextContent('Grades: K-3');
    });
  });

  describe('20:1 Ratio Enforcement', () => {
    test('should enforce maximum 20:1 student-teacher ratio', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const fullTeacherCard = screen.getByTestId('teacher-card-2'); // 18/20 students
      const draggedStudent = screen.getByTestId('ranked-student-4');

      // Try to assign 3rd student to full teacher (would exceed ratio)
      fireEvent.dragStart(draggedStudent);
      fireEvent.dragOver(fullTeacherCard);
      fireEvent.drop(fullTeacherCard);

      expect(screen.getByText(/cannot exceed 20:1 ratio/i)).toBeInTheDocument();
    });

    test('should warn when approaching capacity', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const nearCapacityTeacher = screen.getByTestId('teacher-card-2');
      expect(nearCapacityTeacher).toHaveTextContent('2 spots remaining');
      expect(nearCapacityTeacher).toHaveClass('near-capacity');
    });

    test('should disable assignment when at capacity', async () => {
      const teachersAtCapacity = mockTeachers.map(teacher => 
        teacher.id === '2' ? { ...teacher, currentAssignments: 20 } : teacher
      );

      render(<TeacherAssignment {...defaultProps} teachers={teachersAtCapacity} />);

      const fullTeacherCard = screen.getByTestId('teacher-card-2');
      expect(fullTeacherCard).toHaveClass('at-capacity');
      expect(fullTeacherCard).toHaveAttribute('data-accepts-drops', 'false');
    });

    test('should calculate remaining capacity correctly', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const teacherCard1 = screen.getByTestId('teacher-card-1'); // 12/20
      expect(teacherCard1).toHaveTextContent('8 spots remaining');

      const teacherCard3 = screen.getByTestId('teacher-card-3'); // 8/20
      expect(teacherCard3).toHaveTextContent('12 spots remaining');
    });
  });

  describe('Student Assignment Actions', () => {
    test('should support drag and drop assignment', async () => {
      const mockOnAssignStudents = jest.fn();
      render(<TeacherAssignment {...defaultProps} onAssignStudents={mockOnAssignStudents} />);

      const student = screen.getByTestId('ranked-student-4'); // Unassigned student
      const teacherCard = screen.getByTestId('teacher-card-1');

      fireEvent.dragStart(student);
      fireEvent.dragOver(teacherCard);
      fireEvent.drop(teacherCard);

      expect(mockOnAssignStudents).toHaveBeenCalledWith('1', ['4']);
    });

    test('should support bulk assignment', async () => {
      const mockOnBulkAssignment = jest.fn();
      render(<TeacherAssignment {...defaultProps} onBulkAssignment={mockOnBulkAssignment} />);

      // Select multiple students
      const checkbox1 = screen.getByRole('checkbox', { name: /select john smith/i });
      const checkbox2 = screen.getByRole('checkbox', { name: /select jane doe/i });
      
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      const bulkAssignButton = screen.getByRole('button', { name: /bulk assign/i });
      fireEvent.click(bulkAssignButton);

      const teacherSelect = screen.getByRole('combobox', { name: /select teacher/i });
      fireEvent.click(teacherSelect);
      fireEvent.click(screen.getByRole('option', { name: /mrs. rodriguez/i }));

      const confirmButton = screen.getByRole('button', { name: /confirm assignment/i });
      fireEvent.click(confirmButton);

      expect(mockOnBulkAssignment).toHaveBeenCalledWith('1', ['1', '2']);
    });

    test('should handle student unassignment', async () => {
      const mockOnUnassignStudent = jest.fn();
      render(<TeacherAssignment {...defaultProps} onUnassignStudent={mockOnUnassignStudent} />);

      const assignedStudent = screen.getByTestId('assigned-student-1');
      const unassignButton = screen.getByRole('button', { name: /unassign john smith/i });
      
      fireEvent.click(unassignButton);

      expect(mockOnUnassignStudent).toHaveBeenCalledWith('1', '1');
    });

    test('should validate assignment compatibility', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      // Try to assign grade 5 student to K-3 teacher
      const grade5Student = screen.getByTestId('ranked-student-4'); // Sarah - Grade 5
      const k3Teacher = screen.getByTestId('teacher-card-1'); // Mrs. Rodriguez - K-3

      fireEvent.dragStart(grade5Student);
      fireEvent.dragOver(k3Teacher);
      fireEvent.drop(k3Teacher);

      expect(screen.getByText(/grade level mismatch/i)).toBeInTheDocument();
    });
  });

  describe('Assignment Recommendations', () => {
    test('should show optimal teacher recommendations', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const studentCard = screen.getByTestId('ranked-student-1'); // John needs math
      const recommendationButton = screen.getByRole('button', { name: /show recommendations/i });
      
      fireEvent.click(recommendationButton);

      const recommendations = screen.getByTestId('recommendations-1');
      expect(recommendations).toHaveTextContent('Mrs. Rodriguez'); // Math specialist
      expect(recommendations).toHaveTextContent('Best match: 95%');
    });

    test('should consider teacher specialties in recommendations', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const elaStudent = screen.getByTestId('ranked-student-2'); // Jane needs ELA
      const recommendationButton = screen.getByRole('button', { name: /show recommendations/i });
      
      fireEvent.click(recommendationButton);

      const recommendations = screen.getByTestId('recommendations-2');
      expect(recommendations).toHaveTextContent('Mr. Thompson'); // ELA specialist
    });

    test('should factor in teacher capacity', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const recommendations = screen.getByTestId('recommendations-1');
      
      // Should show capacity consideration
      expect(recommendations).toHaveTextContent('8 spots available');
      expect(recommendations).toHaveTextContent('Capacity: Good');
    });

    test('should auto-assign with optimal matching', async () => {
      const mockOnAssignStudents = jest.fn();
      render(<TeacherAssignment {...defaultProps} onAssignStudents={mockOnAssignStudents} />);

      const autoAssignButton = screen.getByRole('button', { name: /auto assign all/i });
      fireEvent.click(autoAssignButton);

      const confirmButton = screen.getByRole('button', { name: /confirm auto assignment/i });
      fireEvent.click(confirmButton);

      // Should assign based on optimal matching
      expect(mockOnAssignStudents).toHaveBeenCalledTimes(4); // One call per unassigned student
    });
  });

  describe('Assignment Validation', () => {
    test('should validate teacher qualifications', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      // Try to assign tier 2 student to junior teacher without tier 2 certification
      const tier2Student = screen.getByTestId('ranked-student-1');
      const juniorTeacher = screen.getByTestId('teacher-card-4'); // Mrs. Chen - junior, no tier 2 cert

      fireEvent.dragStart(tier2Student);
      fireEvent.dragOver(juniorTeacher);
      fireEvent.drop(juniorTeacher);

      expect(screen.getByText(/teacher lacks required certification/i)).toBeInTheDocument();
    });

    test('should check grade level compatibility', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const validationResults = screen.getByTestId('validation-results');
      expect(validationResults).toBeInTheDocument();
    });

    test('should warn about workload balance', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const workloadWarning = screen.getByTestId('workload-warning');
      expect(workloadWarning).toHaveTextContent(/uneven workload distribution/i);
    });
  });

  describe('Assignment Confirmation', () => {
    test('should generate assignment confirmation', async () => {
      const mockOnSaveAssignments = jest.fn();
      render(<TeacherAssignment {...defaultProps} onSaveAssignments={mockOnSaveAssignments} />);

      const saveButton = screen.getByRole('button', { name: /save assignments/i });
      fireEvent.click(saveButton);

      const confirmationModal = screen.getByRole('dialog', { name: /confirm assignments/i });
      expect(confirmationModal).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm save/i });
      fireEvent.click(confirmButton);

      expect(mockOnSaveAssignments).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: expect.any(Array),
          timestamp: expect.any(Date)
        })
      );
    });

    test('should show assignment summary', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save assignments/i });
      fireEvent.click(saveButton);

      const summary = screen.getByTestId('assignment-summary');
      expect(summary).toHaveTextContent('4 students assigned');
      expect(summary).toHaveTextContent('4 teachers involved');
      expect(summary).toHaveTextContent('Average ratio: 15:1');
    });

    test('should handle assignment conflicts', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save assignments/i });
      fireEvent.click(saveButton);

      const conflicts = screen.getByTestId('assignment-conflicts');
      if (conflicts) {
        expect(conflicts).toHaveTextContent(/conflicts detected/i);
      }
    });
  });

  describe('Report Generation', () => {
    test('should generate assignment report', async () => {
      const mockOnGenerateReport = jest.fn();
      render(<TeacherAssignment {...defaultProps} onGenerateReport={mockOnGenerateReport} />);

      const reportButton = screen.getByRole('button', { name: /generate report/i });
      fireEvent.click(reportButton);

      const reportType = screen.getByRole('combobox', { name: /report type/i });
      fireEvent.click(reportType);
      fireEvent.click(screen.getByRole('option', { name: /assignment summary/i }));

      const generateButton = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(generateButton);

      expect(mockOnGenerateReport).toHaveBeenCalledWith('assignment_summary');
    });

    test('should support different report formats', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const reportButton = screen.getByRole('button', { name: /generate report/i });
      fireEvent.click(reportButton);

      const formatSelect = screen.getByRole('combobox', { name: /format/i });
      fireEvent.click(formatSelect);

      expect(screen.getByRole('option', { name: /pdf/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /excel/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /csv/i })).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    test('should show loading state', async () => {
      render(<TeacherAssignment {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('assignment-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading assignment data/i)).toBeInTheDocument();
    });

    test('should display error state', async () => {
      render(<TeacherAssignment {...defaultProps} error="Failed to load assignment data" />);

      expect(screen.getByText(/failed to load assignment data/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(<TeacherAssignment {...defaultProps} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper ARIA labels for drag and drop', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const draggableStudent = screen.getByTestId('ranked-student-1');
      expect(draggableStudent).toHaveAttribute('aria-grabbed', 'false');
      expect(draggableStudent).toHaveAttribute('aria-describedby');

      const dropZone = screen.getByTestId('teacher-card-1');
      expect(dropZone).toHaveAttribute('aria-dropeffect', 'move');
    });

    test('should support keyboard navigation for assignments', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const student = screen.getByTestId('ranked-student-1');
      student.focus();

      fireEvent.keyDown(student, { key: 'Space' }); // Select
      fireEvent.keyDown(student, { key: 'ArrowRight' }); // Move to teacher column
      fireEvent.keyDown(student, { key: 'Enter' }); // Assign

      expect(screen.getByText(/assignment completed/i)).toBeInTheDocument();
    });

    test('should provide screen reader announcements', async () => {
      render(<TeacherAssignment {...defaultProps} />);

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

      render(<TeacherAssignment {...defaultProps} />);

      const mobileLayout = screen.getByTestId('assignment-mobile-layout');
      expect(mobileLayout).toBeInTheDocument();
    });

    test('should stack columns vertically on small screens', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const assignmentGrid = screen.getByTestId('assignment-grid');
      expect(assignmentGrid).toHaveClass('grid-cols-1', 'lg:grid-cols-2');
    });

    test('should provide mobile-friendly assignment interface', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(<TeacherAssignment {...defaultProps} />);

      // Should show assign buttons instead of drag-drop on mobile
      expect(screen.getAllByRole('button', { name: /assign to teacher/i })).toHaveLength(4);
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', async () => {
      const largeStudentList = Array.from({ length: 500 }, (_, i) => ({
        id: i.toString(),
        name: `Student ${i}`,
        grade: (Math.floor(i / 100) + 1).toString(),
        attendancePercentage: Math.random() * 100,
        daysAbsent: Math.floor(Math.random() * 20),
        needsSupport: {
          math: Math.random() > 0.5,
          ela: Math.random() > 0.5,
          el: Math.random() > 0.8
        },
        currentTeacher: `Teacher ${i % 20}`,
        interventionTier: Math.random() > 0.5 ? 'tier1' : 'tier2',
        riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        iReadyLevel: {
          math: `Grade ${Math.floor(Math.random() * 6)}`,
          ela: `Grade ${Math.floor(Math.random() * 6)}`
        }
      }));

      const startTime = performance.now();

      render(<TeacherAssignment {...defaultProps} students={largeStudentList} />);

      await waitFor(() => {
        expect(screen.getByTestId('teacher-assignment')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(2000);
    });

    test('should implement virtual scrolling for large lists', async () => {
      const largeStudentList = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        name: `Student ${i}`,
        grade: '3',
        attendancePercentage: 75,
        daysAbsent: 15,
        needsSupport: { math: true, ela: false, el: false },
        currentTeacher: 'Teacher',
        interventionTier: 'tier1',
        riskLevel: 'medium',
        iReadyLevel: { math: 'Grade 2', ela: 'Grade 3' }
      }));

      render(<TeacherAssignment {...defaultProps} students={largeStudentList} />);

      // Should only render visible items
      const renderedStudents = screen.getAllByTestId(/ranked-student-/);
      expect(renderedStudents.length).toBeLessThanOrEqual(50); // Only visible items
    });
  });

  describe('Data Validation', () => {
    test('should validate student data completeness', async () => {
      const incompleteStudent = {
        id: '1',
        name: 'John Smith',
        // Missing required fields
      };

      render(<TeacherAssignment {...defaultProps} students={[incompleteStudent]} />);

      expect(screen.getByText(/incomplete student data/i)).toBeInTheDocument();
    });

    test('should validate teacher qualification data', async () => {
      const invalidTeacher = {
        id: '1',
        name: 'Invalid Teacher',
        specialty: 'unknown',
        maxCapacity: -5,
      };

      render(<TeacherAssignment {...defaultProps} teachers={[invalidTeacher]} />);

      expect(screen.getByText(/invalid teacher data/i)).toBeInTheDocument();
    });
  });

  describe('Assignment History', () => {
    test('should track assignment changes', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const historyButton = screen.getByRole('button', { name: /view history/i });
      fireEvent.click(historyButton);

      const history = screen.getByTestId('assignment-history');
      expect(history).toBeInTheDocument();
    });

    test('should allow reverting assignments', async () => {
      render(<TeacherAssignment {...defaultProps} />);

      const historyButton = screen.getByRole('button', { name: /view history/i });
      fireEvent.click(historyButton);

      const revertButton = screen.getByRole('button', { name: /revert to previous/i });
      expect(revertButton).toBeInTheDocument();
    });
  });
});