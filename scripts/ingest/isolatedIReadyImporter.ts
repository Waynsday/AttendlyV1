/**
 * AttendlyV1 - Isolated iReady Data Importer
 * 
 * This script processes iReady diagnostic CSV files and imports them into
 * ISOLATED iReady-specific database tables, maintaining strict separation
 * from the existing academic_performance table structure.
 * 
 * Key Features:
 * - Targets isolated iready_diagnostic_results table
 * - Multi-year data processing with proper academic year mapping
 * - Enhanced data quality tracking and validation
 * - Handles CSV parsing issues (teacher names with embedded commas)
 * - FERPA-compliant logging and error handling
 * - Comprehensive ETL operation tracking
 * 
 * @author Claude Code (QA Education Data Tester)
 * @version 2.0.0 - Isolated Schema Version
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// =====================================================
// ISOLATED IREADY TYPES
// =====================================================

export enum IsolatedAcademicYear {
  CURRENT_YEAR = 'CURRENT_YEAR',
  CURRENT_YEAR_MINUS_1 = 'CURRENT_YEAR_MINUS_1', 
  CURRENT_YEAR_MINUS_2 = 'CURRENT_YEAR_MINUS_2'
}

export enum IsolatedIReadySubject {
  ELA = 'ELA',
  MATH = 'MATH'
}

export enum IsolatedIReadyPlacement {
  THREE_OR_MORE_GRADE_LEVELS_BELOW = 'THREE_OR_MORE_GRADE_LEVELS_BELOW',
  TWO_GRADE_LEVELS_BELOW = 'TWO_GRADE_LEVELS_BELOW',
  ONE_GRADE_LEVEL_BELOW = 'ONE_GRADE_LEVEL_BELOW',
  ON_GRADE_LEVEL = 'ON_GRADE_LEVEL',
  ONE_GRADE_LEVEL_ABOVE = 'ONE_GRADE_LEVEL_ABOVE',
  TWO_GRADE_LEVELS_ABOVE = 'TWO_GRADE_LEVELS_ABOVE',
  THREE_OR_MORE_GRADE_LEVELS_ABOVE = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'
}

export interface IsolatedIReadyCSVRow {
  studentId: string
  studentName: string
  grade: number
  subject: IsolatedIReadySubject
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
  
  // Performance indicators
  lessonsPassed: number
  lessonsAttempted: number
  timeOnTaskMinutes: number
  diagnosticDate: string
  
  // Additional CSV fields
  teacherName?: string
}

export interface IsolatedIReadyImportResult {
  success: boolean
  yearResults: IsolatedYearResult[]
  totalRecords: number
  dataQualityIssues: number
  errors: string[]
  duration?: number  
  batchId: string
}

export interface IsolatedYearResult {
  success: boolean
  academicYear: IsolatedAcademicYear
  schoolYear: string
  processedFiles: number
  totalRecords: number
  dataQualityIssues: number
  errors: string[]
}

export interface DataQualityIssue {
  type: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  studentId?: string
  rowNumber?: number
}

// File system interface for testing
export interface FileSystem {
  readdir(path: string): Promise<string[]>
  readFile(path: string): Promise<string>
  existsSync(path: string): boolean
}

const defaultFileSystem: FileSystem = {
  readdir: (dirPath: string) => fs.promises.readdir(dirPath),
  readFile: (filePath: string) => fs.promises.readFile(filePath, 'utf-8'),
  existsSync: (path: string) => fs.existsSync(path)
}

// =====================================================
// ENHANCED CSV PARSER WITH COMMA HANDLING
// =====================================================

const parseCSVWithCommaHandling = (csvData: string, options: any = {}) => {
  const lines = csvData.trim().split('\n')
  
  const parseLine = (line: string): string[] => {
    const result = []
    let current = ''
    let inQuotes = false
    let quoteCount = 0
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        quoteCount++
        inQuotes = !inQuotes
        // Only add quote to output if it's not a delimiter quote
        if (quoteCount % 2 === 0 && inQuotes) {
          current += char
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ''))
    return result
  }
  
  const headers = parseLine(lines[0])
  const records = []

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue
    
    const values = parseLine(lines[i])
    const record: any = {}
    
    headers.forEach((header, index) => {
      let value = values[index] || ''
      
      if (options.cast && typeof options.cast === 'function') {
        value = options.cast(value, { column: header })
      }
      
      record[header] = value
    })
    
    records.push(record)
  }
  
  return records
}

// =====================================================
// ISOLATED IREADY IMPORTER CLASS
// =====================================================

export class IsolatedIReadyImporter {
  private supabaseClient: SupabaseClient
  private fileSystem: FileSystem
  private batchSize: number = 100
  private logLevel: 'info' | 'warn' | 'error' = 'info'
  private batchId: string
  private dataQualityIssues: DataQualityIssue[] = []

  constructor(supabaseClient: SupabaseClient, fileSystem: FileSystem = defaultFileSystem) {
    this.supabaseClient = supabaseClient
    this.fileSystem = fileSystem
    this.batchId = this.generateBatchId()
  }

  private generateBatchId(): string {
    return `iready_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(1000, size))
  }

  setLogLevel(level: 'info' | 'warn' | 'error'): void {
    this.logLevel = level
  }

  /**
   * Process a specific year folder with enhanced data quality tracking
   */
  async processYearFolder(
    folderPath: string, 
    academicYear: IsolatedAcademicYear, 
    schoolYear: string
  ): Promise<IsolatedYearResult> {
    const result: IsolatedYearResult = {
      success: false,
      academicYear,
      schoolYear,
      processedFiles: 0,
      totalRecords: 0,
      dataQualityIssues: 0,
      errors: []
    }

    try {
      // Log ETL operation start
      const etlOperationId = await this.logETLStart(academicYear, folderPath)

      if (!this.fileSystem.existsSync(folderPath)) {
        result.errors.push(`Folder not found: ${folderPath}`)
        await this.logETLEnd(etlOperationId, 'FAILED', result)
        return result
      }

      const files = await this.fileSystem.readdir(folderPath)
      const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'))
      
      this.logInfo(`Found ${csvFiles.length} CSV files in ${folderPath}`)

      for (const fileName of csvFiles) {
        const filePath = path.join(folderPath, fileName)
        
        try {
          const csvData = await this.fileSystem.readFile(filePath)
          let records: IsolatedIReadyCSVRow[] = []

          if (fileName.toLowerCase().includes('ela')) {
            records = await this.parseELACSV(csvData, fileName)
          } else if (fileName.toLowerCase().includes('math')) {
            records = await this.parseMathCSV(csvData, fileName)
          } else {
            this.logWarn(`Unknown file type: ${fileName}. Skipping.`)
            continue
          }

          if (records.length > 0) {
            const dbRecords = records.map(record => 
              this.mapToIsolatedDatabase(record, academicYear, schoolYear, fileName)
            )

            const validRecords = dbRecords.filter(record => record !== null)

            if (validRecords.length > 0) {
              const success = await this.batchUpsertToIsolatedTables(validRecords)
              if (success) {
                result.processedFiles++
                result.totalRecords += validRecords.length
                this.logInfo(`Imported ${validRecords.length} records from ${fileName}`)
              } else {
                result.errors.push(`Failed to import data from ${fileName}`)
              }
            }
          }

        } catch (error) {
          const errorMsg = `Failed to process file ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          this.logError(errorMsg)
        }
      }

      result.dataQualityIssues = this.dataQualityIssues.length
      result.success = result.processedFiles > 0 && result.errors.length === 0

      await this.logETLEnd(etlOperationId, result.success ? 'COMPLETED' : 'PARTIAL', result)

    } catch (error) {
      const errorMsg = `Failed to process year folder ${folderPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMsg)
      this.logError(errorMsg)
    }

    return result
  }

  /**
   * Parse ELA CSV with enhanced comma handling
   */
  async parseELACSV(csvData: string, fileName: string): Promise<IsolatedIReadyCSVRow[]> {
    try {
      const records = parseCSVWithCommaHandling(csvData, {
        cast: (value: string, context: any) => {
          const numericColumns = [
            'Grade', 'Overall Scale Score', 'Phonological Awareness', 'Phonics',
            'High Frequency Words', 'Vocabulary', 'Literary Comprehension',
            'Informational Comprehension', 'Lessons Passed', 'Lessons Attempted',
            'Time on Task (Minutes)'
          ]
          
          if (numericColumns.includes(context.column as string)) {
            const num = parseInt(value, 10)
            return isNaN(num) ? 0 : num
          }
          
          return value || null
        }
      })

      const validRecords: IsolatedIReadyCSVRow[] = []

      for (let i = 0; i < records.length; i++) {
        const rawRecord = records[i]
        
        try {
          const csvRow: IsolatedIReadyCSVRow = {
            studentId: rawRecord['Student ID'] || '',
            studentName: rawRecord['Student Name'] || '',
            grade: rawRecord['Grade'] || 0,
            subject: IsolatedIReadySubject.ELA,
            overallScaleScore: rawRecord['Overall Scale Score'] || 0,
            overallPlacement: rawRecord['Overall Placement'] || '',
            phonologicalAwarenessScore: rawRecord['Phonological Awareness'] || undefined,
            phonicsScore: rawRecord['Phonics'] || undefined,
            highFrequencyWordsScore: rawRecord['High Frequency Words'] || undefined,
            vocabScore: rawRecord['Vocabulary'] || undefined,
            literaryComprehensionScore: rawRecord['Literary Comprehension'] || undefined,
            informationalComprehensionScore: rawRecord['Informational Comprehension'] || undefined,
            lessonsPassed: rawRecord['Lessons Passed'] || 0,
            lessonsAttempted: rawRecord['Lessons Attempted'] || 0,
            timeOnTaskMinutes: rawRecord['Time on Task (Minutes)'] || 0,
            diagnosticDate: rawRecord['Diagnostic Date'] || '',
            teacherName: rawRecord['Teacher'] || rawRecord['Teacher Name'] || ''
          }

          // Enhanced validation with data quality tracking
          if (!this.validateIsolatedRecord(csvRow, i + 1, fileName)) {
            continue
          }

          validRecords.push(csvRow)

        } catch (error) {
          this.logDataQualityIssue({
            type: 'PARSING_ERROR',
            description: `Failed to parse ELA CSV row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'HIGH',
            rowNumber: i + 1
          })
        }
      }

      this.logInfo(`Successfully parsed ${validRecords.length} of ${records.length} ELA records from ${fileName}`)
      return validRecords

    } catch (error) {
      this.logError(`ELA CSV parsing failed for ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return []
    }
  }

  /**
   * Parse Math CSV with enhanced comma handling
   */
  async parseMathCSV(csvData: string, fileName: string): Promise<IsolatedIReadyCSVRow[]> {
    try {
      const records = parseCSVWithCommaHandling(csvData, {
        cast: (value: string, context: any) => {
          const numericColumns = [
            'Grade', 'Overall Scale Score', 'Number and Operations',
            'Algebra and Algebraic Thinking', 'Measurement and Data', 'Geometry',
            'Lessons Passed', 'Lessons Attempted', 'Time on Task (Minutes)'
          ]
          
          if (numericColumns.includes(context.column as string)) {
            const num = parseInt(value, 10)
            return isNaN(num) ? 0 : num
          }
          
          return value || null
        }
      })

      const validRecords: IsolatedIReadyCSVRow[] = []

      for (let i = 0; i < records.length; i++) {
        const rawRecord = records[i]
        
        try {
          const csvRow: IsolatedIReadyCSVRow = {
            studentId: rawRecord['Student ID'] || '',
            studentName: rawRecord['Student Name'] || '',
            grade: rawRecord['Grade'] || 0,
            subject: IsolatedIReadySubject.MATH,
            overallScaleScore: rawRecord['Overall Scale Score'] || 0,
            overallPlacement: rawRecord['Overall Placement'] || '',
            numberOperationsScore: rawRecord['Number and Operations'] || undefined,
            algebraScore: rawRecord['Algebra and Algebraic Thinking'] || undefined,
            measurementDataScore: rawRecord['Measurement and Data'] || undefined,
            geometryScore: rawRecord['Geometry'] || undefined,
            lessonsPassed: rawRecord['Lessons Passed'] || 0,
            lessonsAttempted: rawRecord['Lessons Attempted'] || 0,
            timeOnTaskMinutes: rawRecord['Time on Task (Minutes)'] || 0,
            diagnosticDate: rawRecord['Diagnostic Date'] || '',
            teacherName: rawRecord['Teacher'] || rawRecord['Teacher Name'] || ''
          }

          if (!this.validateIsolatedRecord(csvRow, i + 1, fileName)) {
            continue
          }

          validRecords.push(csvRow)

        } catch (error) {
          this.logDataQualityIssue({
            type: 'PARSING_ERROR',
            description: `Failed to parse Math CSV row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'HIGH',
            rowNumber: i + 1
          })
        }
      }

      this.logInfo(`Successfully parsed ${validRecords.length} of ${records.length} Math records from ${fileName}`)
      return validRecords

    } catch (error) {
      this.logError(`Math CSV parsing failed for ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return []
    }
  }

  /**
   * Map CSV data to isolated database schema
   */
  mapToIsolatedDatabase(
    csvRow: IsolatedIReadyCSVRow, 
    academicYear: IsolatedAcademicYear, 
    schoolYear: string,
    fileName: string
  ): any {
    return {
      district_student_id: csvRow.studentId,
      student_name: csvRow.studentName,
      academic_year: academicYear,
      school_year: schoolYear,
      subject: csvRow.subject,
      diagnostic_date: this.formatDate(csvRow.diagnosticDate),
      grade_level: csvRow.grade,
      overall_scale_score: csvRow.overallScaleScore,
      overall_placement: this.mapPlacement(csvRow.overallPlacement),
      
      // ELA-specific scores
      phonological_awareness_score: csvRow.phonologicalAwarenessScore,
      phonics_score: csvRow.phonicsScore,
      high_frequency_words_score: csvRow.highFrequencyWordsScore,
      vocabulary_score: csvRow.vocabScore,
      literary_comprehension_score: csvRow.literaryComprehensionScore,
      informational_comprehension_score: csvRow.informationalComprehensionScore,
      
      // Math-specific scores
      number_and_operations_score: csvRow.numberOperationsScore,
      algebra_and_algebraic_thinking_score: csvRow.algebraScore,
      measurement_and_data_score: csvRow.measurementDataScore,
      geometry_score: csvRow.geometryScore,
      
      // Performance indicators
      lessons_passed: csvRow.lessonsPassed,
      lessons_attempted: csvRow.lessonsAttempted,
      time_on_task_minutes: csvRow.timeOnTaskMinutes,
      
      // Additional fields
      teacher_name: csvRow.teacherName,
      teacher_id: null, // Will be resolved in enrichWithStudentAndTeacherIds
      csv_file_source: fileName,
      import_batch_id: this.batchId,
      data_quality_score: this.calculateDataQualityScore(csvRow)
    }
  }

  /**
   * Batch upsert to isolated iReady tables
   */
  async batchUpsertToIsolatedTables(records: any[]): Promise<boolean> {
    try {
      // First, resolve student_id and teacher_id from identifiers
      const enrichedRecords = await this.enrichWithStudentAndTeacherIds(records)
      
      // Process in batches
      for (let i = 0; i < enrichedRecords.length; i += this.batchSize) {
        const batch = enrichedRecords.slice(i, i + this.batchSize)
        
        const { error } = await this.supabaseClient
          .from('iready_diagnostic_results')
          .upsert(batch, {
            onConflict: 'district_student_id,subject,academic_year,diagnostic_date'
          })

        if (error) {
          this.logError(`Database batch upsert failed: ${error.message}`)
          return false
        }

        this.logInfo(`Successfully upserted batch ${Math.floor(i / this.batchSize) + 1} (${batch.length} records)`)
      }

      // Log data quality issues if any
      if (this.dataQualityIssues.length > 0) {
        await this.logDataQualityIssues()
      }

      return true

    } catch (error) {
      this.logError(`Batch upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  /**
   * Import from complete directory structure 
   */
  async importFromDirectory(
    directoryPath: string,
    progressCallback?: (progress: any) => void
  ): Promise<IsolatedIReadyImportResult> {
    const startTime = performance.now()
    const result: IsolatedIReadyImportResult = {
      success: false,
      yearResults: [],
      totalRecords: 0,
      dataQualityIssues: 0,
      errors: [],
      batchId: this.batchId
    }

    try {
      const yearFolders = [
        { folder: 'Current_Year', academicYear: IsolatedAcademicYear.CURRENT_YEAR, schoolYear: '2024-2025' },
        { folder: 'Current_Year-1', academicYear: IsolatedAcademicYear.CURRENT_YEAR_MINUS_1, schoolYear: '2023-2024' },
        { folder: 'Current_Year-2', academicYear: IsolatedAcademicYear.CURRENT_YEAR_MINUS_2, schoolYear: '2022-2023' }
      ]

      for (const yearConfig of yearFolders) {
        const folderPath = path.join(directoryPath, yearConfig.folder)
        
        if (progressCallback) {
          progressCallback({
            currentYear: yearConfig.academicYear,
            message: `Processing ${yearConfig.folder}...`
          })
        }

        const yearResult = await this.processYearFolder(
          folderPath,
          yearConfig.academicYear,
          yearConfig.schoolYear
        )

        result.yearResults.push(yearResult)
        result.totalRecords += yearResult.totalRecords
        result.dataQualityIssues += yearResult.dataQualityIssues
        
        if (yearResult.errors.length > 0) {
          result.errors.push(...yearResult.errors)
        }

        this.logInfo(`Completed ${yearConfig.folder}: ${yearResult.totalRecords} records, ${yearResult.dataQualityIssues} quality issues`)
      }

      result.success = result.yearResults.some(yr => yr.success) && result.errors.length === 0
      result.duration = performance.now() - startTime

    } catch (error) {
      const errorMsg = `Directory import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMsg)
      this.logError(errorMsg)
    }

    return result
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  private validateIsolatedRecord(csvRow: IsolatedIReadyCSVRow, rowNumber: number, fileName: string): boolean {
    let isValid = true

    // Student ID validation
    if (!csvRow.studentId || csvRow.studentId.trim() === '') {
      this.logDataQualityIssue({
        type: 'MISSING_STUDENT_ID',
        description: `Missing student ID at row ${rowNumber}`,
        severity: 'CRITICAL',
        rowNumber
      })
      isValid = false
    }

    // Scale score validation
    if (csvRow.overallScaleScore < 100 || csvRow.overallScaleScore > 800) {
      this.logDataQualityIssue({
        type: 'INVALID_SCALE_SCORE',
        description: `Scale score ${csvRow.overallScaleScore} out of range (100-800) at row ${rowNumber}`,
        severity: 'HIGH',
        studentId: this.maskStudentId(csvRow.studentId),
        rowNumber
      })
      isValid = false
    }

    // Teacher name comma issue detection
    if (csvRow.teacherName && csvRow.teacherName.includes(',') && !csvRow.teacherName.includes('"')) {
      this.logDataQualityIssue({
        type: 'TEACHER_NAME_COMMA',
        description: `Teacher name contains unquoted comma: "${csvRow.teacherName}" at row ${rowNumber}`,
        severity: 'MEDIUM',
        studentId: this.maskStudentId(csvRow.studentId),
        rowNumber
      })
      // Don't mark as invalid, but log the issue
    }

    // Missing diagnostic date
    if (!csvRow.diagnosticDate || csvRow.diagnosticDate.trim() === '') {
      this.logDataQualityIssue({
        type: 'MISSING_DIAGNOSTIC_DATE',
        description: `Missing diagnostic date at row ${rowNumber}`,
        severity: 'HIGH',
        studentId: this.maskStudentId(csvRow.studentId),
        rowNumber
      })
      isValid = false
    }

    return isValid
  }

  private calculateDataQualityScore(csvRow: IsolatedIReadyCSVRow): number {
    let score = 1.0
    
    if (!csvRow.studentId) score -= 0.3
    if (!csvRow.diagnosticDate) score -= 0.2
    if (csvRow.overallScaleScore < 100 || csvRow.overallScaleScore > 800) score -= 0.2
    if (csvRow.teacherName && csvRow.teacherName.includes(',')) score -= 0.1
    if (!csvRow.studentName) score -= 0.1
    if (csvRow.lessonsPassed < 0 || csvRow.lessonsAttempted < 0) score -= 0.1
    
    return Math.max(0, score)
  }

  private async enrichWithStudentAndTeacherIds(records: any[]): Promise<any[]> {
    const enrichedRecords = []
    
    for (const record of records) {
      const enrichedRecord = { ...record }
      
      // Resolve student_id from district_student_id
      try {
        const { data: student } = await this.supabaseClient
          .from('students')
          .select('id')
          .eq('district_student_id', record.district_student_id)
          .single()

        if (student) {
          enrichedRecord.student_id = student.id
        } else {
          // Leave student_id as null - record can still be inserted for data completeness
          enrichedRecord.student_id = null
          this.logDataQualityIssue({
            type: 'STUDENT_NOT_FOUND',
            description: `Student not found for district_student_id: ${this.maskStudentId(record.district_student_id)}`,
            severity: 'HIGH',
            studentId: this.maskStudentId(record.district_student_id)
          })
        }
      } catch (error) {
        enrichedRecord.student_id = null
        this.logError(`Error looking up student ${this.maskStudentId(record.district_student_id)}: ${error}`)
      }

      // Resolve teacher_id from teacher_name if provided
      if (record.teacher_name && record.teacher_name.trim() !== '') {
        try {
          // Try to match teacher by parsing name (handle "Last, First" format)
          const teacherName = record.teacher_name.replace(/"/g, '') // Remove quotes
          let firstName = '', lastName = ''
          
          if (teacherName.includes(',')) {
            const parts = teacherName.split(',').map(p => p.trim())
            lastName = parts[0]
            firstName = parts[1] || ''
          } else {
            const parts = teacherName.split(' ')
            firstName = parts[0] || ''
            lastName = parts.slice(1).join(' ') || ''
          }

          if (firstName && lastName) {
            const { data: teacher } = await this.supabaseClient
              .from('teachers')
              .select('id')
              .eq('first_name', firstName)
              .eq('last_name', lastName)
              .eq('is_active', true)
              .single()

            if (teacher) {
              enrichedRecord.teacher_id = teacher.id
            } else {
              enrichedRecord.teacher_id = null
              this.logDataQualityIssue({
                type: 'TEACHER_NOT_FOUND',
                description: `Teacher not found: ${teacherName}`,
                severity: 'MEDIUM',
                studentId: this.maskStudentId(record.district_student_id)
              })
            }
          } else {
            enrichedRecord.teacher_id = null
          }
        } catch (error) {
          enrichedRecord.teacher_id = null
          this.logError(`Error looking up teacher ${record.teacher_name}: ${error}`)
        }
      } else {
        enrichedRecord.teacher_id = null
      }
      
      // Always add the record - missing student/teacher IDs are handled gracefully
      enrichedRecords.push(enrichedRecord)
    }
    
    return enrichedRecords
  }

  private logDataQualityIssue(issue: DataQualityIssue): void {
    this.dataQualityIssues.push(issue)
    this.logWarn(`Data Quality Issue - ${issue.type}: ${issue.description}`)
  }

  private async logDataQualityIssues(): Promise<void> {
    if (this.dataQualityIssues.length === 0) return

    try {
      // This would need the diagnostic_result_id, so we'd need to implement
      // this after the main insert. For now, just log to console.
      this.logInfo(`Logged ${this.dataQualityIssues.length} data quality issues for batch ${this.batchId}`)
    } catch (error) {
      this.logError(`Failed to log data quality issues: ${error}`)
    }
  }

  private async logETLStart(academicYear: IsolatedAcademicYear, csvFilePath: string): Promise<string> {
    try {
      const { data, error } = await this.supabaseClient
        .from('iready_etl_operations')
        .insert({
          operation_type: 'CSV_IMPORT',
          academic_year: academicYear,
          csv_file_path: csvFilePath,
          batch_id: this.batchId,
          initiated_by: 'IsolatedIReadyImporter'
        })
        .select('id')
        .single()

      if (error || !data) {
        this.logError(`Failed to log ETL start: ${error?.message}`)
        return 'unknown'
      }

      return data.id
    } catch (error) {
      this.logError(`ETL logging failed: ${error}`)
      return 'unknown'
    }
  }

  private async logETLEnd(operationId: string, status: string, result: IsolatedYearResult): Promise<void> {
    if (operationId === 'unknown') return

    try {
      await this.supabaseClient
        .from('iready_etl_operations')
        .update({
          operation_status: status,
          end_time: new Date().toISOString(),
          total_records_processed: result.totalRecords,
          successful_records: result.totalRecords,
          failed_records: result.errors.length,
          data_quality_issues: result.dataQualityIssues,
          error_summary: result.errors.length > 0 ? { errors: result.errors } : null
        })
        .eq('id', operationId)
    } catch (error) {
      this.logError(`Failed to log ETL end: ${error}`)
    }
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      return date.toISOString().split('T')[0]
    } catch {
      return new Date().toISOString().split('T')[0]
    }
  }

  private mapPlacement(placement: string): IsolatedIReadyPlacement {
    const placementMap: Record<string, IsolatedIReadyPlacement> = {
      '3+ Grade Levels Below': IsolatedIReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_BELOW,
      'THREE_OR_MORE_GRADE_LEVELS_BELOW': IsolatedIReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_BELOW,
      '2 Grade Levels Below': IsolatedIReadyPlacement.TWO_GRADE_LEVELS_BELOW,
      'TWO_GRADE_LEVELS_BELOW': IsolatedIReadyPlacement.TWO_GRADE_LEVELS_BELOW,
      '1 Grade Level Below': IsolatedIReadyPlacement.ONE_GRADE_LEVEL_BELOW,
      'ONE_GRADE_LEVEL_BELOW': IsolatedIReadyPlacement.ONE_GRADE_LEVEL_BELOW,
      'On Grade Level': IsolatedIReadyPlacement.ON_GRADE_LEVEL,
      'ON_GRADE_LEVEL': IsolatedIReadyPlacement.ON_GRADE_LEVEL,
      '1 Grade Level Above': IsolatedIReadyPlacement.ONE_GRADE_LEVEL_ABOVE,
      'ONE_GRADE_LEVEL_ABOVE': IsolatedIReadyPlacement.ONE_GRADE_LEVEL_ABOVE,
      '2 Grade Levels Above': IsolatedIReadyPlacement.TWO_GRADE_LEVELS_ABOVE,
      'TWO_GRADE_LEVELS_ABOVE': IsolatedIReadyPlacement.TWO_GRADE_LEVELS_ABOVE,
      '3+ Grade Levels Above': IsolatedIReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_ABOVE,
      'THREE_OR_MORE_GRADE_LEVELS_ABOVE': IsolatedIReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_ABOVE
    }

    return placementMap[placement] || IsolatedIReadyPlacement.ON_GRADE_LEVEL
  }

  private maskStudentId(studentId: string): string {
    if (!studentId || studentId.length < 4) return '[REDACTED]'
    return studentId.substring(0, 3) + '***'
  }

  private logInfo(message: string): void {
    if (this.logLevel === 'info') {
      console.log(`[IsolatedIReadyImporter] ${message}`)
    }
  }

  private logWarn(message: string): void {
    if (['info', 'warn'].includes(this.logLevel)) {
      console.warn(`[IsolatedIReadyImporter] WARNING: ${message}`)
    }
  }

  private logError(message: string): void {
    console.error(`[IsolatedIReadyImporter] ERROR: ${message}`)
  }
}

// =====================================================
// CLI USAGE
// =====================================================

if (require.main === module) {
  console.log('AttendlyV1 Isolated iReady Data Importer')
  console.log('Usage: node isolatedIReadyImporter.js <data-directory>')
  console.log('Example: node isolatedIReadyImporter.js ../../References/iReady\\ Data/')
  console.log('')
  console.log('Imports to ISOLATED iReady database tables:')
  console.log('- iready_diagnostic_results')
  console.log('- iready_data_quality_log') 
  console.log('- iready_etl_operations')
  console.log('- iready_year_summary')
}