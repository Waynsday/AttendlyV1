import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TestDataFactory } from '../fixtures/test-data-factory';

/**
 * Mock Aeries API Server for Testing
 * 
 * Provides realistic mock responses for Aeries API endpoints
 * used by AP Tool V1. Simulates the actual Aeries SIS API
 * with educational data patterns and response formats.
 * 
 * Endpoints mocked:
 * - Student enrollment data
 * - Attendance records  
 * - Teacher assignments
 * - School information
 * - Authentication/authorization
 */

// Mock server instance
let mockServer: ReturnType<typeof setupServer> | null = null;

// Mock data store
interface MockDataStore {
  students: any[];
  attendanceRecords: any[];
  teachers: any[];
  schools: any[];
  syncOperations: any[];
}

const mockData: MockDataStore = {
  students: [],
  attendanceRecords: [],
  teachers: [],
  schools: [],
  syncOperations: []
};

/**
 * Start the mock Aeries API server
 */
export async function startMockServer(): Promise<void> {
  if (mockServer) {
    return; // Already started
  }

  // Initialize mock data
  await initializeMockData();

  // Create server with handlers
  mockServer = setupServer(...createMockHandlers());

  // Start listening
  mockServer.listen({
    onUnhandledRequest: 'warn'
  });

  console.log('    🔧 Mock Aeries API server started');
}

/**
 * Stop the mock server
 */
export async function stopMockServer(): Promise<void> {
  if (mockServer) {
    mockServer.close();
    mockServer = null;
    console.log('    🔌 Mock Aeries API server stopped');
  }
}

/**
 * Reset mock server handlers (useful between tests)
 */
export function resetMockServer(): void {
  if (mockServer) {
    mockServer.resetHandlers();
  }
}

/**
 * Initialize mock data with realistic educational data
 */
async function initializeMockData(): Promise<void> {
  // Generate realistic student data
  mockData.students = TestDataFactory.createMiddleSchoolStudents().slice(0, 100).map(student => ({
    StudentID: student.id.value,
    FirstName: student.firstName,
    LastName: student.lastName,
    Grade: student.gradeLevel,
    Email: student.email,
    SchoolCode: '001',
    EnrollmentDate: '2024-08-15',
    ExitDate: null,
    StudentNumber: student.id.value,
    Gender: Math.random() > 0.5 ? 'M' : 'F',
    BirthDate: generateBirthDate(student.gradeLevel),
    HomeLanguage: 'English',
    EthnicityCode: generateEthnicityCode(),
    Active: student.isActive
  }));

  // Generate attendance records for first 20 students
  const sampleStudents = mockData.students.slice(0, 20);
  mockData.attendanceRecords = [];
  
  for (const student of sampleStudents) {
    const records = generateAttendanceRecords(student.StudentID);
    mockData.attendanceRecords.push(...records);
  }

  // Generate teacher data
  mockData.teachers = Array.from({ length: 25 }, () => {
    const teacher = TestDataFactory.createTeacher();
    return {
      TeacherID: teacher.id,
      FirstName: teacher.firstName,
      LastName: teacher.lastName,
      Email: teacher.email,
      Department: teacher.department,
      SchoolCode: '001',
      Active: true,
      HireDate: '2020-08-01'
    };
  });

  // Generate school data
  mockData.schools = [
    {
      SchoolCode: '001',
      SchoolName: 'Romoland Middle School',
      Principal: 'Dr. Maria Rodriguez',
      Address: '1480 Ethanac Rd',
      City: 'Romoland',
      State: 'CA',
      ZipCode: '92585',
      Phone: '(951) 657-3118',
      GradeLevels: '6,7,8',
      Enrollment: 520
    }
  ];
}

/**
 * Create MSW request handlers for Aeries API endpoints
 */
