/**
 * @fileoverview Timeline API endpoint for attendance data
 * Provides cumulative absence data over time for timeline visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TimelineDataPoint {
  date: string;
  grade: number;
  dailyAbsences: number;
  cumulativeAbsences: number;
  totalStudents: number;
  attendanceRate: number;
  absenceRate: number;
  schoolName?: string;
  schoolCode?: string;
}

export interface TimelineResponse {
  success: boolean;
  data: TimelineDataPoint[];
  metadata: {
    schoolFilter: string;
    dateRange: {
      start: string;
      end: string;
    };
    grades: number[];
    totalDataPoints: number;
    cacheHit: boolean;
  };
  error?: string;
}

/**
 * GET /api/attendance/timeline
 * Query parameters:
 * - schoolId: 'all' or specific school ID
 * - startDate: YYYY-MM-DD format
 * - endDate: YYYY-MM-DD format
 * - grades: comma-separated grade levels (optional)
 * - schoolYear: YYYY-YYYY format (optional, defaults to current)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const gradesParam = searchParams.get('grades');
    const schoolYear = searchParams.get('schoolYear') || getCurrentSchoolYear();

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate are required'
      }, { status: 400 });
    }

    // Parse grades filter
    const grades = gradesParam ? 
      gradesParam.split(',').map(g => parseInt(g.trim())).filter(g => !isNaN(g)) : 
      [];

    // Generate cache key
    const cacheKey = generateCacheKey(schoolId, startDate, endDate, grades, schoolYear);

    // Try to get from cache first
    const cachedData = await getCachedTimelineData(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        metadata: {
          schoolFilter: schoolId,
          dateRange: { start: startDate, end: endDate },
          grades,
          totalDataPoints: cachedData.length,
          cacheHit: true
        }
      });
    }

    // Fetch fresh data
    const timelineData = await fetchTimelineData(schoolId, startDate, endDate, grades, schoolYear);

    // Cache the results
    await cacheTimelineData(cacheKey, timelineData, schoolId, grades, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: timelineData,
      metadata: {
        schoolFilter: schoolId,
        dateRange: { start: startDate, end: endDate },
        grades: grades.length > 0 ? grades : extractGradesFromData(timelineData),
        totalDataPoints: timelineData.length,
        cacheHit: false
      }
    });

  } catch (error) {
    console.error('Timeline API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Fetch timeline data from database (updated for revised schema)
 */
