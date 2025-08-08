import { NextRequest } from 'next/server';
import { createMocks } from 'node-mocks-http';
import { startMockServer, stopMockServer, simulateErrorScenario } from '@/tests/mocks/aeries-mock-server';
import { seedAnonymizedData, cleanupTestData } from '@/tests/fixtures/seed-test-data';

/**
 * Integration Tests for Attendance API Endpoints
 * 
 * Tests the complete flow from API request to database response
 * including Aeries API integration, data validation, and error handling.
 * 
 * Scenarios tested:
 * - Student attendance retrieval by grade level
 * - Date range filtering for attendance records
 * - Real-time attendance updates
 * - Error handling for missing students
 * - Performance with large datasets
 * - FERPA compliance in responses
 */

// Mock the attendance API route handler
import attendanceHandler from '@/app/api/attendance/route';

describe('Attendance API Integration Tests', () => {
  beforeAll(async () => {
    await startMockServer();
    await seedAnonymizedData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopMockServer();
  });

  beforeEach(() => {
    // Reset any error simulations
    jest.clearAllMocks();
  });

  describe('GET /api/attendance - Retrieve Attendance Data', () => {
    it('should retrieve attendance data for all students with no filters', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/attendance',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      // Convert to NextRequest format
      const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
        method: 'GET',
        headers: req.headers as any
      });

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('students');
      expect(Array.isArray(data.students)).toBe(true);
      expect(data.students.length).toBeGreaterThan(0);

      // Verify data structure
      const firstStudent = data.students[0];
      expect(firstStudent).toHaveProperty('student_id');
      expect(firstStudent).toHaveProperty('first_name');
      expect(firstStudent).toHaveProperty('last_name');
      expect(firstStudent).toHaveProperty('grade_level');
      expect(firstStudent).toHaveProperty('attendance_records');
    });

    it('should filter attendance data by grade level', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/attendance?grade=7'), {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.students.every((student: any) => student.grade_level === 7)).toBe(true);
    });

    it('should filter attendance data by date range', async () => {
      const startDate = '2024-11-01';
      const endDate = '2024-11-30';
      
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/attendance?startDate=${startDate}&endDate=${endDate}`),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      
      // Verify all attendance records are within date range
      data.students.forEach((student: any) => {
        student.attendance_records.forEach((record: any) => {
          expect(record.attendance_date).toBeGreaterThanOrEqual(startDate);
          expect(record.attendance_date).toBeLessThanOrEqual(endDate);
        });
      });
    });

    it('should handle requests for specific student', async () => {
      const studentId = '123456';
      
      const request = new NextRequest(
        new URL(`http://localhost:3000/api/attendance?studentId=${studentId}`),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.students).toHaveLength(1);
      expect(data.students[0].student_id).toBe(studentId);
    });

    it('should return 404 for non-existent student', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/attendance?studentId=999999'),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Student not found');
    });
  });

  describe('Attendance Calculations and Business Logic', () => {
    it('should correctly calculate attendance percentages', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/attendance?includeCalculations=true'),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      const data = await response.json();

      data.students.forEach((student: any) => {
        expect(student).toHaveProperty('overall_attendance_percentage');
        expect(typeof student.overall_attendance_percentage).toBe('number');
        expect(student.overall_attendance_percentage).toBeGreaterThanOrEqual(0);
        expect(student.overall_attendance_percentage).toBeLessThanOrEqual(100);

        // Check daily calculations
        student.attendance_records.forEach((record: any) => {
          expect(record).toHaveProperty('daily_attendance_percentage');
          expect(record.daily_attendance_percentage).toBeGreaterThanOrEqual(0);
          expect(record.daily_attendance_percentage).toBeLessThanOrEqual(100);
        });
      });
    });

    it('should identify students needing interventions', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/attendance?includeInterventions=true'),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      const data = await response.json();

      // Should include intervention flags
      const studentsNeedingIntervention = data.students.filter(
        (student: any) => student.needs_intervention === true
      );

      if (studentsNeedingIntervention.length > 0) {
        studentsNeedingIntervention.forEach((student: any) => {
          expect(student).toHaveProperty('intervention_level');
          expect(['TRUANCY_LETTER', 'PARENT_CONFERENCE', 'SART', 'SARB'])
            .toContain(student.intervention_level);
        });
      }
    });

    it('should track full-day absences correctly', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/attendance?includeFullDayAbsences=true'),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      const data = await response.json();

      data.students.forEach((student: any) => {
        const fullDayAbsences = student.attendance_records.filter(
          (record: any) => record.is_full_day_absent === true
        );

        expect(student).toHaveProperty('total_full_day_absences');
        expect(student.total_full_day_absences).toBe(fullDayAbsences.length);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large grade-level requests efficiently', async () => {
      const startTime = Date.now();
      
      const request = new NextRequest(
        new URL('http://localhost:3000/api/attendance?grade=7&limit=100'),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      
      // Should respond within 2 seconds for up to 100 students
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(2000);
      
      const data = await response.json();
      expect(data.students.length).toBeLessThanOrEqual(100);
    });

    it('should implement pagination for large datasets', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/attendance?page=1&limit=10'),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      const data = await response.json();
      
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('totalPages');
      
      expect(data.students.length).toBeLessThanOrEqual(10);
    });

    it('should cache frequently requested data', async () => {
      const url = 'http://localhost:3000/api/attendance?grade=6';
      const request1 = new NextRequest(url, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      // First request
      const startTime1 = Date.now();
      const response1 = await attendanceHandler.GET(request1);
      const endTime1 = Date.now();

      expect(response1.status).toBe(200);

      // Second identical request (should be faster due to caching)
      const request2 = new NextRequest(url, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const startTime2 = Date.now();
      const response2 = await attendanceHandler.GET(request2);
      const endTime2 = Date.now();

      expect(response2.status).toBe(200);

      // Second request should be faster (cached)
      const firstRequestTime = endTime1 - startTime1;
      const secondRequestTime = endTime2 - startTime2;
      
      // Allow some variance but second should generally be faster
      expect(secondRequestTime).toBeLessThanOrEqual(firstRequestTime * 1.5);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Aeries API timeout gracefully', async () => {
      simulateErrorScenario('timeout');

      const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const response = await attendanceHandler.GET(request);
      
      expect([503, 408]).toContain(response.status);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('timeout');
    });

    it('should handle Aeries API rate limiting', async () => {
      simulateErrorScenario('ratelimit');

      const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(429);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('retryAfter');
    });

    it('should handle database connection failures', async () => {
      // Mock database connection failure
      const originalEnv = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'invalid-connection-string';

      const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('database');

      // Restore original environment
      process.env.DATABASE_URL = originalEnv;
    });

    it('should validate request parameters', async () => {
      const invalidRequests = [
        'http://localhost:3000/api/attendance?grade=invalid',
        'http://localhost:3000/api/attendance?startDate=invalid-date',
        'http://localhost:3000/api/attendance?limit=-1',
        'http://localhost:3000/api/attendance?page=0'
      ];

      for (const url of invalidRequests) {
        const request = new NextRequest(url, {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        });

        const response = await attendanceHandler.GET(request);
        
        expect(response.status).toBe(400);
        
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Invalid');
      }
    });
  });

  describe('FERPA Compliance and Security', () => {
    it('should require authentication for all requests', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
        method: 'GET'
        // No Authorization header
      });

      const response = await attendanceHandler.GET(request);
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Unauthorized');
    });

    it('should not expose sensitive student information', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const response = await attendanceHandler.GET(request);
      const data = await response.json();

      // Should not include sensitive fields
      data.students.forEach((student: any) => {
        expect(student).not.toHaveProperty('ssn');
        expect(student).not.toHaveProperty('home_address');
        expect(student).not.toHaveProperty('parent_phone');
        expect(student).not.toHaveProperty('medical_information');
        
        // Email should be school email only
        if (student.email) {
          expect(student.email).toMatch(/@.*\.k12\.ca\.us$/);
        }
      });
    });

    it('should sanitize response data', async () => {
      const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const response = await attendanceHandler.GET(request);
      const data = await response.json();

      // Check that all string fields are properly sanitized
      data.students.forEach((student: any) => {
        if (student.first_name) {
          expect(student.first_name).not.toMatch(/<script>/i);
          expect(student.first_name).not.toMatch(/javascript:/i);
        }
        
        if (student.last_name) {
          expect(student.last_name).not.toMatch(/<script>/i);
          expect(student.last_name).not.toMatch(/javascript:/i);
        }
      });
    });

    it('should implement role-based access control', async () => {
      const roles = [
        { token: 'teacher-token', role: 'teacher' },
        { token: 'ap-token', role: 'ap_administrator' },
        { token: 'counselor-token', role: 'counselor' }
      ];

      for (const { token, role } of roles) {
        const request = new NextRequest(new URL('http://localhost:3000/api/attendance'), {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const response = await attendanceHandler.GET(request);
        
        if (role === 'teacher') {
          // Teachers should only see their assigned students
          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data).toHaveProperty('students');
          // Should be filtered based on teacher assignments
        } else if (role === 'ap_administrator') {
          // APs should see all students
          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.students.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        new NextRequest(new URL(`http://localhost:3000/api/attendance?grade=${6 + (i % 3)}`), {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => attendanceHandler.GET(request))
      );
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle 10 concurrent requests within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // 5 seconds
    });

    it('should generate accurate truancy reports', async () => {
      const request = new NextRequest(
        new URL('http://localhost:3000/api/attendance?report=truancy&threshold=10'),
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer valid-token' }
        }
      );

      const response = await attendanceHandler.GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('truancy_report');
      expect(data.truancy_report).toHaveProperty('students_at_risk');
      expect(data.truancy_report).toHaveProperty('total_students');
      expect(data.truancy_report).toHaveProperty('threshold_used');

      // Students at risk should all meet the threshold
      data.truancy_report.students_at_risk.forEach((student: any) => {
        expect(student.total_absences).toBeGreaterThanOrEqual(10);
        expect(student).toHaveProperty('recommended_intervention');
      });
    });

    it('should support export formats for reporting', async () => {
      const formats = ['json', 'csv'];

      for (const format of formats) {
        const request = new NextRequest(
          new URL(`http://localhost:3000/api/attendance?format=${format}&grade=7`),
          {
            method: 'GET',
            headers: { 'Authorization': 'Bearer valid-token' }
          }
        );

        const response = await attendanceHandler.GET(request);
        
        expect(response.status).toBe(200);

        if (format === 'csv') {
          const contentType = response.headers.get('content-type');
          expect(contentType).toContain('text/csv');
        } else {
          const contentType = response.headers.get('content-type');
          expect(contentType).toContain('application/json');
        }
      }
    });
  });
});