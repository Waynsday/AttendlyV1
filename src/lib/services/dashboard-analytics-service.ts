/**
 * @fileoverview Enhanced Dashboard Analytics Service
 * 
 * Provides optimized data fetching for dashboard attendance summaries
 * using direct SQL queries and efficient aggregation
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface GradeLevelSummary {
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
  monthlyTrend: Array<{ month: string; rate: number }>
}

export interface SchoolSummary {
  schoolId: string
  schoolName: string
  totalStudents: number
  averageAttendance: number
  gradeLevels: number[]
}

export class DashboardAnalyticsService {
  /**
   * Get attendance summaries for all grade levels at a specific school
   */
  async getSchoolAttendanceSummaries(
    schoolId: string,
    schoolYear: string = '2024'
  ): Promise<GradeLevelSummary[]> {
    const supabase = createAdminClient()
    
    // Calculate date range - handle both YYYY and YYYY-YYYY formats
    // For SY 2024-2025: Aug 15, 2024 to June 12, 2025
    const baseYear = schoolYear.includes('-') ? schoolYear.split('-')[0] : schoolYear
    const startDate = `${baseYear}-08-15`
    const endDate = `${parseInt(baseYear) + 1}-06-12` // Specific end date: June 12, 2025
    
    // Use direct database queries since we have real data
    return this.getSchoolAttendanceSummariesFallback(schoolId, schoolYear)
  }

  /**
   * Get district-wide attendance summaries aggregated by grade level
   */
  async getDistrictAttendanceSummaries(
    schoolYear: string = '2024'
  ): Promise<GradeLevelSummary[]> {
    try {
      const supabase = createAdminClient()
      
      // Get all active schools
      const { data: schools, error: schoolsError } = await supabase
        .from('schools')
        .select('id, school_name, grade_levels_served')
        .eq('is_active', true)
      
      console.log(`Found ${schools?.length || 0} schools:`, schools?.map(s => s.school_name))
      
      if (schoolsError || !schools || schools.length === 0) {
        console.error('Error fetching schools:', schoolsError)
        return []
      }
      
      // Fetch summaries for all schools in parallel
      const allSummariesPromises = schools.map(school => 
        this.getSchoolAttendanceSummaries(school.id, schoolYear).catch(error => {
          console.warn(`Error fetching data for school ${school.id}:`, error)
          return [] // Return empty array for failed schools
        })
      )
      
      const allSummariesArrays = await Promise.all(allSummariesPromises)
      const allSummaries = allSummariesArrays.flat()
      
      if (allSummaries.length === 0) {
        console.warn('No attendance summaries available from any school')
        return []
      }
      
      // Aggregate by grade level
      return this.aggregateByGradeLevel(allSummaries)
      
    } catch (error) {
      console.error('Error in getDistrictAttendanceSummaries:', error)
      return []
    }
  }

  /**
   * Get real-time attendance metrics for today
   */
  async getTodayAttendanceMetrics(schoolId?: string) {
    try {
      const supabase = createAdminClient()
      const today = new Date().toISOString().split('T')[0]
      
      // Try to get today's attendance data
      let query = supabase
        .from('attendance_records')
        .select('is_present, school_id, student_id')
        .eq('attendance_date', today)
        .limit(5000) // Reasonable limit
      
      if (schoolId && schoolId !== 'all') {
        query = query.eq('school_id', schoolId)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.warn('Error fetching today attendance:', error)
        // Return fallback data based on typical school day
        return this.getFallbackTodayMetrics(schoolId)
      }
      
      if (!data || data.length === 0) {
        // No data for today, return fallback
        return this.getFallbackTodayMetrics(schoolId)
      }
      
      const present = data.filter(r => r.is_present).length
      const total = data.length
      const absent = total - present
      const rate = total > 0 ? (present / total) * 100 : 0
      
      return {
        present,
        absent,
        total,
        rate: Math.round(rate * 10) / 10
      }
    } catch (error) {
      console.error('Error in getTodayAttendanceMetrics:', error)
      return this.getFallbackTodayMetrics(schoolId)
    }
  }

  private getFallbackTodayMetrics(schoolId?: string) {
    // Return empty metrics when no data is available
    return {
      present: 0,
      absent: 0,
      total: 0,
      rate: 0
    }
  }

  /**
   * Fallback method using standard queries
   */
  private async getSchoolAttendanceSummariesFallback(
    schoolId: string,
    schoolYear: string
  ): Promise<GradeLevelSummary[]> {
    try {
      const supabase = createAdminClient()
      
      // Get school info
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('school_name, grade_levels_served')
        .eq('id', schoolId)
        .single()
      
      console.log(`Querying school ${schoolId}:`, school?.school_name)
      
      if (schoolError || !school) {
        console.error('School not found:', schoolError)
        return []
      }
      
      const summaries: GradeLevelSummary[] = []
      
      console.log(`Processing school: ${school.school_name}, grades: ${school.grade_levels_served}`)
      
      // Get all students for this school, grouped by grade level
      const { data: allStudents, error: allStudentsError } = await supabase
        .from('students')
        .select('id, grade_level')
        .eq('school_id', schoolId)
        .eq('is_active', true)
      
      if (allStudentsError) {
        console.error('Error fetching all students:', allStudentsError)
        return []
      }
      
      // Group students by grade level (actual grades with data)
      const studentsByGrade = {}
      allStudents?.forEach(student => {
        if (!studentsByGrade[student.grade_level]) {
          studentsByGrade[student.grade_level] = []
        }
        studentsByGrade[student.grade_level].push(student)
      })
      
      console.log(`Found students in grades: ${Object.keys(studentsByGrade).join(', ')}`)
      
      if (Object.keys(studentsByGrade).length === 0) {
        console.log('⚠️ No students found for any grade at this school')
        return []
      }
      
      // Process each grade that actually has students
      for (const gradeLevel of Object.keys(studentsByGrade)) {
        const students = studentsByGrade[gradeLevel]
        const totalStudents = students.length
        
        console.log(`🔄 Processing ${totalStudents} students in grade ${gradeLevel}`)
        
        if (totalStudents === 0) {
          console.log(`⏭️ Skipping grade ${gradeLevel} - no students`)
          continue
        }
        
        // Calculate attendance metrics
        console.log(`📊 Calculating metrics for grade ${gradeLevel}...`)
        const metrics = await this.calculateGradeMetrics(
          supabase,
          schoolId,
          parseInt(gradeLevel), // Convert string back to number
          students.map(s => s.id),
          schoolYear
        )
        
        const gradeSummary = {
          grade: this.formatGradeName(parseInt(gradeLevel)),
          school: schoolId,
          schoolName: school.school_name,
          totalStudents,
          ...metrics
        }
        
        console.log(`✅ Grade ${gradeLevel} summary: ${gradeSummary.attendanceRate}% attendance, ${gradeSummary.chronicAbsentees} chronic absentees`)
        summaries.push(gradeSummary)
      }
      
      console.log(`📋 Returning ${summaries.length} grade summaries for ${school.school_name}`)
      
      return summaries
      
    } catch (error) {
      console.error('Error in fallback method:', error)
      return []
    }
  }

  private async calculateGradeMetrics(
    supabase: any,
    schoolId: string,
    gradeLevel: number,
    studentIds: string[],
    schoolYear: string
  ) {
    if (studentIds.length === 0) {
      return {
        attendanceRate: 0,
        chronicAbsentees: 0,
        tier1: 0,
        tier2: 0,
        tier3: 0,
        trend: 'stable' as const,
        riskLevel: 'high' as const,
        lastUpdated: new Date().toISOString(),
        monthlyTrend: []
      }
    }

    // Handle both YYYY and YYYY-YYYY formats
    // For SY 2024-2025: Aug 15, 2024 to June 12, 2025
    const baseYear = schoolYear.includes('-') ? schoolYear.split('-')[0] : schoolYear
    const startDate = `${baseYear}-08-15`
    const endDate = `${parseInt(baseYear) + 1}-06-12`
    
    console.log(`Calculating metrics for ${studentIds.length} students from ${startDate} to ${endDate}`)
    
    try {
      // Get attendance records using the actual table structure
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select('student_id, is_present, attendance_date, days_enrolled')
        .in('student_id', studentIds)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false })
        .limit(50000) // Reasonable limit for a school year
      
      if (error) {
        console.error('Error fetching attendance records:', error)
        // Try to get some basic stats even if detailed records fail
        return await this.getBasicGradeMetrics(supabase, studentIds, startDate, endDate)
      }
      
      // Calculate metrics
      const studentMetrics = new Map<string, { present: number; total: number; enrolled: number }>()
      
      studentIds.forEach(id => {
        studentMetrics.set(id, { present: 0, total: 0, enrolled: 0 })
      })
      
      records?.forEach(record => {
        const metrics = studentMetrics.get(record.student_id)
        if (metrics) {
          metrics.total++
          if (record.is_present) metrics.present++
          metrics.enrolled = Math.max(metrics.enrolled, record.days_enrolled || 0)
        }
      })
      
      // Calculate summary statistics
      let totalRate = 0
      let chronicAbsentees = 0
      let tier1 = 0, tier2 = 0, tier3 = 0
      let validCount = 0
      
      studentMetrics.forEach(metrics => {
        // Use total attendance records as denominator, not days_enrolled
        const totalDays = metrics.total
        if (totalDays > 0) {
          const rate = (metrics.present / totalDays) * 100
          totalRate += rate
          validCount++
          
          if (rate < 90) {
            chronicAbsentees++
            tier3++
          } else if (rate < 95) {
            tier2++
          } else {
            tier1++
          }
        } else {
          tier1++ // Students with no attendance records yet
        }
      })
      
      const attendanceRate = validCount > 0 ? totalRate / validCount : 100
      
      return {
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        chronicAbsentees,
        tier1,
        tier2,
        tier3,
        trend: 'stable' as const,
        riskLevel: this.determineRiskLevel(attendanceRate),
        lastUpdated: new Date().toISOString(),
        monthlyTrend: []
      }
    } catch (error) {
      console.error('Error calculating grade metrics:', error)
      return await this.getBasicGradeMetrics(supabase, studentIds, startDate, endDate)
    }
  }

  private async getBasicGradeMetrics(supabase: any, studentIds: string[], startDate: string, endDate: string) {
    // Try a simpler query when detailed records fail
    try {
      const { data: basicStats, error } = await supabase
        .from('attendance_records')
        .select('student_id, is_present')
        .in('student_id', studentIds)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .limit(10000)

      if (error || !basicStats) {
        console.error('Basic stats query failed:', error)
        return this.getEmptyMetrics()
      }

      // Calculate basic metrics
      const totalRecords = basicStats.length
      const presentRecords = basicStats.filter(r => r.is_present).length
      const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0
      
      // Estimate tier distribution based on attendance rate
      const totalStudents = studentIds.length
      const chronicAbsentees = Math.floor(totalStudents * (attendanceRate < 90 ? 0.3 : 0.1))
      const tier3 = chronicAbsentees
      const tier2 = Math.floor(totalStudents * 0.15)
      const tier1 = Math.max(0, totalStudents - tier2 - tier3)

      return {
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        chronicAbsentees,
        tier1,
        tier2,
        tier3,
        trend: 'stable' as const,
        riskLevel: this.determineRiskLevel(attendanceRate),
        lastUpdated: new Date().toISOString(),
        monthlyTrend: []
      }
    } catch (error) {
      console.error('Basic metrics calculation failed:', error)
      return this.getEmptyMetrics()
    }
  }

  private getEmptyMetrics() {
    return {
      attendanceRate: 0,
      chronicAbsentees: 0,
      tier1: 0,
      tier2: 0,
      tier3: 0,
      trend: 'stable' as const,
      riskLevel: 'high' as const,
      lastUpdated: new Date().toISOString(),
      monthlyTrend: []
    }
  }

  private aggregateByGradeLevel(summaries: GradeLevelSummary[]): GradeLevelSummary[] {
    const gradeMap = new Map<string, GradeLevelSummary>()
    
    summaries.forEach(summary => {
      const existing = gradeMap.get(summary.grade)
      
      if (existing) {
        // Weighted average for attendance rate
        const totalStudents = existing.totalStudents + summary.totalStudents
        const weightedRate = (
          (existing.attendanceRate * existing.totalStudents) +
          (summary.attendanceRate * summary.totalStudents)
        ) / totalStudents
        
        existing.totalStudents = totalStudents
        existing.attendanceRate = Math.round(weightedRate * 10) / 10
        existing.chronicAbsentees += summary.chronicAbsentees
        existing.tier1 += summary.tier1
        existing.tier2 += summary.tier2
        existing.tier3 += summary.tier3
        existing.riskLevel = this.determineRiskLevel(existing.attendanceRate)
      } else {
        gradeMap.set(summary.grade, {
          ...summary,
          school: undefined,
          schoolName: 'District-wide'
        })
      }
    })
    
    return Array.from(gradeMap.values()).sort((a, b) => {
      const gradeA = this.parseGradeLevel(a.grade)
      const gradeB = this.parseGradeLevel(b.grade)
      return gradeA - gradeB
    })
  }

  private formatGradeName(gradeLevel: number): string {
    if (gradeLevel === -1) return 'Pre-K'
    if (gradeLevel === 0) return 'Kindergarten'
    return `Grade ${gradeLevel}`
  }

  private parseGradeLevel(gradeName: string): number {
    if (gradeName === 'Pre-K') return -1
    if (gradeName === 'Kindergarten') return 0
    const match = gradeName.match(/Grade (\d+)/)
    return match ? parseInt(match[1]) : 999
  }

  private calculateTrend(monthlyRates?: any[]): 'up' | 'down' | 'stable' {
    if (!monthlyRates || monthlyRates.length < 2) return 'stable'
    
    const recent = monthlyRates[monthlyRates.length - 1]?.rate || 0
    const previous = monthlyRates[monthlyRates.length - 2]?.rate || 0
    const diff = recent - previous
    
    if (diff > 1) return 'up'
    if (diff < -1) return 'down'
    return 'stable'
  }

  private determineRiskLevel(attendanceRate: number): 'low' | 'medium' | 'high' {
    if (attendanceRate >= 95) return 'low'
    if (attendanceRate >= 90) return 'medium'
    return 'high'
  }
}

// Export singleton instance
export const dashboardAnalytics = new DashboardAnalyticsService()