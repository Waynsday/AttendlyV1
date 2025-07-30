/**
 * @fileoverview Dashboard Data Hook
 * 
 * Custom hook for managing dashboard state including school selection
 * and grade data with caching and error handling
 */

import { useState, useEffect, useCallback } from 'react'
import { dashboardDataService, School, AttendanceData } from '@/lib/services/dashboard-data-service'

export interface UseDashboardDataReturn {
  // Data
  schools: School[]
  selectedSchoolId: string
  attendanceData: AttendanceData[]
  
  // State
  isLoading: boolean
  isLoadingAttendance: boolean
  error: string | null
  lastUpdated: string | null
  
  // Actions
  setSelectedSchoolId: (schoolId: string) => void
  refreshData: () => Promise<void>
  clearError: () => void
}

export function useDashboardData(initialSchoolId: string = 'all'): UseDashboardDataReturn {
  // State
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchoolId, setSelectedSchoolIdState] = useState<string>(initialSchoolId)
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load attendance data when school selection changes
  useEffect(() => {
    if (schools.length > 0) {
      loadAttendanceData(selectedSchoolId)
    }
  }, [selectedSchoolId, schools])

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load schools first
      const schoolsData = await dashboardDataService.fetchSchools()
      setSchools(schoolsData)

      // Then load attendance data for initial school
      const attendanceDataResult = await dashboardDataService.fetchAttendanceSummaries(selectedSchoolId)
      setAttendanceData(attendanceDataResult)
      setLastUpdated(new Date().toISOString())

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data'
      setError(errorMessage)
      console.error('Error loading initial dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedSchoolId])

  const loadAttendanceData = useCallback(async (schoolId: string) => {
    try {
      setIsLoadingAttendance(true)
      setError(null)

      const attendanceDataResult = await dashboardDataService.fetchAttendanceSummaries(schoolId)
      setAttendanceData(attendanceDataResult)
      setLastUpdated(new Date().toISOString())

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load attendance data'
      setError(errorMessage)
      console.error('Error loading attendance data:', err)
    } finally {
      setIsLoadingAttendance(false)
    }
  }, [])

  const setSelectedSchoolId = useCallback((schoolId: string) => {
    setSelectedSchoolIdState(schoolId)
  }, [])

  const refreshData = useCallback(async () => {
    try {
      setError(null)
      
      // Clear cache to force fresh data
      dashboardDataService.clearCache()
      
      // Reload both schools and attendance data
      const [schoolsData, attendanceDataResult] = await Promise.all([
        dashboardDataService.fetchSchools(),
        dashboardDataService.fetchAttendanceSummaries(selectedSchoolId)
      ])

      setSchools(schoolsData)
      setAttendanceData(attendanceDataResult)
      setLastUpdated(new Date().toISOString())

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh dashboard data'
      setError(errorMessage)
      console.error('Error refreshing dashboard data:', err)
    }
  }, [selectedSchoolId])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Data
    schools,
    selectedSchoolId,
    attendanceData,
    
    // State
    isLoading,
    isLoadingAttendance,
    error,
    lastUpdated,
    
    // Actions
    setSelectedSchoolId,
    refreshData,
    clearError
  }
}