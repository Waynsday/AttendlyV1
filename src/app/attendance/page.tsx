'use client';

/**
 * @fileoverview Enhanced Attendance Page Component
 * Displays sortable student attendance table with tier badges and detailed sidebar
 * Uses real data from AP Romoland CSV files
 */

import * as React from 'react';
import { DashboardLayout } from '../../presentation/components/dashboard-layout';
import { StudentDetailSidebar } from '../../presentation/components/StudentDetailSidebar';
import { Button } from '../../presentation/components/ui/button';
import { cn } from '../../presentation/utils/cn';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Filter } from 'lucide-react';

// Enhanced student data interface with detailed information
interface StudentRow {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  studentId: string;
  attendanceRate: number;
  absences: number;
  enrolled: number;
  present: number;
  tier: string;
  riskLevel: 'low' | 'medium' | 'high';
  lastIntervention?: string;
  
  // Additional details for sidebar
  attendanceHistory: Array<{
    date: string;
    status: 'present' | 'absent' | 'tardy';
    percentage: number;
  }>;
  
  iReadyScores: Array<{
    subject: 'ELA' | 'Math';
    testDate: string;
    overallScore: number;
    placement: string;
    lexileLevel?: string;
    percentile: number;
    gain: number;
  }>;
  
  interventions: Array<{
    date: string;
    type: 'Letter 1' | 'Letter 2' | 'SART' | 'SARB' | 'Mediation' | 'Parent Contact';
    status: 'Completed' | 'Pending' | 'No Show';
    notes: string;
  }>;
  
  comments: Array<{
    date: string;
    staff: string;
    comment: string;
  }>;
}

// Sort direction type
type SortDirection = 'asc' | 'desc' | null;

// Column configuration
interface Column {
  key: keyof StudentRow;
  label: string;
  sortable: boolean;
  className?: string;
}

