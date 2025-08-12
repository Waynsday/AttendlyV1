/**
 * @file useStudentList.test.ts
 * @description Comprehensive tests for useStudentList hook
 * Tests pagination, filtering by tier/grade, sorting, and performance with large datasets
 * Tests are designed to FAIL initially to enable TDD implementation
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { server } from '../../../tests/mocks/server';
import { rest } from 'msw';
import { useStudentList } from '../useStudentList';

// Mock student data based on CSV structure from References/
const mockStudent = {
  id: 'STU001',
  firstName: 'John',
  lastName: 'Doe',
  grade: 'K',
  teacherName: 'Ms. Smith',
  attendanceRate: 94.5,
  totalAbsences: 8,
  chronicAbsences: 2,
  tier: 1 as const, // Tier 1: 1-2 days absent
  lastAttendanceDate: '2025-01-15',
  interventions: [],
  iReadyScores: {
    currentYear: { ela: 485, math: 492 },
    previousYear: { ela: 456, math: 467 },
    twoYearsAgo: { ela: null, math: null }
  }
};

const mockStudentList = Array.from({ length: 50 }, (_, i) => ({
  ...mockStudent,
  id: `STU${String(i + 1).padStart(3, '0')}`,
  firstName: `Student${i + 1}`,
  lastName: `Test${i + 1}`,
  grade: ['K', '1', '2', '3', '4', '5'][i % 6],
  attendanceRate: 90 + Math.random() * 10,
  totalAbsences: Math.floor(Math.random() * 20),
  tier: (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3
}));

const mockApiResponse = {
  data: mockStudentList,
  pagination: {
    page: 1,
    limit: 25,
    total: 1250,
    totalPages: 50
  },
  filters: {
    grade: null,
    tier: null,
    teacherName: null,
    search: null
  }
};

describe('useStudentList', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('Basic data fetching', () => {
    it('should fetch student list with default pagination on mount', async () => {
      // This test will FAIL initially - no hook implementation exists
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          return res(ctx.json(mockApiResponse));
        })
      );

      const { result } = renderHook(() => useStudentList());

      // Initial state assertions - will fail without implementation
      expect(result.current.isLoading).toBe(true);
      expect(result.current.students).toEqual([]);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.students).toHaveLength(25);
      expect(result.current.pagination).toEqual(mockApiResponse.pagination);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty student list gracefully', async () => {
      // This test will FAIL - requires empty state handling
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          return res(ctx.json({
            data: [],
            pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
            filters: mockApiResponse.filters
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.students).toEqual([]);
      expect(result.current.isEmpty).toBe(true);
      expect(result.current.pagination.total).toBe(0);
    });
  });

  describe('Pagination functionality', () => {
    it('should handle page navigation correctly', async () => {
      // This test will FAIL - requires pagination implementation
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const page = parseInt(req.url.searchParams.get('page') || '1');
          const limit = parseInt(req.url.searchParams.get('limit') || '25');
          
          const startIndex = (page - 1) * limit;
          const endIndex = startIndex + limit;
          const paginatedData = mockStudentList.slice(startIndex, endIndex);

          return res(ctx.json({
            data: paginatedData,
            pagination: {
              page,
              limit,
              total: mockStudentList.length,
              totalPages: Math.ceil(mockStudentList.length / limit)
            },
            filters: mockApiResponse.filters
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Navigate to page 2
      act(() => {
        result.current.goToPage(2);
      });

      await waitFor(() => {
        expect(result.current.pagination.page).toBe(2);
      });

      expect(result.current.students).toHaveLength(25);
      expect(result.current.students[0].id).toBe('STU026'); // Second page starts at index 25
    });

    it('should change page size dynamically', async () => {
      // This test will FAIL - requires page size change implementation
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const limit = parseInt(req.url.searchParams.get('limit') || '25');
          return res(ctx.json({
            ...mockApiResponse,
            data: mockStudentList.slice(0, limit),
            pagination: { ...mockApiResponse.pagination, limit }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change page size to 50
      act(() => {
        result.current.changePageSize(50);
      });

      await waitFor(() => {
        expect(result.current.pagination.limit).toBe(50);
      });

      expect(result.current.students).toHaveLength(50);
    });
  });

  describe('Filtering functionality', () => {
    it('should filter students by grade', async () => {
      // This test will FAIL - requires grade filtering implementation
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const grade = req.url.searchParams.get('grade');
          const filteredData = grade 
            ? mockStudentList.filter(s => s.grade === grade)
            : mockStudentList;

          return res(ctx.json({
            data: filteredData.slice(0, 25),
            pagination: {
              ...mockApiResponse.pagination,
              total: filteredData.length,
              totalPages: Math.ceil(filteredData.length / 25)
            },
            filters: { ...mockApiResponse.filters, grade }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Apply grade filter
      act(() => {
        result.current.applyFilter({ grade: 'K' });
      });

      await waitFor(() => {
        expect(result.current.filters.grade).toBe('K');
      });

      // All students should be in grade K
      result.current.students.forEach(student => {
        expect(student.grade).toBe('K');
      });
    });

    it('should filter students by attendance tier', async () => {
      // This test will FAIL - requires tier filtering implementation
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const tier = req.url.searchParams.get('tier');
          const filteredData = tier 
            ? mockStudentList.filter(s => s.tier === parseInt(tier))
            : mockStudentList;

          return res(ctx.json({
            data: filteredData.slice(0, 25),
            pagination: {
              ...mockApiResponse.pagination,
              total: filteredData.length
            },
            filters: { ...mockApiResponse.filters, tier: tier ? parseInt(tier) : null }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Apply tier 3 filter (chronic absentees)
      act(() => {
        result.current.applyFilter({ tier: 3 });
      });

      await waitFor(() => {
        expect(result.current.filters.tier).toBe(3);
      });

      result.current.students.forEach(student => {
        expect(student.tier).toBe(3);
      });
    });

    it('should support search by student name', async () => {
      // This test will FAIL - requires search implementation
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const search = req.url.searchParams.get('search');
          const filteredData = search 
            ? mockStudentList.filter(s => 
                s.firstName.toLowerCase().includes(search.toLowerCase()) ||
                s.lastName.toLowerCase().includes(search.toLowerCase())
              )
            : mockStudentList;

          return res(ctx.json({
            data: filteredData.slice(0, 25),
            pagination: {
              ...mockApiResponse.pagination,
              total: filteredData.length
            },
            filters: { ...mockApiResponse.filters, search }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Search for "Student1"
      act(() => {
        result.current.applyFilter({ search: 'Student1' });
      });

      await waitFor(() => {
        expect(result.current.filters.search).toBe('Student1');
      });

      result.current.students.forEach(student => {
        expect(
          student.firstName.toLowerCase().includes('student1') ||
          student.lastName.toLowerCase().includes('student1')
        ).toBe(true);
      });
    });

    it('should combine multiple filters correctly', async () => {
      // This test will FAIL - requires multiple filter combination
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const grade = req.url.searchParams.get('grade');
          const tier = req.url.searchParams.get('tier');
          
          let filteredData = mockStudentList;
          if (grade) filteredData = filteredData.filter(s => s.grade === grade);
          if (tier) filteredData = filteredData.filter(s => s.tier === parseInt(tier));

          return res(ctx.json({
            data: filteredData.slice(0, 25),
            pagination: {
              ...mockApiResponse.pagination,
              total: filteredData.length
            },
            filters: { 
              ...mockApiResponse.filters, 
              grade, 
              tier: tier ? parseInt(tier) : null 
            }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Apply both grade and tier filters
      act(() => {
        result.current.applyFilter({ grade: 'K', tier: 2 });
      });

      await waitFor(() => {
        expect(result.current.filters.grade).toBe('K');
        expect(result.current.filters.tier).toBe(2);
      });

      result.current.students.forEach(student => {
        expect(student.grade).toBe('K');
        expect(student.tier).toBe(2);
      });
    });
  });

  describe('Sorting functionality', () => {
    it('should sort students by name (alphabetical)', async () => {
      // This test will FAIL - requires sorting implementation
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const sortBy = req.url.searchParams.get('sortBy');
          const sortOrder = req.url.searchParams.get('sortOrder') || 'asc';
          
          let sortedData = [...mockStudentList];
          if (sortBy === 'name') {
            sortedData.sort((a, b) => {
              const nameA = `${a.lastName}, ${a.firstName}`;
              const nameB = `${b.lastName}, ${b.firstName}`;
              return sortOrder === 'asc' 
                ? nameA.localeCompare(nameB)
                : nameB.localeCompare(nameA);
            });
          }

          return res(ctx.json({
            data: sortedData.slice(0, 25),
            pagination: mockApiResponse.pagination,
            filters: mockApiResponse.filters,
            sort: { field: sortBy, order: sortOrder }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Apply name sorting
      act(() => {
        result.current.setSorting({ field: 'name', order: 'asc' });
      });

      await waitFor(() => {
        expect(result.current.sort?.field).toBe('name');
        expect(result.current.sort?.order).toBe('asc');
      });

      // Verify sorting order
      const names = result.current.students.map(s => `${s.lastName}, ${s.firstName}`);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should sort students by attendance rate', async () => {
      // This test will FAIL - requires attendance rate sorting
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const sortBy = req.url.searchParams.get('sortBy');
          const sortOrder = req.url.searchParams.get('sortOrder') || 'desc';
          
          let sortedData = [...mockStudentList];
          if (sortBy === 'attendanceRate') {
            sortedData.sort((a, b) => {
              return sortOrder === 'desc' 
                ? b.attendanceRate - a.attendanceRate
                : a.attendanceRate - b.attendanceRate;
            });
          }

          return res(ctx.json({
            data: sortedData.slice(0, 25),
            pagination: mockApiResponse.pagination,
            filters: mockApiResponse.filters,
            sort: { field: sortBy, order: sortOrder }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Sort by attendance rate (highest first)
      act(() => {
        result.current.setSorting({ field: 'attendanceRate', order: 'desc' });
      });

      await waitFor(() => {
        expect(result.current.sort?.field).toBe('attendanceRate');
      });

      // Verify descending order
      const rates = result.current.students.map(s => s.attendanceRate);
      for (let i = 1; i < rates.length; i++) {
        expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
      }
    });
  });

  describe('Performance with large datasets', () => {
    it('should handle 1000+ students efficiently with virtualization', async () => {
      // This test will FAIL - requires virtualization implementation
      const largeStudentList = Array.from({ length: 1500 }, (_, i) => ({
        ...mockStudent,
        id: `STU${String(i + 1).padStart(4, '0')}`,
        firstName: `Student${i + 1}`,
        lastName: `Test${Math.floor(i / 50) + 1}`, // Group by 50s for realistic distribution
        grade: ['K', '1', '2', '3', '4', '5'][i % 6],
        attendanceRate: 85 + Math.random() * 15,
        tier: (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3
      }));

      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const page = parseInt(req.url.searchParams.get('page') || '1');
          const limit = parseInt(req.url.searchParams.get('limit') || '100');
          
          // Simulate network delay for large dataset
          return res(
            ctx.delay(50),
            ctx.json({
              data: largeStudentList.slice((page - 1) * limit, page * limit),
              pagination: {
                page,
                limit,
                total: largeStudentList.length,
                totalPages: Math.ceil(largeStudentList.length / limit)
              },
              filters: mockApiResponse.filters
            })
          );
        })
      );

      const startTime = performance.now();
      const { result } = renderHook(() => 
        useStudentList({ initialPageSize: 100, enableVirtualization: true })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Should load efficiently (under 200ms)
      expect(loadTime).toBeLessThan(200);
      expect(result.current.students).toHaveLength(100);
      expect(result.current.pagination.total).toBe(1500);
      expect(result.current.isVirtualized).toBe(true);
    });

    it('should debounce search queries to avoid excessive API calls', async () => {
      // This test will FAIL - requires search debouncing
      let requestCount = 0;
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          requestCount++;
          const search = req.url.searchParams.get('search');
          return res(
            ctx.delay(10),
            ctx.json({
              ...mockApiResponse,
              filters: { ...mockApiResponse.filters, search }
            })
          );
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialRequests = requestCount;

      // Rapidly type search query
      act(() => {
        result.current.applyFilter({ search: 'J' });
      });
      act(() => {
        result.current.applyFilter({ search: 'Jo' });
      });
      act(() => {
        result.current.applyFilter({ search: 'Joh' });
      });
      act(() => {
        result.current.applyFilter({ search: 'John' });
      });

      // Wait for debounce delay
      await waitFor(() => {
        expect(result.current.filters.search).toBe('John');
      }, { timeout: 1000 });

      // Should only make one additional request due to debouncing
      expect(requestCount).toBe(initialRequests + 1);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle API errors gracefully', async () => {
      // This test will FAIL - requires error handling
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Database connection failed' }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error.message).toContain('Failed to load students');
      expect(result.current.students).toEqual([]);
    });

    it('should handle malformed student data', async () => {
      // This test will FAIL - requires data validation
      const malformedData = [
        { id: 'STU001', firstName: null, lastName: 'Doe' }, // Missing firstName
        { id: 'STU002', firstName: 'Jane', grade: 'Invalid' }, // Invalid grade
        { id: null, firstName: 'Bob', lastName: 'Smith' }, // Missing ID
        { firstName: 'Alice', lastName: 'Johnson', attendanceRate: 'not-a-number' } // Invalid attendance rate
      ];

      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          return res(ctx.json({
            data: malformedData,
            pagination: mockApiResponse.pagination,
            filters: mockApiResponse.filters
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should filter out or fix malformed data
      result.current.students.forEach(student => {
        expect(student.id).toBeTruthy();
        expect(student.firstName).toBeTruthy();
        expect(student.lastName).toBeTruthy();
        expect(['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']).toContain(student.grade);
        expect(typeof student.attendanceRate).toBe('number');
      });
    });

    it('should maintain filter state during refresh', async () => {
      // This test will FAIL - requires state persistence
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const grade = req.url.searchParams.get('grade');
          const tier = req.url.searchParams.get('tier');
          
          return res(ctx.json({
            ...mockApiResponse,
            filters: { ...mockApiResponse.filters, grade, tier: tier ? parseInt(tier) : null }
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Apply filters
      act(() => {
        result.current.applyFilter({ grade: 'K', tier: 2 });
      });

      await waitFor(() => {
        expect(result.current.filters.grade).toBe('K');
        expect(result.current.filters.tier).toBe(2);
      });

      // Simulate refresh
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Filters should be maintained
      expect(result.current.filters.grade).toBe('K');
      expect(result.current.filters.tier).toBe(2);
    });
  });

  describe('FERPA compliance and access control', () => {
    it('should respect teacher-level access restrictions', async () => {
      // This test will FAIL - requires access control implementation
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          const authHeader = req.headers.get('Authorization');
          if (!authHeader?.includes('teacher-token')) {
            return res(ctx.status(403), ctx.json({ error: 'Insufficient permissions' }));
          }

          // Mock teacher can only see their own students
          const teacherStudents = mockStudentList.filter(s => s.teacherName === 'Ms. Smith');
          return res(ctx.json({
            data: teacherStudents,
            pagination: {
              ...mockApiResponse.pagination,
              total: teacherStudents.length
            },
            filters: mockApiResponse.filters
          }));
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // All returned students should belong to the authenticated teacher
      result.current.students.forEach(student => {
        expect(student.teacherName).toBe('Ms. Smith');
      });
    });

    it('should not expose sensitive information in error messages', async () => {
      // This test will FAIL - requires error sanitization
      server.use(
        rest.get('/api/students', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({ 
              error: 'Query failed: SELECT * FROM students WHERE ssn = "123-45-6789"',
              details: 'Database error with sensitive student data'
            })
          );
        })
      );

      const { result } = renderHook(() => useStudentList());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error.message).not.toContain('123-45-6789');
      expect(result.current.error.message).not.toContain('SELECT');
      expect(result.current.error.message).not.toContain('ssn');
      expect(result.current.error.message).toBe('Failed to load students');
    });
  });
});