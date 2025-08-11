/**
 * @fileoverview Timeline Summary Grid Component
 * 
 * Responsive grid layout for timeline attendance cards with filtering and controls
 * Replaces the pie chart-based AttendanceSummaryGrid with timeline visualization
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { TimelineCard, type TimelineDataPoint } from '@/presentation/components/TimelineCard'
import { Button } from '@/presentation/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select'
import { Badge } from '@/presentation/components/ui/badge'
import { LayoutGrid, List, Filter, Calendar, TrendingUp, RefreshCw } from 'lucide-react'

export interface TimelineAttendanceData {
  schoolId: string
  schoolCode?: string
  schoolName: string
  timelineData: TimelineDataPoint[]
  availableGrades: number[]
  dateRange: { start: string; end: string }
  totalStudents: number
  totalAbsences: number
  avgDailyAbsences: number
  trendDirection: 'up' | 'down' | 'stable'
}

interface TimelineSummaryGridProps {
  data: TimelineAttendanceData[]
  isLoading?: boolean
  selectedSchoolId?: string
  onGradeFilter?: (schoolId: string, grades: number[]) => void
  onDateRangeChange?: (range: { start: string; end: string }) => void
  onRefresh?: () => void
}

type ViewMode = 'grid' | 'compact'
type TrendFilter = 'all' | 'increasing' | 'decreasing' | 'stable'
type GradeFilter = 'all' | string

export function TimelineSummaryGrid({ 
  data, 
  isLoading = false,
  selectedSchoolId,
  onGradeFilter,
  onDateRangeChange,
  onRefresh
}: TimelineSummaryGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('all')
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all')
  const [selectedGrades, setSelectedGrades] = useState<Record<string, number[]>>({})

  // Get all unique grades across all schools
  const allGrades = useMemo(() => {
    const grades = new Set<number>()
    data?.forEach(school => {
      school.availableGrades.forEach(grade => grades.add(grade))
    })
    return Array.from(grades).sort()
  }, [data])

  // Filter and process data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) {
      return []
    }

    let filtered = data

    // Apply trend filter
    if (trendFilter !== 'all') {
      const trendMapping: Record<TrendFilter, string> = {
        increasing: 'up',
        decreasing: 'down',
        stable: 'stable',
        all: ''
      }
      const targetTrend = trendMapping[trendFilter]
      if (targetTrend) {
        filtered = filtered.filter(school => school.trendDirection === targetTrend)
      }
    }

    // Apply grade filter
    if (gradeFilter !== 'all') {
      const targetGrade = parseInt(gradeFilter)
      if (!isNaN(targetGrade)) {
        filtered = filtered.filter(school => school.availableGrades.includes(targetGrade))
      }
    }

    return filtered
  }, [data, trendFilter, gradeFilter])

  // Handle grade selection for individual schools
  const handleGradeFilter = useCallback((schoolId: string, grades: number[]) => {
    setSelectedGrades(prev => ({
      ...prev,
      [schoolId]: grades
    }))
    onGradeFilter?.(schoolId, grades)
  }, [onGradeFilter])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!processedData.length) {
      return {
        totalSchools: 0,
        totalStudents: 0,
        totalAbsences: 0,
        avgAbsenceRate: 0,
        trendDistribution: { up: 0, down: 0, stable: 0 }
      }
    }

    const trendCounts = processedData.reduce(
      (acc, school) => {
        acc[school.trendDirection]++
        return acc
      },
      { up: 0, down: 0, stable: 0 }
    )

    const totalStudents = processedData.reduce((sum, school) => sum + school.totalStudents, 0)
    const totalAbsences = processedData.reduce((sum, school) => sum + school.totalAbsences, 0)

    return {
      totalSchools: processedData.length,
      totalStudents,
      totalAbsences,
      avgAbsenceRate: totalStudents > 0 ? (totalAbsences / totalStudents) * 100 : 0,
      trendDistribution: trendCounts
    }
  }, [processedData])

  // Get trend badge styling
  const getTrendBadgeStyle = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'down':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'stable':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />
      case 'down':
        return <TrendingUp className="h-3 w-3 rotate-180" />
      default:
        return null
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="flex space-x-2">
            <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-48 bg-gray-200 rounded mb-4"></div>
              <div className="flex space-x-4">
                <div className="h-4 bg-gray-200 rounded flex-1"></div>
                <div className="h-4 bg-gray-200 rounded flex-1"></div>
                <div className="h-4 bg-gray-200 rounded flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (processedData.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <Calendar className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No timeline data available
        </h3>
        <p className="text-gray-600 mb-4">
          {trendFilter !== 'all' || gradeFilter !== 'all'
            ? 'No schools match the selected filters'
            : 'There are no attendance timeline records for the selected criteria.'
          }
        </p>
        {(trendFilter !== 'all' || gradeFilter !== 'all') && (
          <div className="flex justify-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setTrendFilter('all')}
              size="sm"
            >
              Clear Trend Filter
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setGradeFilter('all')}
              size="sm"
            >
              Clear Grade Filter
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats Bar */}
      <div className="bg-white rounded-lg border p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary-900">{summaryStats.totalSchools}</div>
            <div className="text-sm text-primary-700">Schools</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-900">{summaryStats.totalStudents.toLocaleString()}</div>
            <div className="text-sm text-primary-700">Students</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-900">{summaryStats.totalAbsences.toLocaleString()}</div>
            <div className="text-sm text-primary-700">Total Absences</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-900">{summaryStats.avgAbsenceRate.toFixed(1)}%</div>
            <div className="text-sm text-primary-700">Avg Absence Rate</div>
          </div>
          <div className="flex justify-center space-x-2">
            <Badge variant="secondary" className="text-xs">
              {getTrendIcon('up')} {summaryStats.trendDistribution.up}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {getTrendIcon('down')} {summaryStats.trendDistribution.down}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {summaryStats.trendDistribution.stable} Stable
            </Badge>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-gray-900">
            Attendance Timelines
          </h2>
          <span className="text-sm text-gray-500">
            ({processedData.length} {processedData.length === 1 ? 'school' : 'schools'})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Grade Filter */}
          <Select value={gradeFilter} onValueChange={(value: GradeFilter) => setGradeFilter(value)}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {allGrades.map(grade => (
                <SelectItem key={grade} value={grade.toString()}>
                  Grade {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Trend Filter */}
          <Select value={trendFilter} onValueChange={(value: TrendFilter) => setTrendFilter(value)}>
            <SelectTrigger className="w-36">
              <TrendingUp className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trends</SelectItem>
              <SelectItem value="increasing">Increasing</SelectItem>
              <SelectItem value="decreasing">Decreasing</SelectItem>
              <SelectItem value="stable">Stable</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          {onRefresh && (
            <Button 
              variant="outline" 
              onClick={onRefresh}
              disabled={isLoading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('compact')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {(trendFilter !== 'all' || gradeFilter !== 'all') && (
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          
          {trendFilter !== 'all' && (
            <Badge 
              variant="secondary" 
              className={`text-xs ${getTrendBadgeStyle(trendFilter === 'increasing' ? 'up' : trendFilter === 'decreasing' ? 'down' : 'stable')}`}
            >
              {getTrendIcon(trendFilter === 'increasing' ? 'up' : trendFilter === 'decreasing' ? 'down' : 'stable')}
              <span className="ml-1">{trendFilter.charAt(0).toUpperCase() + trendFilter.slice(1)}</span>
              <button
                onClick={() => setTrendFilter('all')}
                className="ml-2 hover:text-gray-900"
              >
                ×
              </button>
            </Badge>
          )}

          {gradeFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Grade {gradeFilter}
              <button
                onClick={() => setGradeFilter('all')}
                className="ml-2 hover:text-gray-900"
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Timeline Grid */}
      <div 
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 xl:grid-cols-2 gap-6'
            : 'grid grid-cols-1 gap-4'
        }
      >
        {processedData.map((schoolData) => (
          <TimelineCard
            key={schoolData.schoolId}
            timelineData={schoolData.timelineData}
            selectedGrades={selectedGrades[schoolData.schoolId] || schoolData.availableGrades}
            schoolName={schoolData.schoolName}
            dateRange={schoolData.dateRange}
            isLoading={false}
            onGradeFilter={(grades) => handleGradeFilter(schoolData.schoolId, grades)}
            onDateRangeChange={onDateRangeChange}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {/* District Summary - if showing all schools */}
      {selectedSchoolId === 'all' && processedData.length > 1 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">District Overview</h3>
          <TimelineCard
            timelineData={processedData.reduce((acc, school) => [...acc, ...school.timelineData], [])}
            selectedGrades={allGrades}
            schoolName="District Total"
            dateRange={processedData[0]?.dateRange || { start: '', end: '' }}
            isLoading={false}
            onDateRangeChange={onDateRangeChange}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  )
}