/**
 * @fileoverview Grade Timeline Grid Component
 * 
 * Shows individual timeline charts for each grade level
 * Filters by school selection (all schools vs specific school)
 */

'use client'

import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Badge } from '@/presentation/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Users, Calendar } from 'lucide-react'

export interface GradeTimelineData {
  date: string
  grade: number
  dailyAbsences: number
  cumulativeAbsences: number
  totalStudents: number
  attendanceRate: number
  absenceRate: number
  schoolName?: string
  schoolCode?: string
}

interface GradeTimelineGridProps {
  data: GradeTimelineData[]
  isLoading?: boolean
  selectedSchoolId?: string
  schoolName?: string
}

interface ProcessedGradeData {
  grade: number
  timelineData: Array<{
    date: string
    cumulativeAbsences: number
    dailyAbsences: number
    totalStudents: number
    absenceRate: number
    formattedDate: string
  }>
  totalStudents: number
  totalAbsences: number
  avgAbsenceRate: number
  trend: 'up' | 'down' | 'stable'
}

export function GradeTimelineGrid({ 
  data, 
  isLoading = false,
  selectedSchoolId = 'all',
  schoolName = 'All Schools'
}: GradeTimelineGridProps) {
  
  // Process data by grade level
  const gradeData = useMemo<ProcessedGradeData[]>(() => {
    if (!data || data.length === 0) return []

    // Group by grade level
    const gradeMap = new Map<number, GradeTimelineData[]>()
    
    for (const record of data) {
      if (!gradeMap.has(record.grade)) {
        gradeMap.set(record.grade, [])
      }
      gradeMap.get(record.grade)!.push(record)
    }

    // Process each grade
    return Array.from(gradeMap.entries())
      .sort(([a], [b]) => a - b) // Sort by grade level
      .map(([grade, records]) => {
        // Sort by date
        const sortedRecords = records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        // Calculate totals and trends
        const totalStudents = sortedRecords[0]?.totalStudents || 0
        const totalAbsences = sortedRecords[sortedRecords.length - 1]?.cumulativeAbsences || 0
        const avgAbsenceRate = sortedRecords.reduce((sum, r) => sum + r.absenceRate, 0) / sortedRecords.length

        // Calculate trend (comparing first and last week)
        const firstWeekAvg = sortedRecords.slice(0, 5).reduce((sum, r) => sum + r.dailyAbsences, 0) / Math.min(5, sortedRecords.length)
        const lastWeekAvg = sortedRecords.slice(-5).reduce((sum, r) => sum + r.dailyAbsences, 0) / Math.min(5, sortedRecords.length)
        const trend = lastWeekAvg > firstWeekAvg * 1.1 ? 'up' : lastWeekAvg < firstWeekAvg * 0.9 ? 'down' : 'stable'

        return {
          grade,
          timelineData: sortedRecords.map(record => ({
            date: record.date,
            dailyAbsences: record.dailyAbsences, // This is what we'll plot
            cumulativeAbsences: record.cumulativeAbsences, // Keep for tooltip
            totalStudents: record.totalStudents,
            absenceRate: record.absenceRate,
            formattedDate: new Date(record.date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })
          })),
          totalStudents,
          totalAbsences,
          avgAbsenceRate,
          trend
        }
      })
  }, [data])

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-red-600 bg-red-50'
      case 'down':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((grade) => (
            <Card key={grade} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-200 rounded mb-4"></div>
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!gradeData || gradeData.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No timeline data available
        </h3>
        <p className="text-gray-600">
          No attendance timeline data found for {schoolName}.
        </p>
      </div>
    )
  }

  // Custom tooltip for the charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border">
          <p className="font-semibold">{label}</p>
          <p className="text-blue-600 font-medium">
            Daily Absences: {payload[0].value} students
          </p>
          <p className="text-gray-600">
            Total Students: {data.totalStudents}
          </p>
          <p className="text-orange-600">
            Absence Rate: {data.absenceRate.toFixed(1)}%
          </p>
          <p className="text-gray-500 text-sm">
            Cumulative: {data.cumulativeAbsences} total
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Daily Attendance Timeline by Grade Level
          </h2>
          <p className="text-gray-600">
            {schoolName} • Daily absence counts over time
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {gradeData.length} grade{gradeData.length !== 1 ? 's' : ''} tracked
        </Badge>
      </div>

      {/* Grade Timeline Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {gradeData.map((grade) => (
          <Card key={grade.grade} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Grade {grade.grade}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {getTrendIcon(grade.trend)}
                  <Badge className={`text-xs px-2 py-1 ${getTrendColor(grade.trend)}`}>
                    {grade.trend === 'up' ? 'Rising' : grade.trend === 'down' ? 'Declining' : 'Stable'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {grade.totalStudents} students
                </div>
                <div>
                  {grade.avgAbsenceRate.toFixed(1)}% avg rate
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={grade.timelineData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="formattedDate"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="dailyAbsences"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-4 flex justify-between items-center text-sm">
                <span className="font-medium text-gray-900">
                  Avg Daily: {(grade.totalAbsences / grade.timelineData.length || 0).toFixed(1)} absences/day
                </span>
                <span className="text-gray-600">
                  {grade.timelineData.length} day{grade.timelineData.length !== 1 ? 's' : ''} tracked
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {gradeData.reduce((sum, g) => sum + g.totalStudents, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Students</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {gradeData.reduce((sum, g) => sum + g.totalAbsences, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Absences</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {((gradeData.reduce((sum, g) => sum + g.avgAbsenceRate, 0) / gradeData.length) || 0).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Avg Absence Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {gradeData.length}
            </div>
            <div className="text-sm text-gray-600">Grade Levels</div>
          </div>
        </div>
      </div>
    </div>
  )
}