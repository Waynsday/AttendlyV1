/**
 * AttendlyV1 - CSV Attendance Data Importer
 * 
 * This script processes "Copy of Chronic Absentees 5.16.25" CSV files and imports
 * attendance data into the Supabase database. It implements:
 * 
 * - CSV parsing with comprehensive validation
 * - Tier assignment calculation based on AP Romoland criteria
 * - Batch upsert operations to avoid duplicates
 * - FERPA-compliant error handling and logging
 * - Performance optimization for large datasets
 * 
 * CSV Expected Format:
 * Student Name, Grade, Teacher, Student ID, Enrolled Days, Absences, Present Days,
 * Attendance %, SART Date, SARB Date, Mediation Status, Intervention Comments, Status
 * 
 * @author Claude Code (TDD Implementation)
 * @version 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
// Simple CSV parser implementation to avoid external dependencies
const parseCSV = (csvData: string, options: any = {}) => {
  const lines = csvData.trim().split('\n')
  
  // Parse CSV line respecting quoted values
  const parseLine = (line: string): string[] => {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }
  
  const headers = parseLine(lines[0])
  const records = []

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue // Skip empty lines
    
    const values = parseLine(lines[i])
    const record: any = {}
    
    headers.forEach((header, index) => {
      let value = values[index] || ''
      
      // Apply casting if specified
      if (options.cast && typeof options.cast === 'function') {
        value = options.cast(value, { column: header })
      }
      
      record[header] = value
    })
    
    records.push(record)
  }
  
  return records
}
import { 
  AttendanceCSVRow, 
  AttendanceCSVRowSchema,
  ImportResult, 
  ImportProgress,
  RiskTier,
  calculateRiskTier,
  sanitizeStudentData,
  isValidStudentId,
  isValidGradeLevel,
  isValidSchoolYear
} from '../../src/types/attendance'
import type { Database } from '../../src/types/supabase'

// =============================================================================
// ATTENDANCEIMPORTER CLASS
// =============================================================================

export class AttendanceImporter {
  private supabaseClient: SupabaseClient<Database>
  private batchSize: number = 100
  private logLevel: 'info' | 'warn' | 'error' = 'info'

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabaseClient = supabaseClient
  }

  /**
   * Set batch size for database operations (default: 100)
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(1000, size)) // Limit between 1-1000
  }

  /**
   * Set logging level for output control
   */
  setLogLevel(level: 'info' | 'warn' | 'error'): void {
    this.logLevel = level
  }

  /**
   * Parse CSV data into structured attendance records with validation
   */
  async parseCSV(csvData: string): Promise<AttendanceCSVRow[]> {
    try {
      const records = parseCSV(csvData, {
        cast: (value: string, context: any) => {
          // Cast numeric columns appropriately
          if (['Grade', 'Enrolled Days', 'Absences', 'Present Days'].includes(context.column as string)) {
            const num = parseInt(value, 10)
            return isNaN(num) ? 0 : num
          }
          if (context.column === 'Attendance %') {
            // Remove % sign and convert to number
            const cleanValue = value.replace('%', '').trim()
            const num = parseFloat(cleanValue)
            return isNaN(num) ? 0 : num
          }
          return value || null
        }
      })

      const validRecords: AttendanceCSVRow[] = []

      for (let i = 0; i < records.length; i++) {
        const rawRecord = records[i]
        
        try {
          // Map CSV columns to our interface
          const csvRow: AttendanceCSVRow = {
            studentName: rawRecord['Student Name'] || '',
            grade: rawRecord['Grade'] || 0,
            teacher: rawRecord['Teacher'] || '',
            studentId: rawRecord['Student ID'] || '',
            enrolledDays: rawRecord['Enrolled Days'] || 0,
            absences: rawRecord['Absences'] || 0,
            presentDays: rawRecord['Present Days'] || 0,
            attendancePercentage: rawRecord['Attendance %'] || 0,
            sartDate: rawRecord['SART Date'] || null,
            sarbDate: rawRecord['SARB Date'] || null,
            mediationStatus: rawRecord['Mediation Status'] || '',
            interventionComments: rawRecord['Intervention Comments'] || '',
            status: rawRecord['Status'] || ''
          }

          // Validate the record
          const validationResult = AttendanceCSVRowSchema.safeParse(csvRow)
          
          if (!validationResult.success) {
            this.logError(`Validation failed for row ${i + 1}: ${validationResult.error.message}`)
            continue
          }

          // Additional business rule validations
          if (!this.validateBusinessRules(csvRow)) {
            this.logError(`Business rule validation failed for student ID ${this.maskStudentId(csvRow.studentId)} at row ${i + 1}`)
            continue
          }

          validRecords.push(csvRow)

        } catch (error) {
          this.logError(`Malformed CSV row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      this.logInfo(`Successfully parsed ${validRecords.length} of ${records.length} CSV rows`)
      return validRecords

    } catch (error) {
      this.logError(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return []
    }
  }

  /**
   * Calculate tier assignment based on AP Romoland criteria
   */
  calculateTierAssignment(csvRow: AttendanceCSVRow): RiskTier {
    return calculateRiskTier({
      absences: csvRow.absences,
      enrolledDays: csvRow.enrolledDays
    })
  }

  /**
   * Map CSV row to Student database record
   */
  mapToStudentRecord(csvRow: AttendanceCSVRow): any {
    const nameParts = csvRow.studentName.split(',').map(part => part.trim())
    const lastName = nameParts[0] || ''
    const firstName = nameParts[1] || ''

    return sanitizeStudentData({
      student_id: csvRow.studentId,
      first_name: firstName,
      last_name: lastName,
      grade_level: csvRow.grade,
      email: `${csvRow.studentId.toLowerCase()}@school.edu`, // Generate placeholder email
      is_active: csvRow.status.toLowerCase() === 'active'
    })
  }

  /**
   * Map CSV row to AttendanceRecord database record
   */
  mapToAttendanceRecord(csvRow: AttendanceCSVRow, schoolYear: string): any {
    // Calculate daily attendance percentage
    const attendancePercentage = csvRow.attendancePercentage || 
      ((csvRow.presentDays / csvRow.enrolledDays) * 100)

    // Generate estimated period statuses based on daily percentage
    // This is a simplification - in production, you'd have actual period data
    const periodStatus = attendancePercentage >= 100 ? 'PRESENT' : 
                        attendancePercentage >= 85 ? 'TARDY' : 'ABSENT'

    return {
      student_id: csvRow.studentId,
      date: new Date().toISOString().split('T')[0], // Current date as placeholder
      school_year: schoolYear,
      period_1_status: periodStatus,
      period_2_status: periodStatus,
      period_3_status: periodStatus,
      period_4_status: periodStatus,
      period_5_status: periodStatus,
      period_6_status: periodStatus,
      period_7_status: periodStatus,
      daily_attendance_percentage: Math.round(attendancePercentage * 100) / 100
    }
  }

  /**
   * Batch upsert records to database table
   */
  async batchUpsert(tableName: string, records: any[], conflictColumn: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient
        .from(tableName)
        .upsert(records, { onConflict: conflictColumn })

      if (error) {
        this.logError(`Database upsert failed for table ${tableName}: ${error.message}`)
        return false
      }

      this.logInfo(`Successfully upserted ${records.length} records to ${tableName}`)
      return true

    } catch (error) {
      this.logError(`Batch upsert failed for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  /**
   * Import complete CSV file with progress reporting
   */
  async importFromCSV(
    csvData: string, 
    schoolYear: string,
    progressCallback?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const startTime = performance.now()
    const result: ImportResult = {
      success: false,
      totalRecords: 0,
      successfulImports: 0,
      errors: []
    }

    try {
      // Validate school year format
      if (!isValidSchoolYear(schoolYear)) {
        result.errors.push(`Invalid school year format: ${schoolYear}. Expected format: YYYY-YYYY`)
        return result
      }

      // Parse CSV data
      const csvRows = await this.parseCSV(csvData)
      result.totalRecords = csvRows.length

      if (csvRows.length === 0) {
        result.errors.push('No valid records found in CSV data')
        return result
      }

      // Process records in batches
      const studentRecords: any[] = []
      const attendanceRecords: any[] = []
      const interventionRecords: any[] = []

      for (let i = 0; i < csvRows.length; i++) {
        const csvRow = csvRows[i]

        try {
          // Map to database records
          const studentRecord = this.mapToStudentRecord(csvRow)
          const attendanceRecord = this.mapToAttendanceRecord(csvRow, schoolYear)

          studentRecords.push(studentRecord)
          attendanceRecords.push(attendanceRecord)

          // Create intervention if needed
          if (csvRow.interventionComments && csvRow.interventionComments.trim() !== '') {
            const tierAssignment = this.calculateTierAssignment(csvRow)
            const interventionRecord = {
              student_id: csvRow.studentId,
              type: this.mapInterventionType(csvRow.sartDate, csvRow.sarbDate),
              description: csvRow.interventionComments,
              created_by: 'SYSTEM_IMPORT',
              scheduled_date: new Date().toISOString().split('T')[0],
              status: csvRow.mediationStatus.toLowerCase() === 'complete' ? 'COMPLETED' : 'SCHEDULED'
            }
            interventionRecords.push(interventionRecord)
          }

          // Report progress
          if (progressCallback) {
            progressCallback({
              totalRecords: csvRows.length,
              processedRecords: i + 1,
              currentRecord: this.maskStudentId(csvRow.studentId),
              errors: result.errors
            })
          }

        } catch (error) {
          const errorMsg = `Failed to process record for student ${this.maskStudentId(csvRow.studentId)}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          this.logError(errorMsg)
        }
      }

      // Batch insert students
      let studentsSuccess = false
      if (studentRecords.length > 0) {
        for (let i = 0; i < studentRecords.length; i += this.batchSize) {
          const batch = studentRecords.slice(i, i + this.batchSize)
          const batchSuccess = await this.batchUpsert('students', batch, 'student_id')
          if (batchSuccess) {
            studentsSuccess = true
            result.successfulImports += batch.length
          }
        }
      }

      // Batch insert attendance records
      let attendanceSuccess = false
      if (attendanceRecords.length > 0 && studentsSuccess) {
        for (let i = 0; i < attendanceRecords.length; i += this.batchSize) {
          const batch = attendanceRecords.slice(i, i + this.batchSize)
          const batchSuccess = await this.batchUpsert('attendance_records', batch, 'student_id,date')
          if (batchSuccess) {
            attendanceSuccess = true
          }
        }
      }

      // Batch insert interventions
      if (interventionRecords.length > 0 && studentsSuccess) {
        for (let i = 0; i < interventionRecords.length; i += this.batchSize) {
          const batch = interventionRecords.slice(i, i + this.batchSize)
          await this.batchUpsert('interventions', batch, 'student_id,scheduled_date')
        }
      }

      result.success = studentsSuccess && attendanceSuccess
      result.duration = performance.now() - startTime

      if (result.success) {
        this.logInfo(`Import completed successfully: ${result.successfulImports} students, ${attendanceRecords.length} attendance records, ${interventionRecords.length} interventions`)
      } else {
        result.errors.push('Import failed due to database errors')
      }

    } catch (error) {
      const errorMsg = `Import process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMsg)
      this.logError(errorMsg)
    }

    return result
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Validate business rules for CSV data
   */
  private validateBusinessRules(csvRow: AttendanceCSVRow): boolean {
    // Check required fields
    if (!csvRow.studentName || csvRow.studentName.trim() === '') {
      return false
    }

    if (!isValidGradeLevel(csvRow.grade)) {
      return false
    }

    if (!isValidStudentId(csvRow.studentId)) {
      return false
    }

    // Check attendance data consistency
    if (csvRow.enrolledDays < csvRow.presentDays + csvRow.absences) {
      this.logWarn(`Attendance data inconsistency for student ${this.maskStudentId(csvRow.studentId)}: enrolled days don't match present + absent days`)
    }

    if (csvRow.attendancePercentage < 0 || csvRow.attendancePercentage > 100) {
      return false
    }

    return true
  }

  /**
   * Map intervention type based on SART/SARB dates
   */
  private mapInterventionType(sartDate: string | null, sarbDate: string | null): string {
    if (sarbDate) return 'SARB_REFERRAL'
    if (sartDate) return 'SART_REFERRAL'
    return 'PARENT_CONTACT'
  }

  /**
   * Mask student ID for FERPA-compliant logging
   */
  private maskStudentId(studentId: string): string {
    if (!studentId || studentId.length < 4) return '[REDACTED]'
    return studentId.substring(0, 3) + '***'
  }

  /**
   * FERPA-compliant logging methods
   */
  private logInfo(message: string): void {
    if (this.logLevel === 'info') {
      console.log(`[AttendanceImporter] ${message}`)
    }
  }

  private logWarn(message: string): void {
    if (['info', 'warn'].includes(this.logLevel)) {
      console.log(`[AttendanceImporter] WARNING: ${message}`)
    }
  }

  private logError(message: string): void {
    console.error(`[AttendanceImporter] ERROR: ${message}`)
  }
}

// =============================================================================
// CLI USAGE (if run directly)
// =============================================================================

if (require.main === module) {
  console.log('AttendlyV1 Attendance Data Importer')
  console.log('Usage: node attendanceImporter.js <csv-file-path> <school-year>')
  console.log('Example: node attendanceImporter.js ./data/chronic-absentees.csv 2024-2025')
  console.log('')
  console.log('For programmatic usage, import the AttendanceImporter class')
}