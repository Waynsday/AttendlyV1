/**
 * @file server-simple.ts
 * @description Simplified MSW server setup for MSW v2 compatibility
 */

// MSW v2 imports
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Simple mock data
const mockDashboardData = {
  schoolMetrics: {
    totalStudents: 1250,
    overallAttendanceRate: 94.2,
    chronicAbsentees: 125,
    lastUpdated: '2025-01-15T10:30:00Z'
  }
};

// Basic handlers
const handlers = [
  http.get('/api/dashboard', () => {
    return HttpResponse.json(mockDashboardData);
  }),

  http.get('/api/students', () => {
    return HttpResponse.json({
      data: [],
      pagination: { page: 1, limit: 100, total: 0 }
    });
  }),

  http.get('/api/students/:id', () => {
    return HttpResponse.json({
      data: {
        id: 'STU001',
        firstName: 'John',
        lastName: 'Doe',
        grade: 'K'
      }
    });
  })
];

export const server = setupServer(...handlers);