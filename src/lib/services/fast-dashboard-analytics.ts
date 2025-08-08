/**
 * @fileoverview Fast Dashboard Analytics Service
 * 
 * Uses pre-calculated SQL views for instant dashboard loading
 * instead of processing 392K+ records in real-time
 */

import { createAdminClient } from '@/lib/supabase/server'
import { GradeLevelSummary } from './dashboard-analytics-service'

export class FastDashboardAnalyticsService {
  /**
   * Get attendance summaries for a specific school (INSTANT)
   * Uses the grade_attendance_summaries view
   */
  async getSchoolAttendanceSummaries(
    schoolId: string,
    schoolYear: string = '2024'
  ): Promise<GradeLevelSummary[]> {
    try {
      const supabase = createAdminClient()
      
      console.log(`🚀 Fast query: Getting summaries for school ${schoolId}`)
      
      const { data, error } = await supabase
        .from('grade_attendance_summaries')
        .select('*')
        .eq('school_id', schoolId)
        .order('grade_level', { ascending: true })

      if (error) {
        console.error('Error fetching from view:', error)
        return []
      }

      // Transform view data to match our interface
      const summaries: GradeLevelSummary[] = data.map(row => ({
        grade: row.grade_name,
        school: row.school_id,
        schoolName: row.school_name,
        totalStudents: row.total_students,
        attendanceRate: row.attendance_rate,
        chronicAbsentees: row.chronic_absentees,
        tier1: row.tier1_students,
        tier2: row.tier2_students,
        tier3: row.tier3_students,
        trend: row.trend as 'up' | 'down' | 'stable',
        riskLevel: row.risk_level as 'low' | 'medium' | 'high',
        lastUpdated: row.last_updated,
        monthlyTrend: []
      }))

      console.log(`✅ Fast query returned ${summaries.length} summaries in milliseconds`)
      return summaries

    } catch (error) {
      console.error('Fast analytics error:', error)
      return []
    }
  }

  /**
   * Get district-wide attendance summaries (INSTANT)
   * Uses the district_attendance_summary view
   */
  async getDistrictAttendanceSummaries(
    schoolYear: string = '2024'
  ): Promise<GradeLevelSummary[]> {
    try {
      const supabase = createAdminClient()
      
      console.log('🚀 Fast query: Getting district-wide summaries')
      
      const { data, error } = await supabase
        .from('district_attendance_summary')
        .select('*')
        .order('grade_level', { ascending: true })

      if (error) {
        console.error('Error fetching district view:', error)
        return []
      }

      // Transform view data to match our interface
      const summaries: GradeLevelSummary[] = data.map(row => ({
        grade: row.grade_name,
        schoolName: row.school_name,
        totalStudents: row.total_students,
        attendanceRate: row.attendance_rate,
        chronicAbsentees: row.chronic_absentees,
        tier1: row.tier1_students,
        tier2: row.tier2_students,
        tier3: row.tier3_students,
        trend: row.trend as 'up' | 'down' | 'stable',
        riskLevel: row.risk_level as 'low' | 'medium' | 'high',
        lastUpdated: row.last_updated,
        monthlyTrend: []
      }))

      console.log(`✅ Fast district query returned ${summaries.length} summaries in milliseconds`)
      return summaries

    } catch (error) {
      console.error('Fast district analytics error:', error)
      return []
    }
  }

  /**
   * Get today's attendance metrics (INSTANT)
   * Uses the todays_attendance_metrics view
   */
  async getTodayAttendanceMetrics(schoolId?: string) {
    try {
      const supabase = createAdminClient()
      
      if (!schoolId || schoolId === 'all') {
        // Get district-wide today's metrics
        const { data, error } = await supabase
          .from('district_todays_metrics')
          .select('*')
          .single()

        if (error || !data) {
          return { present: 0, absent: 0, total: 0, rate: 0 }
        }

        return {
          present: data.present_count || 0,
          absent: data.absent_count || 0,
          total: data.total_records || 0,
          rate: data.attendance_rate || 0
        }
      } else {
        // Get school-specific today's metrics
        const { data, error } = await supabase
          .from('todays_attendance_metrics')
          .select('*')
          .eq('school_id', schoolId)
          .single()

        if (error || !data) {
          return { present: 0, absent: 0, total: 0, rate: 0 }
        }

        return {
          present: data.present_count || 0,
          absent: data.absent_count || 0,
          total: data.total_records || 0,
          rate: data.attendance_rate || 0
        }
      }
    } catch (error) {
      console.error('Fast today metrics error:', error)
      return { present: 0, absent: 0, total: 0, rate: 0 }
    }
  }

  /**
   * Check if views exist in the database
   */
  async checkViewsExist(): Promise<boolean> {
    try {
      const supabase = createAdminClient()
      
      // Try to query one of the views
      const { error } = await supabase
        .from('grade_attendance_summaries')
        .select('school_id')
        .limit(1)

      return !error
    } catch (error) {
      return false
    }
  }
}

// Export singleton instance
export const fastDashboardAnalytics = new FastDashboardAnalyticsService()