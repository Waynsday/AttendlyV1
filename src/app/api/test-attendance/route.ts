/**
 * Simple test endpoint for attendance data
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('✅ Test attendance endpoint hit')
  
  const url = new URL(request.url)
  const schoolId = url.searchParams.get('schoolId') || 'all'
  
  const testData = [
    {
      grade: 'Grade 6',
      schoolName: schoolId === 'all' ? 'District-wide' : 'Test School',
      totalStudents: 150,
      attendanceRate: 88.5,
      chronicAbsentees: 18,
      tier1: 120,
      tier2: 12,
      tier3: 18,
      trend: 'stable',
      riskLevel: 'medium',
      lastUpdated: new Date().toISOString(),
      monthlyTrend: []
    },
    {
      grade: 'Grade 7',
      schoolName: schoolId === 'all' ? 'District-wide' : 'Test School',
      totalStudents: 142,
      attendanceRate: 86.2,
      chronicAbsentees: 20,
      tier1: 110,
      tier2: 12,
      tier3: 20,
      trend: 'down',
      riskLevel: 'medium',
      lastUpdated: new Date().toISOString(),
      monthlyTrend: []
    }
  ]

  return NextResponse.json({
    success: true,
    data: testData,
    meta: {
      schoolId,
      schoolName: schoolId === 'all' ? 'District-wide' : 'Test School',
      timestamp: new Date().toISOString(),
      test: true
    }
  })
}