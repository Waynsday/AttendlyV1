/**
 * @fileoverview Dashboard Data Service
 * 
 * Handles data fetching and caching for dashboard components
 * Provides a clean interface between UI components and API endpoints
 */

import { supabase } from '@/lib/supabase/client'

export interface School {
  id: string
  code: string
  name: string
  type: string
  gradeLevelsServed: number[]
  principalName: string
  enrollment: number
}

export interface AttendanceData {
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

export interface DashboardDataState {
  schools: School[]
  selectedSchoolId: string
  attendanceData: AttendanceData[]
  isLoading: boolean
  error: string | null
  lastUpdated: string | null
}

class DashboardDataService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Fetch all available schools for dropdown
   */
  async fetchSchools(): Promise<School[]> {
    const cacheKey = 'schools'
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const response = await fetch('/api/schools', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId()
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch schools: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch schools')
      }

      const schools = result.data as School[]
      this.setCache(cacheKey, schools)
      return schools

    } catch (error) {
      console.error('Error fetching schools:', error)
      // Return fallback data if API fails
      return this.getFallbackSchools()
    }
  }

  /**
   * Fetch attendance summaries for a specific school or all schools
   */
  async fetchAttendanceSummaries(schoolId: string, schoolYear?: string): Promise<AttendanceData[]> {
    const cacheKey = `attendance-summaries-${schoolId}-${schoolYear || '2024-2025'}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const url = new URL('/api/attendance-summaries', window.location.origin)
      url.searchParams.set('schoolId', schoolId)
      if (schoolYear) {
        url.searchParams.set('schoolYear', schoolYear)
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.generateRequestId()
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch attendance summaries: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch attendance summaries')
      }

      const attendanceData = result.data as AttendanceData[]
      this.setCache(cacheKey, attendanceData, this.CACHE_TTL / 2) // Shorter cache for dynamic data
      return attendanceData

    } catch (error) {
      console.error('Error fetching attendance summaries:', error)
      // Return fallback data if API fails
      return this.getFallbackAttendanceData(schoolId)
    }
  }

  /**
   * Get aggregated dashboard data for a school
   */
  async getDashboardData(schoolId: string): Promise<{
    schools: School[]
    attendanceData: AttendanceData[]
  }> {
    const [schools, attendanceData] = await Promise.all([
      this.fetchSchools(),
      this.fetchAttendanceSummaries(schoolId)
    ])

    return { schools, attendanceData }
  }

  /**
   * Clear cache for fresh data fetch
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Preload data for better performance
   */
  async preloadDashboardData(): Promise<void> {
    try {
      // Preload schools and district-wide attendance data
      await Promise.all([
        this.fetchSchools(),
        this.fetchAttendanceSummaries('all')
      ])
    } catch (error) {
      console.warn('Failed to preload dashboard data:', error)
    }
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const isExpired = Date.now() > (cached.timestamp + cached.ttl)
    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  private setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  private getFallbackSchools(): School[] {
    return [
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
      },
      {
        id: 'heritage-elementary',
        code: 'HES',
        name: 'Heritage Elementary School',
        type: 'ELEMENTARY',
        gradeLevelsServed: [1, 2, 3, 4, 5],
        principalName: 'Mr. James Thompson',
        enrollment: 380
      },
      {
        id: 'romoland-intermediate',
        code: 'RIS',
        name: 'Romoland Intermediate School',
        type: 'INTERMEDIATE',
        gradeLevelsServed: [6, 7, 8],
        principalName: 'Dr. Michael Chen',
        enrollment: 420
      }
    ]
  }

  private getFallbackAttendanceData(schoolId: string): AttendanceData[] {
    const allAttendanceData: AttendanceData[] = [
      {
        grade: 'Kindergarten',
        school: 'romoland-elementary',
        schoolName: 'Romoland Elementary',
        totalStudents: 75,
        attendanceRate: 94.2,
        chronicAbsentees: 6,
        tier1: 63,
        tier2: 6,
        tier3: 6,
        trend: 'stable',
        riskLevel: 'low',
        lastUpdated: new Date().toISOString(),
        monthlyTrend: [
          { month: 'Sep', rate: 93.5 },
          { month: 'Oct', rate: 94.1 },
          { month: 'Nov', rate: 94.2 }
        ]
      },
      {
        grade: 'Grade 1',
        school: 'romoland-elementary',
        schoolName: 'Romoland Elementary',
        totalStudents: 68,
        attendanceRate: 93.8,
        chronicAbsentees: 5,
        tier1: 58,
        tier2: 5,
        tier3: 5,
        trend: 'up',
        riskLevel: 'low',
        lastUpdated: new Date().toISOString(),
        monthlyTrend: [
          { month: 'Sep', rate: 93.2 },
          { month: 'Oct', rate: 93.5 },
          { month: 'Nov', rate: 93.8 }
        ]
      },
      {
        grade: 'Grade 6',
        school: 'romoland-intermediate',
        schoolName: 'Romoland Intermediate',
        totalStudents: 140,
        attendanceRate: 88.5,
        chronicAbsentees: 15,
        tier1: 110,
        tier2: 15,
        tier3: 15,
        trend: 'stable',
        riskLevel: 'medium',
        lastUpdated: new Date().toISOString(),
        monthlyTrend: [
          { month: 'Sep', rate: 88.1 },
          { month: 'Oct', rate: 88.3 },
          { month: 'Nov', rate: 88.5 }
        ]
      },
      {
        grade: 'Grade 7',
        school: 'romoland-intermediate',
        schoolName: 'Romoland Intermediate',
        totalStudents: 135,
        attendanceRate: 86.2,
        chronicAbsentees: 18,
        tier1: 102,
        tier2: 15,
        tier3: 18,
        trend: 'down',
        riskLevel: 'medium',
        lastUpdated: new Date().toISOString(),
        monthlyTrend: [
          { month: 'Sep', rate: 87.1 },
          { month: 'Oct', rate: 86.7 },
          { month: 'Nov', rate: 86.2 }
        ]
      }
    ]

    if (schoolId === 'all') {
      // Return aggregated data across all schools
      return this.aggregateAttendanceData(allAttendanceData)
    } else {
      // Filter by specific school
      return allAttendanceData.filter(attendance => attendance.school === schoolId)
    }
  }

  private aggregateAttendanceData(attendanceData: AttendanceData[]): AttendanceData[] {
    const gradeMap = new Map<string, AttendanceData>()

    attendanceData.forEach(attendance => {
      const existing = gradeMap.get(attendance.grade)
      if (existing) {
        const totalStudents = existing.totalStudents + attendance.totalStudents
        const weightedRate = (
          (existing.attendanceRate * existing.totalStudents) + 
          (attendance.attendanceRate * attendance.totalStudents)
        ) / totalStudents

        existing.totalStudents = totalStudents
        existing.attendanceRate = Math.round(weightedRate * 10) / 10
        existing.chronicAbsentees += attendance.chronicAbsentees
        existing.tier1 += attendance.tier1
        existing.tier2 += attendance.tier2
        existing.tier3 += attendance.tier3
      } else {
        gradeMap.set(attendance.grade, {
          ...attendance,
          school: undefined,
          schoolName: 'District-wide'
        })
      }
    })

    return Array.from(gradeMap.values())
  }
}

// Export singleton instance
export const dashboardDataService = new DashboardDataService()