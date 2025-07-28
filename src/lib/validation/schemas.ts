/**
 * @fileoverview Comprehensive Zod validation schemas for AP_Tool_V1
 * 
 * These schemas provide critical security controls for:
 * - Input validation and sanitization
 * - API request validation
 * - CSV import sanitization
 * - Form input validation
 * 
 * SECURITY REQUIREMENTS:
 * - All student data must be validated before processing (FERPA compliance)
 * - Prevent injection attacks (XSS, SQL injection, path traversal)
 * - Limit input sizes to prevent DoS attacks
 * - Sanitize all string inputs
 * - Validate enum values strictly
 * - Protect against prototype pollution
 */

import { z } from 'zod';

// Security constants for input validation
const MAX_STRING_LENGTH = 255;
const MAX_TEXT_LENGTH = 2000;
const MAX_ARRAY_LENGTH = 100;
const MIN_EMPLOYEE_ID_LENGTH = 5;
const STUDENT_ID_REGEX = /^[A-Za-z0-9]{4,20}$/;
const EMPLOYEE_ID_REGEX = /^T\d{4,}$/;
const SCHOOL_YEAR_REGEX = /^\d{4}-\d{4}$/;
const SAFE_STRING_REGEX = /^[A-Za-z0-9\s\-_.@()[\],:;!?'"]+$/;

// Define enums for validation
export const AttendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'TARDY']);
export const TeacherRoleEnum = z.enum(['TEACHER', 'ASSISTANT_PRINCIPAL', 'ADMINISTRATOR']);
export const InterventionTypeEnum = z.enum([
  'PARENT_CONTACT',
  'COUNSELOR_REFERRAL', 
  'ATTENDANCE_CONTRACT',
  'SART_REFERRAL',
  'SARB_REFERRAL',
  'OTHER'
]);
export const InterventionStatusEnum = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELED']);

/**
 * Base sanitization for string inputs
 * Prevents XSS, path traversal, and null byte injection
 */
