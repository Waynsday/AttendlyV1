/**
 * @fileoverview Aeries Data Validator Tests
 * 
 * Tests for the data validation service that ensures
 * Aeries API response data meets security and quality standards.
 * 
 * Following TDD practices - these tests define the expected behavior
 * of the data validator before implementation.
 */

import { jest } from '@jest/globals';
import { AeriesDataValidator, ValidationResult, ValidationError, PIIScanner } from '../../../../lib/aeries/data-validator';
import type { AeriesAttendanceRecord, AeriesStudent } from '../../../../types/aeries';

describe('AeriesDataValidator', () => {
  let validator: AeriesDataValidator;
  let mockPIIScanner: jest.Mocked<PIIScanner>;

  beforeEach(() => {
    mockPIIScanner = {
      scanForPII: jest.fn(),
      sanitizeData: jest.fn(),
      maskSensitiveFields: jest.fn()
    } as jest.Mocked<PIIScanner>;

    validator = new AeriesDataValidator({
      strictMode: true,
      enablePIIScanning: true,
      maxRecordSize: 10000,
      allowedSchools: ['RHS', 'RMS', 'RES', 'HHS'],
      piiScanner: mockPIIScanner
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Attendance Data Validation', () => {
    it('should validate valid attendance records', () => {
      // Arrange
      const validAttendanceData: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'RHS',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [{
          period: 1,
          periodName: 'Period 1',
          status: 'PRESENT',
          teacherId: 'TCH001',
          teacherName: 'Smith, John',
          courseCode: 'ENG101',
          courseName: 'English 1',
          lastModified: '2024-08-15T08:30:00Z'
        }],
        dailyAttendance: {
          status: 'PRESENT',
          minutesAbsent: 0,
          minutesTardy: 0
        },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }];

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: false, piiFields: [] });

      // Act
      const result = validator.validateAttendanceData(validAttendanceData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData).toEqual(validAttendanceData);
    });

    it('should reject attendance records with missing required fields', () => {
      // Arrange
      const invalidAttendanceData = [{
        // Missing studentId, studentNumber, schoolCode
        attendanceDate: '2024-08-15',
        periods: [],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: '2024-08-15T08:30:00Z'
      }] as AeriesAttendanceRecord[];

      // Act
      const result = validator.validateAttendanceData(invalidAttendanceData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'studentId',
        message: 'Student ID is required',
        recordIndex: 0,
        severity: 'ERROR'
      });
      expect(result.errors).toContainEqual({
        field: 'studentNumber',
        message: 'Student Number is required',
        recordIndex: 0,
        severity: 'ERROR'
      });
      expect(result.errors).toContainEqual({
        field: 'schoolCode',
        message: 'School Code is required',
        recordIndex: 0,
        severity: 'ERROR'
      });
    });

    it('should validate date formats', () => {
      // Arrange
      const invalidDateData: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'RHS',
        attendanceDate: '08/15/2024', // Invalid format
        schoolYear: '2024-2025',
        periods: [],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: 'invalid-date', // Invalid format
        modifiedBy: 'AERIES_SYNC'
      }];

      // Act
      const result = validator.validateAttendanceData(invalidDateData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'attendanceDate',
        message: 'Invalid date format. Expected ISO 8601 date (YYYY-MM-DD)',
        recordIndex: 0,
        severity: 'ERROR'
      });
      expect(result.errors).toContainEqual({
        field: 'lastModified',
        message: 'Invalid datetime format. Expected ISO 8601 datetime',
        recordIndex: 0,
        severity: 'ERROR'
      });
    });

    it('should validate school codes against allowed list', () => {
      // Arrange
      const invalidSchoolData: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'INVALID_SCHOOL',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }];

      // Act
      const result = validator.validateAttendanceData(invalidSchoolData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'schoolCode',
        message: 'Invalid school code: INVALID_SCHOOL. Allowed codes: RHS, RMS, RES, HHS',
        recordIndex: 0,
        severity: 'ERROR'
      });
    });

    it('should validate period data structure', () => {
      // Arrange
      const invalidPeriodData: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'RHS',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [{
          period: 0, // Invalid period number
          periodName: '',
          status: 'INVALID_STATUS' as any,
          lastModified: '2024-08-15T08:30:00Z'
        }],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }];

      // Act
      const result = validator.validateAttendanceData(invalidPeriodData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'periods[0].period',
        message: 'Period number must be between 1 and 8',
        recordIndex: 0,
        severity: 'ERROR'
      });
      expect(result.errors).toContainEqual({
        field: 'periods[0].status',
        message: 'Invalid attendance status: INVALID_STATUS',
        recordIndex: 0,
        severity: 'ERROR'
      });
    });

    it('should validate Romoland middle school 7-period structure', () => {
      // Arrange
      const middleSchoolData: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'RMS',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [
          { period: 1, periodName: 'Period 1', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 2, periodName: 'Period 2', status: 'ABSENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 3, periodName: 'Period 3', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 4, periodName: 'Period 4', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 5, periodName: 'Period 5', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 6, periodName: 'Period 6', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 7, periodName: 'Period 7', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' }
        ],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }];

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: false, piiFields: [] });

      // Act
      const result = validator.validateAttendanceData(middleSchoolData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('period count')
        })
      );
    });

    it('should warn about unexpected period counts for school type', () => {
      // Arrange
      const unexpectedPeriodData: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'RMS', // Middle school should have 7 periods
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [
          { period: 1, periodName: 'Period 1', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 2, periodName: 'Period 2', status: 'PRESENT', lastModified: '2024-08-15T08:30:00Z' }
          // Only 2 periods for middle school
        ],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }];

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: false, piiFields: [] });

      // Act
      const result = validator.validateAttendanceData(unexpectedPeriodData);

      // Assert
      expect(result.warnings).toContainEqual({
        field: 'periods',
        message: 'Middle school (RMS) typically has 7 periods, but found 2',
        recordIndex: 0,
        severity: 'WARNING'
      });
    });
  });

  describe('Student Data Validation', () => {
    it('should validate valid student records', () => {
      // Arrange
      const validStudentData: AeriesStudent[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        stateStudentId: 'CA987654321',
        firstName: 'John',
        middleName: 'A',
        lastName: 'Doe',
        grade: '9',
        schoolCode: 'RHS',
        homeRoom: 'A101',
        enrollmentStatus: 'ACTIVE',
        enrollmentDate: '2024-08-15',
        birthDate: '2008-06-15',
        gender: 'M',
        ethnicity: 'Hispanic',
        language: 'English',
        specialPrograms: ['EL', 'Title1'],
        lastUpdate: '2024-08-15T08:30:00Z'
      }];

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: true, piiFields: ['firstName', 'lastName', 'birthDate'] });
      mockPIIScanner.sanitizeData.mockReturnValue(validStudentData);

      // Act
      const result = validator.validateStudentData(validStudentData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockPIIScanner.sanitizeData).toHaveBeenCalledWith(validStudentData);
    });

    it('should validate grade levels', () => {
      // Arrange
      const invalidGradeData: AeriesStudent[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        stateStudentId: 'CA987654321',
        firstName: 'John',
        lastName: 'Doe',
        grade: '15', // Invalid grade
        schoolCode: 'RHS',
        enrollmentStatus: 'ACTIVE',
        enrollmentDate: '2024-08-15',
        birthDate: '2008-06-15',
        gender: 'M',
        lastUpdate: '2024-08-15T08:30:00Z'
      }];

      // Act
      const result = validator.validateStudentData(invalidGradeData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'grade',
        message: 'Invalid grade level: 15. Allowed grades: K, 1-12',
        recordIndex: 0,
        severity: 'ERROR'
      });
    });

    it('should validate enrollment status values', () => {
      // Arrange
      const invalidStatusData: AeriesStudent[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        stateStudentId: 'CA987654321',
        firstName: 'John',
        lastName: 'Doe',
        grade: '9',
        schoolCode: 'RHS',
        enrollmentStatus: 'UNKNOWN' as any, // Invalid status
        enrollmentDate: '2024-08-15',
        birthDate: '2008-06-15',
        gender: 'M',
        lastUpdate: '2024-08-15T08:30:00Z'
      }];

      // Act
      const result = validator.validateStudentData(invalidStatusData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'enrollmentStatus',
        message: 'Invalid enrollment status: UNKNOWN. Allowed values: ACTIVE, INACTIVE, TRANSFERRED',
        recordIndex: 0,
        severity: 'ERROR'
      });
    });
  });

  describe('PII Scanning and Security', () => {
    it('should detect PII in data fields', () => {
      // Arrange
      const dataWithPII: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456789', // Could be SSN
        schoolCode: 'RHS',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }];

      mockPIIScanner.scanForPII.mockReturnValue({
        hasPII: true,
        piiFields: ['studentNumber'],
        violations: [{
          field: 'studentNumber',
          type: 'SSN_PATTERN',
          confidence: 0.8
        }]
      });

      // Act
      const result = validator.validateAttendanceData(dataWithPII);

      // Assert
      expect(result.warnings).toContainEqual({
        field: 'studentNumber',
        message: 'Potential PII detected: SSN_PATTERN (confidence: 80%)',
        recordIndex: 0,
        severity: 'WARNING'
      });
    });

    it('should sanitize sensitive data', () => {
      // Arrange
      const sensitiveData: AeriesStudent[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        stateStudentId: 'CA987654321',
        firstName: 'John',
        lastName: 'Doe',
        grade: '9',
        schoolCode: 'RHS',
        enrollmentStatus: 'ACTIVE',
        enrollmentDate: '2024-08-15',
        birthDate: '2008-06-15',
        gender: 'M',
        lastUpdate: '2024-08-15T08:30:00Z'
      }];

      const sanitizedData = [{
        ...sensitiveData[0],
        firstName: 'J***',
        lastName: 'D**',
        birthDate: '****-**-15'
      }];

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: true, piiFields: ['firstName', 'lastName', 'birthDate'] });
      mockPIIScanner.sanitizeData.mockReturnValue(sanitizedData);

      // Act
      const result = validator.validateStudentData(sensitiveData);

      // Assert
      expect(mockPIIScanner.sanitizeData).toHaveBeenCalledWith(sensitiveData);
      expect(result.sanitizedData).toEqual(sanitizedData);
    });

    it('should mask sensitive fields in error messages', () => {
      // Arrange
      const dataWithSensitiveError: AeriesStudent[] = [{
        studentId: 'STU12345',
        studentNumber: '123-45-6789', // SSN format
        stateStudentId: 'CA987654321',
        firstName: 'John',
        lastName: 'Doe',
        grade: 'INVALID',
        schoolCode: 'RHS',
        enrollmentStatus: 'ACTIVE',
        enrollmentDate: '2024-08-15',
        birthDate: '2008-06-15',
        gender: 'M',
        lastUpdate: '2024-08-15T08:30:00Z'
      }];

      mockPIIScanner.maskSensitiveFields.mockImplementation((message) => 
        message.replace(/\d{3}-\d{2}-\d{4}/, '***-**-****')
      );

      // Act
      const result = validator.validateStudentData(dataWithSensitiveError);

      // Assert
      expect(result.errors[0].message).not.toContain('123-45-6789');
      expect(mockPIIScanner.maskSensitiveFields).toHaveBeenCalled();
    });
  });

  describe('Data Integrity Checks', () => {
    it('should validate data consistency across related fields', () => {
      // Arrange
      const inconsistentData: AeriesAttendanceRecord[] = [{
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'RHS',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [
          { period: 1, periodName: 'Period 1', status: 'ABSENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 2, periodName: 'Period 2', status: 'ABSENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 3, periodName: 'Period 3', status: 'ABSENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 4, periodName: 'Period 4', status: 'ABSENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 5, periodName: 'Period 5', status: 'ABSENT', lastModified: '2024-08-15T08:30:00Z' },
          { period: 6, periodName: 'Period 6', status: 'ABSENT', lastModified: '2024-08-15T08:30:00Z' }
        ],
        dailyAttendance: { status: 'PRESENT' }, // Inconsistent with all periods absent
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }];

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: false, piiFields: [] });

      // Act
      const result = validator.validateAttendanceData(inconsistentData);

      // Assert
      expect(result.warnings).toContainEqual({
        field: 'dailyAttendance.status',
        message: 'Daily status PRESENT inconsistent with all periods being ABSENT',
        recordIndex: 0,
        severity: 'WARNING'
      });
    });

    it('should check for duplicate records', () => {
      // Arrange
      const duplicateData: AeriesAttendanceRecord[] = [
        {
          studentId: 'STU12345',
          studentNumber: '123456',
          schoolCode: 'RHS',
          attendanceDate: '2024-08-15',
          schoolYear: '2024-2025',
          periods: [],
          dailyAttendance: { status: 'PRESENT' },
          lastModified: '2024-08-15T08:30:00Z',
          modifiedBy: 'AERIES_SYNC'
        },
        {
          studentId: 'STU12345', // Same student
          studentNumber: '123456',
          schoolCode: 'RHS',
          attendanceDate: '2024-08-15', // Same date
          schoolYear: '2024-2025',
          periods: [],
          dailyAttendance: { status: 'ABSENT' },
          lastModified: '2024-08-15T09:00:00Z',
          modifiedBy: 'AERIES_SYNC'
        }
      ];

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: false, piiFields: [] });

      // Act
      const result = validator.validateAttendanceData(duplicateData);

      // Assert
      expect(result.warnings).toContainEqual({
        field: 'record',
        message: 'Duplicate attendance record found for student STU12345 on 2024-08-15',
        recordIndex: 1,
        severity: 'WARNING'
      });
    });

    it('should validate record size limits', () => {
      // Arrange
      const largeRecord: AeriesAttendanceRecord = {
        studentId: 'STU12345',
        studentNumber: '123456',
        schoolCode: 'RHS',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [],
        dailyAttendance: { 
          status: 'PRESENT',
          excuseDescription: 'A'.repeat(15000) // Exceeds maxRecordSize
        },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      };

      // Act
      const result = validator.validateAttendanceData([largeRecord]);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'record',
        message: 'Record size exceeds maximum allowed size of 10000 bytes',
        recordIndex: 0,
        severity: 'ERROR'
      });
    });
  });

  describe('Performance and Batching', () => {
    it('should handle large datasets efficiently', () => {
      // Arrange
      const largeDataset: AeriesAttendanceRecord[] = [];
      for (let i = 0; i < 10000; i++) {
        largeDataset.push({
          studentId: `STU${i.toString().padStart(5, '0')}`,
          studentNumber: i.toString(),
          schoolCode: 'RHS',
          attendanceDate: '2024-08-15',
          schoolYear: '2024-2025',
          periods: [],
          dailyAttendance: { status: 'PRESENT' },
          lastModified: '2024-08-15T08:30:00Z',
          modifiedBy: 'AERIES_SYNC'
        });
      }

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: false, piiFields: [] });

      // Act
      const startTime = Date.now();
      const result = validator.validateAttendanceData(largeDataset);
      const endTime = Date.now();

      // Assert
      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should support batch validation', async () => {
      // Arrange
      const batchData: AeriesAttendanceRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        studentId: `STU${i}`,
        studentNumber: i.toString(),
        schoolCode: 'RHS',
        attendanceDate: '2024-08-15',
        schoolYear: '2024-2025',
        periods: [],
        dailyAttendance: { status: 'PRESENT' },
        lastModified: '2024-08-15T08:30:00Z',
        modifiedBy: 'AERIES_SYNC'
      }));

      mockPIIScanner.scanForPII.mockReturnValue({ hasPII: false, piiFields: [] });

      // Act
      const result = await validator.validateAttendanceDataBatch(batchData, { batchSize: 100 });

      // Assert
      expect(result.totalRecords).toBe(1000);
      expect(result.validRecords).toBe(1000);
      expect(result.invalidRecords).toBe(0);
      expect(result.batchResults).toHaveLength(10); // 1000 / 100 = 10 batches
    });
  });
});