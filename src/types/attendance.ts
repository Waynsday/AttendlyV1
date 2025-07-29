/**
 * AttendlyV1 - Attendance and Performance Tracking Types
 * 
 * This module provides comprehensive TypeScript type definitions and Zod validation schemas
 * for the AP Romoland attendance tracking system. All types are designed with FERPA
 * compliance and data security in mind.
 * 
 * Key Features:
 * - Runtime type validation with Zod schemas
 * - FERPA-compliant data sanitization
 * - Support for multi-year historical data
 * - Comprehensive CSV import type definitions
 * - Type guards for runtime type checking
 * 
 * @author Claude Code (TDD Implementation)
 * @version 1.0.0
 */

import { z } from 'zod'
import type { Database } from './supabase'

// =============================================================================
// CORE DATABASE TYPES (from Supabase)
// =============================================================================

export type Student = Database['public']['Tables']['students']['Row']
export type StudentInsert = Database['public']['Tables']['students']['Insert']
export type StudentUpdate = Database['public']['Tables']['students']['Update']

export type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row']
export type AttendanceRecordInsert = Database['public']['Tables']['attendance_records']['Insert']
export type AttendanceRecordUpdate = Database['public']['Tables']['attendance_records']['Update']

export type Intervention = Database['public']['Tables']['interventions']['Row']
export type InterventionInsert = Database['public']['Tables']['interventions']['Insert']
export type InterventionUpdate = Database['public']['Tables']['interventions']['Update']

// Extended types for new tables (will be added in migration 005)
export interface IReadyScore {
  id: string
  student_id: string
  subject: IReadySubject
  academic_year: AcademicYear
  school_year: string
  diagnostic_date: string
  overall_scale_score: number
  overall_placement: IReadyPlacement
  annual_typical_growth_measure?: number
  percent_progress_to_annual_typical_growth?: number
  
  // ELA-specific scores
  phonological_awareness_score?: number
  phonics_score?: number
  high_frequency_words_score?: number
  vocabulary_score?: number
  literary_comprehension_score?: number
  informational_comprehension_score?: number
  
  // Math-specific scores
  number_and_operations_score?: number
  algebra_and_algebraic_thinking_score?: number
  measurement_and_data_score?: number
  geometry_score?: number
  
  // Performance indicators
  lessons_passed: number
  lessons_attempted: number
  time_on_task_minutes: number
  
  created_at: string
  updated_at: string
}

export interface TeacherAssignment {
  id: string
  teacher_id: string
  grade_level: number
  school_year: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// ENUM TYPES
// =============================================================================

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  TARDY = 'TARDY'
}

export enum TeacherRole {
  TEACHER = 'TEACHER',
  ASSISTANT_PRINCIPAL = 'ASSISTANT_PRINCIPAL',
  ADMINISTRATOR = 'ADMINISTRATOR'
}

export enum InterventionType {
  PARENT_CONTACT = 'PARENT_CONTACT',
  COUNSELOR_REFERRAL = 'COUNSELOR_REFERRAL',
  ATTENDANCE_CONTRACT = 'ATTENDANCE_CONTRACT',
  SART_REFERRAL = 'SART_REFERRAL',
  SARB_REFERRAL = 'SARB_REFERRAL',
  OTHER = 'OTHER'
}

export enum InterventionStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED'
}

export enum IReadySubject {
  ELA = 'ELA',
  MATH = 'MATH'
}

export enum IReadyPlacement {
  THREE_OR_MORE_GRADE_LEVELS_BELOW = 'THREE_OR_MORE_GRADE_LEVELS_BELOW',
  TWO_GRADE_LEVELS_BELOW = 'TWO_GRADE_LEVELS_BELOW',
  ONE_GRADE_LEVEL_BELOW = 'ONE_GRADE_LEVEL_BELOW',
  ON_GRADE_LEVEL = 'ON_GRADE_LEVEL',
  ONE_GRADE_LEVEL_ABOVE = 'ONE_GRADE_LEVEL_ABOVE',
  TWO_GRADE_LEVELS_ABOVE = 'TWO_GRADE_LEVELS_ABOVE',
  THREE_OR_MORE_GRADE_LEVELS_ABOVE = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'
}