function createMockHandlers() {
  const baseUrl = 'https://romolandapi.aeries.net/admin/api/v5';

  return [
    // Authentication endpoint
    http.post(`${baseUrl}/token`, () => {
      return HttpResponse.json({
        access_token: 'mock_access_token_12345',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write'
      });
    }),

    // Schools endpoint
    http.get(`${baseUrl}/schools`, ({ request }) => {
      const url = new URL(request.url);
      const schoolCode = url.searchParams.get('schoolCode');

      let schools = mockData.schools;
      if (schoolCode) {
        schools = schools.filter(s => s.SchoolCode === schoolCode);
      }

      return HttpResponse.json(schools);
    }),

    // Students endpoint
    http.get(`${baseUrl}/schools/:schoolCode/students`, ({ params, request }) => {
      const { schoolCode } = params;
      const url = new URL(request.url);
      const grade = url.searchParams.get('grade');
      const active = url.searchParams.get('active');

      let students = mockData.students.filter(s => s.SchoolCode === schoolCode);

      if (grade) {
        students = students.filter(s => s.Grade.toString() === grade);
      }

      if (active === 'true') {
        students = students.filter(s => s.Active === true);
      }

      return HttpResponse.json(students);
    }),

    // Individual student endpoint
    http.get(`${baseUrl}/schools/:schoolCode/students/:studentId`, ({ params }) => {
      const { schoolCode, studentId } = params;
      const student = mockData.students.find(s => 
        s.SchoolCode === schoolCode && s.StudentID === studentId
      );

      if (!student) {
        return new HttpResponse(null, { status: 404 });
      }

      return HttpResponse.json(student);
    }),

    // Attendance records endpoint
    http.get(`${baseUrl}/schools/:schoolCode/students/:studentId/attendance`, ({ params, request }) => {
      const { schoolCode, studentId } = params;
      const url = new URL(request.url);
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      let attendance = mockData.attendanceRecords.filter(a => 
        a.SchoolCode === schoolCode && a.StudentID === studentId
      );

      if (startDate) {
        attendance = attendance.filter(a => a.Date >= startDate);
      }

      if (endDate) {
        attendance = attendance.filter(a => a.Date <= endDate);
      }

      return HttpResponse.json(attendance);
    }),

    // Bulk attendance endpoint
    http.get(`${baseUrl}/schools/:schoolCode/attendance`, ({ params, request }) => {
      const { schoolCode } = params;
      const url = new URL(request.url);
      const date = url.searchParams.get('date');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      let attendance = mockData.attendanceRecords.filter(a => a.SchoolCode === schoolCode);

      if (date) {
        attendance = attendance.filter(a => a.Date === date);
      } else if (startDate && endDate) {
        attendance = attendance.filter(a => a.Date >= startDate && a.Date <= endDate);
      }

      return HttpResponse.json(attendance);
    }),

    // Teachers endpoint
    http.get(`${baseUrl}/schools/:schoolCode/teachers`, ({ params }) => {
      const { schoolCode } = params;
      return HttpResponse.json(
        mockData.teachers.filter(t => t.SchoolCode === schoolCode)
      );
    }),

    // Student enrollment changes
    http.get(`${baseUrl}/schools/:schoolCode/enrollmentchanges`, ({ params, request }) => {
      const { schoolCode } = params;
      const url = new URL(request.url);
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      // Mock enrollment changes (transfers, new enrollments, exits)
      const changes = generateEnrollmentChanges(schoolCode as string, startDate, endDate);
      return HttpResponse.json(changes);
    }),

    // Health check endpoint
    http.get(`${baseUrl}/health`, () => {
      return HttpResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '5.0.0',
        environment: 'test'
      });
    }),

    // Error simulation endpoints for testing error handling
    http.get(`${baseUrl}/error/500`, () => {
      return new HttpResponse(null, { status: 500 });
    }),

    http.get(`${baseUrl}/error/timeout`, () => {
      // Simulate timeout by delaying response
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new HttpResponse(null, { status: 408 }));
        }, 10000); // 10 second delay
      });
    }),

    http.get(`${baseUrl}/error/ratelimit`, () => {
      return new HttpResponse(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '1000',
            'X-RateLimit-Remaining': '0'
          }
        }
      );
    })
  ];
}

/**
 * Generate realistic birth date based on grade level
 */
