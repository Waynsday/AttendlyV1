import { AttendancePercentage } from '@/domain/value-objects/attendance-percentage';
import { StudentId } from '@/domain/value-objects/student-id';

/**
 * Attendance Status Enum
 * 
 * Represents the possible attendance statuses for a student in a period
 */
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  TARDY = 'TARDY'
}

/**
 * Period Attendance Interface
 * 
 * Represents attendance for a specific period of the day
 */
export interface PeriodAttendance {
  period: number;
  status: AttendanceStatus;
}

/**
 * AttendanceRecord Entity
 * 
 * Represents a daily attendance record for a student in the AP Romoland system.
 * Handles period-based attendance (7 periods for middle school) and provides
 * methods for calculating attendance percentages and managing period-specific data.
 * 
 * @example
 * ```typescript
 * const studentId = new StudentId('12345');
 * const periodAttendance = [
 *   { period: 1, status: AttendanceStatus.PRESENT },
 *   { period: 2, status: AttendanceStatus.ABSENT },
 *   // ... for all 7 periods
 * ];
 * 
 * const record = new AttendanceRecord(
 *   studentId,
 *   new Date('2025-01-15'),
 *   '2024-2025',
 *   periodAttendance
 * );
 * ```
 */
export class AttendanceRecord {
  private readonly _studentId: StudentId;
  private readonly _date: Date;
  private readonly _schoolYear: string;
  private _periodAttendance: PeriodAttendance[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  /**
   * Number of periods in a middle school day
   */
  private static readonly MIDDLE_SCHOOL_PERIODS = 7;

  /**
   * Creates a new AttendanceRecord instance
   * 
   * @param studentId - Unique identifier for the student
   * @param date - The date of the attendance record
   * @param schoolYear - The school year (e.g., '2024-2025')
   * @param periodAttendance - Array of attendance data for each period
   * @throws {Error} If any validation fails
   */
  constructor(
    studentId: StudentId,
    date: Date,
    schoolYear: string,
    periodAttendance: PeriodAttendance[]
  ) {
    this.validateSchoolYear(schoolYear);
    this.validatePeriodAttendance(periodAttendance);

    this._studentId = studentId;
    this._date = new Date(date);
    this._schoolYear = schoolYear;
    this._periodAttendance = [...periodAttendance].sort((a, b) => a.period - b.period);
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Gets the student ID
   */
  get studentId(): StudentId {
    return this._studentId;
  }

  /**
   * Gets the date of the attendance record
   */
  get date(): Date {
    return new Date(this._date);
  }

  /**
   * Gets the school year
   */
  get schoolYear(): string {
    return this._schoolYear;
  }

  /**
   * Gets the period attendance data
   */
  get periodAttendance(): PeriodAttendance[] {
    return [...this._periodAttendance];
  }

  /**
   * Gets the date when the record was created
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Gets the date when the record was last updated
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Validates the school year format
   * 
   * @param schoolYear - The school year to validate
   * @throws {Error} If validation fails
   */
  private validateSchoolYear(schoolYear: string): void {
    if (!schoolYear || typeof schoolYear !== 'string' || schoolYear.trim().length === 0) {
      throw new Error('School year cannot be empty');
    }

    // Validate format: YYYY-YYYY
    const schoolYearRegex = /^\d{4}-\d{4}$/;
    if (!schoolYearRegex.test(schoolYear.trim())) {
      throw new Error('School year must be in format YYYY-YYYY');
    }
  }

  /**
   * Validates the period attendance data
   * 
   * @param periodAttendance - The period attendance to validate
   * @throws {Error} If validation fails
   */
  private validatePeriodAttendance(periodAttendance: PeriodAttendance[]): void {
    if (!periodAttendance || periodAttendance.length === 0) {
      throw new Error('Period attendance cannot be empty');
    }

    if (periodAttendance.length !== AttendanceRecord.MIDDLE_SCHOOL_PERIODS) {
      throw new Error('Middle school must have exactly 7 periods');
    }

    // Check for valid period numbers (1-7)
    const periodNumbers = periodAttendance.map(p => p.period);
    const invalidPeriods = periodNumbers.filter(p => p < 1 || p > 7);
    if (invalidPeriods.length > 0) {
      throw new Error('Period numbers must be between 1 and 7');
    }

    // Check for duplicate periods
    const uniquePeriods = new Set(periodNumbers);
    if (uniquePeriods.size !== periodNumbers.length) {
      throw new Error('Duplicate periods are not allowed');
    }

    // Ensure all periods 1-7 are present
    for (let i = 1; i <= AttendanceRecord.MIDDLE_SCHOOL_PERIODS; i++) {
      if (!uniquePeriods.has(i)) {
        throw new Error(`Missing period ${i}`);
      }
    }
  }

  /**
   * Calculates the daily attendance percentage
   * 
   * @returns AttendancePercentage representing the percentage of periods attended
   */
  calculateDailyAttendancePercentage(): AttendancePercentage {
    const presentCount = this._periodAttendance.filter(period => 
      period.status === AttendanceStatus.PRESENT || period.status === AttendanceStatus.TARDY
    ).length;

    return AttendancePercentage.fromFraction(presentCount, AttendanceRecord.MIDDLE_SCHOOL_PERIODS);
  }

  /**
   * Gets the periods where the student was present (including tardy)
   * 
   * @returns Array of period numbers where student was present or tardy
   */
  getPresentPeriods(): number[] {
    return this._periodAttendance
      .filter(period => 
        period.status === AttendanceStatus.PRESENT || period.status === AttendanceStatus.TARDY
      )
      .map(period => period.period)
      .sort((a, b) => a - b);
  }

  /**
   * Gets the periods where the student was absent
   * 
   * @returns Array of period numbers where student was absent
   */
  getAbsentPeriods(): number[] {
    return this._periodAttendance
      .filter(period => period.status === AttendanceStatus.ABSENT)
      .map(period => period.period)
      .sort((a, b) => a - b);
  }

  /**
   * Updates the attendance status for a specific period
   * 
   * @param periodNumber - The period number to update (1-7)
   * @param newStatus - The new attendance status
   * @throws {Error} If the period number is invalid
   */
  updatePeriodAttendance(periodNumber: number, newStatus: AttendanceStatus): void {
    if (periodNumber < 1 || periodNumber > AttendanceRecord.MIDDLE_SCHOOL_PERIODS) {
      throw new Error('Period number must be between 1 and 7');
    }

    const periodIndex = this._periodAttendance.findIndex(p => p.period === periodNumber);
    if (periodIndex !== -1) {
      this._periodAttendance[periodIndex].status = newStatus;
      this._updatedAt = new Date();
    }
  }

  /**
   * Checks if the student was absent for the entire day
   * 
   * @returns true if all periods are marked as absent
   */
  isFullDayAbsent(): boolean {
    return this._periodAttendance.every(period => period.status === AttendanceStatus.ABSENT);
  }

  /**
   * Compares this AttendanceRecord with another for equality
   * Records are considered equal if they have the same student ID and date
   * 
   * @param other - The other AttendanceRecord to compare with
   * @returns true if records represent the same student on the same date
   */
  equals(other: AttendanceRecord): boolean {
    if (!other || !(other instanceof AttendanceRecord)) {
      return false;
    }

    return this._studentId.equals(other._studentId) && 
           this._date.getTime() === other._date.getTime();
  }
}