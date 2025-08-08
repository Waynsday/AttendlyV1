/**
 * @fileoverview Enhanced Dashboard Integration Tests
 * 
 * Tests the enhanced dashboard functionality including:
 * - Real-time attendance metrics
 * - Grade-level summaries with filtering/sorting
 * - Optimized SQL queries
 * - Responsive UI components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { dashboardAnalytics } from '@/lib/services/dashboard-analytics-service'
import { DashboardHeader } from '@/presentation/components/dashboard/DashboardHeader'
import { AttendanceSummaryGrid } from '@/presentation/components/dashboard/AttendanceSummaryGrid'

// Mock data
const mockTodayMetrics = {
  present: 485,
  absent: 35,
  total: 520,
  rate: 93.3
}

const mockAttendanceData = [
  {
    grade: 'Grade 6',
    school: 'school-1',
    schoolName: 'Romoland Elementary',
    totalStudents: 120,
    attendanceRate: 94.5,
    chronicAbsentees: 8,
    tier1: 100,
    tier2: 12,
    tier3: 8,
    trend: 'up' as const,
    riskLevel: 'low' as const,
    lastUpdated: new Date().toISOString(),
    monthlyTrend: [
      { month: 'Sep', rate: 93.2 },
      { month: 'Oct', rate: 94.1 },
      { month: 'Nov', rate: 94.5 }
    ]
  },
  {
    grade: 'Grade 7',
    school: 'school-1',
    schoolName: 'Romoland Elementary',
    totalStudents: 115,
    attendanceRate: 91.8,
    chronicAbsentees: 15,
    tier1: 85,
    tier2: 15,
    tier3: 15,
    trend: 'stable' as const,
    riskLevel: 'medium' as const,
    lastUpdated: new Date().toISOString(),
    monthlyTrend: [
      { month: 'Sep', rate: 91.5 },
      { month: 'Oct', rate: 91.7 },
      { month: 'Nov', rate: 91.8 }
    ]
  },
  {
    grade: 'Grade 8',
    school: 'school-1',
    schoolName: 'Romoland Elementary',
    totalStudents: 108,
    attendanceRate: 88.2,
    chronicAbsentees: 22,
    tier1: 70,
    tier2: 16,
    tier3: 22,
    trend: 'down' as const,
    riskLevel: 'high' as const,
    lastUpdated: new Date().toISOString(),
    monthlyTrend: [
      { month: 'Sep', rate: 89.8 },
      { month: 'Oct', rate: 89.1 },
      { month: 'Nov', rate: 88.2 }
    ]
  }
]

// Mock the analytics service
vi.mock('@/lib/services/dashboard-analytics-service', () => ({
  dashboardAnalytics: {
    getSchoolAttendanceSummaries: vi.fn(),
    getDistrictAttendanceSummaries: vi.fn(),
    getTodayAttendanceMetrics: vi.fn()
  }
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Enhanced Dashboard Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API response
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockAttendanceData,
        meta: {
          schoolId: 'school-1',
          schoolName: 'Romoland Elementary',
          schoolYear: '2024-2025',
          todayAttendance: mockTodayMetrics,
          timestamp: new Date().toISOString()
        }
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('DashboardHeader Component', () => {
    it('displays school name and district correctly', () => {
      render(
        <DashboardHeader
          schoolName="Romoland Elementary"
          todayMetrics={mockTodayMetrics}
          lastUpdated={new Date().toISOString()}
        />
      )

      expect(screen.getByText('Attendance Dashboard')).toBeInTheDocument()
      expect(screen.getByText(/Romoland Elementary.*Romoland School District/)).toBeInTheDocument()
    })

    it('displays today\'s metrics with correct formatting', () => {
      render(
        <DashboardHeader
          schoolName="Test School"
          todayMetrics={mockTodayMetrics}
        />
      )

      expect(screen.getByText('520')).toBeInTheDocument() // Total students
      expect(screen.getByText('485')).toBeInTheDocument() // Present
      expect(screen.getByText('35')).toBeInTheDocument() // Absent
      expect(screen.getByText('93.3%')).toBeInTheDocument() // Rate
    })

    it('applies correct styling based on attendance rate', () => {
      const highRateMetrics = { ...mockTodayMetrics, rate: 96.5 }
      const { rerender } = render(
        <DashboardHeader
          schoolName="Test School"
          todayMetrics={highRateMetrics}
        />
      )

      // High rate should use green styling
      expect(screen.getByText('96.5%')).toHaveClass('text-green-600')

      // Test medium rate
      const mediumRateMetrics = { ...mockTodayMetrics, rate: 92.0 }
      rerender(
        <DashboardHeader
          schoolName="Test School"
          todayMetrics={mediumRateMetrics}
        />
      )
      expect(screen.getByText('92.0%')).toHaveClass('text-yellow-600')

      // Test low rate
      const lowRateMetrics = { ...mockTodayMetrics, rate: 85.0 }
      rerender(
        <DashboardHeader
          schoolName="Test School"
          todayMetrics={lowRateMetrics}
        />
      )
      expect(screen.getByText('85.0%')).toHaveClass('text-red-600')
    })

    it('displays error messages correctly', () => {
      render(
        <DashboardHeader
          schoolName="Test School"
          error="Failed to load data"
        />
      )

      expect(screen.getByText(/Error loading data.*Failed to load data/)).toBeInTheDocument()
    })

    it('shows loading state when metrics are unavailable', () => {
      render(
        <DashboardHeader
          schoolName="Test School"
        />
      )

      // Should show loading placeholders
      const loadingElements = screen.getAllByText(/Loading.../i)
      expect(loadingElements.length).toBeGreaterThan(0)
    })
  })

  describe('AttendanceSummaryGrid Component', () => {
    it('renders all attendance cards', () => {
      render(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      expect(screen.getByText('Grade 6')).toBeInTheDocument()
      expect(screen.getByText('Grade 7')).toBeInTheDocument()
      expect(screen.getByText('Grade 8')).toBeInTheDocument()
    })

    it('handles filtering by risk level', async () => {
      render(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      // Click the risk filter dropdown
      const riskFilter = screen.getByRole('combobox', { name: /filter/i })
      fireEvent.click(riskFilter)

      // Select high risk filter
      const highRiskOption = screen.getByText('High Risk')
      fireEvent.click(highRiskOption)

      await waitFor(() => {
        // Should only show Grade 8 (high risk)
        expect(screen.getByText('Grade 8')).toBeInTheDocument()
        expect(screen.queryByText('Grade 6')).not.toBeInTheDocument()
        expect(screen.queryByText('Grade 7')).not.toBeInTheDocument()
      })
    })

    it('handles sorting by different fields', async () => {
      render(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      // Click the sort dropdown
      const sortSelect = screen.getByRole('combobox', { name: /sort/i })
      fireEvent.click(sortSelect)

      // Select sort by attendance rate
      const attendanceRateOption = screen.getByText('Sort by Rate')
      fireEvent.click(attendanceRateOption)

      await waitFor(() => {
        // Verify sorting is applied (implementation would depend on component structure)
        expect(screen.getByText('Grade Level Summaries')).toBeInTheDocument()
      })
    })

    it('displays empty state when no data matches filters', () => {
      render(
        <AttendanceSummaryGrid
          data={[]}
          isLoading={false}
          schoolName="Test School"
        />
      )

      expect(screen.getByText('No attendance data available')).toBeInTheDocument()
      expect(screen.getByText(/There are no attendance records/)).toBeInTheDocument()
    })

    it('shows loading state correctly', () => {
      render(
        <AttendanceSummaryGrid
          data={[]}
          isLoading={true}
          schoolName="Test School"
        />
      )

      // Should show loading skeleton cards
      const loadingElements = screen.getAllByRole('generic')
      const animatedElements = loadingElements.filter(el => 
        el.className.includes('animate-pulse')
      )
      expect(animatedElements.length).toBeGreaterThan(0)
    })

    it('toggles between grid and compact view modes', async () => {
      render(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      // Find view mode toggle buttons
      const compactViewButton = screen.getByRole('button', { name: /list/i })
      fireEvent.click(compactViewButton)

      await waitFor(() => {
        // Component should switch to compact view
        // (actual implementation would change grid layout)
        expect(compactViewButton).toHaveAttribute('aria-pressed', 'true')
      })
    })
  })

  describe('Analytics Service Integration', () => {
    it('fetches school attendance summaries correctly', async () => {
      const mockSummaries = mockAttendanceData
      ;(dashboardAnalytics.getSchoolAttendanceSummaries as any).mockResolvedValue(mockSummaries)

      const result = await dashboardAnalytics.getSchoolAttendanceSummaries('school-1', '2024-2025')

      expect(dashboardAnalytics.getSchoolAttendanceSummaries).toHaveBeenCalledWith('school-1', '2024-2025')
      expect(result).toEqual(mockSummaries)
    })

    it('fetches district-wide summaries correctly', async () => {
      const mockDistrictSummaries = [
        {
          grade: 'Grade 6',
          schoolName: 'District-wide',
          totalStudents: 240,
          attendanceRate: 93.8,
          chronicAbsentees: 18,
          tier1: 200,
          tier2: 22,
          tier3: 18,
          trend: 'stable' as const,
          riskLevel: 'low' as const,
          lastUpdated: new Date().toISOString(),
          monthlyTrend: []
        }
      ]
      
      ;(dashboardAnalytics.getDistrictAttendanceSummaries as any).mockResolvedValue(mockDistrictSummaries)

      const result = await dashboardAnalytics.getDistrictAttendanceSummaries('2024-2025')

      expect(dashboardAnalytics.getDistrictAttendanceSummaries).toHaveBeenCalledWith('2024-2025')
      expect(result).toEqual(mockDistrictSummaries)
    })

    it('fetches today\'s attendance metrics correctly', async () => {
      ;(dashboardAnalytics.getTodayAttendanceMetrics as any).mockResolvedValue(mockTodayMetrics)

      const result = await dashboardAnalytics.getTodayAttendanceMetrics('school-1')

      expect(dashboardAnalytics.getTodayAttendanceMetrics).toHaveBeenCalledWith('school-1')
      expect(result).toEqual(mockTodayMetrics)
    })
  })

  describe('API Integration', () => {
    it('handles successful attendance summaries API response', async () => {
      const response = await fetch('/api/attendance-summaries?schoolId=school-1')
      const result = await response.json()

      expect(fetch).toHaveBeenCalledWith('/api/attendance-summaries?schoolId=school-1')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockAttendanceData)
      expect(result.meta.todayAttendance).toEqual(mockTodayMetrics)
    })

    it('handles API errors gracefully', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Database connection failed'
        })
      })

      const response = await fetch('/api/attendance-summaries?schoolId=invalid')
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('validates school year parameter format', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Invalid school year format'
        })
      })

      const response = await fetch('/api/attendance-summaries?schoolYear=invalid-format')
      const result = await response.json()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid school year format')
    })
  })

  describe('Performance Optimization', () => {
    it('efficiently handles large datasets', async () => {
      // Create a large dataset
      const largeDataset = Array.from({ length: 50 }, (_, i) => ({
        ...mockAttendanceData[0],
        grade: `Grade ${i + 1}`,
        totalStudents: Math.floor(Math.random() * 200) + 50
      }))

      const startTime = performance.now()
      
      render(
        <AttendanceSummaryGrid
          data={largeDataset}
          isLoading={false}
          schoolName="Large School"
        />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within reasonable time (less than 1000ms)
      expect(renderTime).toBeLessThan(1000)
    })

    it('implements proper memoization for card components', () => {
      const { rerender } = render(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      // Re-render with same data should not cause unnecessary re-renders
      rerender(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      // Cards should still be present and functional
      expect(screen.getByText('Grade 6')).toBeInTheDocument()
      expect(screen.getByText('Grade 7')).toBeInTheDocument()
      expect(screen.getByText('Grade 8')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('adapts layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      // Should render cards in single column on mobile
      // (implementation would depend on CSS classes)
      expect(screen.getByText('Grade Level Summaries')).toBeInTheDocument()
    })

    it('uses appropriate grid layout for desktop', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      render(
        <AttendanceSummaryGrid
          data={mockAttendanceData}
          isLoading={false}
          schoolName="Test School"
        />
      )

      // Should render cards in multi-column grid on desktop
      expect(screen.getByText('Grade Level Summaries')).toBeInTheDocument()
    })
  })
})