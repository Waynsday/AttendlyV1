/**
 * @fileoverview Dashboard Data Hook
 * 
 * Custom hook for managing dashboard state including school selection
 * and grade data with caching and error handling
 */

import { useState, useEffect, useCallback } from 'react'
import { dashboardDataService, School, AttendanceData } from '@/lib/services/dashboard-data-service'

export interface TodayMetrics {
  present: number
  absent: number
  total: number
  rate: number
}

export interface UseDashboardDataReturn {
  // Data
  schools: School[]
  selectedSchoolId: string
  attendanceData: AttendanceData[]
  todayMetrics?: TodayMetrics
  
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

export function useDashboardData(initialSchoolId: string = 'all', schoolYear: string = '2024'): UseDashboardDataReturn {
  // State
  const [schools, setSchools] = useState<School[]>([])
  const [selectedSchoolId, setSelectedSchoolIdState] = useState<string>(initialSchoolId)
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([])
  const [todayMetrics, setTodayMetrics] = useState<TodayMetrics | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load attendance data when school selection or school year changes
  useEffect(() => {
    if (schools.length > 0) {
      loadAttendanceData(selectedSchoolId, schoolYear)
    }
  }, [selectedSchoolId, schoolYear, schools])

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load schools first
      const schoolsData = await dashboardDataService.fetchSchools()
      setSchools(schoolsData)

      // Then load attendance data for initial school
      console.log(`Loading attendance data for school: ${selectedSchoolId}, year: ${schoolYear}`)
      const response = await fetch(`/api/attendance-summaries?schoolId=${selectedSchoolId}&schoolYear=${schoolYear}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('API Response:', result)
      
      if (result.success) {
        console.log(`Loaded ${result.data?.length || 0} attendance records`)
        setAttendanceData(result.data || [])
        setTodayMetrics(result.meta?.todayAttendance)
        setLastUpdated(new Date().toISOString())
      } else {
        throw new Error(result.error || 'Failed to load attendance data')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data'
      setError(errorMessage)
      console.error('Error loading initial dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedSchoolId, schoolYear])

  const loadAttendanceData = useCallback(async (schoolId: string, currentSchoolYear: string = schoolYear) => {
    try {
      setIsLoadingAttendance(true)
      setError(null)

      console.log(`Loading attendance data for school change: ${schoolId}, year: ${currentSchoolYear}`)
      const response = await fetch(`/api/attendance-summaries?schoolId=${schoolId}&schoolYear=${currentSchoolYear}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('School change API Response:', result)
      
      if (result.success) {
        console.log(`Loaded ${result.data?.length || 0} attendance records for school ${schoolId}`)
        setAttendanceData(result.data || [])
        setTodayMetrics(result.meta?.todayAttendance)
        setLastUpdated(new Date().toISOString())
      } else {
        throw new Error(result.error || 'Failed to load attendance data')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load attendance data'
      setError(errorMessage)
      console.error('Error loading attendance data:', err)
    } finally {
      setIsLoadingAttendance(false)
    }
  }, [schoolYear])

  const setSelectedSchoolId = useCallback((schoolId: string) => {
    setSelectedSchoolIdState(schoolId)
  }, [])

  const refreshData = useCallback(async () => {
    try {
      setError(null)
      
      // Clear cache to force fresh data
      dashboardDataService.clearCache()
      
      // Reload both schools and attendance data
      const [schoolsResponse, attendanceResponse] = await Promise.all([
        dashboardDataService.fetchSchools(),
        fetch(`/api/attendance-summaries?schoolId=${selectedSchoolId}&schoolYear=${schoolYear}`)
      ])

      const attendanceResult = await attendanceResponse.json()
      
      setSchools(schoolsResponse)
      
      if (attendanceResult.success) {
        setAttendanceData(attendanceResult.data)
        setTodayMetrics(attendanceResult.meta?.todayAttendance)
      }
      
      setLastUpdated(new Date().toISOString())

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh dashboard data'
      setError(errorMessage)
      console.error('Error refreshing dashboard data:', err)
    }
  }, [selectedSchoolId, schoolYear])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Data
    schools,
    selectedSchoolId,
    attendanceData,
    todayMetrics,
    
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