/**
 * @fileoverview Timeline Data Hook
 * 
 * Custom hook for fetching and managing attendance timeline data
 * Handles caching, loading states, and data transformations
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { TimelineDataPoint } from '../components/TimelineCard'
import type { TimelineAttendanceData } from '../components/dashboard/TimelineSummaryGrid'

export interface TimelineDataOptions {
  schoolId: string // 'all' for district-wide
  startDate?: string
  endDate?: string
  schoolYear?: string
  grades?: number[]
  autoRefresh?: boolean
  refreshInterval?: number
}

export interface TimelineError {
  message: string
  code?: string
  timestamp: Date
}

export interface UseTimelineDataReturn {
  // Data
  timelineData: TimelineAttendanceData[]
  rawData: TimelineDataPoint[]
  
  // Loading states
  isLoading: boolean
  isRefreshing: boolean
  
  // Error handling
  error: TimelineError | null
  
  // Metadata
  lastUpdated: Date | null
  cacheHit: boolean
  dataRange: { start: string; end: string } | null
  
  // Actions
  refreshData: () => Promise<void>
  clearError: () => void
  updateFilters: (options: Partial<TimelineDataOptions>) => void
  
  // Utilities
  getSchoolData: (schoolId: string) => TimelineAttendanceData | null
  getSummaryStats: () => {
    totalStudents: number
    totalAbsences: number
    avgAbsenceRate: number
    dateRange: string
  }
}

/**
 * Hook for managing timeline attendance data
 */
