/**
 * @fileoverview Dashboard Data Service Tests
 * 
 * Tests the dashboard data service functionality including caching,
 * data transformation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { dashboardDataService } from '@/lib/services/dashboard-data-service'

// Mock fetch
global.fetch = jest.fn()

describe('DashboardDataService', () => {
  beforeEach(() => {
    // Clear cache before each test
    dashboardDataService.clearCache()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('fetchSchools', () => {
    it('should fetch schools from API successfully', async () => {
      // Arrange
      const mockSchools = [
        {
          id: 'all',
          code: 'ALL',
          name: 'All Schools (District-wide)',
          type: 'DISTRICT',
          gradeLevelsServed: [1, 2, 3, 4, 5, 6, 7, 8],
          principalName: 'District Administration',
          enrollment: 1200
        },
        {
          id: 'romoland-elementary',
          code: 'RES',
          name: 'Romoland Elementary School',
          type: 'ELEMENTARY',
          gradeLevelsServed: [1, 2, 3, 4, 5],
          principalName: 'Dr. Maria Rodriguez',
          enrollment: 400
        }
      ]

      const mockResponse = {
        success: true,
        data: mockSchools
      }

      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      // Act
      const result = await dashboardDataService.fetchSchools()

      // Assert
      expect(result).toEqual(mockSchools)
      expect(fetch).toHaveBeenCalledWith('/api/schools', expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }))
    })

    it('should return fallback data when API fails', async () => {
      // Arrange
      ;(fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      )

      // Act
      const result = await dashboardDataService.fetchSchools()

      // Assert
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].id).toBe('all')
      expect(result[0].name).toBe('All Schools (District-wide)')
    })

    it('should cache schools data after first fetch', async () => {
      // Arrange
      const mockSchools = [{ id: '1', name: 'Test School' }]
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSchools })
      } as Response)

      // Act - First fetch
      await dashboardDataService.fetchSchools()
      
      // Act - Second fetch
      const result = await dashboardDataService.fetchSchools()

      // Assert - Should only call fetch once due to caching
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockSchools)
    })
  })

  describe('fetchAttendanceSummaries', () => {
    it('should fetch attendance summaries for a specific school', async () => {
      // Arrange
      const schoolId = 'romoland-elementary'
      const mockAttendanceData = [
        {
          grade: 'Grade 1',
          school: schoolId,
          schoolName: 'Romoland Elementary',
          totalStudents: 75,
          attendanceRate: 94.2,
          chronicAbsentees: 6,
          tier1: 63,
          tier2: 6,
          tier3: 6,
          trend: 'stable' as const,
          riskLevel: 'low' as const,
          lastUpdated: '2025-07-29T10:30:00Z'
        }
      ]

      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAttendanceData })
      } as Response)

      // Act
      const result = await dashboardDataService.fetchAttendanceSummaries(schoolId)

      // Assert
      expect(result).toEqual(mockAttendanceData)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/attendance-summaries?schoolId=${schoolId}`),
        expect.any(Object)
      )
    })

    it('should fetch aggregated attendance data for all schools', async () => {
      // Arrange
      const schoolId = 'all'
      const mockAggregatedData = [
        {
          grade: 'Grade 1',
          schoolName: 'District-wide',
          totalStudents: 150,
          attendanceRate: 93.5,
          chronicAbsentees: 12,
          tier1: 120,
          tier2: 18,
          tier3: 12,
          trend: 'stable' as const,
          riskLevel: 'low' as const,
          lastUpdated: '2025-07-29T10:30:00Z'
        }
      ]

      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockAggregatedData })
      } as Response)

      // Act
      const result = await dashboardDataService.fetchAttendanceSummaries(schoolId)

      // Assert
      expect(result).toEqual(mockAggregatedData)
      expect(result[0].schoolName).toBe('District-wide')
    })

    it('should return fallback data when API fails', async () => {
      // Arrange
      ;(fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('API error')
      )

      // Act
      const result = await dashboardDataService.fetchAttendanceSummaries('test-school')

      // Assert
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getDashboardData', () => {
    it('should fetch both schools and attendance data', async () => {
      // Arrange
      const schoolId = 'romoland-elementary'
      const mockSchools = [{ id: '1', name: 'Test School' }]
      const mockAttendanceData = [{ grade: 'Grade 1', totalStudents: 50 }]

      ;(fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockSchools })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockAttendanceData })
        } as Response)

      // Act
      const result = await dashboardDataService.getDashboardData(schoolId)

      // Assert
      expect(result.schools).toEqual(mockSchools)
      expect(result.attendanceData).toEqual(mockAttendanceData)
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      // Arrange - Cache some data
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] })
      } as Response)

      await dashboardDataService.fetchSchools()
      expect(fetch).toHaveBeenCalledTimes(1)

      // Act
      dashboardDataService.clearCache()
      await dashboardDataService.fetchSchools()

      // Assert - Should fetch again after cache clear
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should clear specific cache key', async () => {
      // Arrange
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] })
      } as Response)

      await dashboardDataService.fetchSchools()
      await dashboardDataService.fetchAttendanceSummaries('test')

      // Act
      dashboardDataService.clearCache('schools')
      await dashboardDataService.fetchSchools()

      // Assert - Schools should be fetched again, grade summaries should still be cached
      expect(fetch).toHaveBeenCalledTimes(3) // 2 initial + 1 schools refetch
    })
  })
})