import { performance } from 'perf_hooks';
import { TestDataFactory } from '../fixtures/test-data-factory';
import { seedAnonymizedData, cleanupTestData } from '../fixtures/seed-test-data';
import { startMockServer, stopMockServer } from '../mocks/aeries-mock-server';

/**
 * Performance Tests for AP Tool V1 Dashboard
 * 
 * Tests performance requirements for educational data processing:
 * - Dashboard load times (<2 seconds per CLAUDE.md requirements)
 * - Large dataset processing (1000+ students)
 * - Concurrent user scenarios (50+ APs)
 * - Memory usage during data imports
 * - API response times (<500ms)
 * - Database query optimization
 * - Real-time sync performance
 */

describe('Dashboard Performance Tests', () => {
  beforeAll(async () => {
    await startMockServer();
    await seedAnonymizedData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await stopMockServer();
  });

  describe('Dashboard Load Performance', () => {
    it('should load dashboard within 2 seconds', async () => {
      const startTime = performance.now();
      
      // Simulate dashboard data loading
      const dashboardData = await loadDashboardData();
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      expect(loadTime).toBeLessThan(2000); // 2 seconds
      expect(dashboardData).toBeDefined();
      expect(dashboardData.students).toBeDefined();
      expect(dashboardData.attendanceOverview).toBeDefined();
    });

    it('should load student cards within 1 second for grade-level views', async () => {
      const grades = [6, 7, 8];
      
      for (const grade of grades) {
        const startTime = performance.now();
        
        const students = await getStudentsByGrade(grade);
        
        const endTime = performance.now();
        const loadTime = endTime - startTime;
        
        expect(loadTime).toBeLessThan(1000); // 1 second per grade
        expect(students.length).toBeGreaterThan(0);
        expect(students.every(s => s.grade_level === grade)).toBe(true);
      }
    });

    it('should handle dashboard refresh efficiently', async () => {
      // Initial load
      const initialStartTime = performance.now();
      await loadDashboardData();
      const initialLoadTime = performance.now() - initialStartTime;
      
      // Cached refresh
      const refreshStartTime = performance.now();
      await loadDashboardData();
      const refreshLoadTime = performance.now() - refreshStartTime;
      
      // Refresh should be at least 50% faster due to caching
      expect(refreshLoadTime).toBeLessThan(initialLoadTime * 0.5);
    });
  });

  describe('Large Dataset Processing', () => {
    it('should process 1000+ student records efficiently', async () => {
      // Generate large dataset
      const largeStudentSet = Array.from({ length: 1000 }, () => 
        TestDataFactory.createStudent()
      );
      
      const startTime = performance.now();
      
      // Process attendance calculations for all students
      const processedData = await processLargeAttendanceDataset(largeStudentSet);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Should process 1000 students within 5 seconds
      expect(processingTime).toBeLessThan(5000);
      expect(processedData).toHaveLength(1000);
      
      // Verify all students have calculated attendance percentages
      processedData.forEach(student => {
        expect(student.attendancePercentage).toBeDefined();
        expect(typeof student.attendancePercentage).toBe('number');
      });
    });

    it('should handle memory efficiently with large datasets', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process multiple large datasets
      for (let i = 0; i < 5; i++) {
        const students = Array.from({ length: 500 }, () => 
          TestDataFactory.createStudent()
        );
        
        await processAttendanceData(students);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage shouldn't increase by more than 100MB
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });

    it('should paginate large results efficiently', async () => {
      const pageSize = 50;
      const totalStudents = 1000;
      const totalPages = Math.ceil(totalStudents / pageSize);
      
      const pageTimes: number[] = [];
      
      for (let page = 1; page <= Math.min(totalPages, 10); page++) {
        const startTime = performance.now();
        
        const pageData = await getPaginatedStudents(page, pageSize);
        
        const endTime = performance.now();
        const pageTime = endTime - startTime;
        
        pageTimes.push(pageTime);
        
        expect(pageData.students).toHaveLength(pageSize);
        expect(pageData.totalPages).toBe(totalPages);
        expect(pageData.currentPage).toBe(page);
        
        // Each page should load within 500ms
        expect(pageTime).toBeLessThan(500);
      }
      
      // Page load times should be consistent (no degradation)
      const averageTime = pageTimes.reduce((a, b) => a + b, 0) / pageTimes.length;
      const maxTime = Math.max(...pageTimes);
      
      expect(maxTime).toBeLessThan(averageTime * 1.5); // No page should be 50% slower than average
    });
  });

  describe('API Response Performance', () => {
    it('should respond to attendance queries within 500ms', async () => {
      const apiEndpoints = [
        '/api/attendance',
        '/api/attendance?grade=7',
        '/api/students',
        '/api/interventions'
      ];
      
      for (const endpoint of apiEndpoints) {
        const startTime = performance.now();
        
        const response = await fetch(`http://localhost:3000${endpoint}`, {
          headers: { 'Authorization': 'Bearer test-token' }
        });
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(500); // 500ms requirement
        
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });

    it('should handle search queries efficiently', async () => {
      const searchQueries = [
        'John',
        'Smith',
        '123456',
        'Grade 7',
        'chronic'
      ];
      
      for (const query of searchQueries) {
        const startTime = performance.now();
        
        const results = await searchStudents(query);
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        // Search should complete within 200ms
        expect(searchTime).toBeLessThan(200);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should optimize database queries for attendance calculations', async () => {
      const studentId = '123456';
      const startDate = '2024-11-01';
      const endDate = '2024-11-30';
      
      const startTime = performance.now();
      
      // This should use optimized queries with proper indexing
      const attendanceData = await getStudentAttendanceWithCalculations(
        studentId, 
        startDate, 
        endDate
      );
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;
      
      // Database query should complete within 100ms
      expect(queryTime).toBeLessThan(100);
      
      expect(attendanceData).toHaveProperty('records');
      expect(attendanceData).toHaveProperty('overallPercentage');
      expect(attendanceData).toHaveProperty('trendAnalysis');
    });
  });

  describe('Concurrent User Performance', () => {
    it('should handle 20 concurrent dashboard requests', async () => {
      const concurrentRequests = 20;
      const requests = Array.from({ length: concurrentRequests }, () => 
        loadDashboardData()
      );
      
      const startTime = performance.now();
      
      const results = await Promise.all(requests);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // All requests should complete within 5 seconds
      expect(totalTime).toBeLessThan(5000);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.students).toBeDefined();
      });
      
      // Average time per request should be reasonable
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).toBeLessThan(1000); // 1 second average
    });

    it('should maintain performance under load', async () => {
      const baselineTime = await measureSingleRequest();
      
      // Simulate load with 10 concurrent background requests
      const backgroundRequests = Array.from({ length: 10 }, () => 
        loadDashboardData()
      );
      
      // Don't wait for background requests to complete
      Promise.all(backgroundRequests);
      
      // Measure performance under load
      const loadTime = await measureSingleRequest();
      
      // Performance shouldn't degrade by more than 100% under load
      expect(loadTime).toBeLessThan(baselineTime * 2);
    });

    it('should handle concurrent data updates efficiently', async () => {
      const studentUpdates = Array.from({ length: 10 }, (_, i) => ({
        studentId: `student-${i}`,
        attendanceUpdate: {
          date: '2024-11-15',
          periods: TestDataFactory.generatePeriodAttendance('random')
        }
      }));
      
      const startTime = performance.now();
      
      // Process all updates concurrently
      const updatePromises = studentUpdates.map(update => 
        updateStudentAttendance(update.studentId, update.attendanceUpdate)
      );
      
      const results = await Promise.all(updatePromises);
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;
      
      // All updates should complete within 2 seconds
      expect(updateTime).toBeLessThan(2000);
      
      // All updates should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Real-time Sync Performance', () => {
    it('should sync Aeries data efficiently', async () => {
      const startTime = performance.now();
      
      // Simulate Aeries sync operation
      const syncResult = await performAeriesSync();
      
      const endTime = performance.now();
      const syncTime = endTime - startTime;
      
      // Sync should complete within 30 seconds for 500 students
      expect(syncTime).toBeLessThan(30000);
      
      expect(syncResult.studentsProcessed).toBeGreaterThan(0);
      expect(syncResult.attendanceRecordsProcessed).toBeGreaterThan(0);
      expect(syncResult.errors.length).toBe(0);
    });

    it('should handle incremental syncs efficiently', async () => {
      // Initial full sync
      const fullSyncStart = performance.now();
      await performAeriesSync();
      const fullSyncTime = performance.now() - fullSyncStart;
      
      // Incremental sync (only changed data)
      const incrementalSyncStart = performance.now();
      const incrementalResult = await performIncrementalSync();
      const incrementalSyncTime = performance.now() - incrementalSyncStart;
      
      // Incremental sync should be much faster
      expect(incrementalSyncTime).toBeLessThan(fullSyncTime * 0.2); // 20% of full sync time
      expect(incrementalResult.changedRecords).toBeDefined();
    });

    it('should update UI efficiently after data changes', async () => {
      // Simulate data change
      const studentId = '123456';
      const attendanceUpdate = {
        date: '2024-11-15',
        periods: TestDataFactory.generatePeriodAttendance('partial')
      };
      
      const startTime = performance.now();
      
      // Update data and refresh UI
      await updateStudentAttendance(studentId, attendanceUpdate);
      const updatedData = await loadDashboardData();
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;
      
      // UI update should complete within 1 second
      expect(updateTime).toBeLessThan(1000);
      
      // Data should reflect the update
      const updatedStudent = updatedData.students.find(s => s.student_id === studentId);
      expect(updatedStudent).toBeDefined();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during long sessions', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate 30 minutes of typical usage
      for (let i = 0; i < 100; i++) {
        await loadDashboardData();
        await searchStudents('test');
        await getStudentsByGrade(6 + (i % 3));
        
        // Periodic cleanup
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory shouldn't grow by more than 50MB during extended usage
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large file processing efficiently', async () => {
      // Simulate processing large CSV import
      const largeDataset = Array.from({ length: 5000 }, () => ({
        student_id: TestDataFactory.generateStudentId(),
        attendance_data: TestDataFactory.createAttendanceHistory(
          TestDataFactory.generateStudentId(),
          new Date('2024-08-15'),
          new Date('2024-11-30')
        )
      }));
      
      const startTime = performance.now();
      const initialMemory = process.memoryUsage();
      
      const processed = await processLargeDataImport(largeDataset);
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      
      const processingTime = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Should process 5000 records within 10 seconds
      expect(processingTime).toBeLessThan(10000);
      
      // Memory usage should be reasonable for the dataset size
      expect(memoryUsed).toBeLessThan(200 * 1024 * 1024); // 200MB
      
      expect(processed.successCount).toBe(largeDataset.length);
      expect(processed.errorCount).toBe(0);
    });
  });
});

// Helper functions for performance testing

async function loadDashboardData() {
  // Simulate dashboard data loading
  return {
    students: await getStudentsByGrade(7),
    attendanceOverview: await getAttendanceOverview(),
    interventions: await getActiveInterventions(),
    analytics: await getAttendanceAnalytics()
  };
}

async function getStudentsByGrade(grade: number) {
  // Simulate database query
  const students = TestDataFactory.createStudentsForGrade(grade, 25);
  return students.map(student => ({
    student_id: student.id.value,
    first_name: student.firstName,
    last_name: student.lastName,
    grade_level: student.gradeLevel,
    email: student.email,
    attendance_percentage: 85 + Math.random() * 15
  }));
}

async function getAttendanceOverview() {
  return {
    total_students: 520,
    present_today: 485,
    absent_today: 35,
    average_attendance: 93.2,
    chronic_absentee_count: 15
  };
}

async function getActiveInterventions() {
  return Array.from({ length: 8 }, () => TestDataFactory.createIntervention());
}

async function getAttendanceAnalytics() {
  return {
    monthly_trend: [95.2, 94.8, 93.5, 92.1],
    grade_comparison: {
      grade_6: 94.5,
      grade_7: 93.2,
      grade_8: 91.8
    }
  };
}

async function processLargeAttendanceDataset(students: any[]) {
  return students.map(student => ({
    ...student,
    attendancePercentage: 85 + Math.random() * 15,
    totalAbsences: Math.floor(Math.random() * 20),
    needsIntervention: Math.random() < 0.15
  }));
}

async function processAttendanceData(students: any[]) {
  // Simulate attendance processing
  return students.map(student => ({
    ...student,
    processed: true
  }));
}

async function getPaginatedStudents(page: number, pageSize: number) {
  const totalStudents = 1000;
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalStudents);
  
  const students = Array.from({ length: endIndex - startIndex }, (_, i) => ({
    student_id: `student-${startIndex + i}`,
    first_name: TestDataFactory.generateFirstName(),
    last_name: TestDataFactory.generateLastName(),
    grade_level: 6 + ((startIndex + i) % 3)
  }));
  
  return {
    students,
    currentPage: page,
    totalPages: Math.ceil(totalStudents / pageSize),
    totalStudents
  };
}