// Real student data based on AP Romoland CSV
const realStudentData: StudentRow[] = [
  {
    id: '1015957',
    name: 'Molina Mendez, Genesis',
    grade: '1',
    teacher: 'Mitchell, Heather',
    studentId: '1015957',
    attendanceRate: 48.15,
    absences: 14,
    enrolled: 27,
    present: 13,
    tier: 'Tier 3',
    riskLevel: 'high',
    lastIntervention: 'New student - enrolled 3/26/25',
    attendanceHistory: [
      { date: '5/9', status: 'absent', percentage: 44.44 },
      { date: '5/2', status: 'present', percentage: 51.85 },
      { date: '4/17', status: 'absent', percentage: 59.09 },
    ],
    iReadyScores: [],
    interventions: [
      {
        date: '2025-05-02',
        type: 'Parent Contact',
        status: 'Completed',
        notes: 'Called dad about attendance. Student sent home due to lice treatment.'
      }
    ],
    comments: [
      {
        date: '2025-05-02',
        staff: 'Mitchell, Heather',
        comment: 'Student was sent home on 4/8/25 by school nurse due to student having lice. Called dad and he explained they are new to the city.'
      }
    ]
  },
  {
    id: '1011396',
    name: 'Hernandez, Mia',
    grade: '3',
    teacher: 'Porter, Aimee',
    studentId: '1011396',
    attendanceRate: 65.38,
    absences: 54,
    enrolled: 156,
    present: 102,
    tier: 'Tier 3',
    riskLevel: 'high',
    lastIntervention: 'SART 4/29/25',
    attendanceHistory: [
      { date: '5/9', status: 'absent', percentage: 34.62 },
      { date: '5/2', status: 'present', percentage: 35.76 },
      { date: '4/17', status: 'absent', percentage: 36.05 },
      { date: '4/11', status: 'absent', percentage: 35.21 },
    ],
    iReadyScores: [
      {
        subject: 'ELA',
        testDate: '2024-08-27',
        overallScore: 593,
        placement: 'Grade 5',
        lexileLevel: '980L',
        percentile: 62,
        gain: 0
      },
      {
        subject: 'Math',
        testDate: '2024-08-27',
        overallScore: 512,
        placement: 'Grade 2',
        percentile: 45,
        gain: 12
      }
    ],
    interventions: [
      {
        date: '2024-10-18',
        type: 'SART',
        status: 'Completed',
        notes: 'SART signed. Home issues with father not supportive. Student has asthma.'
      },
      {
        date: '2024-11-22',
        type: 'SARB',
        status: 'No Show',
        notes: 'No show on 11/22, signed on 12/13/24'
      },
      {
        date: '2025-04-29',
        type: 'SART',
        status: 'Completed',
        notes: 'Second SART contract signed'
      }
    ],
    comments: [
      {
        date: '2024-09-04',
        staff: 'Hernandez',
        comment: 'Spoke to mom - family emergency. Student has been sick often with dr appointments. Monitoring attendance closely.'
      },
      {
        date: '2024-12-02',
        staff: 'Carroll',
        comment: 'Mia comes in daily for morning check-ins. Still consistently missing at least one day a week. Participating in Mentoring Matters program.'
      }
    ]
  },
  {
    id: '1015880',
    name: 'Lemus, Ava',
    grade: '1',
    teacher: 'Mitchell, Heather',
    studentId: '1015880',
    attendanceRate: 68.52,
    absences: 17,
    enrolled: 54,
    present: 37,
    tier: 'Tier 2',
    riskLevel: 'medium',
    lastIntervention: 'Called 5/8/25 - No answer',
    attendanceHistory: [
      { date: '4/17', status: 'absent', percentage: 31.48 },
      { date: '4/11', status: 'absent', percentage: 28.57 },
      { date: '4/4', status: 'absent', percentage: 31.11 },
    ],
    iReadyScores: [],
    interventions: [],
    comments: [
      {
        date: '2025-05-08',
        staff: 'Staff',
        comment: 'Called at 9:48am - No answer'
      }
    ]
  },
  {
    id: '1013808',
    name: 'Dorsey, Lilliana',
    grade: '0',
    teacher: 'Lizardi, Wendy',
    studentId: '1013808',
    attendanceRate: 71.15,
    absences: 45,
    enrolled: 156,
    present: 111,
    tier: 'Tier 3',
    riskLevel: 'high',
    lastIntervention: 'Will send to Mediation',
    attendanceHistory: [
      { date: '5/9', status: 'absent', percentage: 28.85 },
      { date: '5/2', status: 'present', percentage: 29.80 },
      { date: '4/17', status: 'absent', percentage: 30.61 },
    ],
    iReadyScores: [],
    interventions: [
      {
        date: '2024-11-05',
        type: 'SART',
        status: 'Completed',
        notes: 'SART signed by mother. Student has been sick a lot. Home issues between parents.'
      },
      {
        date: '2025-02-28',
        type: 'SARB',
        status: 'No Show',
        notes: 'Did not attend SARB meeting'
      }
    ],
    comments: [
      {
        date: '2024-12-02',
        staff: 'Carroll',
        comment: 'Attempted to leave a message. The mailbox is full.'
      },
      {
        date: '2024-11-05',
        staff: 'Machado',
        comment: 'SART signed by mother. She has been sick a lot. Also there are home issues between the parents.'
      }
    ]
  }
];

// Tier Badge Component
interface TierBadgeProps {
  tier: string;
}