export function useTimelineData(options: TimelineDataOptions): UseTimelineDataReturn {
  const [rawData, setRawData] = useState<TimelineDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<TimelineError | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cacheHit, setCacheHit] = useState(false)
  const [currentOptions, setCurrentOptions] = useState<TimelineDataOptions>(options)

  // Calculate default date range (school year 2024-2025)
  const defaultDateRange = useMemo(() => {
    // Use school year date range to ensure we capture the timeline data
    return {
      start: '2024-08-01', // Start of school year 2024-2025
      end: '2025-06-30'    // End of school year 2024-2025
    }
  }, [])

  // Fetch timeline data from API
  const fetchTimelineData = useCallback(async (opts: TimelineDataOptions, isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const params = new URLSearchParams({
        schoolId: opts.schoolId,
        startDate: opts.startDate || defaultDateRange.start,
        endDate: opts.endDate || defaultDateRange.end,
        ...(opts.schoolYear && { schoolYear: opts.schoolYear }),
        ...(opts.grades && opts.grades.length > 0 && { grades: opts.grades.join(',') })
      })

      // Use the optimized timeline API with real data
      const response = await fetch(`/api/attendance/timeline?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch timeline data')
      }

      setRawData(result.data || [])
      setCacheHit(result.metadata?.cacheHit || false)
      setLastUpdated(new Date())

    } catch (err) {
      console.error('Timeline data fetch error:', err)
      setError({
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        code: 'FETCH_ERROR',
        timestamp: new Date()
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [defaultDateRange])

  // Transform raw data into school-grouped timeline data
  const timelineData = useMemo<TimelineAttendanceData[]>(() => {
    if (!rawData || rawData.length === 0) return []

    // Group data by school
    const schoolMap = new Map<string, TimelineDataPoint[]>()
    
    for (const point of rawData) {
      const schoolKey = currentOptions.schoolId === 'all' 
        ? (point.schoolName || 'Unknown School')
        : currentOptions.schoolId
      
      if (!schoolMap.has(schoolKey)) {
        schoolMap.set(schoolKey, [])
      }
      schoolMap.get(schoolKey)!.push(point)
    }

    // Convert to TimelineAttendanceData format
    return Array.from(schoolMap.entries()).map(([schoolKey, schoolData]) => {
      // Calculate aggregated metrics
      const latestData = schoolData.filter(d => 
        d.date === Math.max(...schoolData.map(p => new Date(p.date).getTime()))
      )
      const earliestData = schoolData.filter(d => 
        d.date === Math.min(...schoolData.map(p => new Date(p.date).getTime()))
      )

      const totalStudents = latestData.reduce((sum, d) => sum + d.totalStudents, 0)
      const totalAbsences = latestData.reduce((sum, d) => sum + d.cumulativeAbsences, 0)
      const avgDailyAbsences = totalAbsences / Math.max(1, new Set(schoolData.map(d => d.date)).size)

      // Calculate trend
      const latestDailyTotal = latestData.reduce((sum, d) => sum + d.dailyAbsences, 0)
      const earliestDailyTotal = earliestData.reduce((sum, d) => sum + d.dailyAbsences, 0)
      const trendDirection = latestDailyTotal > earliestDailyTotal 
        ? 'up' 
        : latestDailyTotal < earliestDailyTotal 
        ? 'down' 
        : 'stable'

      // Get available grades
      const availableGrades = Array.from(new Set(schoolData.map(d => d.grade))).sort()

      // Get date range
      const dates = schoolData.map(d => d.date).sort()
      const dateRange = {
        start: dates[0] || defaultDateRange.start,
        end: dates[dates.length - 1] || defaultDateRange.end
      }

      // Determine school info
      const firstPoint = schoolData[0]
      const schoolId = currentOptions.schoolId === 'all' 
        ? (firstPoint?.schoolCode || schoolKey)
        : currentOptions.schoolId
      const schoolName = currentOptions.schoolId === 'all' 
        ? schoolKey
        : (firstPoint?.schoolName || schoolKey)

      return {
        schoolId,
        schoolCode: firstPoint?.schoolCode,
        schoolName,
        timelineData: schoolData,
        availableGrades,
        dateRange,
        totalStudents,
        totalAbsences,
        avgDailyAbsences,
        trendDirection: trendDirection as 'up' | 'down' | 'stable'
      }
    })
  }, [rawData, currentOptions.schoolId, defaultDateRange])

  // Initial data fetch
  useEffect(() => {
    fetchTimelineData(currentOptions)
  }, [fetchTimelineData, currentOptions])

  // Auto-refresh setup
  useEffect(() => {
    if (!currentOptions.autoRefresh || !currentOptions.refreshInterval) return

    const interval = setInterval(() => {
      fetchTimelineData(currentOptions, true)
    }, currentOptions.refreshInterval)

    return () => clearInterval(interval)
  }, [currentOptions.autoRefresh, currentOptions.refreshInterval, fetchTimelineData])

  // Actions
  const refreshData = useCallback(async () => {
    await fetchTimelineData(currentOptions, true)
  }, [fetchTimelineData, currentOptions])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const updateFilters = useCallback((newOptions: Partial<TimelineDataOptions>) => {
    setCurrentOptions(prev => ({
      ...prev,
      ...newOptions
    }))
  }, [])

  // Utility functions
  const getSchoolData = useCallback((schoolId: string) => {
    return timelineData.find(school => school.schoolId === schoolId) || null
  }, [timelineData])

  const getSummaryStats = useCallback(() => {
    const totalStudents = timelineData.reduce((sum, school) => sum + school.totalStudents, 0)
    const totalAbsences = timelineData.reduce((sum, school) => sum + school.totalAbsences, 0)
    const avgAbsenceRate = totalStudents > 0 ? (totalAbsences / totalStudents) * 100 : 0
    
    const allDates = timelineData.flatMap(school => 
      school.timelineData.map(d => d.date)
    ).sort()
    
    const dateRange = allDates.length > 0 
      ? `${allDates[0]} to ${allDates[allDates.length - 1]}`
      : 'No data'

    return {
      totalStudents,
      totalAbsences,
      avgAbsenceRate,
      dateRange
    }
  }, [timelineData])

  // Data range for metadata
  const dataRange = useMemo(() => {
    if (timelineData.length === 0) return null
    
    const allDates = timelineData.flatMap(school => 
      school.timelineData.map(d => d.date)
    ).sort()
    
    return {
      start: allDates[0] || currentOptions.startDate || defaultDateRange.start,
      end: allDates[allDates.length - 1] || currentOptions.endDate || defaultDateRange.end
    }
  }, [timelineData, currentOptions, defaultDateRange])

  return {
    // Data
    timelineData,
    rawData,
    
    // Loading states
    isLoading,
    isRefreshing,
    
    // Error handling
    error,
    
    // Metadata
    lastUpdated,
    cacheHit,
    dataRange,
    
    // Actions
    refreshData,
    clearError,
    updateFilters,
    
    // Utilities
    getSchoolData,
    getSummaryStats
  }
}