export enum AcademicYear {
  CURRENT_YEAR = 'CURRENT_YEAR',
  CURRENT_YEAR_MINUS_1 = 'CURRENT_YEAR_MINUS_1',
  CURRENT_YEAR_MINUS_2 = 'CURRENT_YEAR_MINUS_2'
}

export enum RiskTier {
  NO_RISK = 'NO_RISK',
  TIER_1 = 'TIER_1',
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3'
}

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================

// Core validation schemas
export const StudentSchema = z.object({
  student_id: z.string().min(1, 'Student ID cannot be empty').regex(/^STU\d{3,}$/, 'Student ID must start with STU followed by digits'),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  grade_level: z.number().int().min(6, 'Grade level must be between 6 and 8').max(8, 'Grade level must be between 6 and 8'),
  email: z.string().email('Invalid email format').max(254),
  is_active: z.boolean().default(true)
})

export const AttendanceRecordSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  school_year: z.string().regex(/^\d{4}-\d{4}$/, 'School year must be in YYYY-YYYY format'),
  period_1_status: z.nativeEnum(AttendanceStatus),
  period_2_status: z.nativeEnum(AttendanceStatus),
  period_3_status: z.nativeEnum(AttendanceStatus),
  period_4_status: z.nativeEnum(AttendanceStatus),
  period_5_status: z.nativeEnum(AttendanceStatus),
  period_6_status: z.nativeEnum(AttendanceStatus),
  period_7_status: z.nativeEnum(AttendanceStatus),
  daily_attendance_percentage: z.number().min(0).max(100).optional()
})

export const IReadyScoreSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required'),
  subject: z.nativeEnum(IReadySubject),
  academic_year: z.nativeEnum(AcademicYear),
  school_year: z.string().regex(/^\d{4}-\d{4}$/, 'School year must be in YYYY-YYYY format'),
  diagnostic_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  overall_scale_score: z.number().int().min(100, 'Scale score must be between 100 and 800').max(800, 'Scale score must be between 100 and 800'),
  overall_placement: z.nativeEnum(IReadyPlacement),
  annual_typical_growth_measure: z.number().int().min(0).optional(),
  percent_progress_to_annual_typical_growth: z.number().min(0).optional(),
  
  // ELA-specific scores (conditional validation)
  phonological_awareness_score: z.number().int().min(100).max(800).optional(),
  phonics_score: z.number().int().min(100).max(800).optional(),
  high_frequency_words_score: z.number().int().min(100).max(800).optional(),
  vocabulary_score: z.number().int().min(100).max(800).optional(),
  literary_comprehension_score: z.number().int().min(100).max(800).optional(),
  informational_comprehension_score: z.number().int().min(100).max(800).optional(),
  
  // Math-specific scores (conditional validation)
  number_and_operations_score: z.number().int().min(100).max(800).optional(),
  algebra_and_algebraic_thinking_score: z.number().int().min(100).max(800).optional(),
  measurement_and_data_score: z.number().int().min(100).max(800).optional(),
  geometry_score: z.number().int().min(100).max(800).optional(),
  
  lessons_passed: z.number().int().min(0).default(0),
  lessons_attempted: z.number().int().min(0).default(0),
  time_on_task_minutes: z.number().int().min(0).default(0)
}).refine(
  (data) => {
    if (data.subject === IReadySubject.ELA) {
      return data.phonological_awareness_score !== undefined &&
             data.phonics_score !== undefined &&
             data.high_frequency_words_score !== undefined &&
             data.vocabulary_score !== undefined &&
             data.literary_comprehension_score !== undefined &&
             data.informational_comprehension_score !== undefined
    }
    return true
  },
  { message: 'ELA scores require all domain-specific scores' }
).refine(
  (data) => {
    if (data.subject === IReadySubject.MATH) {
      return data.number_and_operations_score !== undefined &&
             data.algebra_and_algebraic_thinking_score !== undefined &&
             data.measurement_and_data_score !== undefined &&
             data.geometry_score !== undefined
    }
    return true
  },
  { message: 'Math scores require all domain-specific scores' }
)

export const InterventionSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required'),
  type: z.nativeEnum(InterventionType),
  description: z.string().min(1, 'Description is required'),
  created_by: z.string().min(1, 'Created by is required'),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  status: z.nativeEnum(InterventionStatus).default(InterventionStatus.SCHEDULED),
  completed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).optional(),
  outcome: z.string().optional()
})

// =============================================================================
// CSV IMPORT TYPES AND SCHEMAS
// =============================================================================