function generateBirthDate(gradeLevel: number): string {
  const currentYear = new Date().getFullYear();
  // Typical age for grade levels: Grade 6 = 11-12, Grade 7 = 12-13, Grade 8 = 13-14
  const ageRange = {
    6: [11, 12],
    7: [12, 13],
    8: [13, 14]
  };

  const [minAge, maxAge] = ageRange[gradeLevel as keyof typeof ageRange] || [12, 13];
  const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));
  const birthYear = currentYear - age;
  
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1; // Avoid month-end issues

  return `${birthYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Generate ethnicity code (anonymized)
 */
function generateEthnicityCode(): string {
  const codes = ['H', 'W', 'A', 'B', 'F', 'P', 'I', 'T']; // CA DOE ethnicity codes
  return codes[Math.floor(Math.random() * codes.length)];
}

/**
 * Generate attendance records for a student
 */
function generateAttendanceRecords(studentId: string): any[] {
  const records = [];
  const startDate = new Date('2024-08-15'); // School year start
  const endDate = new Date('2024-12-20');   // First semester end
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const attendanceRecord = TestDataFactory.createAttendanceRecord({
        studentId,
        date: new Date(currentDate),
        attendancePattern: Math.random() > 0.15 ? 'perfect' : 'random' // 85% good attendance
      });

      // Convert to Aeries format
      records.push({
        StudentID: studentId,
        SchoolCode: '001',
        Date: formatDate(currentDate),
        Period1: attendanceRecord.periodAttendance.find(p => p.period === 1)?.status || 'P',
        Period2: attendanceRecord.periodAttendance.find(p => p.period === 2)?.status || 'P',
        Period3: attendanceRecord.periodAttendance.find(p => p.period === 3)?.status || 'P',
        Period4: attendanceRecord.periodAttendance.find(p => p.period === 4)?.status || 'P',
        Period5: attendanceRecord.periodAttendance.find(p => p.period === 5)?.status || 'P',
        Period6: attendanceRecord.periodAttendance.find(p => p.period === 6)?.status || 'P',
        Period7: attendanceRecord.periodAttendance.find(p => p.period === 7)?.status || 'P',
        TotalPeriods: 7,
        PeriodsAbsent: attendanceRecord.getAbsentPeriods().length,
        PeriodsPresent: attendanceRecord.getPresentPeriods().length,
        AttendancePercentage: attendanceRecord.calculateDailyAttendancePercentage().value,
        IsFullDayAbsent: attendanceRecord.isFullDayAbsent(),
        LastModified: new Date().toISOString()
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return records;
}

/**
 * Generate enrollment changes for testing
 */
function generateEnrollmentChanges(schoolCode: string, startDate: string | null, endDate: string | null): any[] {
  // Mock some enrollment changes
  const changes = [
    {
      StudentID: '999001',
      SchoolCode: schoolCode,
      ChangeType: 'ENTRY',
      ChangeDate: '2024-09-15',
      Reason: 'Transfer from out of district',
      PreviousSchool: 'Other District',
      Grade: 7
    },
    {
      StudentID: '123456',
      SchoolCode: schoolCode,
      ChangeType: 'EXIT',
      ChangeDate: '2024-10-30',
      Reason: 'Family relocation',
      NextSchool: 'Heritage Elementary',
      Grade: 6
    }
  ];

  // Filter by date range if provided
  if (startDate && endDate) {
    return changes.filter(c => c.ChangeDate >= startDate && c.ChangeDate <= endDate);
  }

  return changes;
}

/**
 * Format date for Aeries API (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get mock data for testing (read-only access)
 */
export function getMockData(): Readonly<MockDataStore> {
  return mockData;
}

/**
 * Add custom mock data for specific tests
 */
export function addMockData(type: keyof MockDataStore, data: any): void {
  mockData[type].push(data);
}

/**
 * Clear all mock data
 */
export function clearMockData(): void {
  mockData.students = [];
  mockData.attendanceRecords = [];
  mockData.teachers = [];
  mockData.schools = [];
  mockData.syncOperations = [];
}

/**
 * Simulate Aeries API error scenarios
 */
export function simulateErrorScenario(scenario: 'timeout' | 'ratelimit' | 'server_error' | 'auth_failure'): void {
  if (!mockServer) return;

  const baseUrl = 'https://romolandapi.aeries.net/admin/api/v5';

  switch (scenario) {
    case 'timeout':
      mockServer.use(
        http.get(`${baseUrl}/*`, () => {
          return new Promise(resolve => {
            setTimeout(() => resolve(new HttpResponse(null, { status: 408 })), 10000);
          });
        })
      );
      break;

    case 'ratelimit':
      mockServer.use(
        http.get(`${baseUrl}/*`, () => {
          return new HttpResponse(
            JSON.stringify({ error: 'Rate limit exceeded' }),
            { status: 429, headers: { 'Retry-After': '60' } }
          );
        })
      );
      break;

    case 'server_error':
      mockServer.use(
        http.get(`${baseUrl}/*`, () => {
          return new HttpResponse(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500 }
          );
        })
      );
      break;

    case 'auth_failure':
      mockServer.use(
        http.get(`${baseUrl}/*`, () => {
          return new HttpResponse(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401 }
          );
        })
      );
      break;
  }
}