function TierBadge({ tier }: TierBadgeProps) {
  const getBadgeConfig = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'tier 1':
        return {
          label: 'Tier 1',
          className: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'tier 2':
        return {
          label: 'Tier 2',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      case 'tier 3':
        return {
          label: 'Tier 3',
          className: 'bg-red-100 text-red-800 border-red-200',
        };
      default:
        return {
          label: 'No Risk',
          className: 'bg-green-100 text-green-800 border-green-200',
        };
    }
  };

  const config = getBadgeConfig(tier);

  return (
    <span
      className={cn(
        'tier-badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

// Table columns configuration
const columns: Column[] = [
  { key: 'name', label: 'Student Name', sortable: true },
  { key: 'grade', label: 'Grade', sortable: true },
  { key: 'teacher', label: 'Teacher', sortable: true },
  { key: 'attendanceRate', label: 'Attendance %', sortable: true },
  { key: 'absences', label: 'Absences', sortable: true },
  { key: 'tier', label: 'Tier', sortable: false },
  { key: 'lastIntervention', label: 'Latest Intervention', sortable: false },
];

// Mock user for layout
const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@romoland.k12.ca.us',
  role: 'teacher',
  school: 'AP Romoland School'
};

export default function AttendancePage() {
  const [sortColumn, setSortColumn] = React.useState<keyof StudentRow | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);
  const [students, setStudents] = React.useState<StudentRow[]>(realStudentData);
  const [selectedStudent, setSelectedStudent] = React.useState<StudentRow | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [filterTier, setFilterTier] = React.useState<string>('all');
  const [filterGrade, setFilterGrade] = React.useState<string>('all');

  // Handle student selection
  const handleStudentClick = (student: StudentRow) => {
    setSelectedStudent(student);
    setSidebarOpen(true);
  };

  // Handle sidebar close
  const handleSidebarClose = () => {
    setSidebarOpen(false);
    setSelectedStudent(null);
  };

  // Handle column sorting
  const handleSort = (column: keyof StudentRow) => {
    let newDirection: SortDirection = 'asc';
    
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newDirection = null;
      } else {
        newDirection = 'asc';
      }
    }

    setSortColumn(newDirection ? column : null);
    setSortDirection(newDirection);

    // Sort the data
    if (newDirection) {
      const sortedStudents = [...students].sort((a, b) => {
        const aValue = a[column];
        const bValue = b[column];

        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return 1;
        if (bValue === undefined) return -1;

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return newDirection === 'desc' ? -comparison : comparison;
      });
      setStudents(sortedStudents);
    } else {
      setStudents(realStudentData);
    }
  };

  // Filter students based on tier and grade
  const filteredStudents = React.useMemo(() => {
    return students.filter(student => {
      const tierMatch = filterTier === 'all' || student.tier.toLowerCase() === filterTier.toLowerCase();
      const gradeMatch = filterGrade === 'all' || student.grade === filterGrade;
      return tierMatch && gradeMatch;
    });
  }, [students, filterTier, filterGrade]);

  // Get sort icon for column header
  const getSortIcon = (column: keyof StudentRow) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="ml-2 h-4 w-4" />;
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="ml-2 h-4 w-4" />;
    }
    return <ChevronsUpDown className="ml-2 h-4 w-4" />;
  };

  // Get aria-sort value for column header
  const getAriaSort = (column: keyof StudentRow) => {
    if (sortColumn !== column) {
      return 'none';
    }
    return sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none';
  };

  // Get unique grades for filter
  const availableGrades = React.useMemo(() => {
    const grades = [...new Set(realStudentData.map(s => s.grade))].sort();
    return grades;
  }, []);

  return (
    <>
      <DashboardLayout user={mockUser} onLogout={() => {}}>
        <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-romoland-primary">Student Attendance Details</h1>
            <p className="text-romoland-text">
              Monitor student attendance rates, risk tier assignments, and intervention history
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-romoland-primary focus:border-transparent"
              >
                <option value="all">All Grades</option>
                {availableGrades.map(grade => (
                  <option key={grade} value={grade}>Grade {grade}</option>
                ))}
              </select>
              
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-romoland-primary focus:border-transparent"
              >
                <option value="all">All Tiers</option>
                <option value="tier 1">Tier 1</option>
                <option value="tier 2">Tier 2</option>
                <option value="tier 3">Tier 3</option>
              </select>
            </div>
            
            <div className="text-sm text-romoland-text">
              Showing {filteredStudents.length} of {realStudentData.length} students
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table role="table" className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        role="columnheader"
                        aria-sort={column.sortable ? getAriaSort(column.key) : undefined}
                        className={cn(
                          'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                          column.sortable && 'cursor-pointer hover:bg-gray-100',
                          column.className
                        )}
                        onClick={column.sortable ? () => handleSort(column.key) : undefined}
                      >
                        <div className="flex items-center">
                          {column.label}
                          {column.sortable && getSortIcon(column.key)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student, index) => (
                    <tr
                      key={student.id}
                      className={cn(
                        'hover:bg-gray-50 cursor-pointer transition-colors',
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      )}
                      onClick={() => handleStudentClick(student)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-500">ID: {student.studentId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.grade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.teacher}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.attendanceRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {student.present}/{student.enrolled} days
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.absences}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <TierBadge tier={student.tier} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                        {student.lastIntervention || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Empty state */}
          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">No students match the current filters.</div>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterTier('all');
                  setFilterGrade('all');
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </DashboardLayout>

      {/* Student Detail Sidebar */}
      <StudentDetailSidebar
        student={selectedStudent}
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
      />
    </>
  );
}