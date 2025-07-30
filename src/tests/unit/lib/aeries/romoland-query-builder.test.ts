/**
 * @fileoverview Romoland Query Builder Tests
 * 
 * Tests for the Romoland-specific query builder that constructs
 * SQL queries for the Aeries API based on Romoland School District requirements.
 * 
 * Following TDD practices - these tests define the expected behavior
 * of the query builder before implementation.
 */

import { jest } from '@jest/globals';
import { RomolandQueryBuilder, QueryOptions, RomolandAttendanceQuery } from '../../../../lib/aeries/romoland-query-builder';

describe('RomolandQueryBuilder', () => {
  let queryBuilder: RomolandQueryBuilder;

  beforeEach(() => {
    queryBuilder = new RomolandQueryBuilder();
  });

  describe('Attendance Query Building', () => {
    it('should build basic attendance query with required fields', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16'
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query).toEqual({
        fields: ['STU.NM', 'STU.GR', 'TCH.TE', 'STU.ID', 'AHS.SP', 'AHS.EN', 'AHS.AB', 'AHS.PR'],
        tables: ['STU', 'TCH', 'AHS'],
        dateRange: {
          startDate: '2024-08-15',
          endDate: '2024-08-16'
        },
        filters: {
          activeOnly: true
        }
      });
    });

    it('should include school code filter when specified', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCode: 'RHS'
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.filters.schoolCode).toBe('RHS');
    });

    it('should include period-based attendance when requested', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        includePeriods: true
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.includePeriods).toBe(true);
      expect(query.fields).toContain('AHS.SP'); // Period field
    });

    it('should handle correction window for attendance data', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        includeCorrectionWindow: true,
        correctionWindowDays: 7
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.correctionWindow).toEqual({
        enabled: true,
        days: 7
      });
    });

    it('should build query for middle school with 7 periods', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCode: 'RMS', // Romoland Middle School
        includePeriods: true
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.periodConfiguration).toEqual({
        totalPeriods: 7,
        schoolType: 'MIDDLE_SCHOOL'
      });
    });

    it('should build query for high school with different period structure', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCode: 'RHS', // Romoland High School
        includePeriods: true
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.periodConfiguration).toEqual({
        totalPeriods: 6,
        schoolType: 'HIGH_SCHOOL'
      });
    });

    it('should include grade level filters', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        gradeLevel: '9'
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.filters.gradeLevel).toBe('9');
    });

    it('should handle multiple school codes', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCodes: ['RHS', 'RMS', 'RES']
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.filters.schoolCodes).toEqual(['RHS', 'RMS', 'RES']);
    });
  });

  describe('Student Query Building', () => {
    it('should build student enrollment query', () => {
      // Arrange
      const options: QueryOptions = {
        schoolCode: 'RHS',
        activeOnly: true
      };

      // Act
      const query = queryBuilder.buildStudentQuery(options);

      // Assert
      expect(query).toEqual({
        fields: ['STU.ID', 'STU.NM', 'STU.GR', 'STU.SC', 'STU.AD', 'STU.WD'],
        tables: ['STU'],
        filters: {
          schoolCode: 'RHS',
          activeOnly: true
        }
      });
    });

    it('should include demographic fields when requested', () => {
      // Arrange
      const options: QueryOptions = {
        schoolCode: 'RHS',
        includeDemographics: true
      };

      // Act
      const query = queryBuilder.buildStudentQuery(options);

      // Assert
      expect(query.fields).toContain('STU.ET'); // Ethnicity
      expect(query.fields).toContain('STU.SX'); // Gender
      expect(query.fields).toContain('STU.LG'); // Language
    });

    it('should filter by enrollment status', () => {
      // Arrange
      const options: QueryOptions = {
        schoolCode: 'RHS',
        enrollmentStatus: 'ACTIVE'
      };

      // Act
      const query = queryBuilder.buildStudentQuery(options);

      // Assert
      expect(query.filters.enrollmentStatus).toBe('ACTIVE');
    });
  });

  describe('Teacher Query Building', () => {
    it('should build teacher assignment query', () => {
      // Arrange
      const options: QueryOptions = {
        schoolCode: 'RHS'
      };

      // Act
      const query = queryBuilder.buildTeacherQuery(options);

      // Assert
      expect(query).toEqual({
        fields: ['TCH.ID', 'TCH.NM', 'TCH.TE', 'TCH.SC', 'TCH.RM'],
        tables: ['TCH'],
        filters: {
          schoolCode: 'RHS',
          activeOnly: true
        }
      });
    });

    it('should include course assignments when requested', () => {
      // Arrange
      const options: QueryOptions = {
        schoolCode: 'RHS',
        includeCourseAssignments: true
      };

      // Act
      const query = queryBuilder.buildTeacherQuery(options);

      // Assert
      expect(query.fields).toContain('CSE.CO'); // Course code
      expect(query.fields).toContain('CSE.CN'); // Course name
      expect(query.tables).toContain('CSE'); // Course table
    });
  });

  describe('SQL Generation', () => {
    it('should convert query object to SQL string', () => {
      // Arrange
      const query: RomolandAttendanceQuery = {
        fields: ['STU.NM', 'STU.GR', 'STU.ID'],
        tables: ['STU'],
        dateRange: {
          startDate: '2024-08-15',
          endDate: '2024-08-16'
        },
        filters: {
          schoolCode: 'RHS',
          activeOnly: true
        }
      };

      // Act
      const sql = queryBuilder.toSQL(query);

      // Assert
      expect(sql).toContain('SELECT STU.NM, STU.GR, STU.ID');
      expect(sql).toContain('FROM STU');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('STU.SC = \'RHS\'');
      expect(sql).toContain('AND STU.DEL = \'N\''); // Active only filter
    });

    it('should handle date range filters in SQL', () => {
      // Arrange
      const query: RomolandAttendanceQuery = {
        fields: ['AHS.AB'],
        tables: ['AHS'],
        dateRange: {
          startDate: '2024-08-15',
          endDate: '2024-08-16'
        },
        filters: {}
      };

      // Act
      const sql = queryBuilder.toSQL(query);

      // Assert
      expect(sql).toContain('AHS.DT >= \'2024-08-15\'');
      expect(sql).toContain('AHS.DT <= \'2024-08-16\'');
    });

    it('should handle multiple table joins', () => {
      // Arrange
      const query: RomolandAttendanceQuery = {
        fields: ['STU.NM', 'TCH.TE', 'AHS.AB'],
        tables: ['STU', 'TCH', 'AHS'],
        dateRange: {
          startDate: '2024-08-15',
          endDate: '2024-08-16'
        },
        filters: {}
      };

      // Act
      const sql = queryBuilder.toSQL(query);

      // Assert
      expect(sql).toContain('FROM STU');
      expect(sql).toContain('JOIN AHS ON STU.ID = AHS.STU');
      expect(sql).toContain('JOIN TCH ON AHS.TE = TCH.ID');
    });

    it('should escape SQL special characters', () => {
      // Arrange
      const query: RomolandAttendanceQuery = {
        fields: ['STU.NM'],
        tables: ['STU'],
        filters: {
          studentName: "O'Connor; DROP TABLE students; --"
        }
      };

      // Act
      const sql = queryBuilder.toSQL(query);

      // Assert
      expect(sql).toContain('\'O\'\'Connor; DROP TABLE students; --\'');
      expect(sql).not.toContain('DROP TABLE');
    });
  });

  describe('Validation', () => {
    it('should validate required fields for attendance queries', () => {
      // Arrange
      const invalidOptions: Partial<QueryOptions> = {
        // Missing startDate and endDate
        schoolCode: 'RHS'
      };

      // Act & Assert
      expect(() => queryBuilder.buildAttendanceQuery(invalidOptions as QueryOptions))
        .toThrow('Start date and end date are required for attendance queries');
    });

    it('should validate date format', () => {
      // Arrange
      const invalidOptions: QueryOptions = {
        startDate: 'invalid-date',
        endDate: '2024-08-16'
      };

      // Act & Assert
      expect(() => queryBuilder.buildAttendanceQuery(invalidOptions))
        .toThrow('Invalid date format. Use YYYY-MM-DD');
    });

    it('should validate date range order', () => {
      // Arrange
      const invalidOptions: QueryOptions = {
        startDate: '2024-08-16',
        endDate: '2024-08-15' // End before start
      };

      // Act & Assert
      expect(() => queryBuilder.buildAttendanceQuery(invalidOptions))
        .toThrow('End date must be after start date');
    });

    it('should validate school codes against known schools', () => {
      // Arrange
      const invalidOptions: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCode: 'INVALID_SCHOOL'
      };

      // Act & Assert
      expect(() => queryBuilder.buildAttendanceQuery(invalidOptions))
        .toThrow('Invalid school code: INVALID_SCHOOL');
    });

    it('should validate field names', () => {
      // Arrange
      const query: RomolandAttendanceQuery = {
        fields: ['INVALID.FIELD'],
        tables: ['STU'],
        filters: {}
      };

      // Act & Assert
      expect(() => queryBuilder.toSQL(query))
        .toThrow('Invalid field name: INVALID.FIELD');
    });
  });

  describe('Performance Optimization', () => {
    it('should include appropriate indexes in query hints', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCode: 'RHS'
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);
      const sql = queryBuilder.toSQL(query);

      // Assert
      expect(sql).toContain('/*+ INDEX(AHS, AHS_DATE_IDX) */');
      expect(sql).toContain('/*+ INDEX(STU, STU_SCHOOL_IDX) */');
    });

    it('should limit result sets for large date ranges', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-01-01',
        endDate: '2024-12-31', // Full year
        limit: 10000
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.limit).toBe(10000);
    });

    it('should use batch processing for large school districts', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCodes: ['RHS', 'RMS', 'RES', 'RKE', 'RIE'], // Multiple schools
        batchSize: 1000
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.batchProcessing).toEqual({
        enabled: true,
        batchSize: 1000
      });
    });
  });

  describe('Romoland-Specific Features', () => {
    it('should handle Heritage High School period configuration', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        schoolCode: 'HHS', // Heritage High School
        includePeriods: true
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.periodConfiguration).toEqual({
        totalPeriods: 6,
        schoolType: 'HIGH_SCHOOL',
        blockSchedule: true
      });
    });

    it('should include special program codes for Romoland district', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        includeSpecialPrograms: true
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.fields).toContain('STU.SP1'); // Special program 1
      expect(query.fields).toContain('STU.SP2'); // Special program 2
      expect(query.fields).toContain('STU.EL');  // English Learner status
    });

    it('should handle district-specific attendance codes', () => {
      // Arrange
      const options: QueryOptions = {
        startDate: '2024-08-15',
        endDate: '2024-08-16',
        includeAttendanceCodes: true
      };

      // Act
      const query = queryBuilder.buildAttendanceQuery(options);

      // Assert
      expect(query.attendanceCodeMapping).toEqual({
        'P': 'PRESENT',
        'A': 'ABSENT',
        'T': 'TARDY',
        'X': 'EXCUSED_ABSENT',
        'U': 'UNEXCUSED_ABSENT',
        'S': 'SUSPENDED',
        'I': 'IN_SCHOOL_SUSPENSION'
      });
    });
  });
});