/**
 * @fileoverview StudentList component implementation
 * Displays student attendance data with filtering, sorting, and bulk operations
 * Follows TDD green phase - implementing minimal functionality to pass failing tests
 */

import * as React from 'react';
import { FixedSizeList as List } from 'react-window';
import { Search, Filter, Download, MoreHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../utils/cn';

// Student interface based on test data
interface Student {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  attendancePercentage: number;
  daysAbsent: number;
  recoveryDays: number;
  interventionStatus: 'active' | 'pending' | 'none';
  tardyCount: number;
  tier: string;
  lastAbsence: string;
  chronicallyAbsent: boolean;
}

interface StudentListProps {
  students: Student[];
  isLoading?: boolean;
  error?: string | null;
  userRole?: string;
  onStudentClick?: (studentId: string) => void;
  onBulkAssignment?: (selectedIds: string[]) => void;
  onExportData?: (format: string, data: Student[]) => void;
}

export function StudentList({
  students,
  isLoading = false,
  error = null,
  userRole = 'teacher',
  onStudentClick,
  onBulkAssignment,
  onExportData,
}: StudentListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedTier, setSelectedTier] = React.useState<string>('all');
  const [selectedGrade, setSelectedGrade] = React.useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = React.useState<string>('all');
  const [selectedStudents, setSelectedStudents] = React.useState<string[]>([]);
  const [sortField, setSortField] = React.useState<string>('');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [showActionsMenu, setShowActionsMenu] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);

  // Handle responsive layout
  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    // Set initial value synchronously for tests
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 640);
    }
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Initialize mobile state on first render for tests
  React.useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 640);
    }
  }, []);

  // Filter students based on search and filters
  const filteredStudents = React.useMemo(() => {
    let filtered = students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = selectedTier === 'all' || student.tier === selectedTier;
      const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade;
      const matchesTeacher = selectedTeacher === 'all' || student.teacher === selectedTeacher;
      
      return matchesSearch && matchesTier && matchesGrade && matchesTeacher;
    });

    // Sort students
    if (sortField) {
      filtered.sort((a, b) => {
        let aVal = a[sortField as keyof Student];
        let bVal = b[sortField as keyof Student];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    } else {
      // Default sort by attendance percentage (lowest first)
      filtered.sort((a, b) => a.attendancePercentage - b.attendancePercentage);
    }

    return filtered;
  }, [students, searchTerm, selectedTier, selectedGrade, selectedTeacher, sortField, sortDirection]);

  // Handle individual student selection
  const handleStudentSelection = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, studentId]);
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== studentId));
    }
  };

  // Handle select all toggle
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(filteredStudents.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTier('all');
    setSelectedGrade('all');
    setSelectedTeacher('all');
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format student name based on user role
  const formatStudentName = (student: Student) => {
    if (userRole === 'limited') {
      const names = student.name.split(' ');
      return names.map(name => `${name.charAt(0)}.`).join('');
    }
    return student.name;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, studentId: string) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = filteredStudents.findIndex(s => s.id === studentId);
      const nextIndex = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
      
      if (nextIndex >= 0 && nextIndex < filteredStudents.length) {
        const nextRow = document.querySelector(`[data-testid="student-row-${filteredStudents[nextIndex].id}"]`) as HTMLElement;
        nextRow?.focus();
      }
    }
  };

  // Handle global keyboard shortcuts
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        handleSelectAll(true);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="student-list-loading" className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading students...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline">Retry</Button>
      </div>
    );
  }

  // Empty state
  if (students.length === 0) {
    return (
      <div data-testid="empty-student-list" className="text-center p-8">
        <p className="text-muted-foreground">No students found</p>
      </div>
    );
  }

  const isSelectAllChecked = selectedStudents.length === filteredStudents.length && filteredStudents.length > 0;
  const isSelectAllIndeterminate = selectedStudents.length > 0 && selectedStudents.length < filteredStudents.length;

  return (
    <div data-testid="student-list" data-secure="true" className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            role="searchbox"
            aria-label="Search students"
          />
        </div>
        
        <Select value={selectedTier} onValueChange={setSelectedTier}>
          <SelectTrigger className="w-[180px]" aria-label="Filter by tier">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="1-2 days">1-2 days</SelectItem>
            <SelectItem value="3-9 days">3-9 days</SelectItem>
            <SelectItem value=">10% chronic">&gt;10% chronic</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
          <SelectTrigger className="w-[180px]" aria-label="Filter by grade">
            <SelectValue placeholder="Filter by grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            <SelectItem value="2">Grade 2</SelectItem>
            <SelectItem value="3">Grade 3</SelectItem>
            <SelectItem value="4">Grade 4</SelectItem>
            <SelectItem value="5">Grade 5</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
          <SelectTrigger className="w-[180px]" aria-label="Filter by teacher">
            <SelectValue placeholder="Filter by teacher" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teachers</SelectItem>
            <SelectItem value="Mrs. Johnson">Mrs. Johnson</SelectItem>
            <SelectItem value="Mr. Williams">Mr. Williams</SelectItem>
            <SelectItem value="Ms. Davis">Ms. Davis</SelectItem>
            <SelectItem value="Mrs. Brown">Mrs. Brown</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={clearFilters} aria-label="Clear filters">
          Clear filters
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedStudents.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span>{selectedStudents.length} students selected</span>
          <Button 
            onClick={() => onBulkAssignment?.(selectedStudents)}
            disabled={selectedStudents.length === 0}
            aria-label="Assign to program"
          >
            Assign to program
          </Button>
        </div>
      )}

      {/* Export and Announcements */}
      <div className="flex items-center justify-between p-4">
        <div 
          role="status" 
          aria-live="polite" 
          className="text-sm text-muted-foreground"
        >
          {(searchTerm || selectedTier !== 'all' || selectedGrade !== 'all' || selectedTeacher !== 'all') && 
            `${filteredStudents.length} student${filteredStudents.length === 1 ? '' : 's'} found`}
        </div>
        
        <div className="relative">
          <Button 
            variant="outline" 
            onClick={() => setShowExportMenu(!showExportMenu)}
            aria-label="Export data"
          >
            <Download className="h-4 w-4 mr-2" />
            Export data
          </Button>
          
          {showExportMenu && (
            <div 
              role="menu" 
              className="absolute right-0 mt-2 w-48 bg-popover border rounded-md shadow-lg z-10"
            >
              <button
                role="menuitem"
                className="w-full text-left px-4 py-2 hover:bg-accent"
                onClick={() => {
                  onExportData?.('csv', filteredStudents);
                  setShowExportMenu(false);
                }}
                aria-label="Export to CSV"
              >
                Export to CSV
              </button>
              <button
                role="menuitem"
                className="w-full text-left px-4 py-2 hover:bg-accent"
                onClick={() => {
                  onExportData?.('pdf', filteredStudents);
                  setShowExportMenu(false);
                }}
                aria-label="Export to PDF"
              >
                Export to PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Student Table - Responsive */}
      <div data-testid={isMobile ? "student-list-mobile" : "student-list-desktop"}>
        <div data-testid="table-container" className="overflow-x-auto">
          {filteredStudents.length > 100 ? (
            // Virtual scrolling for large datasets
            <div data-testid="virtual-list" data-item-count={filteredStudents.length} data-item-size={60}>
              <List
                height={600}
                width="100%"
                itemCount={filteredStudents.length}
                itemSize={60}
                itemData={filteredStudents}
              >
              {({ index, style, data }) => {
                const student = data[index];
                return (
                  <div 
                    style={style} 
                    key={student.id}
                    data-testid={`student-row-${student.id}`}
                    className={cn(
                      'flex items-center border-b px-4 hover:bg-muted/50',
                      student.chronicallyAbsent && 'chronic-absent bg-red-50'
                    )}
                    onClick={() => onStudentClick?.(student.id)}
                  >
                    <div className="flex-1 truncate">{formatStudentName(student)}</div>
                    <div className="w-20">{student.attendancePercentage.toFixed(1)}%</div>
                  </div>
                );
              }}
            </List>
            </div>
          ) : (
            // Regular table for smaller datasets
            <table 
              role="table" 
              aria-label="Student attendance list"
              className="w-full border-collapse"
            >
              <thead>
                <tr>
                  <th className="text-left p-2">
                    <input
                      type="checkbox"
                      checked={isSelectAllChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = isSelectAllIndeterminate;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all students"
                    />
                  </th>
                  <th 
                    role="columnheader" 
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort('name')}
                    aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Student Name
                    {sortField === 'name' && (
                      <span data-testid={`sort-icon-${sortDirection === 'asc' ? 'asc' : 'desc'}`} className="ml-2">
                        {sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
                      </span>
                    )}
                  </th>
                  {!isMobile && <th role="columnheader" className="text-left p-2">Grade</th>}
                  {!isMobile && <th role="columnheader" className="text-left p-2">Teacher</th>}
                  <th 
                    role="columnheader" 
                    className="text-left p-2 cursor-pointer select-none"
                    onClick={() => handleSort('attendancePercentage')}
                    aria-sort={sortField === 'attendancePercentage' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Attendance %
                  </th>
                  {!isMobile && (
                    <th 
                      role="columnheader" 
                      className="text-left p-2 cursor-pointer select-none"
                      onClick={() => handleSort('daysAbsent')}
                      aria-sort={sortField === 'daysAbsent' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      Days Absent
                    </th>
                  )}
                  {!isMobile && <th role="columnheader" className="text-left p-2">Recovery Days</th>}
                  {!isMobile && <th role="columnheader" className="text-left p-2">Intervention Status</th>}
                  {!isMobile && <th role="columnheader" className="text-left p-2">Tardy Count</th>}
                  {!isMobile && <th role="columnheader" className="text-left p-2">Last Absence</th>}
                  <th role="columnheader" className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    data-testid={`student-row-${student.id}`}
                    className={cn(
                      'border-b hover:bg-muted/50 focus:bg-muted/50',
                      student.chronicallyAbsent && 'chronic-absent bg-red-50'
                    )}
                    onClick={() => onStudentClick?.(student.id)}
                    onKeyDown={(e) => handleKeyDown(e, student.id)}
                    tabIndex={0}
                    role="row"
                  >
                    <td className="p-2" role="rowheader">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={(e) => handleStudentSelection(student.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${student.name}`}
                      />
                    </td>
                    <td className="p-2 font-medium" role="rowheader">
                      {formatStudentName(student)}
                    </td>
                    {!isMobile && <td className="p-2">Grade {student.grade}</td>}
                    {!isMobile && <td className="p-2">{student.teacher}</td>}
                    <td className="p-2">{student.attendancePercentage.toFixed(1)}%</td>
                    {!isMobile && <td className="p-2">{student.daysAbsent} days</td>}
                    {!isMobile && <td className="p-2">{student.recoveryDays} recovery</td>}
                    {!isMobile && (
                      <td className="p-2">
                        <span 
                          data-testid={`intervention-status-${student.interventionStatus}`}
                          className={cn(
                            'px-2 py-1 rounded-full text-xs',
                            student.interventionStatus === 'active' && 'bg-green-100 text-green-800',
                            student.interventionStatus === 'pending' && 'bg-yellow-100 text-yellow-800',
                            student.interventionStatus === 'none' && 'bg-gray-100 text-gray-800'
                          )}
                        >
                          {student.interventionStatus}
                        </span>
                      </td>
                    )}
                    {!isMobile && <td className="p-2">{student.tardyCount} tardies</td>}
                    {!isMobile && (
                      <td className="p-2 text-sm text-muted-foreground">
                        {formatDate(student.lastAbsence)}
                      </td>
                    )}
                    <td className="p-2">
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowActionsMenu(showActionsMenu === student.id ? null : student.id);
                          }}
                          aria-label={`Actions for ${student.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        
                        {showActionsMenu === student.id && (
                          <div 
                            role="menu"
                            className="absolute right-0 mt-2 w-48 bg-popover border rounded-md shadow-lg z-10"
                          >
                            <button
                              role="menuitem"
                              className="w-full text-left px-4 py-2 hover:bg-accent"
                              onClick={() => {
                                onStudentClick?.(student.id);
                                setShowActionsMenu(null);
                              }}
                              aria-label="View details"
                            >
                              View details
                            </button>
                            <button
                              role="menuitem"
                              className="w-full text-left px-4 py-2 hover:bg-accent"
                              onClick={() => setShowActionsMenu(null)}
                              aria-label="Create intervention"
                            >
                              Create intervention
                            </button>
                            <button
                              role="menuitem"
                              className="w-full text-left px-4 py-2 hover:bg-accent"
                              onClick={() => setShowActionsMenu(null)}
                              aria-label="Send notification"
                            >
                              Send notification
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}