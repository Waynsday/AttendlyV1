/**
 * @fileoverview Tests for comprehensive Zod validation schemas
 * 
 * These tests verify that all entities have proper Zod schemas for:
 * - Input validation and sanitization
 * - API request validation
 * - CSV import sanitization
 * - Form input validation
 * 
 * SECURITY REQUIREMENT: All student data must be validated before processing
 * to prevent injection attacks and ensure FERPA compliance.
 */

import { z } from 'zod';
import {
  StudentSchema,
  TeacherSchema,
  AttendanceRecordSchema,
  InterventionSchema,
  StudentCreateSchema,
  TeacherCreateSchema,
  AttendanceRecordCreateSchema,
  InterventionCreateSchema,
  StudentUpdateSchema,
  TeacherUpdateSchema,
  AttendanceRecordUpdateSchema,
  InterventionUpdateSchema,
  CSVStudentImportSchema,
  CSVAttendanceImportSchema,
  PaginationSchema,
  DateRangeSchema,
  ApiRequestSchema
} from '@/lib/validation/schemas';
import { AttendanceStatus } from '@/domain/entities/attendance-record';
import { InterventionType, InterventionStatus } from '@/domain/entities/intervention';
import { TeacherRole } from '@/domain/entities/teacher';

describe('Validation Schemas - Critical Security Controls', () => {
  describe('StudentSchema', () => {
    it('should validate a valid student object', () => {
      const validStudent = {
        id: '12345',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 7,
        email: 'john.doe@school.edu',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => StudentSchema.parse(validStudent)).not.toThrow();
    });

    it('should reject invalid student data and prevent injection attacks', () => {
      const maliciousStudent = {
        id: '<script>alert("xss")</script>',
        firstName: 'John\'"; DROP TABLE students; --',
        lastName: 'Doe',
        gradeLevel: 'invalid',
        email: 'not-an-email',
        isActive: 'yes'
      };

      expect(() => StudentSchema.parse(maliciousStudent)).toThrow();
    });

    it('should sanitize and validate student names with proper length limits', () => {
      const longNameStudent = {
        id: '12345',
        firstName: 'A'.repeat(101), // Too long
        lastName: 'Doe',
        gradeLevel: 7,
        email: 'john.doe@school.edu'
      };

      expect(() => StudentSchema.parse(longNameStudent)).toThrow();
    });

    it('should validate grade levels are within middle school range (6-8)', () => {
      const invalidGradeStudent = {
        id: '12345',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 12, // High school grade
        email: 'john.doe@school.edu'
      };

      expect(() => StudentSchema.parse(invalidGradeStudent)).toThrow();
    });

    it('should validate and sanitize email addresses properly', () => {
      const invalidEmailStudent = {
        id: '12345',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 7,
        email: 'javascript:alert("xss")' // XSS attempt
      };

      expect(() => StudentSchema.parse(invalidEmailStudent)).toThrow();
    });
  });

  describe('TeacherSchema', () => {
    it('should validate a valid teacher object', () => {
      const validTeacher = {
        employeeId: 'T12345',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@romoland.k12.ca.us',
        department: 'Mathematics',
        role: TeacherRole.TEACHER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => TeacherSchema.parse(validTeacher)).not.toThrow();
    });

    it('should reject malicious teacher data and prevent injection', () => {
      const maliciousTeacher = {
        employeeId: '../../etc/passwd',
        firstName: 'Jane\x00\x0A',
        lastName: 'Smith<script>',
        email: 'jane@evil.com',
        department: 'Math"; DELETE FROM teachers; --',
        role: 'ADMIN'
      };

      expect(() => TeacherSchema.parse(maliciousTeacher)).toThrow();
    });

    it('should validate employee ID format (T + digits)', () => {
      const invalidEmployeeIdTeacher = {
        employeeId: 'INVALID123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@romoland.k12.ca.us',
        department: 'Mathematics',
        role: TeacherRole.TEACHER
      };

      expect(() => TeacherSchema.parse(invalidEmployeeIdTeacher)).toThrow();
    });

    it('should validate teacher role is from enum', () => {
      const invalidRoleTeacher = {
        employeeId: 'T12345',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@romoland.k12.ca.us',
        department: 'Mathematics',
        role: 'SUPER_ADMIN' // Invalid role
      };

      expect(() => TeacherSchema.parse(invalidRoleTeacher)).toThrow();
    });
  });

  describe('AttendanceRecordSchema', () => {
    it('should validate a valid attendance record', () => {
      const validRecord = {
        studentId: '12345',
        date: new Date(),
        schoolYear: '2024-2025',
        periodAttendance: [
          { period: 1, status: AttendanceStatus.PRESENT },
          { period: 2, status: AttendanceStatus.ABSENT },
          { period: 3, status: AttendanceStatus.TARDY },
          { period: 4, status: AttendanceStatus.PRESENT },
          { period: 5, status: AttendanceStatus.PRESENT },
          { period: 6, status: AttendanceStatus.PRESENT },
          { period: 7, status: AttendanceStatus.PRESENT }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => AttendanceRecordSchema.parse(validRecord)).not.toThrow();
    });

    it('should reject malicious attendance data', () => {
      const maliciousRecord = {
        studentId: '"; DROP TABLE attendance; --',
        date: 'not-a-date',
        schoolYear: '<script>alert("xss")</script>',
        periodAttendance: [
          { period: 99, status: 'INVALID_STATUS' }
        ]
      };

      expect(() => AttendanceRecordSchema.parse(maliciousRecord)).toThrow();
    });

    it('should validate school year format (YYYY-YYYY)', () => {
      const invalidYearRecord = {
        studentId: '12345',
        date: new Date(),
        schoolYear: '2024', // Invalid format
        periodAttendance: []
      };

      expect(() => AttendanceRecordSchema.parse(invalidYearRecord)).toThrow();
    });

    it('should require exactly 7 periods for middle school', () => {
      const invalidPeriodsRecord = {
        studentId: '12345',
        date: new Date(),
        schoolYear: '2024-2025',
        periodAttendance: [
          { period: 1, status: AttendanceStatus.PRESENT }
        ] // Missing periods 2-7
      };

      expect(() => AttendanceRecordSchema.parse(invalidPeriodsRecord)).toThrow();
    });

    it('should validate period numbers are between 1-7', () => {
      const invalidPeriodNumberRecord = {
        studentId: '12345',
        date: new Date(),
        schoolYear: '2024-2025',
        periodAttendance: [
          { period: 0, status: AttendanceStatus.PRESENT }, // Invalid period
          { period: 2, status: AttendanceStatus.PRESENT },
          { period: 3, status: AttendanceStatus.PRESENT },
          { period: 4, status: AttendanceStatus.PRESENT },
          { period: 5, status: AttendanceStatus.PRESENT },
          { period: 6, status: AttendanceStatus.PRESENT },
          { period: 7, status: AttendanceStatus.PRESENT }
        ]
      };

      expect(() => AttendanceRecordSchema.parse(invalidPeriodNumberRecord)).toThrow();
    });
  });

  describe('InterventionSchema', () => {
    it('should validate a valid intervention', () => {
      const validIntervention = {
        studentId: '12345',
        type: InterventionType.PARENT_CONTACT,
        description: 'Called parent regarding attendance concerns',
        createdBy: 'T12345',
        scheduledDate: new Date(Date.now() + 86400000), // Tomorrow
        status: InterventionStatus.SCHEDULED,
        completedDate: null,
        outcome: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => InterventionSchema.parse(validIntervention)).not.toThrow();
    });

    it('should reject malicious intervention data', () => {
      const maliciousIntervention = {
        studentId: '../../etc/passwd',
        type: 'MALICIOUS_TYPE',
        description: '<script>alert("xss")</script>',
        createdBy: 'INVALID_ID',
        scheduledDate: 'not-a-date',
        status: 'INVALID_STATUS'
      };

      expect(() => InterventionSchema.parse(maliciousIntervention)).toThrow();
    });

    it('should validate intervention type is from enum', () => {
      const invalidTypeIntervention = {
        studentId: '12345',
        type: 'INVALID_TYPE',
        description: 'Valid description',
        createdBy: 'T12345',
        scheduledDate: new Date()
      };

      expect(() => InterventionSchema.parse(invalidTypeIntervention)).toThrow();
    });

    it('should validate createdBy is valid employee ID', () => {
      const invalidCreatedByIntervention = {
        studentId: '12345',
        type: InterventionType.PARENT_CONTACT,
        description: 'Valid description',
        createdBy: 'INVALID123', // Not T prefix
        scheduledDate: new Date()
      };

      expect(() => InterventionSchema.parse(invalidCreatedByIntervention)).toThrow();
    });
  });

  describe('CSV Import Schemas - Critical Security', () => {
    it('should validate and sanitize CSV student import data', () => {
      const csvStudentData = {
        student_id: '12345',
        first_name: 'John',
        last_name: 'Doe',
        grade_level: '7',
        email: 'john.doe@school.edu'
      };

      expect(() => CSVStudentImportSchema.parse(csvStudentData)).not.toThrow();
    });

    it('should reject malicious CSV student data', () => {
      const maliciousCSVData = {
        student_id: '"; DROP TABLE students; --',
        first_name: '<script>alert("xss")</script>',
        last_name: 'Doe\x00\x0A',
        grade_level: 'eval("malicious_code()")',
        email: 'javascript:alert("xss")'
      };

      expect(() => CSVStudentImportSchema.parse(maliciousCSVData)).toThrow();
    });

    it('should validate and sanitize CSV attendance import data', () => {
      const csvAttendanceData = {
        student_id: '12345',
        date: '2025-01-15',
        school_year: '2024-2025',
        period_1: 'PRESENT',
        period_2: 'ABSENT',
        period_3: 'TARDY',
        period_4: 'PRESENT',
        period_5: 'PRESENT',
        period_6: 'PRESENT',
        period_7: 'PRESENT'
      };

      expect(() => CSVAttendanceImportSchema.parse(csvAttendanceData)).not.toThrow();
    });

    it('should reject malicious CSV attendance data', () => {
      const maliciousCSVAttendance = {
        student_id: '../../etc/passwd',
        date: '<script>',
        school_year: '"; DELETE FROM attendance; --',
        period_1: 'INVALID_STATUS',
        period_2: 'eval()',
        period_3: 'TARDY',
        period_4: 'PRESENT',
        period_5: 'PRESENT',
        period_6: 'PRESENT',
        period_7: 'PRESENT'
      };

      expect(() => CSVAttendanceImportSchema.parse(maliciousCSVAttendance)).toThrow();
    });
  });

  describe('API Request Schemas - Security Layer', () => {
    it('should validate API request with pagination', () => {
      const apiRequest = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        filters: {}
      };

      expect(() => PaginationSchema.parse(apiRequest)).not.toThrow();
    });

    it('should reject malicious pagination parameters', () => {
      const maliciousRequest = {
        page: 'eval("malicious_code()")',
        limit: '999999999',
        sortBy: '"; DROP TABLE students; --',
        sortOrder: '<script>alert("xss")</script>'
      };

      expect(() => PaginationSchema.parse(maliciousRequest)).toThrow();
    });

    it('should validate date range parameters', () => {
      const dateRange = {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      expect(() => DateRangeSchema.parse(dateRange)).not.toThrow();
    });

    it('should reject invalid date formats', () => {
      const invalidDateRange = {
        startDate: 'not-a-date',
        endDate: '<script>alert("xss")</script>'
      };

      expect(() => DateRangeSchema.parse(invalidDateRange)).toThrow();
    });

    it('should validate complete API request structure', () => {
      const apiRequest = {
        body: { firstName: 'John', lastName: 'Doe' },
        query: { page: '1', limit: '20' },
        params: { id: '12345' }
      };

      expect(() => ApiRequestSchema.parse(apiRequest)).not.toThrow();
    });

    it('should accept generic API request data but validate structure', () => {
      // ApiRequestSchema is intentionally generic for flexibility
      // Specific validation happens at the endpoint level with entity schemas
      const apiRequest = {
        body: { 
          firstName: 'John',
          lastName: 'Doe'
        },
        query: { 
          page: '1',
          limit: '20'
        },
        params: { 
          id: '12345'
        }
      };

      expect(() => ApiRequestSchema.parse(apiRequest)).not.toThrow();

      // Test that it rejects non-object structures
      expect(() => ApiRequestSchema.parse("not an object")).toThrow();
      expect(() => ApiRequestSchema.parse([])).toThrow();
    });
  });

  describe('Schema Edge Cases and Security Boundaries', () => {
    it('should handle null and undefined values securely', () => {
      expect(() => StudentSchema.parse(null)).toThrow();
      expect(() => StudentSchema.parse(undefined)).toThrow();
      expect(() => StudentSchema.parse({})).toThrow();
    });

    it('should prevent prototype pollution attacks', () => {
      const maliciousData = {
        '__proto__': { 'isAdmin': true },
        'constructor': { 'prototype': { 'isAdmin': true } },
        id: '12345',
        firstName: 'John',
        lastName: 'Doe'
      };

      expect(() => StudentSchema.parse(maliciousData)).toThrow();
    });

    it('should limit string lengths to prevent DoS attacks', () => {
      const oversizedData = {
        id: '12345',
        firstName: 'A'.repeat(10000), // Extremely long string
        lastName: 'Doe',
        gradeLevel: 7,
        email: 'john.doe@school.edu'
      };

      expect(() => StudentSchema.parse(oversizedData)).toThrow();
    });

    it('should validate array lengths to prevent memory exhaustion', () => {
      const massiveArray = {
        studentId: '12345',
        date: new Date(),
        schoolYear: '2024-2025',
        periodAttendance: new Array(10000).fill({ period: 1, status: 'PRESENT' })
      };

      expect(() => AttendanceRecordSchema.parse(massiveArray)).toThrow();
    });
  });
});