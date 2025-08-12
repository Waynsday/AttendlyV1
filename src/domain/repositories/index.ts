/**
 * Domain Repository Interfaces
 * 
 * This module exports all repository interfaces following Clean Architecture principles.
 * These interfaces define the contracts for data persistence without specifying
 * implementation details, allowing for flexibility in choosing data storage solutions.
 */

// Student Repository
export type {
  StudentRepository,
  StudentFilters,
  PaginatedResult
} from './student-repository';

// Attendance Record Repository
export type {
  AttendanceRecordRepository,
  AttendanceFilters,
  AttendanceStatistics,
  PaginatedAttendanceResult,
  DailyAttendanceSummary
} from './attendance-record-repository';

// Teacher Repository
export type {
  TeacherRepository,
  TeacherFilters,
  PaginatedTeacherResult
} from './teacher-repository';

export { TeacherPermission } from './teacher-repository';

// Intervention Repository
export type {
  InterventionRepository,
  InterventionFilters,
  InterventionStatistics,
  InterventionSummary,
  PaginatedInterventionResult,
  InterventionCriteria
} from './intervention-repository';