const sanitizedString = (maxLength: number = MAX_STRING_LENGTH) => 
  z.string()
    .min(1, 'Field cannot be empty')
    .max(maxLength, `Field cannot exceed ${maxLength} characters`)
    .trim()
    .refine(
      (val) => !val.includes('\x00') && !val.includes('\x0A') && !val.includes('\x0D'),
      'Field contains invalid characters'
    )
    .refine(
      (val) => !val.includes('<script') && !val.includes('javascript:') && !val.includes('data:'),
      'Field contains potentially malicious content'
    )
    .refine(
      (val) => !val.includes('..') && !val.includes('/etc/') && !val.includes('\\\\'),
      'Field contains path traversal attempts'
    )
    .refine(
      (val) => !val.match(/['"]+\s*;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE)/i),
      'Field contains SQL injection attempt'
    );

/**
 * Safe text field for longer content like descriptions
 */
const sanitizedText = sanitizedString(MAX_TEXT_LENGTH);

/**
 * Email validation with enhanced security
 */
const sanitizedEmail = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .trim()
  .toLowerCase()
  .refine(
    (val) => !val.includes('<') && !val.includes('>') && !val.includes('script'),
    'Email contains invalid characters'
  );

/**
 * Student ID validation - alphanumeric only, no special characters
 */
const studentIdField = z.string()
  .min(1, 'Student ID cannot be empty')
  .max(20, 'Student ID too long')
  .regex(STUDENT_ID_REGEX, 'Student ID must contain only letters and numbers')
  .trim();

/**
 * Employee ID validation - must start with T followed by digits
 */
const employeeIdField = z.string()
  .min(MIN_EMPLOYEE_ID_LENGTH, 'Employee ID too short')
  .max(20, 'Employee ID too long')
  .regex(EMPLOYEE_ID_REGEX, 'Employee ID must start with T followed by digits')
  .trim();

/**
 * Grade level validation for middle school (6-8)
 */
const gradeLevelField = z.number()
  .int('Grade level must be an integer')
  .min(6, 'Grade level must be at least 6')
  .max(8, 'Grade level must not exceed 8');

/**
 * School year validation (YYYY-YYYY format)
 */
const schoolYearField = z.string()
  .regex(SCHOOL_YEAR_REGEX, 'School year must be in format YYYY-YYYY')
  .refine((val) => {
    const [start, end] = val.split('-').map(Number);
    return end === start + 1;
  }, 'School year end must be one year after start');

/**
 * Period attendance validation
 */
const PeriodAttendanceSchema = z.object({
  period: z.number()
    .int('Period must be an integer')
    .min(1, 'Period must be at least 1')
    .max(7, 'Period must not exceed 7'),
  status: AttendanceStatusEnum
});

/**
 * Date validation with reasonable bounds
 */
const dateField = z.date()
  .refine((date) => date >= new Date('2020-01-01'), 'Date cannot be before 2020')
  .refine((date) => date <= new Date('2030-12-31'), 'Date cannot be after 2030');

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Student entity validation schema
 */
export const StudentSchema = z.object({
  id: studentIdField,
  firstName: sanitizedString(50),
  lastName: sanitizedString(50),
  gradeLevel: gradeLevelField,
  email: sanitizedEmail,
  isActive: z.boolean().default(true),
  createdAt: dateField,
  updatedAt: dateField
}).strict(); // Prevent additional properties

/**
 * Teacher entity validation schema
 */
export const TeacherSchema = z.object({
  employeeId: employeeIdField,
  firstName: sanitizedString(50),
  lastName: sanitizedString(50),
  email: sanitizedEmail,
  department: sanitizedString(100),
  role: TeacherRoleEnum,
  isActive: z.boolean().default(true),
  createdAt: dateField,
  updatedAt: dateField
}).strict();

/**
 * Attendance record entity validation schema
 */
export const AttendanceRecordSchema = z.object({
  studentId: studentIdField,
  date: dateField,
  schoolYear: schoolYearField,
  periodAttendance: z.array(PeriodAttendanceSchema)
    .length(7, 'Must have exactly 7 periods for middle school')
    .refine((periods) => {
      const periodNumbers = periods.map(p => p.period);
      const uniquePeriods = new Set(periodNumbers);
      return uniquePeriods.size === 7;
    }, 'All period numbers 1-7 must be present and unique'),
  createdAt: dateField,
  updatedAt: dateField
}).strict();

/**
 * Intervention entity validation schema
 */
export const InterventionSchema = z.object({
  studentId: studentIdField,
  type: InterventionTypeEnum,
  description: sanitizedText,
  createdBy: employeeIdField,
  scheduledDate: dateField,
  status: InterventionStatusEnum,
  completedDate: dateField.nullable(),
  outcome: sanitizedText.nullable(),
  createdAt: dateField,
  updatedAt: dateField
}).strict();

// =============================================================================
// CREATE/UPDATE SCHEMAS (for API endpoints)
// =============================================================================

/**
 * Student creation schema (excludes auto-generated fields)
 */
export const StudentCreateSchema = StudentSchema.omit({
  createdAt: true,
  updatedAt: true
});

/**
 * Student update schema (all fields optional except ID)
 */
export const StudentUpdateSchema = StudentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).partial();

/**
 * Teacher creation schema
 */
export const TeacherCreateSchema = TeacherSchema.omit({
  createdAt: true,
  updatedAt: true
});

/**
 * Teacher update schema
 */
export const TeacherUpdateSchema = TeacherSchema.omit({
  employeeId: true,
  createdAt: true,
  updatedAt: true
}).partial();

/**
 * Attendance record creation schema
 */
export const AttendanceRecordCreateSchema = AttendanceRecordSchema.omit({
  createdAt: true,
  updatedAt: true
});

/**
 * Attendance record update schema
 */
export const AttendanceRecordUpdateSchema = z.object({
  periodAttendance: z.array(PeriodAttendanceSchema)
    .length(7, 'Must have exactly 7 periods for middle school')
    .optional()
});

/**
 * Intervention creation schema
 */
export const InterventionCreateSchema = InterventionSchema.omit({
  status: true,
  completedDate: true,
  outcome: true,
  createdAt: true,
  updatedAt: true
});

/**
 * Intervention update schema
 */
export const InterventionUpdateSchema = z.object({
  description: sanitizedText.optional(),
  scheduledDate: dateField.optional(),
  status: InterventionStatusEnum.optional(),
  outcome: sanitizedText.optional()
});

// =============================================================================
// CSV IMPORT SCHEMAS (Critical Security Layer)
// =============================================================================

/**
 * CSV Student import schema - validates raw CSV data
 */
export const CSVStudentImportSchema = z.object({
  student_id: z.string()
    .min(1, 'Student ID required')
    .regex(STUDENT_ID_REGEX, 'Invalid student ID format')
    .transform((val) => val.trim()),
  first_name: z.string()
    .min(1, 'First name required')
    .max(50, 'First name too long')
    .regex(SAFE_STRING_REGEX, 'First name contains invalid characters')
    .transform((val) => val.trim()),
  last_name: z.string()
    .min(1, 'Last name required')
    .max(50, 'Last name too long')
    .regex(SAFE_STRING_REGEX, 'Last name contains invalid characters')
    .transform((val) => val.trim()),
  grade_level: z.string()
    .regex(/^[6-8]$/, 'Grade level must be 6, 7, or 8')
    .transform((val) => parseInt(val, 10)),
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .transform((val) => val.trim().toLowerCase())
}).strict();

/**
 * CSV Attendance import schema - validates raw CSV attendance data
 */
export const CSVAttendanceImportSchema = z.object({
  student_id: z.string()
    .min(1, 'Student ID required')
    .regex(STUDENT_ID_REGEX, 'Invalid student ID format')
    .transform((val) => val.trim()),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .transform((val) => new Date(val)),
  school_year: z.string()
    .regex(SCHOOL_YEAR_REGEX, 'School year must be in YYYY-YYYY format'),
  period_1: AttendanceStatusEnum,
  period_2: AttendanceStatusEnum,
  period_3: AttendanceStatusEnum,
  period_4: AttendanceStatusEnum,
  period_5: AttendanceStatusEnum,
  period_6: AttendanceStatusEnum,
  period_7: AttendanceStatusEnum
}).strict()
.transform((data) => ({
  studentId: data.student_id,
  date: data.date,
  schoolYear: data.school_year,
  periodAttendance: [
    { period: 1, status: data.period_1 },
    { period: 2, status: data.period_2 },
    { period: 3, status: data.period_3 },
    { period: 4, status: data.period_4 },
    { period: 5, status: data.period_5 },
    { period: 6, status: data.period_6 },
    { period: 7, status: data.period_7 }
  ]
}));

// =============================================================================
// API REQUEST SCHEMAS
// =============================================================================

/**
 * Pagination parameters validation
 */
export const PaginationSchema = z.object({
  page: z.coerce.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .max(10000, 'Page number too large')
    .default(1),
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
  sortBy: z.string()
    .max(50, 'Sort field name too long')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid sort field name')
    .optional(),
  sortOrder: z.enum(['asc', 'desc'])
    .default('asc'),
  filters: z.record(z.string(), z.any()).optional()
});

/**
 * Date range validation for reports
 */
export const DateRangeSchema = z.object({
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .transform((val) => new Date(val)),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .transform((val) => new Date(val))
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be after start date'
});

/**
 * Generic API request structure validation
 */
export const ApiRequestSchema = z.object({
  body: z.record(z.string(), z.any()).optional(),
  query: z.record(z.string(), z.string()).optional(),
  params: z.record(z.string(), z.string()).optional()
}).strict();

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Student = z.infer<typeof StudentSchema>;
export type Teacher = z.infer<typeof TeacherSchema>;
export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;
export type Intervention = z.infer<typeof InterventionSchema>;

export type StudentCreate = z.infer<typeof StudentCreateSchema>;
export type TeacherCreate = z.infer<typeof TeacherCreateSchema>;
export type AttendanceRecordCreate = z.infer<typeof AttendanceRecordCreateSchema>;
export type InterventionCreate = z.infer<typeof InterventionCreateSchema>;

export type StudentUpdate = z.infer<typeof StudentUpdateSchema>;
export type TeacherUpdate = z.infer<typeof TeacherUpdateSchema>;
export type AttendanceRecordUpdate = z.infer<typeof AttendanceRecordUpdateSchema>;
export type InterventionUpdate = z.infer<typeof InterventionUpdateSchema>;

export type CSVStudentImport = z.infer<typeof CSVStudentImportSchema>;
export type CSVAttendanceImport = z.infer<typeof CSVAttendanceImportSchema>;

export type PaginationParams = z.infer<typeof PaginationSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type ApiRequest = z.infer<typeof ApiRequestSchema>;