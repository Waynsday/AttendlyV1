import * as fc from 'fast-check';
import { AttendanceRecord, AttendanceStatus, PeriodAttendance } from '@/domain/entities/attendance-record';
import { StudentId } from '@/domain/value-objects/student-id';
import { TestDataFactory } from '@/tests/fixtures/test-data-factory';

/**
 * Comprehensive AttendanceRecord Entity Tests
 * 
 * Tests all edge cases and scenarios specific to Romoland Middle School:
 * - 7-period day validation
 * - Full-day absence calculations
 * - Period-based attendance tracking
 * - California attendance law compliance
 * - Multi-year school year validation
 * - Data integrity and business rules
 */

describe('AttendanceRecord Entity - Comprehensive Tests', () => {
  const validStudentId = new StudentId('123456');
  const validDate = new Date('2025-01-15');
  const validSchoolYear = '2024-2025';
  
  describe('Romoland-Specific Business Rules', () => {
    describe('7-Period Day Validation', () => {
      it('should require exactly 7 periods for middle school', () => {
        const incompletePeriods = [
          { period: 1, status: AttendanceStatus.PRESENT },
          { period: 2, status: AttendanceStatus.PRESENT },
          { period: 3, status: AttendanceStatus.PRESENT },
          { period: 4, status: AttendanceStatus.PRESENT },
          { period: 5, status: AttendanceStatus.PRESENT },
          { period: 6, status: AttendanceStatus.PRESENT }
          // Missing period 7
        ];

        expect(() => new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          incompletePeriods
        )).toThrow('Middle school must have exactly 7 periods');
      });

      it('should reject more than 7 periods', () => {
        const tooManyPeriods = Array.from({ length: 8 }, (_, i) => ({
          period: i + 1,
          status: AttendanceStatus.PRESENT
        }));

        expect(() => new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          tooManyPeriods
        )).toThrow('Middle school must have exactly 7 periods');
      });

      it('should reject fewer than 7 periods', () => {
        const tooFewPeriods = [
          { period: 1, status: AttendanceStatus.PRESENT },
          { period: 2, status: AttendanceStatus.PRESENT }
        ];

        expect(() => new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          tooFewPeriods
        )).toThrow('Middle school must have exactly 7 periods');
      });

      it('should validate all periods 1-7 are present', () => {
        const missingPeriod3 = [
          { period: 1, status: AttendanceStatus.PRESENT },
          { period: 2, status: AttendanceStatus.PRESENT },
          { period: 4, status: AttendanceStatus.PRESENT }, // Missing 3
          { period: 5, status: AttendanceStatus.PRESENT },
          { period: 6, status: AttendanceStatus.PRESENT },
          { period: 7, status: AttendanceStatus.PRESENT },
          { period: 8, status: AttendanceStatus.PRESENT } // Invalid period
        ];

        expect(() => new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          missingPeriod3
        )).toThrow('Missing period 3');
      });

      it('should reject invalid period numbers', () => {
        const invalidPeriods = [
          { period: 0, status: AttendanceStatus.PRESENT }, // Invalid
          { period: 2, status: AttendanceStatus.PRESENT },
          { period: 3, status: AttendanceStatus.PRESENT },
          { period: 4, status: AttendanceStatus.PRESENT },
          { period: 5, status: AttendanceStatus.PRESENT },
          { period: 6, status: AttendanceStatus.PRESENT },
          { period: 7, status: AttendanceStatus.PRESENT }
        ];

        expect(() => new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          invalidPeriods
        )).toThrow('Period numbers must be between 1 and 7');
      });

      it('should reject duplicate periods', () => {
        const duplicatePeriods = [
          { period: 1, status: AttendanceStatus.PRESENT },
          { period: 2, status: AttendanceStatus.PRESENT },
          { period: 2, status: AttendanceStatus.ABSENT }, // Duplicate
          { period: 4, status: AttendanceStatus.PRESENT },
          { period: 5, status: AttendanceStatus.PRESENT },
          { period: 6, status: AttendanceStatus.PRESENT },
          { period: 7, status: AttendanceStatus.PRESENT }
        ];

        expect(() => new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          duplicatePeriods
        )).toThrow('Duplicate periods are not allowed');
      });
    });

    describe('Full-Day Absence Logic', () => {
      it('should identify full-day absence when all 7 periods are absent', () => {
        const allAbsent = Array.from({ length: 7 }, (_, i) => ({
          period: i + 1,
          status: AttendanceStatus.ABSENT
        }));

        const record = new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          allAbsent
        );

        expect(record.isFullDayAbsent()).toBe(true);
        expect(record.calculateDailyAttendancePercentage().value).toBe(0);
      });

      it('should not identify full-day absence if any period is present', () => {
        const partiallyPresent = [
          { period: 1, status: AttendanceStatus.PRESENT }, // Present
          { period: 2, status: AttendanceStatus.ABSENT },
          { period: 3, status: AttendanceStatus.ABSENT },
          { period: 4, status: AttendanceStatus.ABSENT },
          { period: 5, status: AttendanceStatus.ABSENT },
          { period: 6, status: AttendanceStatus.ABSENT },
          { period: 7, status: AttendanceStatus.ABSENT }
        ];

        const record = new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          partiallyPresent
        );

        expect(record.isFullDayAbsent()).toBe(false);
        expect(record.calculateDailyAttendancePercentage().value).toBeCloseTo(14.29, 2); // 1/7
      });

      it('should not identify full-day absence if any period is tardy', () => {
        const tardyPresent = [
          { period: 1, status: AttendanceStatus.TARDY }, // Tardy counts as present
          { period: 2, status: AttendanceStatus.ABSENT },
          { period: 3, status: AttendanceStatus.ABSENT },
          { period: 4, status: AttendanceStatus.ABSENT },
          { period: 5, status: AttendanceStatus.ABSENT },
          { period: 6, status: AttendanceStatus.ABSENT },
          { period: 7, status: AttendanceStatus.ABSENT }
        ];

        const record = new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          tardyPresent
        );

        expect(record.isFullDayAbsent()).toBe(false);
        expect(record.calculateDailyAttendancePercentage().value).toBeCloseTo(14.29, 2);
      });
    });

    describe('Attendance Percentage Calculations', () => {
      it('should calculate 100% attendance for perfect attendance', () => {
        const perfectAttendance = Array.from({ length: 7 }, (_, i) => ({
          period: i + 1,
          status: AttendanceStatus.PRESENT
        }));

        const record = new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          perfectAttendance
        );

        expect(record.calculateDailyAttendancePercentage().value).toBe(100);
      });

      it('should count tardy as present for attendance percentage', () => {
        const allTardy = Array.from({ length: 7 }, (_, i) => ({
          period: i + 1,
          status: AttendanceStatus.TARDY
        }));

        const record = new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          allTardy
        );

        expect(record.calculateDailyAttendancePercentage().value).toBe(100);
      });

      it('should calculate correct percentage for mixed attendance', () => {
        // 3 present, 2 tardy, 2 absent = 5/7 = ~71.43%
        const mixedAttendance = [
          { period: 1, status: AttendanceStatus.PRESENT },
          { period: 2, status: AttendanceStatus.PRESENT },
          { period: 3, status: AttendanceStatus.PRESENT },
          { period: 4, status: AttendanceStatus.TARDY },
          { period: 5, status: AttendanceStatus.TARDY },
          { period: 6, status: AttendanceStatus.ABSENT },
          { period: 7, status: AttendanceStatus.ABSENT }
        ];

        const record = new AttendanceRecord(
          validStudentId,
          validDate,
          validSchoolYear,
          mixedAttendance
        );

        expect(record.calculateDailyAttendancePercentage().value).toBeCloseTo(71.43, 2);
      });
    });
  });

  describe('California Attendance Law Compliance (SB 153/176)', () => {
    it('should handle truancy threshold scenarios', () => {
      // Test scenarios that would trigger truancy letters under CA law
      const chronicAbsenteeism = [
        { period: 1, status: AttendanceStatus.ABSENT },
        { period: 2, status: AttendanceStatus.ABSENT },
        { period: 3, status: AttendanceStatus.ABSENT },
        { period: 4, status: AttendanceStatus.PRESENT },
        { period: 5, status: AttendanceStatus.PRESENT },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ];

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        chronicAbsenteeism
      );

      // Should track absent periods for intervention calculations
      const absentPeriods = record.getAbsentPeriods();
      expect(absentPeriods).toEqual([1, 2, 3]);
      expect(absentPeriods.length).toBe(3); // 3+ unexcused absences in morning
    });

    it('should track patterns that indicate intervention needs', () => {
      // Morning tardiness pattern (common issue requiring intervention)
      const morningTardiness = [
        { period: 1, status: AttendanceStatus.TARDY },
        { period: 2, status: AttendanceStatus.TARDY },
        { period: 3, status: AttendanceStatus.PRESENT },
        { period: 4, status: AttendanceStatus.PRESENT },
        { period: 5, status: AttendanceStatus.PRESENT },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ];

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        morningTardiness
      );

      const presentPeriods = record.getPresentPeriods();
      expect(presentPeriods).toEqual([1, 2, 3, 4, 5, 6, 7]); // Tardy counts as present
      
      // But we can identify the tardy pattern for intervention purposes
      const tardyPeriods = record.periodAttendance
        .filter(p => p.status === AttendanceStatus.TARDY)
        .map(p => p.period);
      expect(tardyPeriods).toEqual([1, 2]);
    });
  });

  describe('School Year Validation', () => {
    it('should accept valid school year formats', () => {
      const validSchoolYears = [
        '2024-2025',
        '2023-2024',
        '2025-2026'
      ];

      validSchoolYears.forEach(schoolYear => {
        const periods = TestDataFactory.generatePeriodAttendance('perfect');
        
        const record = new AttendanceRecord(
          validStudentId,
          validDate,
          schoolYear,
          periods
        );

        expect(record.schoolYear).toBe(schoolYear);
      });
    });

    it('should reject invalid school year formats', () => {
      const invalidSchoolYears = [
        '2024',           // Too short
        '24-25',          // Wrong format
        '2024-25',        // Incomplete year
        '2024-2026',      // Gap year
        '2025-2024',      // Backwards
        '2024_2025',      // Wrong separator
        '2024/2025',      // Wrong separator
        'SY2024-2025',    // Prefix
        '2024-2025-SY'    // Suffix
      ];

      invalidSchoolYears.forEach(schoolYear => {
        const periods = TestDataFactory.generatePeriodAttendance('perfect');
        
        expect(() => new AttendanceRecord(
          validStudentId,
          validDate,
          schoolYear,
          periods
        )).toThrow('School year must be in format YYYY-YYYY');
      });
    });

    it('should handle multi-year historical data tracking', () => {
      const currentDate = new Date('2025-01-15');
      const schoolYears = ['2022-2023', '2023-2024', '2024-2025'];
      
      const records = schoolYears.map(year => {
        const periods = TestDataFactory.generatePeriodAttendance('random');
        return new AttendanceRecord(validStudentId, currentDate, year, periods);
      });

      // Should maintain separate records for each school year
      expect(records[0].schoolYear).toBe('2022-2023');
      expect(records[1].schoolYear).toBe('2023-2024');
      expect(records[2].schoolYear).toBe('2024-2025');

      // All should have same student and date but different years
      records.forEach(record => {
        expect(record.studentId.equals(validStudentId)).toBe(true);
        expect(record.date.getTime()).toBe(currentDate.getTime());
      });
    });
  });

  describe('Period Attendance Updates', () => {
    let record: AttendanceRecord;

    beforeEach(() => {
      const periods = TestDataFactory.generatePeriodAttendance('perfect');
      record = new AttendanceRecord(validStudentId, validDate, validSchoolYear, periods);
    });

    it('should update period attendance status', async () => {
      const originalUpdatedAt = record.updatedAt;
      
      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 5));
      
      record.updatePeriodAttendance(3, AttendanceStatus.ABSENT);
      
      expect(record.periodAttendance.find(p => p.period === 3)?.status).toBe(AttendanceStatus.ABSENT);
      expect(record.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should reject invalid period numbers for updates', () => {
      expect(() => record.updatePeriodAttendance(0, AttendanceStatus.ABSENT))
        .toThrow('Period number must be between 1 and 7');
      
      expect(() => record.updatePeriodAttendance(8, AttendanceStatus.ABSENT))
        .toThrow('Period number must be between 1 and 7');
      
      expect(() => record.updatePeriodAttendance(-1, AttendanceStatus.ABSENT))
        .toThrow('Period number must be between 1 and 7');
    });

    it('should handle updates that change full-day status', async () => {
      // Start with perfect attendance
      expect(record.isFullDayAbsent()).toBe(false);
      
      // Mark all periods absent
      for (let period = 1; period <= 7; period++) {
        record.updatePeriodAttendance(period, AttendanceStatus.ABSENT);
      }
      
      expect(record.isFullDayAbsent()).toBe(true);
      expect(record.calculateDailyAttendancePercentage().value).toBe(0);
    });
  });

  describe('Data Integrity and Edge Cases', () => {
    it('should maintain period order regardless of input order', () => {
      const unorderedPeriods = [
        { period: 5, status: AttendanceStatus.PRESENT },
        { period: 2, status: AttendanceStatus.ABSENT },
        { period: 7, status: AttendanceStatus.TARDY },
        { period: 1, status: AttendanceStatus.PRESENT },
        { period: 4, status: AttendanceStatus.ABSENT },
        { period: 3, status: AttendanceStatus.PRESENT },
        { period: 6, status: AttendanceStatus.TARDY }
      ];

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        unorderedPeriods
      );

      const periods = record.periodAttendance.map(p => p.period);
      expect(periods).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should create immutable date objects', () => {
      const inputDate = new Date('2025-01-15');
      const periods = TestDataFactory.generatePeriodAttendance('perfect');
      
      const record = new AttendanceRecord(validStudentId, inputDate, validSchoolYear, periods);
      
      // Modifying input date shouldn't affect record
      inputDate.setDate(20);
      expect(record.date.getDate()).toBe(15);
      
      // Modifying returned date shouldn't affect record
      const returnedDate = record.date;
      returnedDate.setDate(25);
      expect(record.date.getDate()).toBe(15);
    });

    it('should handle edge case dates (weekends, holidays)', () => {
      const weekendDate = new Date('2025-01-11'); // Saturday
      const holidayDate = new Date('2025-12-25'); // Christmas
      
      const periods = TestDataFactory.generatePeriodAttendance('perfect');
      
      // Should still create records for any date (business logic elsewhere determines validity)
      const weekendRecord = new AttendanceRecord(validStudentId, weekendDate, validSchoolYear, periods);
      const holidayRecord = new AttendanceRecord(validStudentId, holidayDate, validSchoolYear, periods);
      
      expect(weekendRecord.date.getDay()).toBe(6); // Saturday
      expect(holidayRecord.date.getMonth()).toBe(11); // December
    });

    it('should handle whitespace in school year', () => {
      const periodsData = TestDataFactory.generatePeriodAttendance('perfect');
      
      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        '  2024-2025  ',
        periodsData
      )).toThrow('School year must be in format YYYY-YYYY');
    });

    it('should handle empty period attendance array', () => {
      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        []
      )).toThrow('Period attendance cannot be empty');
    });
  });

  describe('Property-Based Testing with fast-check', () => {
    it('should always maintain 7 periods in valid records', () => {
      fc.assert(fc.property(
        fc.date(),
        fc.constantFrom('2022-2023', '2023-2024', '2024-2025', '2025-2026'),
        (date, schoolYear) => {
          const periods = TestDataFactory.generatePeriodAttendance('random');
          const record = new AttendanceRecord(validStudentId, date, schoolYear, periods);
          
          expect(record.periodAttendance).toHaveLength(7);
          
          // Check all periods 1-7 are present
          const periodNumbers = record.periodAttendance.map(p => p.period).sort((a, b) => a - b);
          expect(periodNumbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
        }
      )); 
    });

    it('should always calculate attendance percentage between 0 and 100', () => {
      fc.assert(fc.property(
        fc.date(),
        fc.constantFrom('2022-2023', '2023-2024', '2024-2025'),
        (date, schoolYear) => {
          const periods = TestDataFactory.generatePeriodAttendance('random');
          const record = new AttendanceRecord(validStudentId, date, schoolYear, periods);
          
          const percentage = record.calculateDailyAttendancePercentage().value;
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);
        }
      ));
    });

    it('should maintain period attendance sum invariant', () => {
      fc.assert(fc.property(
        fc.date(),
        fc.constantFrom('2023-2024', '2024-2025'),
        (date, schoolYear) => {
          const periods = TestDataFactory.generatePeriodAttendance('random');
          const record = new AttendanceRecord(validStudentId, date, schoolYear, periods);
          
          const presentCount = record.getPresentPeriods().length;
          const absentCount = record.getAbsentPeriods().length;
          
          // Present + Absent should equal 7 (all periods accounted for)
          expect(presentCount + absentCount).toBe(7);
        }
      ));
    });
  });

  describe('Equality and Comparison', () => {
    it('should identify equal records by student ID and date', () => {
      const periods1 = TestDataFactory.generatePeriodAttendance('perfect');
      const periods2 = TestDataFactory.generatePeriodAttendance('partial');
      
      const record1 = new AttendanceRecord(validStudentId, validDate, validSchoolYear, periods1);
      const record2 = new AttendanceRecord(validStudentId, validDate, validSchoolYear, periods2);
      
      // Same student, same date = equal (regardless of attendance data)
      expect(record1.equals(record2)).toBe(true);
    });

    it('should identify different records by student ID', () => {
      const differentStudentId = new StudentId('789012');
      const periods = TestDataFactory.generatePeriodAttendance('perfect');
      
      const record1 = new AttendanceRecord(validStudentId, validDate, validSchoolYear, periods);
      const record2 = new AttendanceRecord(differentStudentId, validDate, validSchoolYear, periods);
      
      expect(record1.equals(record2)).toBe(false);
    });

    it('should identify different records by date', () => {
      const differentDate = new Date('2025-01-16');
      const periods = TestDataFactory.generatePeriodAttendance('perfect');
      
      const record1 = new AttendanceRecord(validStudentId, validDate, validSchoolYear, periods);
      const record2 = new AttendanceRecord(validStudentId, differentDate, validSchoolYear, periods);
      
      expect(record1.equals(record2)).toBe(false);
    });

    it('should handle null/undefined comparisons safely', () => {
      const periods = TestDataFactory.generatePeriodAttendance('perfect');
      const record = new AttendanceRecord(validStudentId, validDate, validSchoolYear, periods);
      
      expect(record.equals(null as any)).toBe(false);
      expect(record.equals(undefined as any)).toBe(false);
      expect(record.equals({} as any)).toBe(false);
    });
  });
});