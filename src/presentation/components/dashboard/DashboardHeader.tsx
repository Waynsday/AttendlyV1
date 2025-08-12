/**
 * @fileoverview Dashboard Header with Real-time Metrics
 * 
 * Displays current attendance statistics and school selection
 */

'use client'

import React from 'react'
import { AlertCircle, Users, UserCheck, UserX, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/presentation/components/ui/card'

interface TodayMetrics {
  present: number
  absent: number
  total: number
  rate: number
}

interface DashboardHeaderProps {
  schoolName: string
  todayMetrics?: TodayMetrics
  lastUpdated?: string
  error?: string | null
}

export function DashboardHeader({
  schoolName,
  todayMetrics,
  lastUpdated,
  error
}: DashboardHeaderProps) {
  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Never'
    try {
      return new Date(dateString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Invalid time'
    }
  }

  const getRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600'
    if (rate >= 90) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRateBgColor = (rate: number) => {
    if (rate >= 95) return 'bg-green-50 border-green-200'
    if (rate >= 90) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <div className="space-y-4">
      {/* Main Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Attendance Dashboard
          </h1>
          <p className="text-lg text-gray-600 mt-1">
            {schoolName} • Romoland School District
          </p>
        </div>
        
        {lastUpdated && (
          <div className="text-sm text-gray-500">
            Last updated: {formatTime(lastUpdated)}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <div className="text-sm text-red-700">
              <strong>Error loading data:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Today's Metrics */}
      {todayMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Students */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Total Students
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {todayMetrics.total.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Present Today */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Present Today
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {todayMetrics.present.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Absent Today */}
          <Card 
            className={`border-2 ${
              todayMetrics.absent > 0 
                ? 'border-red-200 bg-red-50' 
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center">
                <UserX 
                  className={`h-8 w-8 mr-3 ${
                    todayMetrics.absent > 0 ? 'text-red-600' : 'text-gray-400'
                  }`} 
                />
                <div>
                  <p 
                    className={`text-sm font-medium ${
                      todayMetrics.absent > 0 ? 'text-red-900' : 'text-gray-700'
                    }`}
                  >
                    Absent Today
                  </p>
                  <p 
                    className={`text-2xl font-bold ${
                      todayMetrics.absent > 0 ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    {todayMetrics.absent.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Rate */}
          <Card className={`border-2 ${getRateBgColor(todayMetrics.rate)}`}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <TrendingUp 
                  className={`h-8 w-8 mr-3 ${getRateColor(todayMetrics.rate)}`}
                />
                <div>
                  <p className={`text-sm font-medium ${
                    todayMetrics.rate >= 95 ? 'text-green-900' :
                    todayMetrics.rate >= 90 ? 'text-yellow-900' : 'text-red-900'
                  }`}>
                    Today's Rate
                  </p>
                  <p className={`text-2xl font-bold ${getRateColor(todayMetrics.rate)}`}>
                    {todayMetrics.rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State for Today's Metrics */}
      {!todayMetrics && !error && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-gray-200">
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-gray-200 rounded mr-3"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}