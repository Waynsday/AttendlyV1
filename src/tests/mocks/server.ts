/**
 * @file server.ts
 * @description MSW (Mock Service Worker) server setup for testing
 * Provides comprehensive API mocking for all endpoints used in tests
 */

import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock data generators based on References/ CSV structure
const generateStudentData = (count: number = 100) => {
  return Array.from({ length: count }, (_, i) => {
    const id = `STU${String(i + 1).padStart(4, '0')}`;
    const grade = ['K', '1', '2', '3', '4', '5'][i % 6];
    const attendanceRate = 85 + Math.random() * 15;
    const totalAbsences = Math.floor((100 - attendanceRate) * 1.8);
    
    let tier: 1 | 2 | 3;
    if (totalAbsences <= 2) tier = 1;
    else if (totalAbsences <= 9) tier = 2;
    else tier = 3;

    return {
      id,
      firstName: `Student${i + 1}`,
      lastName: `Test${Math.floor(i / 25) + 1}`,
      grade,
      teacherName: `Teacher${Math.floor(i / 30) + 1}`,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      totalAbsences,
      chronicAbsences: tier === 3 ? Math.floor(totalAbsences * 0.7) : 0,
      tier,
      lastAbsenceDate: tier > 1 ? '2025-01-14' : null,
      interventions: tier === 3 ? ['daily-checkin'] : [],
      riskFactors: tier === 3 ? ['chronic-pattern'] : [],
      iReadyScores: {
        currentYear: { ela: 400 + i * 2, math: 380 + i * 2.5 },
        previousYear: { ela: 380 + i * 1.8, math: 360 + i * 2.2 },
        twoYearsAgo: i > 50 ? null : { ela: 360 + i * 1.5, math: 340 + i * 2 }
      }
    };
  });
};

const mockStudents = generateStudentData(1250);