export interface AttendanceCSVRow {
  studentName: string
  grade: number
  teacher: string
  studentId: string
  enrolledDays: number
  absences: number
  presentDays: number
  attendancePercentage: number
  sartDate: string | null
  sarbDate: string | null
  mediationStatus: string
  interventionComments: string
  status: string
}

export interface IReadyCSVRow {
  studentId: string
  studentName: string
  grade: number
  subject: string
  overallScaleScore: number
  overallPlacement: string
  
  // ELA-specific fields
  phonologicalAwarenessScore?: number
  phonicsScore?: number
  highFrequencyWordsScore?: number
  vocabScore?: number
  literaryComprehensionScore?: number
  informationalComprehensionScore?: number
  
  // Math-specific fields
  numberOperationsScore?: number
  algebraScore?: number
  measurementDataScore?: number
  geometryScore?: number
  
  lessonsPassed: number
  lessonsAttempted: number
  timeOnTaskMinutes: number
  diagnosticDate: string
}

export const AttendanceCSVRowSchema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  grade: z.number().int().min(6).max(8),
  teacher: z.string().min(1, 'Teacher name is required'),
  studentId: z.string().regex(/^STU\d{3,}$/, 'Invalid student ID format'),
  enrolledDays: z.number().int().min(0),
  absences: z.number().int().min(0),
  presentDays: z.number().int().min(0),
  attendancePercentage: z.number().min(0).max(100),
  sartDate: z.string().nullable(),
  sarbDate: z.string().nullable(),
  mediationStatus: z.string(),
  interventionComments: z.string(),
  status: z.string()
})

