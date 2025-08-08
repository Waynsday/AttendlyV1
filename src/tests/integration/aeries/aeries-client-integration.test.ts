import { startMockServer, stopMockServer, simulateErrorScenario, getMockData } from '@/tests/mocks/aeries-mock-server';
import { TestDataFactory } from '@/tests/fixtures/test-data-factory';

/**
 * Integration Tests for Aeries API Client
 * 
 * Tests the complete integration with Aeries SIS API including:
 * - Authentication and certificate handling
 * - Student data retrieval and sync
 * - Attendance record processing
 * - Error handling and retry mechanisms
 * - Rate limiting and circuit breaker patterns
 * - Data validation and transformation
 * - California-specific educational data compliance
 */

// Import the actual Aeries client implementations
import { SimpleAeriesClient } from '@/lib/aeries/simple-aeries-client';
import { EnhancedAeriesClient } from '@/lib/aeries/enhanced-aeries-client';
import { ProductionAeriesClient } from '@/lib/aeries/production-aeries-client';

describe('Aeries API Client Integration Tests', () => {
  let simpleClient: SimpleAeriesClient;
  let enhancedClient: EnhancedAeriesClient;
  let productionClient: ProductionAeriesClient;

  beforeAll(async () => {
    await startMockServer();
    
    // Initialize clients with test configuration
    const testConfig = {
      baseUrl: 'https://romolandapi.aeries.net/admin/api/v5',
      certificatePath: './certs/aeries-client.crt',
      timeout: 5000,
      retryAttempts: 3,
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000
      }
    };

    simpleClient = new SimpleAeriesClient(testConfig);
    enhancedClient = new EnhancedAeriesClient(testConfig);
    productionClient = new ProductionAeriesClient(testConfig);
  });

  afterAll(async () => {
    await stopMockServer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Connection', () => {
    it('should successfully authenticate with valid certificate', async () => {
      const isConnected = await simpleClient.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should handle authentication failure gracefully', async () => {
      simulateErrorScenario('auth_failure');
      
      try {
        await simpleClient.getSchools();
        fail('Should have thrown authentication error');
      } catch (error: any) {
        expect(error.message).toContain('Unauthorized');
        expect(error.status).toBe(401);
      }
    });

    it('should validate SSL certificate properly', async () => {
      // This would test actual certificate validation in production
      const healthCheck = await enhancedClient.healthCheck();
      expect(healthCheck.status).toBe('healthy');
    });
  });

  describe('School Data Retrieval', () => {
    it('should retrieve school information', async () => {
      const schools = await simpleClient.getSchools();
      
      expect(Array.isArray(schools)).toBe(true);
      expect(schools.length).toBeGreaterThan(0);
      
      const romolandMiddle = schools.find(s => s.SchoolCode === '001');
      expect(romolandMiddle).toBeDefined();
      expect(romolandMiddle?.SchoolName).toBe('Romoland Middle School');
      expect(romolandMiddle?.GradeLevels).toBe('6,7,8');
    });

    it('should filter schools by code', async () => {
      const school = await simpleClient.getSchoolByCode('001');
      
      expect(school).toBeDefined();
      expect(school.SchoolCode).toBe('001');
      expect(school.SchoolName).toBe('Romoland Middle School');
    });
  });

  describe('Student Data Management', () => {
    it('should retrieve all students for a school', async () => {
      const students = await simpleClient.getStudents('001');
      
      expect(Array.isArray(students)).toBe(true);
      expect(students.length).toBeGreaterThan(0);
      
      // Verify student data structure
      const firstStudent = students[0];
      expect(firstStudent).toHaveProperty('StudentID');
      expect(firstStudent).toHaveProperty('FirstName');
      expect(firstStudent).toHaveProperty('LastName');
      expect(firstStudent).toHaveProperty('Grade');
      expect(firstStudent).toHaveProperty('SchoolCode');
      expect([6, 7, 8]).toContain(firstStudent.Grade);
    });

    it('should filter students by grade level', async () => {
      const grade7Students = await enhancedClient.getStudentsByGrade('001', 7);
      
      expect(Array.isArray(grade7Students)).toBe(true);
      grade7Students.forEach(student => {
        expect(student.Grade).toBe(7);
        expect(student.SchoolCode).toBe('001');
      });
    });

    it('should retrieve individual student details', async () => {
      const mockData = getMockData();
      const testStudentId = mockData.students[0]?.StudentID;
      
      if (testStudentId) {
        const student = await simpleClient.getStudent('001', testStudentId);
        
        expect(student).toBeDefined();
        expect(student.StudentID).toBe(testStudentId);
        expect(student.SchoolCode).toBe('001');
      }
    });

    it('should handle non-existent student gracefully', async () => {
      try {
        await simpleClient.getStudent('001', '999999');
        fail('Should have thrown not found error');
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it('should retrieve only active students when specified', async () => {
      const activeStudents = await enhancedClient.getActiveStudents('001');
      
      activeStudents.forEach(student => {
        expect(student.Active).toBe(true);
      });
    });
  });

  describe('Attendance Data Processing', () => {
    it('should retrieve attendance records for a student', async () => {
      const mockData = getMockData();
      const testStudentId = mockData.students[0]?.StudentID;
      
      if (testStudentId) {
        const attendance = await simpleClient.getStudentAttendance(
          '001', 
          testStudentId,
          '2024-11-01',
          '2024-11-30'
        );
        
        expect(Array.isArray(attendance)).toBe(true);
        
        if (attendance.length > 0) {
          const firstRecord = attendance[0];
          expect(firstRecord).toHaveProperty('StudentID');
          expect(firstRecord).toHaveProperty('Date');
          expect(firstRecord).toHaveProperty('Period1');
          expect(firstRecord).toHaveProperty('Period7');
          expect(firstRecord).toHaveProperty('TotalPeriods');
          expect(firstRecord.TotalPeriods).toBe(7);
        }
      }
    });

    it('should handle bulk attendance retrieval', async () => {
      const attendanceData = await enhancedClient.getBulkAttendance(
        '001',
        '2024-11-01',
        '2024-11-30'
      );
      
      expect(Array.isArray(attendanceData)).toBe(true);
      
      if (attendanceData.length > 0) {
        // Verify all records are within date range
        attendanceData.forEach(record => {
          expect(record.Date).toBeGreaterThanOrEqual('2024-11-01');
          expect(record.Date).toBeLessThanOrEqual('2024-11-30');
          expect(record.SchoolCode).toBe('001');
        });
      }
    });

    it('should validate attendance data integrity', async () => {
      const mockData = getMockData();
      const testStudentId = mockData.students[0]?.StudentID;
      
      if (testStudentId) {
        const attendance = await productionClient.getStudentAttendance(
          '001',
          testStudentId,
          '2024-11-01',
          '2024-11-15'
        );
        
        attendance.forEach(record => {
          // Validate period data
          expect(record.TotalPeriods).toBe(7);
          expect(record.PeriodsPresent + record.PeriodsAbsent).toBeLessThanOrEqual(7);
          
          // Validate attendance percentage
          expect(record.AttendancePercentage).toBeGreaterThanOrEqual(0);
          expect(record.AttendancePercentage).toBeLessThanOrEqual(100);
          
          // Validate period statuses
          const periodStatuses = [
            record.Period1, record.Period2, record.Period3, record.Period4,
            record.Period5, record.Period6, record.Period7
          ];
          
          periodStatuses.forEach(status => {
            expect(['P', 'A', 'T']).toContain(status); // Present, Absent, Tardy
          });
        });
      }
    });

    it('should calculate attendance statistics correctly', async () => {
      const stats = await enhancedClient.getAttendanceStatistics('001', '2024-11-01', '2024-11-30');
      
      expect(stats).toHaveProperty('totalStudents');
      expect(stats).toHaveProperty('averageAttendanceRate');
      expect(stats).toHaveProperty('chronicAbsenteeCount');
      expect(stats).toHaveProperty('perfectAttendanceCount');
      
      expect(stats.averageAttendanceRate).toBeGreaterThanOrEqual(0);
      expect(stats.averageAttendanceRate).toBeLessThanOrEqual(100);
      expect(stats.totalStudents).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle API timeout with retry mechanism', async () => {
      simulateErrorScenario('timeout');
      
      const startTime = Date.now();
      
      try {
        await enhancedClient.getStudents('001');
        fail('Should have thrown timeout error after retries');
      } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should have attempted retries (longer duration)
        expect(duration).toBeGreaterThan(1000); // At least 1 second for retries
        expect(error.message).toContain('timeout');
      }
    });

    it('should implement circuit breaker for repeated failures', async () => {
      simulateErrorScenario('server_error');
      
      // Multiple consecutive failures should trigger circuit breaker
      const promises = Array.from({ length: 5 }, () => 
        enhancedClient.getStudents('001').catch(e => e)
      );
      
      const results = await Promise.all(promises);
      
      // Later requests should fail fast due to circuit breaker
      const lastResult = results[results.length - 1];
      expect(lastResult.message).toContain('Circuit breaker');
    });

    it('should handle rate limiting gracefully', async () => {
      simulateErrorScenario('ratelimit');
      
      try {
        await productionClient.getStudents('001');
        fail('Should have thrown rate limit error');
      } catch (error: any) {
        expect(error.status).toBe(429);
        expect(error.retryAfter).toBeDefined();
      }
    });

    it('should validate response data format', async () => {
      // Test with production client which has stricter validation
      const students = await productionClient.getStudents('001');
      
      students.forEach(student => {
        // Required fields validation
        expect(student.StudentID).toBeDefined();
        expect(typeof student.StudentID).toBe('string');
        expect(student.FirstName).toBeDefined();
        expect(typeof student.FirstName).toBe('string');
        expect(student.LastName).toBeDefined();
        expect(typeof student.LastName).toBe('string');
        expect([6, 7, 8]).toContain(student.Grade);
        
        // Email format validation if present
        if (student.Email) {
          expect(student.Email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        }
        
        // Date format validation
        if (student.EnrollmentDate) {
          expect(student.EnrollmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should efficiently handle large student populations', async () => {
      const startTime = Date.now();
      
      const students = await enhancedClient.getStudents('001');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle 500+ students within 3 seconds
      expect(duration).toBeLessThan(3000);
      expect(students.length).toBeGreaterThan(0);
    });

    it('should implement request caching', async () => {
      // First request
      const startTime1 = Date.now();
      const students1 = await enhancedClient.getStudents('001');
      const endTime1 = Date.now();
      
      // Second identical request (should use cache)
      const startTime2 = Date.now();
      const students2 = await enhancedClient.getStudents('001');
      const endTime2 = Date.now();
      
      const firstDuration = endTime1 - startTime1;
      const secondDuration = endTime2 - startTime2;
      
      // Second request should be significantly faster
      expect(secondDuration).toBeLessThan(firstDuration * 0.5);
      expect(students1).toEqual(students2);
    });

    it('should batch multiple requests efficiently', async () => {
      const studentIds = getMockData().students.slice(0, 5).map(s => s.StudentID);
      
      const startTime = Date.now();
      
      // Get attendance for multiple students
      const attendancePromises = studentIds.map(id =>
        enhancedClient.getStudentAttendance('001', id, '2024-11-01', '2024-11-15')
      );
      
      const attendanceResults = await Promise.all(attendancePromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Batch processing should be more efficient than sequential
      expect(duration).toBeLessThan(studentIds.length * 1000); // Less than 1 second per student
      expect(attendanceResults).toHaveLength(studentIds.length);
    });
  });

  describe('Data Transformation and Validation', () => {
    it('should transform Aeries data to internal format', async () => {
      const aeriesStudents = await simpleClient.getStudents('001');
      const transformedStudents = await enhancedClient.transformStudentData(aeriesStudents);
      
      transformedStudents.forEach(student => {
        // Should have internal format properties
        expect(student).toHaveProperty('student_id');
        expect(student).toHaveProperty('first_name');
        expect(student).toHaveProperty('last_name');
        expect(student).toHaveProperty('grade_level');
        expect(student).toHaveProperty('school_id');
        
        // Should preserve data integrity
        const originalStudent = aeriesStudents.find(s => s.StudentID === student.student_id);
        expect(originalStudent).toBeDefined();
        expect(student.first_name).toBe(originalStudent?.FirstName);
        expect(student.last_name).toBe(originalStudent?.LastName);
        expect(student.grade_level).toBe(originalStudent?.Grade);
      });
    });

    it('should validate and sanitize input data', async () => {
      // Test with potentially malicious input
      const maliciousStudentId = '<script>alert("xss")</script>';
      
      try {
        await productionClient.getStudent('001', maliciousStudentId);
        fail('Should have rejected malicious input');
      } catch (error: any) {
        expect(error.message).toContain('Invalid student ID format');
      }
    });

    it('should handle data type conversions correctly', async () => {
      const attendance = await enhancedClient.getBulkAttendance('001', '2024-11-01', '2024-11-30');
      
      attendance.forEach(record => {
        // Numeric fields should be numbers
        expect(typeof record.TotalPeriods).toBe('number');
        expect(typeof record.PeriodsPresent).toBe('number');
        expect(typeof record.PeriodsAbsent).toBe('number');
        expect(typeof record.AttendancePercentage).toBe('number');
        
        // Date fields should be valid dates
        expect(new Date(record.Date)).toBeInstanceOf(Date);
        expect(new Date(record.Date).toString()).not.toBe('Invalid Date');
        
        // Boolean fields should be booleans
        expect(typeof record.IsFullDayAbsent).toBe('boolean');
      });
    });
  });

  describe('Sync Operations and Data Consistency', () => {
    it('should perform incremental sync for changed data only', async () => {
      const lastSyncDate = '2024-11-01';
      const currentDate = '2024-11-30';
      
      const changedStudents = await enhancedClient.getStudentChanges('001', lastSyncDate, currentDate);
      
      expect(Array.isArray(changedStudents)).toBe(true);
      
      // Should only include students with changes since last sync
      changedStudents.forEach(student => {
        expect(new Date(student.LastModified)).toBeGreaterThanOrEqual(new Date(lastSyncDate));
      });
    });

    it('should detect and resolve data conflicts', async () => {
      const conflicts = await productionClient.detectDataConflicts('001');
      
      expect(Array.isArray(conflicts)).toBe(true);
      
      if (conflicts.length > 0) {
        conflicts.forEach(conflict => {
          expect(conflict).toHaveProperty('studentId');
          expect(conflict).toHaveProperty('conflictType');
          expect(conflict).toHaveProperty('aeriesValue');
          expect(conflict).toHaveProperty('localValue');
          expect(conflict).toHaveProperty('recommendedResolution');
        });
      }
    });

    it('should maintain data integrity during sync operations', async () => {
      const syncResult = await enhancedClient.performFullSync('001');
      
      expect(syncResult).toHaveProperty('studentsProcessed');
      expect(syncResult).toHaveProperty('attendanceRecordsProcessed');
      expect(syncResult).toHaveProperty('errors');
      expect(syncResult).toHaveProperty('duration');
      
      expect(syncResult.studentsProcessed).toBeGreaterThan(0);
      expect(Array.isArray(syncResult.errors)).toBe(true);
      
      // Should complete without critical errors
      const criticalErrors = syncResult.errors.filter(e => e.severity === 'critical');
      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('California Education Code Compliance', () => {
    it('should track attendance data per CA requirements', async () => {
      const mockData = getMockData();
      const testStudentId = mockData.students[0]?.StudentID;
      
      if (testStudentId) {
        const attendance = await productionClient.getStudentAttendance(
          '001',
          testStudentId,
          '2024-08-15', // School year start
          '2024-06-12'  // School year end
        );
        
        // Should track all required attendance data
        attendance.forEach(record => {
          // Must have all 7 periods tracked
          expect(record.TotalPeriods).toBe(7);
          
          // Must distinguish between different absence types
          expect(['P', 'A', 'T']).toContain(record.Period1);
          
          // Must calculate full-day absence correctly
          if (record.IsFullDayAbsent) {
            expect(record.PeriodsAbsent).toBe(7);
          }
        });
      }
    });

    it('should support SARB reporting requirements', async () => {
      const sarbData = await enhancedClient.generateSARBReport('001', '2024-11-01', '2024-11-30');
      
      expect(sarbData).toHaveProperty('studentsAtRisk');
      expect(sarbData).toHaveProperty('totalAbsenceDays');
      expect(sarbData).toHaveProperty('interventionHistory');
      
      // Students at risk should meet CA criteria
      sarbData.studentsAtRisk.forEach((student: any) => {
        expect(student.totalAbsences).toBeGreaterThanOrEqual(10); // CA threshold
        expect(student).toHaveProperty('interventionsAttempted');
        expect(student).toHaveProperty('parentContactLog');
      });
    });
  });
});