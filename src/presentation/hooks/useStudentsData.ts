/**
 * @fileoverview Custom hook for managing student data with pagination and filtering
 */

import { useState, useEffect, useCallback } from 'react';

export interface StudentData {
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
  tardies: number;
  lastIntervention?: string;
  interventionDate?: string;
  interventionDescription?: string;
  school?: string;  
  schoolName?: string;
  // iReady scores
  ireadyElaScore?: number;
  ireadyElaPlacement?: string;
  ireadyElaDate?: string;
  ireadyMathScore?: number;
  ireadyMathPlacement?: string;
  ireadyMathDate?: string;
}

export interface StudentsFilters {
  schoolId?: string;
  grade?: string;
  tier?: string;
  schoolYear?: string;
  search?: string;
  sortColumn?: string;
  sortDirection?: string;
}

export interface StudentsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StudentsApiResponse {
  data: StudentData[];
  pagination: StudentsPagination;
  metadata: {
    schoolYear: string;
    dateRange: {
      start: string;
      end: string;
    };
    filters: StudentsFilters;
  };
}

export interface UseStudentsDataState {
  students: StudentData[];
  pagination: StudentsPagination;
  isLoading: boolean;
  error: string | null;
  filters: StudentsFilters;
  currentPage: number;
  pageSize: number;
}

export interface UseStudentsDataActions {
  setFilters: (filters: StudentsFilters) => void;
  setPageSize: (size: number) => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refreshData: () => void;
  clearError: () => void;
  setSorting: (column: string, direction: string) => void;
}

export type UseStudentsDataReturn = UseStudentsDataState & UseStudentsDataActions;

const initialPagination: StudentsPagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
};

export function useStudentsData(
  initialFilters: StudentsFilters = {},
  initialPageSize: number = 20
): UseStudentsDataReturn {
  const [state, setState] = useState<UseStudentsDataState>({
    students: [],
    pagination: { ...initialPagination, limit: initialPageSize },
    isLoading: false,
    error: null,
    filters: initialFilters,
    currentPage: 1,
    pageSize: initialPageSize
  });

  const fetchStudents = useCallback(async (
    filters: StudentsFilters,
    page: number,
    limit: number
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.schoolId && filters.schoolId !== 'all' && { schoolId: filters.schoolId }),
        ...(filters.grade && filters.grade !== 'all' && { grade: filters.grade }),
        ...(filters.tier && filters.tier !== 'all' && { tier: filters.tier }),
        ...(filters.schoolYear && { schoolYear: filters.schoolYear }),
        ...(filters.search && filters.search.trim() && { search: filters.search.trim() }),
        ...(filters.sortColumn && { sortColumn: filters.sortColumn }),
        ...(filters.sortDirection && { sortDirection: filters.sortDirection })
      });

      // Use the fast endpoint with Supabase views
      // Add cache busting to ensure fresh data
      params.set('_t', Date.now().toString());
      const response = await fetch(`/api/students-fast?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: StudentsApiResponse = await response.json();

      // Debug logging to check intervention data in frontend
      if (data.data && data.data.length > 0) {
        const studentsWithInterventions = data.data.filter((s: any) => s.lastIntervention);
        console.log('🔍 FRONTEND DEBUG: Received intervention data:', {
          totalStudents: data.data.length,
          studentsWithInterventions: studentsWithInterventions.length,
          sampleStudent: {
            name: data.data[0].name,
            tardies: data.data[0].tardies,
            attendanceRate: data.data[0].attendanceRate,
            lastIntervention: data.data[0].lastIntervention,
            interventionDate: data.data[0].interventionDate
          }
        });

        // Check specifically for student 1012350
        const student1012350 = data.data.find((s: any) => s.studentId === '1012350');
        if (student1012350) {
          console.log('🎯 FRONTEND: Student 1012350 received:', {
            name: student1012350.name,
            studentId: student1012350.studentId,
            lastIntervention: student1012350.lastIntervention,
            interventionDate: student1012350.interventionDate,
            interventionDescription: student1012350.interventionDescription
          });
        }

        if (studentsWithInterventions.length > 0) {
          console.log('📋 FRONTEND: Sample students with interventions:');
          studentsWithInterventions.slice(0, 3).forEach((student: any) => {
            console.log(`  - ${student.name}: ${student.lastIntervention} on ${student.interventionDate}`);
          });
        }
      }

      setState(prev => ({
        ...prev,
        students: data.data,
        pagination: data.pagination,
        isLoading: false,
        error: null
      }));

    } catch (error) {
      console.error('Error fetching students:', error);
      setState(prev => ({
        ...prev,
        students: [],
        pagination: initialPagination,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch students'
      }));
    }
  }, []);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchStudents(state.filters, state.currentPage, state.pageSize);
  }, [fetchStudents, state.filters, state.currentPage, state.pageSize]);

  const setFilters = useCallback((filters: StudentsFilters) => {
    setState(prev => ({
      ...prev,
      filters,
      currentPage: 1 // Reset to first page when filters change
    }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setState(prev => ({
      ...prev,
      pageSize: size,
      currentPage: 1, // Reset to first page when page size changes
      pagination: { ...prev.pagination, limit: size }
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.pagination.totalPages))
    }));
  }, []);

  const nextPage = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.pagination.totalPages)
    }));
  }, []);

  const prevPage = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1)
    }));
  }, []);

  const refreshData = useCallback(() => {
    fetchStudents(state.filters, state.currentPage, state.pageSize);
  }, [fetchStudents, state.filters, state.currentPage, state.pageSize]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setSorting = useCallback((column: string, direction: string) => {
    setFilters({ 
      ...state.filters, 
      sortColumn: column, 
      sortDirection: direction 
    });
  }, [state.filters, setFilters]);

  return {
    students: state.students,
    pagination: state.pagination,
    isLoading: state.isLoading,
    error: state.error,
    filters: state.filters,
    currentPage: state.currentPage,
    pageSize: state.pageSize,
    setFilters,
    setPageSize,
    goToPage,
    nextPage,
    prevPage,
    refreshData,
    clearError,
    setSorting
  };
}