export const IReadyCSVRowSchema = z.object({
  studentId: z.string().regex(/^STU\d{3,}$/, 'Invalid student ID format'),
  studentName: z.string().min(1, 'Student name is required'),
  grade: z.number().int().min(6).max(8),
  subject: z.enum(['ELA', 'MATH']),
  overallScaleScore: z.number().int().min(100).max(800),
  overallPlacement: z.string(),
  phonologicalAwarenessScore: z.number().int().min(100).max(800).optional(),
  phonicsScore: z.number().int().min(100).max(800).optional(),
  highFrequencyWordsScore: z.number().int().min(100).max(800).optional(),
  vocabScore: z.number().int().min(100).max(800).optional(),
  literaryComprehensionScore: z.number().int().min(100).max(800).optional(),
  informationalComprehensionScore: z.number().int().min(100).max(800).optional(),
  numberOperationsScore: z.number().int().min(100).max(800).optional(),
  algebraScore: z.number().int().min(100).max(800).optional(),
  measurementDataScore: z.number().int().min(100).max(800).optional(),
  geometryScore: z.number().int().min(100).max(800).optional(),
  lessonsPassed: z.number().int().min(0),
  lessonsAttempted: z.number().int().min(0),
  timeOnTaskMinutes: z.number().int().min(0),
  diagnosticDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

// =============================================================================
// IMPORT RESULT TYPES
// =============================================================================

export interface ImportProgress {
  totalRecords: number
  processedRecords: number
  currentRecord: string
  errors: string[]
}

export interface ImportResult {
  success: boolean
  totalRecords: number
  successfulImports: number
  errors: string[]
  duration?: number
}

export interface IReadyImportResult {
  success: boolean
  yearResults: Array<{
    success: boolean
    academicYear: AcademicYear
    schoolYear: string
    processedFiles: number
    totalRecords: number
    errors: string[]
  }>
  totalRecords: number
  errors: string[]
  duration?: number
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validates student ID format (STU followed by digits)
 */
export function isValidStudentId(studentId: string): boolean {
  return /^STU\d{3,}$/.test(studentId)
}

/**
 * Validates grade level is within middle school range (6-8)
 */
export function isValidGradeLevel(grade: number): boolean {
  return Number.isInteger(grade) && grade >= 6 && grade <= 8
}

/**
 * Validates school year format (YYYY-YYYY with consecutive years)
 */
export function isValidSchoolYear(schoolYear: string): boolean {
  const match = schoolYear.match(/^(\d{4})-(\d{4})$/)
  if (!match) return false
  
  const startYear = parseInt(match[1], 10)
  const endYear = parseInt(match[2], 10)
  return endYear === startYear + 1
}

/**
 * Validates iReady scale score range (100-800)
 */
export function isValidScaleScore(score: number): boolean {
  return Number.isInteger(score) && score >= 100 && score <= 800
}

/**
 * Calculates risk tier based on AP Romoland criteria
 * - Tier 1: 1-2 absences
 * - Tier 2: 3-9 absences
 * - Tier 3: >10% absent (chronic absenteeism)
 * - No Risk: 0 absences
 */
export function calculateRiskTier(data: { absences: number; enrolledDays: number }): RiskTier {
  const { absences, enrolledDays } = data
  
  if (absences === 0) return RiskTier.NO_RISK
  if (absences >= 1 && absences <= 2) return RiskTier.TIER_1
  if (absences >= 3 && absences <= 9) return RiskTier.TIER_2
  
  // Calculate chronic absenteeism (>10% absent)
  const absenteePercentage = (absences / enrolledDays) * 100
  if (absenteePercentage > 10) return RiskTier.TIER_3
  
  return RiskTier.TIER_2 // Default for edge cases
}

/**
 * Sanitizes student data for FERPA compliance by removing sensitive fields
 */
export function sanitizeStudentData(data: any): any {
  const { ssn, parent_phone, home_address, ...sanitized } = data
  return sanitized
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if object is a valid Student
 */
export function isStudent(obj: any): obj is Student {
  if (!obj || typeof obj !== 'object') return false
  
  return typeof obj.id === 'string' &&
         typeof obj.student_id === 'string' &&
         typeof obj.first_name === 'string' &&
         typeof obj.last_name === 'string' &&
         typeof obj.grade_level === 'number' &&
         obj.grade_level >= 6 && obj.grade_level <= 8 &&
         typeof obj.email === 'string' &&
         typeof obj.is_active === 'boolean' &&
         typeof obj.created_at === 'string' &&
         typeof obj.updated_at === 'string'
}

/**
 * Type guard to check if object is a valid AttendanceRecord
 */
export function isAttendanceRecord(obj: any): obj is AttendanceRecord {
  if (!obj || typeof obj !== 'object') return false
  
  const validStatuses = ['PRESENT', 'ABSENT', 'TARDY']
  
  return typeof obj.id === 'string' &&
         typeof obj.student_id === 'string' &&
         typeof obj.date === 'string' &&
         typeof obj.school_year === 'string' &&
         validStatuses.includes(obj.period_1_status) &&
         validStatuses.includes(obj.period_2_status) &&
         validStatuses.includes(obj.period_3_status) &&
         validStatuses.includes(obj.period_4_status) &&
         validStatuses.includes(obj.period_5_status) &&
         validStatuses.includes(obj.period_6_status) &&
         validStatuses.includes(obj.period_7_status) &&
         typeof obj.daily_attendance_percentage === 'number' &&
         obj.daily_attendance_percentage >= 0 && obj.daily_attendance_percentage <= 100
}

/**
 * Type guard to check if object is a valid IReadyScore
 */
export function isIReadyScore(obj: any): obj is IReadyScore {
  if (!obj || typeof obj !== 'object') return false
  
  return typeof obj.id === 'string' &&
         typeof obj.student_id === 'string' &&
         ['ELA', 'MATH'].includes(obj.subject) &&
         ['CURRENT_YEAR', 'CURRENT_YEAR_MINUS_1', 'CURRENT_YEAR_MINUS_2'].includes(obj.academic_year) &&
         typeof obj.school_year === 'string' &&
         typeof obj.diagnostic_date === 'string' &&
         typeof obj.overall_scale_score === 'number' &&
         obj.overall_scale_score >= 100 && obj.overall_scale_score <= 800
}

/**
 * Type guard to check if object is a valid Intervention
 */
export function isIntervention(obj: any): obj is Intervention {
  if (!obj || typeof obj !== 'object') return false
  
  const validTypes = ['PARENT_CONTACT', 'COUNSELOR_REFERRAL', 'ATTENDANCE_CONTRACT', 'SART_REFERRAL', 'SARB_REFERRAL', 'OTHER']
  const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELED']
  
  return typeof obj.id === 'string' &&
         typeof obj.student_id === 'string' &&
         validTypes.includes(obj.type) &&
         typeof obj.description === 'string' &&
         typeof obj.created_by === 'string' &&
         typeof obj.scheduled_date === 'string' &&
         validStatuses.includes(obj.status)
}