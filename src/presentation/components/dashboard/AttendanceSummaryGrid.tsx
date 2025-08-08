/**
 * @fileoverview Attendance Summary Grid Component
 * 
 * Responsive grid layout for attendance summary cards with filtering and sorting
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { AttendanceCard } from '@/presentation/components/AttendanceCard'
import { Button } from '@/presentation/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select'
import { LayoutGrid, List, Filter, SortAsc, SortDesc } from 'lucide-react'

interface AttendanceData {
  grade: string
  school?: string
  schoolName?: string
  totalStudents: number
  attendanceRate: number
  chronicAbsentees: number
  tier1: number
  tier2: number
  tier3: number
  trend: 'up' | 'down' | 'stable'
  riskLevel: 'low' | 'medium' | 'high'
  lastUpdated: string
  monthlyTrend?: Array<{ month: string; rate: number }>
}

interface AttendanceSummaryGridProps {
  data: AttendanceData[]
  isLoading?: boolean
  schoolName?: string
}

type SortField = 'grade' | 'totalStudents' | 'attendanceRate' | 'chronicAbsentees'
type SortDirection = 'asc' | 'desc'
type RiskFilter = 'all' | 'low' | 'medium' | 'high'
type ViewMode = 'grid' | 'compact'

export function AttendanceSummaryGrid({ 
  data, 
  isLoading = false,
  schoolName = 'All Schools'
}: AttendanceSummaryGridProps) {
  const [sortField, setSortField] = useState<SortField>('grade')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Helper function for grade level parsing - defined before useMemo
  const parseGradeLevel = useCallback((grade: string): number => {
    if (!grade) return 999
    if (grade === 'Kindergarten') return 0
    if (grade === 'Pre-K') return -1
    const match = grade.match(/Grade (\d+)/)
    return match ? parseInt(match[1]) : 999
  }, [])

  // Sort and filter data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) {
      return []
    }

    let filtered = data

    // Apply risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(item => item && item.riskLevel === riskFilter)
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      if (!a || !b) return 0

      let aValue: any, bValue: any

      switch (sortField) {
        case 'grade':
          // Custom grade sorting (K, 1, 2, 3, etc.)
          aValue = parseGradeLevel(a.grade || '')
          bValue = parseGradeLevel(b.grade || '')
          break
        case 'totalStudents':
          aValue = a.totalStudents || 0
          bValue = b.totalStudents || 0
          break
        case 'attendanceRate':
          aValue = a.attendanceRate || 0
          bValue = b.attendanceRate || 0
          break
        case 'chronicAbsentees':
          aValue = a.chronicAbsentees || 0
          bValue = b.chronicAbsentees || 0
          break
        default:
          return 0
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [data, sortField, sortDirection, riskFilter, parseGradeLevel])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? 
      <SortAsc className="h-4 w-4 ml-1" /> : 
      <SortDesc className="h-4 w-4 ml-1" />
  }

  const getRiskFilterColor = (risk: RiskFilter) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'low': return 'bg-green-100 text-green-700 border-green-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="flex space-x-2">
            <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
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
          <LayoutGrid className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No attendance data available
        </h3>
        <p className="text-gray-600 mb-4">
          {riskFilter !== 'all' 
            ? `No grades found with ${riskFilter} risk level`
            : 'There are no attendance records for the selected criteria.'
          }
        </p>
        {riskFilter !== 'all' && (
          <Button 
            variant="outline" 
            onClick={() => setRiskFilter('all')}
            className="mt-2"
          >
            Clear Filters
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-gray-900">
            Grade Level Summaries
          </h2>
          <span className="text-sm text-gray-500">
            ({processedData.length} {processedData.length === 1 ? 'grade' : 'grades'})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Risk Filter */}
          <Select value={riskFilter} onValueChange={(value: RiskFilter) => setRiskFilter(value)}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="low">Low Risk</SelectItem>
              <SelectItem value="medium">Medium Risk</SelectItem>
              <SelectItem value="high">High Risk</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Options */}
          <Select value={sortField} onValueChange={(value: SortField) => handleSort(value)}>
            <SelectTrigger className="w-36">
              <SelectValue />
              {getSortIcon(sortField)}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grade">Sort by Grade</SelectItem>
              <SelectItem value="totalStudents">Sort by Students</SelectItem>
              <SelectItem value="attendanceRate">Sort by Rate</SelectItem>
              <SelectItem value="chronicAbsentees">Sort by Chronic</SelectItem>
            </SelectContent>
          </Select>

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
      {riskFilter !== 'all' && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          <span 
            className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskFilterColor(riskFilter)}`}
          >
            {riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)} Risk
            <button
              onClick={() => setRiskFilter('all')}
              className="ml-2 hover:text-gray-900"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Grid */}
      <div 
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'grid grid-cols-1 md:grid-cols-2 gap-4'
        }
      >
        {processedData.map((gradeData) => (
          <AttendanceCard
            key={`${gradeData.school || 'district'}-${gradeData.grade}`}
            gradeData={gradeData}
            isLoading={false}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  )
}