// Request handlers
const handlers = [
  // Dashboard API
  http.get('/api/dashboard', () => {
    return HttpResponse.json({
        schoolMetrics: {
          totalStudents: 1250,
          overallAttendanceRate: 94.2,
          chronicAbsentees: 125,
          tier1Count: 850,
          tier2Count: 275,
          tier3Count: 125,
          lastUpdated: '2025-01-15T10:30:00Z'
        },
        gradeBreakdown: [
          {
            grade: 'K',
            totalStudents: 125,
            attendanceRate: 95.2,
            chronicAbsentees: 8,
            tier1: 98,
            tier2: 19,
            tier3: 8,
            trend: 'stable',
            riskLevel: 'low'
          },
          {
            grade: '1',
            totalStudents: 130,
            attendanceRate: 94.8,
            chronicAbsentees: 12,
            tier1: 95,
            tier2: 23,
            tier3: 12,
            trend: 'improving',
            riskLevel: 'low'
          },
          {
            grade: '5',
            totalStudents: 95,
            attendanceRate: 89.2,
            chronicAbsentees: 25,
            tier1: 45,
            tier2: 25,
            tier3: 25,
            trend: 'declining',
            riskLevel: 'high'
          }
        ],
        alerts: [
          {
            id: 'ALERT001',
            type: 'chronic_absence_spike',
            grade: '5',
            message: 'Grade 5 chronic absence rate increased by 15% this month',
            severity: 'high',
            timestamp: '2025-01-15T09:00:00Z'
          }
        ]
      });
  }),

  // Students list API with filtering, sorting, pagination
  http.get('/api/students', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const grade = url.searchParams.get('grade');
    const tier = url.searchParams.get('tier');
    const search = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sortBy');
    const sortOrder = url.searchParams.get('sortOrder') || 'asc';

    let filteredStudents = [...mockStudents];

    // Apply filters
    if (grade && grade !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === grade);
    }
    if (tier && tier !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.tier === parseInt(tier));
    }
    if (search) {
      filteredStudents = filteredStudents.filter(s => 
        s.firstName.toLowerCase().includes(search.toLowerCase()) ||
        s.lastName.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply sorting
    if (sortBy) {
      filteredStudents.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'name':
            aValue = `${a.lastName}, ${a.firstName}`;
            bValue = `${b.lastName}, ${b.firstName}`;
            break;
          case 'attendanceRate':
            aValue = a.attendanceRate;
            bValue = b.attendanceRate;
            break;
          case 'grade':
            aValue = a.grade === 'K' ? 0 : parseInt(a.grade);
            bValue = b.grade === 'K' ? 0 : parseInt(b.grade);
            break;
          default:
            aValue = a[sortBy as keyof typeof a];
            bValue = b[sortBy as keyof typeof b];
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedStudents = filteredStudents.slice(startIndex, startIndex + limit);

    return HttpResponse.json({
      data: paginatedStudents,
      pagination: {
        page,
        limit,
        total: filteredStudents.length,
        totalPages: Math.ceil(filteredStudents.length / limit)
      },
      filters: {
        grade: grade || null,
        tier: tier ? parseInt(tier) : null,
        search: search || null
      },
      summary: {
        totalStudents: filteredStudents.length,
        tier1Count: filteredStudents.filter(s => s.tier === 1).length,
        tier2Count: filteredStudents.filter(s => s.tier === 2).length,
        tier3Count: filteredStudents.filter(s => s.tier === 3).length,
        averageAttendanceRate: filteredStudents.reduce((sum, s) => sum + s.attendanceRate, 0) / filteredStudents.length
      }
    });
  }),

  // Individual student details API
  http.get('/api/students/:id', ({ params }) => {
    const { id } = params;
    const student = mockStudents.find(s => s.id === id);

    if (!student) {
      return HttpResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Extended student details
    const detailedStudent = {
      ...student,
      attendanceHistory: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: Math.random() > 0.1 ? 'present' : 'absent',
        notes: Math.random() > 0.8 ? 'Sick' : null
      })),
      conferences: [
        {
          id: 'CONF001',
          date: '2024-12-15',
          type: 'parent-teacher',
          attendees: ['Parent: Jane Doe', `Teacher: ${student.teacherName}`],
          notes: 'Discussed attendance concerns',
          followUpRequired: true
        }
      ],
      parentContacts: [
        {
          id: 'CONTACT001',
          date: '2025-01-10',
          method: 'phone',
          initiatedBy: 'teacher',
          topic: 'attendance',
          outcome: 'parent aware, will monitor'
        }
      ]
    };

    // Simulate API delay
    return new Promise(resolve => 
      setTimeout(() => resolve(HttpResponse.json({ data: detailedStudent })), 75)
    );
  }),

  // Attendance by grade API
  http.get('/api/attendance/by-grade', ({ request }) => {
    const url = new URL(request.url);
    const grade = url.searchParams.get('grade');

    const gradeData = [
      {
        grade: 'K',
        totalStudents: 125,
        chronicallyCAbsent: 8,
        tier1Students: 98,
        tier2Students: 19,
        tier3Students: 8,
        averageAttendanceRate: 95.2,
        lastUpdated: '2025-01-15T10:30:00Z'
      },
      {
        grade: '1',
        totalStudents: 130,
        chronicallyCAbsent: 12,
        tier1Students: 95,
        tier2Students: 23,
        tier3Students: 12,
        averageAttendanceRate: 94.8,
        lastUpdated: '2025-01-15T10:30:00Z'
      },
      {
        grade: '5',
        totalStudents: 95,
        chronicallyCAbsent: 25,
        tier1Students: 45,
        tier2Students: 25,
        tier3Students: 25,
        averageAttendanceRate: 89.2,
        lastUpdated: '2025-01-15T10:30:00Z'
      }
    ];

    const filteredData = grade ? gradeData.filter(g => g.grade === grade) : gradeData;

    return res(
      ctx.delay(100),
      ctx.json({
        data: filteredData,
        meta: {
          totalGrades: gradeData.length,
          schoolwideAverage: 94.1,
          lastSync: '2025-01-15T10:30:00Z'
        }
      })
    );
  }),

  // Health check API
  http.get('/api/health', ({ request }) => {
    return res(
      ctx.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      })
    );
  }),

  // Error simulation handlers
  http.get('/api/error/500', ({ request }) => {
    return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
  }),

  http.get('/api/error/timeout', ({ request }) => {
    return res(ctx.delay(10000), ctx.json({ data: 'This will timeout' }));
  }),

  http.get('/api/error/network', ({ request }) => {
    return res.networkError('Network connection failed');
  })
];

// Setup server
export const server = setupServer(...handlers);

// Utility functions for test customization
export const overrideHandler = (path: string, handler: any) => {
  server.use(handler);
};

export const resetHandlers = () => {
  server.resetHandlers(...handlers);
};

export const generateMockStudents = generateStudentData;

// Authentication mock handlers
export const authHandlers = [
  http.post('/api/auth/login', ({ request }) => {
    return res(
      ctx.json({
        user: {
          id: 'USER001',
          name: 'Test Teacher',
          email: 'teacher@school.edu',
          role: 'teacher'
        },
        token: 'mock-jwt-token'
      })
    );
  }),

  http.get('/api/auth/me', ({ request }) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.includes('mock-jwt-token')) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }

    return res(
      ctx.json({
        user: {
          id: 'USER001',
          name: 'Test Teacher',
          email: 'teacher@school.edu',
          role: 'teacher'
        }
      })
    );
  })
];

// CSV import simulation handlers
export const csvImportHandlers = [
  http.post('/api/import/attendance', ({ request }) => {
    return res(
      ctx.delay(2000), // Simulate processing time
      ctx.json({
        success: true,
        processed: 1250,
        errors: [],
        summary: {
          newStudents: 25,
          updatedRecords: 1225,
          tier1: 850,
          tier2: 275,
          tier3: 125
        }
      })
    );
  }),

  http.post('/api/import/iready', ({ request }) => {
    return res(
      ctx.delay(1500),
      ctx.json({
        success: true,
        processed: 1200,
        errors: [
          { row: 45, error: 'Invalid score format' },
          { row: 123, error: 'Missing student ID' }
        ],
        summary: {
          elaScores: 600,
          mathScores: 600,
          invalidRecords: 2
        }
      })
    );
  })
];