'use client';

import { DashboardLayout } from '@/presentation/components/dashboard-layout';
import { AttendanceCard } from '@/presentation/components/AttendanceCard';

export default function DashboardPage() {
  // Mock user data for development
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@romolandschool.edu',
    role: 'teacher',
    school: 'Romoland Elementary'
  };

  // Mock grade data based on AP Romoland requirements
  const gradeData = [
    {
      grade: 'Kindergarten',
      totalStudents: 180,
      attendanceRate: 94.2,
      chronicAbsentees: 15,
      tier1: 150,
      tier2: 15,
      tier3: 15,
      trend: 'stable' as const,
      riskLevel: 'low' as const,
      lastUpdated: '2025-07-29T10:30:00Z',
      monthlyTrend: [
        { month: 'Sep', rate: 93.5 },
        { month: 'Oct', rate: 94.1 },
        { month: 'Nov', rate: 94.2 }
      ]
    },
    {
      grade: 'Grade 1',
      totalStudents: 165,
      attendanceRate: 93.8,
      chronicAbsentees: 12,
      tier1: 140,
      tier2: 13,
      tier3: 12,
      trend: 'up' as const,
      riskLevel: 'low' as const,
      lastUpdated: '2025-07-29T10:30:00Z',
      monthlyTrend: [
        { month: 'Sep', rate: 93.2 },
        { month: 'Oct', rate: 93.5 },
        { month: 'Nov', rate: 93.8 }
      ]
    },
    {
      grade: 'Grade 2',
      totalStudents: 158,
      attendanceRate: 95.1,
      chronicAbsentees: 10,
      tier1: 142,
      tier2: 6,
      tier3: 10,
      trend: 'up' as const,
      riskLevel: 'low' as const,
      lastUpdated: '2025-07-29T10:30:00Z',
      monthlyTrend: [
        { month: 'Sep', rate: 94.8 },
        { month: 'Oct', rate: 95.0 },
        { month: 'Nov', rate: 95.1 }
      ]
    },
    {
      grade: 'Grade 3',
      totalStudents: 172,
      attendanceRate: 92.9,
      chronicAbsentees: 14,
      tier1: 147,
      tier2: 11,
      tier3: 14,
      trend: 'stable' as const,
      riskLevel: 'medium' as const,
      lastUpdated: '2025-07-29T10:30:00Z',
      monthlyTrend: [
        { month: 'Sep', rate: 92.8 },
        { month: 'Oct', rate: 92.9 },
        { month: 'Nov', rate: 92.9 }
      ]
    },
    {
      grade: 'Grade 4',
      totalStudents: 168,
      attendanceRate: 94.6,
      chronicAbsentees: 13,
      tier1: 148,
      tier2: 7,
      tier3: 13,
      trend: 'up' as const,
      riskLevel: 'low' as const,
      lastUpdated: '2025-07-29T10:30:00Z',
      monthlyTrend: [
        { month: 'Sep', rate: 94.2 },
        { month: 'Oct', rate: 94.4 },
        { month: 'Nov', rate: 94.6 }
      ]
    },
    {
      grade: 'Grade 5',
      totalStudents: 155,
      attendanceRate: 93.3,
      chronicAbsentees: 11,
      tier1: 133,
      tier2: 11,
      tier3: 11,
      trend: 'down' as const,
      riskLevel: 'medium' as const,
      lastUpdated: '2025-07-29T10:30:00Z',
      monthlyTrend: [
        { month: 'Sep', rate: 93.8 },
        { month: 'Oct', rate: 93.5 },
        { month: 'Nov', rate: 93.3 }
      ]
    }
  ];

  return (
    <DashboardLayout user={mockUser}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading text-foreground">
            Attendance Dashboard
          </h1>
          <div className="text-sm text-muted-foreground">
            Romoland School District
          </div>
        </div>
        
        {/* Grade Level Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gradeData.map((grade) => (
            <AttendanceCard
              key={grade.grade}
              gradeData={grade}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}