/**
 * @fileoverview Sample Timeline API
 * Provides working timeline data for immediate dashboard testing
 */

import { NextRequest, NextResponse } from 'next/server';

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

/**
 * GET /api/timeline-sample
 * Returns sample timeline data for immediate testing
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || 'all';

    // Generate sample timeline data for the last 10 school days
    const sampleDates = [
      '2024-08-15', '2024-08-16', '2024-08-19', '2024-08-20', '2024-08-21',
      '2024-08-22', '2024-08-23', '2024-08-26', '2024-08-27', '2024-08-28'
    ];

    const grades = [1, 2, 3, 4, 5];
    const timelineData: TimelineDataPoint[] = [];

    let cumulativeAbsencesByGrade: { [key: number]: number } = {};

    for (const date of sampleDates) {
      for (const grade of grades) {
        // Initialize cumulative absences for grade if not exists
        if (!(grade in cumulativeAbsencesByGrade)) {
          cumulativeAbsencesByGrade[grade] = 0;
        }

        // Generate realistic absence patterns
        const baseStudents = 85 + (grade * 10) + Math.floor(Math.random() * 15);
        const seasonalVariation = Math.sin(sampleDates.indexOf(date) * 0.5) * 0.02;
        const absenceRate = 0.12 + seasonalVariation + (Math.random() - 0.5) * 0.03;
        const dailyAbsences = Math.max(1, Math.floor(baseStudents * Math.max(0.05, absenceRate)));
        
        // Update cumulative absences
        cumulativeAbsencesByGrade[grade] += dailyAbsences;

        const dataPoint: TimelineDataPoint = {
          date,
          grade,
          dailyAbsences,
          cumulativeAbsences: cumulativeAbsencesByGrade[grade],
          totalStudents: baseStudents,
          attendanceRate: Math.round(((baseStudents - dailyAbsences) / baseStudents) * 100 * 100) / 100,
          absenceRate: Math.round((dailyAbsences / baseStudents) * 100 * 100) / 100,
          schoolName: schoolId === 'all' ? 'All Schools (District)' : 'Heritage Elementary',
          schoolCode: schoolId === 'all' ? 'ALL' : 'HER'
        };

        timelineData.push(dataPoint);
      }
    }

    return NextResponse.json({
      success: true,
      data: timelineData,
      metadata: {
        schoolFilter: schoolId,
        dateRange: { 
          start: sampleDates[0], 
          end: sampleDates[sampleDates.length - 1] 
        },
        grades,
        totalDataPoints: timelineData.length,
        cacheHit: false,
        sample: true
      }
    });

  } catch (error) {
    console.error('Sample timeline API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}