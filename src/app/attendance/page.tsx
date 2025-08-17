'use client';

/**
 * @fileoverview Enhanced Attendance Page Component
 * Displays paginated student attendance table with real data from Supabase
 * Includes filtering by school, grade, tier, and school year
 */

import * as React from 'react';
import { DashboardLayout } from '../../presentation/components/dashboard-layout';
import { StudentDetailSidebar } from '../../presentation/components/StudentDetailSidebar';
import { Button } from '../../presentation/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../presentation/components/ui/select';
import { cn } from '../../presentation/utils/cn';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Calendar, RefreshCw, Search } from 'lucide-react';
import { useStudentsData } from '../../presentation/hooks/useStudentsData';
import { useDashboardData } from '../../presentation/hooks/useDashboardData';

// Import types from the hook
import type { StudentData } from '../../presentation/hooks/useStudentsData';

// Sort direction type
type SortDirection = 'asc' | 'desc' | null;

// Column configuration
interface Column {
  key: keyof StudentData;
  label: string;
  sortable: boolean;
  className?: string;
}

// Tier Badge Component
interface TierBadgeProps {
  tier: string;
}

function TierBadge({ tier }: TierBadgeProps) {
  const getBadgeConfig = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'tier 1':
        return {
          label: 'Low Risk',
          className: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'tier 2':
        return {
          label: 'Medium Risk',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      case 'tier 3':
        return {
          label: 'High Risk',
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
  { key: 'attendanceRate', label: 'Attendance %', sortable: true },
  { key: 'absences', label: 'Absences', sortable: true },
  { key: 'tardies', label: 'Tardies', sortable: true },
  { key: 'ireadyElaScore', label: 'iReady ELA', sortable: true, className: 'min-w-32' },
  { key: 'ireadyMathScore', label: 'iReady Math', sortable: true, className: 'min-w-32' },
  { key: 'tier', label: 'Risk Level', sortable: false },
  { key: 'lastIntervention', label: 'Latest Intervention', sortable: false },
];

// Mock user for layout
const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@romoland.k12.ca.us',
  role: 'teacher',
  school: 'Romoland School District'
};

export default function AttendancePage() {
  console.log('🔍 ATTENDANCE PAGE: Component rendering');
  
  // School year state - matches dashboard
  const [selectedSchoolYear, setSelectedSchoolYear] = React.useState<string>('2024');
  
  // Available school years
  const schoolYears = [
    { value: '2024', label: 'SY 2024-2025', description: 'Aug 15, 2024 - Jun 12, 2025' }
  ];

  // Get schools data from dashboard hook
  const { schools } = useDashboardData('all', selectedSchoolYear);

  // Students data hook with pagination and filtering
  const {
    students,
    pagination,
    isLoading,
    error,
    filters,
    currentPage,
    pageSize,
    setFilters,
    setPageSize,
    goToPage,
    nextPage,
    prevPage,
    refreshData,
    clearError,
    setSorting
  } = useStudentsData(
    {
      schoolId: 'all',
      grade: 'all',
      tier: 'all',
      schoolYear: selectedSchoolYear
    },
    20
  );

  // Local state for UI
  const [selectedStudent, setSelectedStudent] = React.useState<StudentData | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sortColumn, setSortColumn] = React.useState<keyof StudentData | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);

  // Handle student selection
  const handleStudentClick = (student: StudentData) => {
    console.log('🔍 ATTENDANCE PAGE: Student clicked!', {
      studentName: student.name,
      studentId: student.id,
      aeriesId: student.studentId
    });
    
    setSelectedStudent(student);
    setSidebarOpen(true);
    
    console.log('🔍 ATTENDANCE PAGE: State updated - sidebarOpen should be true');
  };

  // Handle sidebar close
  const handleSidebarClose = () => {
    setSidebarOpen(false);
    setSelectedStudent(null);
  };

  // Handle filter changes
  const handleSchoolChange = (schoolId: string) => {
    setFilters({ ...filters, schoolId });
  };

  const handleGradeChange = (grade: string) => {
    setFilters({ ...filters, grade });
  };

  const handleRiskLevelChange = (riskLevel: string) => {
    // Map risk level to tier values that the API expects
    let tier = 'all';
    if (riskLevel !== 'all') {
      switch(riskLevel) {
        case 'low': tier = '1'; break;
        case 'medium': tier = '2'; break;
        case 'high': tier = '3'; break;
      }
    }
    setFilters({ ...filters, tier });
  };

  const handleSchoolYearChange = (schoolYear: string) => {
    setSelectedSchoolYear(schoolYear);
    setFilters({ ...filters, schoolYear });
  };

  const handleSearchChange = (search: string) => {
    setFilters({ ...filters, search });
  };

  // Handle column sorting (server-side)
  const handleSort = (column: keyof StudentData) => {
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

    // Use server-side sorting
    if (newDirection) {
      setSorting(column as string, newDirection);
    } else {
      // Reset to default sorting (Tier 3 first, then alphabetical)
      setSorting('default', 'asc');
    }
  };


  // Get sort icon for column header
  const getSortIcon = (column: keyof StudentData) => {
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
  const getAriaSort = (column: keyof StudentData) => {
    if (sortColumn !== column) {
      return 'none';
    }
    return sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none';
  };

  // Get unique grades for filter - hardcoded for now since we need all grades, not just current page
  const availableGrades = React.useMemo(() => {
    // Standard K-12 grades plus special grades
    return ['-2', '-1', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, []);

  console.log('🔍 ATTENDANCE PAGE: About to render, state:', { 
    selectedStudent: selectedStudent?.name, 
    sidebarOpen 
  });

  return (
    <>
      <DashboardLayout user={mockUser} onLogout={() => {}}>
        <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Student Attendance Details</h1>
            <p className="text-muted-foreground">
              Monitor student attendance rates, risk level assessments, and intervention history
            </p>
          </div>

          {/* Filter Controls */}
          <div className="bg-white rounded-lg border-2 border-primary shadow-lg p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Search Input */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-primary">Search:</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Student name or ID..."
                      value={filters.search || ''}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-64"
                    />
                  </div>
                </div>
                {/* School Selection */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-primary">School:</label>
                  <Select value={filters.schoolId || 'all'} onValueChange={handleSchoolChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select school..." />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Grade Selection */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-primary">Grade:</label>
                  <select
                    value={filters.grade || 'all'}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="px-3 py-2 border border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  >
                    <option value="all">All Grades</option>
                    {availableGrades.map(grade => (
                      <option key={grade} value={grade}>
                        {grade === '-2' ? 'Grade P (Preschool)' :
                         grade === '-1' ? 'Grade TK (Transitional Kindergarten)' :
                         grade === '0' ? 'Grade K (Kindergarten)' :
                         `Grade ${grade}`}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Risk Level Selection */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-primary">Risk Level:</label>
                  <select
                    value={
                      filters.tier === '1' ? 'low' :
                      filters.tier === '2' ? 'medium' :
                      filters.tier === '3' ? 'high' : 'all'
                    }
                    onChange={(e) => handleRiskLevelChange(e.target.value)}
                    className="px-3 py-2 border border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>

                {/* School Year Selection */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-primary">School Year:</label>
                  <Select value={selectedSchoolYear} onValueChange={handleSchoolYearChange}>
                    <SelectTrigger className="w-48">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Select year..." />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears.map((year) => (
                        <SelectItem key={year.value} value={year.value}>
                          <span className="font-medium">{year.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Button 
                  variant="outline" 
                  onClick={refreshData}
                  disabled={isLoading}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>

                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>Showing {pagination.total} students</span>
                </div>
              </div>
            </div>

            {/* Page Size Selection */}
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-primary">Rows per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value))}
                  className="px-3 py-1 border border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage <= 1 || isLoading}
                  className="px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-primary">
                  Page {currentPage} of {Math.max(1, pagination.totalPages)}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage >= pagination.totalPages || isLoading}
                  className="px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <div className="text-red-600">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error loading student data</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Attendance Table */}
          <div className="bg-white border-2 border-primary rounded-lg shadow-lg">
            {isLoading ? (
              <div className="p-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="grid grid-cols-7 gap-4">
                        <div className="h-4 bg-gray-200 rounded col-span-2"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded col-span-2"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table role="table" className="w-full">
                  <thead>
                    <tr className="border-b-2 border-primary/20 bg-muted/50">
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          role="columnheader"
                          aria-sort={column.sortable ? getAriaSort(column.key) : undefined}
                          className={cn(
                            'px-6 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider',
                            column.sortable && 'cursor-pointer hover:bg-primary/10',
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
                  <tbody className="bg-white divide-y divide-primary/10">
                    {students.map((student, index) => (
                      <tr
                        key={student.id}
                        className={cn(
                          'hover:bg-primary/5 cursor-pointer transition-colors',
                          index % 2 === 0 ? 'bg-white' : 'bg-muted/30'
                        )}
                        onClick={() => handleStudentClick(student)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-primary">{student.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {student.studentId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {student.grade === '-2' ? 'Grade P' : 
                           student.grade === '-1' ? 'Grade TK' :
                           student.grade === '0' ? 'Grade K' :
                           `Grade ${student.grade}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-primary">
                            {student.attendanceRate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {student.present}/{student.enrolled} days
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {student.absences}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                          {student.tardies || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.ireadyElaScore ? (
                            <div>
                              <div className="text-sm font-medium text-primary">{student.ireadyElaScore}</div>
                              {student.ireadyElaPlacement && (
                                <div className="text-xs text-muted-foreground">{student.ireadyElaPlacement}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No data</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.ireadyMathScore ? (
                            <div>
                              <div className="text-sm font-medium text-primary">{student.ireadyMathScore}</div>
                              {student.ireadyMathPlacement && (
                                <div className="text-xs text-muted-foreground">{student.ireadyMathPlacement}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No data</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <TierBadge tier={student.tier} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.lastIntervention ? (
                            <div className="max-w-48">
                              <div className="text-sm font-medium text-primary">{student.lastIntervention}</div>
                              {student.interventionDate && (
                                <div className="text-xs text-muted-foreground">{new Date(student.interventionDate).toLocaleDateString()}</div>
                              )}
                              {student.interventionDescription && (
                                <div className="text-xs text-gray-600 truncate" title={student.interventionDescription}>
                                  {student.interventionDescription}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No interventions</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Empty state */}
          {!isLoading && students.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">No students match the current filters.</div>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({
                    schoolId: 'all',
                    grade: 'all',
                    tier: 'all',
                    schoolYear: selectedSchoolYear,
                    search: ''
                  });
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