async function fetchTimelineData(
  schoolId: string, 
  startDate: string, 
  endDate: string, 
  grades: number[], 
  schoolYear: string
): Promise<TimelineDataPoint[]> {
  console.log(`Fetching timeline data: schoolId=${schoolId}, startDate=${startDate}, endDate=${endDate}, grades=${grades.join(',')}`);
  
  if (schoolId === 'all') {
    // Use materialized view for district-wide data with better performance
    let query = supabase
      .from('district_timeline_summary')
      .select(`
        summary_date,
        grade_level,
        daily_absences,
        cumulative_absences,
        total_students,
        attendance_rate,
        absence_rate
      `)
      .eq('school_year', schoolYear)
      .gte('summary_date', startDate)
      .lte('summary_date', endDate);

    // Apply grade filter if specified
    if (grades.length > 0) {
      query = query.in('grade_level', grades);
    }

    // Order by date and grade
    query = query.order('summary_date', { ascending: true })
                 .order('grade_level', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('District timeline view error:', error);
      // Fallback to manual aggregation
      return fetchDistrictDataManually(startDate, endDate, grades, schoolYear);
    }

    if (!data || data.length === 0) {
      console.log('No district data found, falling back to manual aggregation');
      return fetchDistrictDataManually(startDate, endDate, grades, schoolYear);
    }

    // Transform materialized view result to timeline format
    return data.map(row => ({
      date: row.summary_date,
      grade: row.grade_level,
      dailyAbsences: row.daily_absences || 0,
      cumulativeAbsences: row.cumulative_absences || 0,
      totalStudents: row.total_students || 0,
      attendanceRate: row.attendance_rate || 100,
      absenceRate: row.absence_rate || 0,
      schoolName: 'All Schools (District)',
      schoolCode: 'ALL'
    }));

  } else {
    // School-specific data with limit for performance
    const query = supabase
      .from('grade_attendance_timeline_summary')
      .select(`
        grade_level,
        summary_date,
        daily_absences,
        cumulative_absences,
        total_students,
        attendance_rate,
        absence_rate
      `)
      .eq('school_id', schoolId)
      .eq('school_year', schoolYear)
      .gte('summary_date', startDate)
      .lte('summary_date', endDate)
      .eq('is_school_day', true)
      .limit(500); // Limit to prevent large responses

    // Apply grade filter if specified
    if (grades.length > 0) {
      query.in('grade_level', grades);
    }

    // Order by date and grade
    query.order('summary_date', { ascending: true })
         .order('grade_level', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch timeline data: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get school information for specific school
    const { data: school } = await supabase
      .from('schools')
      .select('school_name, school_code')
      .eq('id', schoolId)
      .single();

    // Transform data to timeline format
    return data.map(row => ({
      date: row.summary_date,
      grade: row.grade_level,
      dailyAbsences: row.daily_absences || 0,
      cumulativeAbsences: row.cumulative_absences || 0,
      totalStudents: row.total_students || 0,
      attendanceRate: row.attendance_rate || 100,
      absenceRate: row.absence_rate || 0,
      schoolName: school?.school_name || 'Unknown School',
      schoolCode: school?.school_code || 'UNKNOWN'
    }));
  }
}

/**
 * Fallback manual aggregation for district-wide data with better performance
 */
async function fetchDistrictDataManually(
  startDate: string, 
  endDate: string, 
  grades: number[], 
  schoolYear: string
): Promise<TimelineDataPoint[]> {
  console.log('Using manual district aggregation fallback');
  
  let query = supabase
    .from('grade_attendance_timeline_summary')
    .select(`
      grade_level,
      summary_date,
      daily_absences,
      cumulative_absences,
      total_students
    `)
    .eq('school_year', schoolYear)
    .gte('summary_date', startDate)
    .lte('summary_date', endDate)
    .eq('is_school_day', true)
    .limit(1000); // Limit for performance

  // Apply grade filter if specified
  if (grades.length > 0) {
    query = query.in('grade_level', grades);
  }

  // Order by date and grade for consistent aggregation
  query = query.order('summary_date', { ascending: true })
                .order('grade_level', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Manual aggregation error:', error);
    throw new Error(`Failed to fetch manual district data: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Efficient aggregation using Map
  const aggregatedMap = new Map();
  
  for (const row of data) {
    const key = `${row.summary_date}-${row.grade_level}`;
    
    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        date: row.summary_date,
        grade: row.grade_level,
        dailyAbsences: 0,
        cumulativeAbsences: 0,
        totalStudents: 0,
        totalPresent: 0,
        totalAbsent: 0
      });
    }
    
    const agg = aggregatedMap.get(key);
    agg.dailyAbsences += row.daily_absences || 0;
    agg.cumulativeAbsences += row.cumulative_absences || 0;
    agg.totalStudents += row.total_students || 0;
    agg.totalPresent += (row.total_students - (row.daily_absences || 0)) || 0;
    agg.totalAbsent += row.daily_absences || 0;
  }
  
  // Transform aggregated data
  return Array.from(aggregatedMap.values()).map(agg => ({
    date: agg.date,
    grade: agg.grade,
    dailyAbsences: agg.dailyAbsences,
    cumulativeAbsences: agg.cumulativeAbsences,
    totalStudents: agg.totalStudents,
    attendanceRate: agg.totalStudents > 0 ? Math.round((agg.totalPresent / agg.totalStudents) * 100 * 100) / 100 : 100,
    absenceRate: agg.totalStudents > 0 ? Math.round((agg.totalAbsent / agg.totalStudents) * 100 * 100) / 100 : 0,
    schoolName: 'All Schools (District)',
    schoolCode: 'ALL'
  }));
}

/**
 * Get cached timeline data
 */
async function getCachedTimelineData(cacheKey: string): Promise<TimelineDataPoint[] | null> {
  try {
    const { data, error } = await supabase
      .from('attendance_timeline_cache')
      .select('timeline_data, expires_at')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    return data.timeline_data as TimelineDataPoint[];
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null;
  }
}

/**
 * Cache timeline data
 */
async function cacheTimelineData(
  cacheKey: string, 
  timelineData: TimelineDataPoint[], 
  schoolFilter: string,
  grades: number[],
  startDate: string,
  endDate: string
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Cache for 1 hour

    await supabase
      .from('attendance_timeline_cache')
      .upsert({
        cache_key: cacheKey,
        school_filter: schoolFilter,
        grade_levels: grades.length > 0 ? grades : extractGradesFromData(timelineData),
        date_range: `[${startDate},${endDate}]`,
        timeline_data: timelineData,
        metadata: {
          dataPoints: timelineData.length,
          generatedAt: new Date().toISOString()
        },
        expires_at: expiresAt.toISOString()
      });
  } catch (error) {
    console.error('Cache storage error:', error);
    // Don't throw - caching failure shouldn't break the API
  }
}

/**
 * Generate cache key for timeline data
 */
function generateCacheKey(
  schoolId: string, 
  startDate: string, 
  endDate: string, 
  grades: number[], 
  schoolYear: string
): string {
  const gradesSorted = grades.length > 0 ? grades.sort().join(',') : 'all';
  return `timeline:${schoolId}:${startDate}:${endDate}:${gradesSorted}:${schoolYear}`;
}

/**
 * Extract unique grades from timeline data
 */
function extractGradesFromData(data: TimelineDataPoint[]): number[] {
  const grades = new Set(data.map(d => d.grade));
  return Array.from(grades).sort();
}

/**
 * Get current school year in YYYY-YYYY format
 */
function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() is 0-indexed
  
  // School year runs August to June
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * POST /api/attendance/timeline - Refresh timeline data
 * Force refresh of timeline summaries for specified date range
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, schoolYear } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate are required'
      }, { status: 400 });
    }

    const targetSchoolYear = schoolYear || getCurrentSchoolYear();

    // Clear existing cache for this date range
    await supabase
      .from('attendance_timeline_cache')
      .delete()
      .overlaps('date_range', `[${startDate},${endDate}]`);

    // Refresh summary data using revised function names
    let processDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    let processedDays = 0;

    while (processDate <= endDateObj) {
      const dateStr = processDate.toISOString().split('T')[0];
      
      // Skip weekends (basic school day filter)
      if (processDate.getDay() !== 0 && processDate.getDay() !== 6) {
        // Call stored procedures to refresh summaries (updated function names)
        await supabase.rpc('populate_grade_timeline_summary', {
          p_summary_date: dateStr,
          p_school_year: targetSchoolYear
        });

        await supabase.rpc('refresh_district_timeline_summary', {
          p_summary_date: dateStr,
          p_school_year: targetSchoolYear
        });

        processedDays++;
      }

      processDate.setDate(processDate.getDate() + 1);
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed timeline data for ${processedDays} school days`,
      dateRange: { start: startDate, end: endDate },
      schoolYear: targetSchoolYear
    });

  } catch (error) {
    console.error('Timeline refresh error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh timeline data'
    }, { status: 500 });
  }
}