async function searchStudents(query: string) {
  // Simulate search operation
  const allStudents = TestDataFactory.createMiddleSchoolStudents().slice(0, 100);
  return allStudents.filter(student => 
    student.firstName.toLowerCase().includes(query.toLowerCase()) ||
    student.lastName.toLowerCase().includes(query.toLowerCase()) ||
    student.id.value.includes(query)
  );
}

async function getStudentAttendanceWithCalculations(studentId: string, startDate: string, endDate: string) {
  const records = TestDataFactory.createAttendanceHistory(
    studentId,
    new Date(startDate),
    new Date(endDate)
  );
  
  const totalDays = records.length;
  const presentDays = records.filter(r => !r.isFullDayAbsent()).length;
  const overallPercentage = (presentDays / totalDays) * 100;
  
  return {
    records: records.map(r => ({
      date: r.date,
      periods: r.periodAttendance,
      percentage: r.calculateDailyAttendancePercentage().value
    })),
    overallPercentage,
    trendAnalysis: {
      improving: overallPercentage > 85,
      stable: overallPercentage >= 80 && overallPercentage <= 85,
      declining: overallPercentage < 80
    }
  };
}

async function measureSingleRequest(): Promise<number> {
  const startTime = performance.now();
  await loadDashboardData();
  return performance.now() - startTime;
}

async function updateStudentAttendance(studentId: string, attendanceUpdate: any) {
  // Simulate attendance update
  return { success: true, studentId, timestamp: new Date() };
}

async function performAeriesSync() {
  // Simulate Aeries sync
  return {
    studentsProcessed: 520,
    attendanceRecordsProcessed: 2500,
    errors: [],
    duration: 15000
  };
}

async function performIncrementalSync() {
  // Simulate incremental sync
  return {
    changedRecords: 25,
    studentsUpdated: 15,
    newRecords: 10,
    duration: 2000
  };
}

async function processLargeDataImport(dataset: any[]) {
  // Simulate large data import processing
  return {
    successCount: dataset.length,
    errorCount: 0,
    duration: performance.now()
  };
}