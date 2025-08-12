import { AttendanceRecord } from '@/domain/entities/attendance-record';
import { StudentId } from '@/domain/value-objects/student-id';
import { AttendancePercentage } from '@/domain/value-objects/attendance-percentage';

/**
 * Attendance Record Repository Interface
 * 
 * Defines the contract for attendance record data persistence in the AP Romoland system.
 * Handles period-based attendance data for middle school students with 7 periods per day.
 * 
 * @example
 * ```typescript
 * class SupabaseAttendanceRecordRepository implements AttendanceRecordRepository {
 *   async findByStudentAndDate(studentId: StudentId, date: Date): Promise<AttendanceRecord | null> {
 *     // Implementation details...
 *   }
 * }
 * ```
 */
export interface AttendanceRecordRepository {
  /**
   * Finds an attendance record for a specific student on a specific date
   * 
   * @param studentId - The student ID
   * @param date - The date to search for
   * @returns Promise resolving to the attendance record or null if not found
   */
  findByStudentAndDate(studentId: StudentId, date: Date): Promise<AttendanceRecord | null>;

  /**
   * Finds all attendance records for a student within a date range
   * 
   * @param studentId - The student ID
   * @param startDate - Start date of the range (inclusive)
   * @param endDate - End date of the range (inclusive)
   * @returns Promise resolving to an array of attendance records
   */
  findByStudentAndDateRange(
    studentId: StudentId, 
    startDate: Date, 
    endDate: Date
  ): Promise<AttendanceRecord[]>;

  /**
   * Finds all attendance records for a specific date across all students
   * 
   * @param date - The date to search for
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of attendance records
   */
  findByDate(date: Date, filters?: AttendanceFilters): Promise<AttendanceRecord[]>;

  /**
   * Finds attendance records within a date range with optional filtering
   * 
   * @param startDate - Start date of the range (inclusive)
   * @param endDate - End date of the range (inclusive)
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of attendance records
   */
  findByDateRange(
    startDate: Date, 
    endDate: Date, 
    filters?: AttendanceFilters
  ): Promise<AttendanceRecord[]>;

  /**
   * Finds attendance records for a specific school year
   * 
   * @param schoolYear - The school year (e.g., '2024-2025')
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of attendance records
   */
  findBySchoolYear(schoolYear: string, filters?: AttendanceFilters): Promise<AttendanceRecord[]>;

  /**
   * Finds students with attendance below a threshold percentage
   * 
   * @param threshold - The attendance percentage threshold
   * @param startDate - Start date for calculation
   * @param endDate - End date for calculation
   * @returns Promise resolving to student IDs with low attendance
   */
  findStudentsWithLowAttendance(
    threshold: AttendancePercentage,
    startDate: Date,
    endDate: Date
  ): Promise<StudentId[]>;

  /**
   * Calculates attendance percentage for a student over a date range
   * 
   * @param studentId - The student ID
   * @param startDate - Start date for calculation
   * @param endDate - End date for calculation
   * @returns Promise resolving to the attendance percentage
   */
  calculateAttendancePercentage(
    studentId: StudentId,
    startDate: Date,
    endDate: Date
  ): Promise<AttendancePercentage>;

  /**
   * Gets attendance statistics for a student
   * 
   * @param studentId - The student ID
   * @param startDate - Start date for calculation
   * @param endDate - End date for calculation
   * @returns Promise resolving to attendance statistics
   */
  getAttendanceStatistics(
    studentId: StudentId,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceStatistics>;

  /**
   * Saves an attendance record (create or update)
   * 
   * @param record - The attendance record to save
   * @returns Promise resolving to the saved record
   */
  save(record: AttendanceRecord): Promise<AttendanceRecord>;

  /**
   * Creates a new attendance record
   * 
   * @param record - The attendance record to create
   * @returns Promise resolving to the created record
   */
  create(record: AttendanceRecord): Promise<AttendanceRecord>;

  /**
   * Updates an existing attendance record
   * 
   * @param record - The attendance record to update
   * @returns Promise resolving to the updated record
   * @throws Error if record is not found
   */
  update(record: AttendanceRecord): Promise<AttendanceRecord>;

  /**
   * Deletes an attendance record
   * 
   * @param studentId - The student ID
   * @param date - The date of the record to delete
   * @returns Promise resolving to true if successful
   */
  delete(studentId: StudentId, date: Date): Promise<boolean>;

  /**
   * Bulk creates multiple attendance records
   * 
   * @param records - Array of attendance records to create
   * @returns Promise resolving to the created records
   */
  bulkCreate(records: AttendanceRecord[]): Promise<AttendanceRecord[]>;

  /**
   * Bulk updates multiple attendance records
   * 
   * @param records - Array of attendance records to update
   * @returns Promise resolving to the updated records
   */
  bulkUpdate(records: AttendanceRecord[]): Promise<AttendanceRecord[]>;

  /**
   * Finds attendance records with pagination support
   * 
   * @param offset - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param filters - Optional filters to apply
   * @returns Promise resolving to paginated attendance record results
   */
  findWithPagination(
    offset: number,
    limit: number,
    filters?: AttendanceFilters
  ): Promise<PaginatedAttendanceResult>;

  /**
   * Gets daily attendance summary for a specific date
   * 
   * @param date - The date to get summary for
   * @returns Promise resolving to daily attendance summary
   */
  getDailyAttendanceSummary(date: Date): Promise<DailyAttendanceSummary>;
}

/**
 * Attendance Filters Interface
 * 
 * Defines optional filters that can be applied when querying attendance records
 */
export interface AttendanceFilters {
  studentIds?: StudentId[];
  gradeLevel?: number;
  schoolYear?: string;
  minAttendancePercentage?: number;
  maxAttendancePercentage?: number;
  fullDayAbsentOnly?: boolean;
}

/**
 * Attendance Statistics Interface
 * 
 * Represents comprehensive attendance statistics for a student
 */
export interface AttendanceStatistics {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  totalPeriods: number;
  presentPeriods: number;
  absentPeriods: number;
  tardyPeriods: number;
  attendancePercentage: AttendancePercentage;
  fullDayAbsences: number;
  consecutiveAbsences: number;
  mostAbsentPeriod: number | null;
}

/**
 * Paginated Attendance Result Interface
 * 
 * Represents a paginated response from the attendance record repository
 */
export interface PaginatedAttendanceResult {
  data: AttendanceRecord[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  statistics?: AttendanceStatistics;
}

/**
 * Daily Attendance Summary Interface
 * 
 * Represents a summary of attendance for a specific day
 */
export interface DailyAttendanceSummary {
  date: Date;
  totalStudents: number;
  presentStudents: number;
  absentStudents: number;
  tardyStudents: number;
  attendanceRate: AttendancePercentage;
  byGradeLevel: {
    [gradeLevel: number]: {
      total: number;
      present: number;
      absent: number;
      tardy: number;
      rate: AttendancePercentage;
    };
  };
}