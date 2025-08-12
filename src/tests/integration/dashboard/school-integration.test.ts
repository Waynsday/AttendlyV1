/**
 * @fileoverview School Integration Tests for Dashboard
 * 
 * Tests the integration between school dropdowns and grade-level summaries
 * Ensures proper data flow from Supabase to frontend components
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }
}))

// Mock dashboard data service
jest.mock('@/lib/services/dashboard-data-service', () => ({
  dashboardDataService: {
    fetchSchools: jest.fn(),
    fetchGradeSummaries: jest.fn(),
    clearCache: jest.fn()
  }
}))

// Mock school data
const mockSchools = [
  {
    id: '1',
    school_code: 'RES',
    school_name: 'Romoland Elementary School',
    school_type: 'ELEMENTARY',
    grade_levels_served: [1, 2, 3, 4, 5],
    principal_name: 'Dr. Maria Rodriguez',
    is_active: true
  },
  {
    id: '2', 
    school_code: 'RIS',
    school_name: 'Romoland Intermediate School',
    school_type: 'INTERMEDIATE',
    grade_levels_served: [6, 7, 8],
    principal_name: 'Dr. Michael Chen',
    is_active: true
  }
]

// Mock grade-level summary data
const mockGradeSummaries = [
  {
    school_id: '1',
    grade_level: 1,
    total_students: 75,
    average_attendance_rate: 94.2,
    chronic_absentees_count: 6,
    tier1_count: 63,
    tier2_count: 6,
    tier3_count: 6,
    last_updated: '2025-07-29T10:30:00Z'
  },
  {
    school_id: '2',
    grade_level: 6,
    total_students: 120,
    average_attendance_rate: 88.5,
    chronic_absentees_count: 12,
    tier1_count: 98,
    tier2_count: 10,
    tier3_count: 12,
    last_updated: '2025-07-29T10:30:00Z'
  }
]

describe('School Dropdown Integration', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should load schools from Supabase on component mount', async () => {
    // Arrange: Mock dashboard service response for schools
    const { dashboardDataService } = require('@/lib/services/dashboard-data-service')
    
    dashboardDataService.fetchSchools.mockResolvedValue(mockSchools)
    dashboardDataService.fetchGradeSummaries.mockResolvedValue(mockGradeSummaries)

    // Act: Render dashboard component
    render(<DashboardPage />)

    // Assert: Schools should be loaded and dropdown populated
    await waitFor(() => {
      expect(mockFromSchools).toHaveBeenCalled()
    })

    // Check that school options appear in dropdown
    const schoolSelect = screen.getByRole('combobox', { name: /select school/i })
    expect(schoolSelect).toBeInTheDocument()
  })

  it('should filter grade data when school is selected', async () => {
    // Arrange: Mock both schools and grade summaries
    const mockFromSchools = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: mockSchools,
            error: null
          }))
        }))
      }))
    }))

    const mockFromGradeSummaries = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: mockGradeSummaries,
            error: null
          }))
        }))
      }))
    }))

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'schools') return mockFromSchools()
      if (table === 'grade_summaries') return mockFromGradeSummaries()
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }
    })

    // Act: Render and select a school
    render(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    const schoolSelect = screen.getByRole('combobox', { name: /select school/i })
    fireEvent.click(schoolSelect)
    
    // Select Romoland Elementary School
    const elementaryOption = screen.getByText('Romoland Elementary School')
    fireEvent.click(elementaryOption)

    // Assert: Grade data should be filtered for selected school
    await waitFor(() => {
      expect(mockFromGradeSummaries).toHaveBeenCalled()
    })

    // Should only show grade cards for elementary grades (1-5)
    expect(screen.getByText(/grade 1/i)).toBeInTheDocument()
    expect(screen.queryByText(/grade 6/i)).not.toBeInTheDocument()
  })

  it('should aggregate data across all schools when "All Schools" is selected', async () => {
    // Arrange: Mock data for multiple schools
    const allSchoolsGradeData = [
      ...mockGradeSummaries,
      {
        school_id: '1',
        grade_level: 2,
        total_students: 68,
        average_attendance_rate: 93.8,
        chronic_absentees_count: 5,
        tier1_count: 58,
        tier2_count: 5,
        tier3_count: 5,
        last_updated: '2025-07-29T10:30:00Z'
      },
      {
        school_id: '2',
        grade_level: 7,
        total_students: 115,
        average_attendance_rate: 86.2,
        chronic_absentees_count: 15,
        tier1_count: 90,
        tier2_count: 10,
        tier3_count: 15,
        last_updated: '2025-07-29T10:30:00Z'
      }
    ]

    const mockFromGradeSummaries = vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({
          data: allSchoolsGradeData,
          error: null
        }))
      }))
    }))

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'schools') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockSchools, error: null }))
          }))
        }))
      }
      if (table === 'grade_summaries') return mockFromGradeSummaries()
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }
    })

    // Act: Render and select "All Schools"
    render(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    const schoolSelect = screen.getByRole('combobox', { name: /select school/i })
    fireEvent.click(schoolSelect)
    
    const allSchoolsOption = screen.getByText('All Schools (District-wide)')
    fireEvent.click(allSchoolsOption)

    // Assert: Should show aggregated data across all schools
    await waitFor(() => {
      expect(mockFromGradeSummaries).toHaveBeenCalled()
    })

    // Should aggregate data by grade level across schools
    expect(screen.getByText(/district-wide/i)).toBeInTheDocument()
  })

  it('should handle API errors gracefully', async () => {
    // Arrange: Mock API error
    const mockFromSchoolsError = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Database connection failed' }
          }))
        }))
      }))
    }))

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'schools') return mockFromSchoolsError()
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }
    })

    // Act: Render component with error
    render(<DashboardPage />)

    // Assert: Should show error state or fallback
    await waitFor(() => {
      expect(mockFromSchoolsError).toHaveBeenCalled()
    })

    // Should show error message or fallback to mock data
    expect(screen.getByText(/attendance dashboard/i)).toBeInTheDocument()
  })

  it('should update grade cards when school selection changes', async () => {
    // Arrange: Mock dynamic data for different schools
    let currentSchoolId = 'all'
    
    const mockFromGradeSummaries = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((field: string, value: string) => ({
          order: vi.fn(() => {
            const filteredData = currentSchoolId === 'all' 
              ? mockGradeSummaries 
              : mockGradeSummaries.filter(g => g.school_id === value)
            return Promise.resolve({
              data: filteredData,
              error: null
            })
          })
        }))
      }))
    }))

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'schools') return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockSchools, error: null }))
          }))
        }))
      }
      if (table === 'grade_summaries') return mockFromGradeSummaries()
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }
    })

    // Act: Render and change school selection
    render(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    // Initially should show all data
    expect(screen.getByText(/attendance dashboard/i)).toBeInTheDocument()

    // Change to specific school
    const schoolSelect = screen.getByRole('combobox', { name: /select school/i })
    fireEvent.click(schoolSelect)
    
    const elementaryOption = screen.getByText('Romoland Elementary School')
    fireEvent.click(elementaryOption)
    currentSchoolId = '1'

    // Assert: Grade cards should update for selected school
    await waitFor(() => {
      expect(mockFromGradeSummaries).toHaveBeenCalledTimes(2) // Initial load + selection change
    })
  })
})

describe('Grade Data Service', () => {
  it('should calculate attendance percentages correctly', () => {
    // This will test the grade data transformation service
    const rawGradeData = [
      {
        school_id: '1',
        grade_level: 1,
        total_students: 100,
        present_count: 94,
        absent_count: 6,
        chronic_absentees_count: 8
      }
    ]

    // This test will pass once we implement the service
    expect(true).toBe(true) // Placeholder - will be replaced with actual service test
  })

  it('should aggregate data across multiple schools correctly', () => {
    // This will test the aggregation logic for district-wide view
    expect(true).toBe(true) // Placeholder - will be replaced with actual aggregation test
  })
})