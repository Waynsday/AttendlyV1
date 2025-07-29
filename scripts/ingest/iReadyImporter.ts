/**
 * AttendlyV1 - iReady Data Importer
 * 
 * This script processes iReady diagnostic CSV files from multiple academic years and
 * imports the data into the Supabase database. It supports:
 * 
 * - Multi-year data processing (Current_Year, Current_Year-1, Current_Year-2)
 * - Both ELA and Math diagnostic results with domain-specific scores
 * - Student matching and historical record creation
 * - FERPA-compliant data handling and error logging
 * - Performance optimization for large datasets
 * - Duplicate detection and prevention
 * 
 * Directory Structure Expected:
 * /path/to/iready-data/
 * ├── Current_Year/
 * │   ├── ela_diagnostic.csv
 * │   └── math_diagnostic.csv
 * ├── Current_Year-1/
 * │   ├── ela_diagnostic.csv
 * │   └── math_diagnostic.csv
 * └── Current_Year-2/
 *     ├── ela_diagnostic.csv
 *     └── math_diagnostic.csv
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
import * as fs from 'fs'
import * as path from 'path'
import { 
  IReadyCSVRow, 
  IReadyCSVRowSchema,
  IReadyImportResult,
  IReadySubject,
  AcademicYear,
  IReadyPlacement,
  isValidStudentId,
  isValidScaleScore,
  isValidSchoolYear
} from '../../src/types/attendance'
import type { Database } from '../../src/types/supabase'

// File system interface for testing abstraction
export interface FileSystem {
  readdir(path: string): Promise<string[]>
  readFile(path: string): Promise<string>
  existsSync(path: string): boolean
}

// Default file system implementation
const defaultFileSystem: FileSystem = {
  readdir: (dirPath: string) => fs.promises.readdir(dirPath),
  readFile: (filePath: string) => fs.promises.readFile(filePath, 'utf-8'),
  existsSync: (path: string) => fs.existsSync(path)
}

// =============================================================================
// IREADYIMPORTER CLASS
// =============================================================================

export class IReadyImporter {
  private supabaseClient: SupabaseClient<Database>
  private fileSystem: FileSystem
  private batchSize: number = 100
  private logLevel: 'info' | 'warn' | 'error' = 'info'

  constructor(supabaseClient: SupabaseClient<Database>, fileSystem: FileSystem = defaultFileSystem) {
    this.supabaseClient = supabaseClient
    this.fileSystem = fileSystem
  }

  /**
   * Set batch size for database operations (default: 100)
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(1000, size))
  }

  /**
   * Set logging level for output control
   */
  setLogLevel(level: 'info' | 'warn' | 'error'): void {
    this.logLevel = level
  }

  /**
   * Process a specific year folder (Current_Year, Current_Year-1, etc.)
   */
  async processYearFolder(
    folderPath: string, 
    academicYear: AcademicYear, 
    schoolYear: string
  ): Promise<{
    success: boolean
    academicYear: AcademicYear
    schoolYear: string
    processedFiles: number
    totalRecords: number
    errors: string[]
  }> {
    const result = {
      success: false,
      academicYear,
      schoolYear,
      processedFiles: 0,
      totalRecords: 0,
      errors: [] as string[]
    }

    try {
      if (!this.fileSystem.existsSync(folderPath)) {
        result.errors.push(`Folder not found: ${folderPath}`)
        return result
      }

      const files = await this.fileSystem.readdir(folderPath)
      const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'))
      
      this.logInfo(`Found ${csvFiles.length} CSV files in ${folderPath}`)

      for (const fileName of csvFiles) {
        const filePath = path.join(folderPath, fileName)
        
        try {
          const csvData = await this.fileSystem.readFile(filePath)
          let records: any[] = []

          // Determine subject and parse accordingly
          if (fileName.toLowerCase().includes('ela')) {
            records = await this.parseELACSV(csvData)
          } else if (fileName.toLowerCase().includes('math')) {
            records = await this.parseMathCSV(csvData)
          } else {
            this.logWarn(`Unknown file type: ${fileName}. Skipping.`)
            continue
          }

          if (records.length > 0) {
            // Map to database records
            const dbRecords = records.map(record => 
              this.mapToDatabase(record, academicYear, schoolYear)
            )

            // Filter out invalid records
            const validRecords = dbRecords.filter(record => record !== null)

            if (validRecords.length > 0) {
              const success = await this.batchUpsertIReadyScores(validRecords)
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

      result.success = result.processedFiles > 0 && result.errors.length === 0

    } catch (error) {
      const errorMsg = `Failed to process year folder ${folderPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMsg)
      this.logError(errorMsg)
    }

    return result
  }

  /**
   * Parse ELA diagnostic CSV data
   */
  async parseELACSV(csvData: string): Promise<IReadyCSVRow[]> {
    try {
      const records = parseCSV(csvData, {
        cast: (value: string, context: any) => {
          // Cast numeric columns
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

      const validRecords: IReadyCSVRow[] = []

      for (let i = 0; i < records.length; i++) {
        const rawRecord = records[i]
        
        try {
          const csvRow: IReadyCSVRow = {
            studentId: rawRecord['Student ID'] || '',
            studentName: rawRecord['Student Name'] || '',
            grade: rawRecord['Grade'] || 0,
            subject: 'ELA',
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
            diagnosticDate: rawRecord['Diagnostic Date'] || ''
          }

          // Validate the record
          const validationResult = IReadyCSVRowSchema.safeParse(csvRow)
          
          if (!validationResult.success) {
            this.logError(`ELA CSV validation failed for row ${i + 1}: ${validationResult.error.message}`)
            continue
          }

          // Additional validations
          if (!this.validateIReadyRecord(csvRow)) {
            this.logError(`ELA record validation failed for student ${this.maskStudentId(csvRow.studentId)} at row ${i + 1}`)
            continue
          }

          validRecords.push(csvRow)

        } catch (error) {
          this.logError(`Failed to parse ELA CSV row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      this.logInfo(`Successfully parsed ${validRecords.length} of ${records.length} ELA records`)
      return validRecords

    } catch (error) {
      this.logError(`ELA CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return []
    }
  }

  /**
   * Parse Math diagnostic CSV data
   */
  async parseMathCSV(csvData: string): Promise<IReadyCSVRow[]> {
    try {
      const records = parseCSV(csvData, {
        cast: (value: string, context: any) => {
          // Cast numeric columns
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

      const validRecords: IReadyCSVRow[] = []

      for (let i = 0; i < records.length; i++) {
        const rawRecord = records[i]
        
        try {
          const csvRow: IReadyCSVRow = {
            studentId: rawRecord['Student ID'] || '',
            studentName: rawRecord['Student Name'] || '',
            grade: rawRecord['Grade'] || 0,
            subject: 'MATH',
            overallScaleScore: rawRecord['Overall Scale Score'] || 0,
            overallPlacement: rawRecord['Overall Placement'] || '',
            numberOperationsScore: rawRecord['Number and Operations'] || undefined,
            algebraScore: rawRecord['Algebra and Algebraic Thinking'] || undefined,
            measurementDataScore: rawRecord['Measurement and Data'] || undefined,
            geometryScore: rawRecord['Geometry'] || undefined,
            lessonsPassed: rawRecord['Lessons Passed'] || 0,
            lessonsAttempted: rawRecord['Lessons Attempted'] || 0,
            timeOnTaskMinutes: rawRecord['Time on Task (Minutes)'] || 0,
            diagnosticDate: rawRecord['Diagnostic Date'] || ''
          }

          // Validate the record
          const validationResult = IReadyCSVRowSchema.safeParse(csvRow)
          
          if (!validationResult.success) {
            this.logError(`Math CSV validation failed for row ${i + 1}: ${validationResult.error.message}`)
            continue
          }

          // Additional validations
          if (!this.validateIReadyRecord(csvRow)) {
            this.logError(`Math record validation failed for student ${this.maskStudentId(csvRow.studentId)} at row ${i + 1}`)
            continue
          }

          validRecords.push(csvRow)

        } catch (error) {
          this.logError(`Failed to parse Math CSV row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      this.logInfo(`Successfully parsed ${validRecords.length} of ${records.length} Math records`)
      return validRecords

    } catch (error) {
      this.logError(`Math CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return []
    }
  }

  /**
   * Validate if student exists in the database
   */
  async validateStudentExists(studentId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient
        .from('students')
        .select('student_id')
        .eq('student_id', studentId)
        .single()

      if (error) {
        this.logInfo(`Student not found: ${this.maskStudentId(studentId)}`)
        return false
      }

      return data !== null

    } catch (error) {
      this.logError(`Error validating student ${this.maskStudentId(studentId)}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  /**
   * Check for duplicate iReady records
   */
  async checkForDuplicate(
    studentId: string, 
    subject: string, 
    academicYear: string, 
    diagnosticDate: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient
        .from('iready_scores')
        .select('id')
        .eq('student_id', studentId)
        .eq('subject', subject)
        .eq('academic_year', academicYear)
        .eq('diagnostic_date', diagnosticDate)
        .single()

      return data !== null

    } catch (error) {
      // If no record found, it's not a duplicate
      return false
    }
  }

  /**
   * Map ELA CSV data to database schema
   */
  mapELAToDatabase(csvRow: IReadyCSVRow, academicYear: AcademicYear, schoolYear: string): any {
    return {
      student_id: csvRow.studentId,
      subject: 'ELA' as IReadySubject,
      academic_year: academicYear,
      school_year: schoolYear,
      diagnostic_date: this.formatDate(csvRow.diagnosticDate),
      overall_scale_score: csvRow.overallScaleScore,
      overall_placement: this.mapPlacement(csvRow.overallPlacement),
      annual_typical_growth_measure: null,
      percent_progress_to_annual_typical_growth: null,
      
      // ELA-specific scores
      phonological_awareness_score: csvRow.phonologicalAwarenessScore,
      phonics_score: csvRow.phonicsScore,
      high_frequency_words_score: csvRow.highFrequencyWordsScore,
      vocabulary_score: csvRow.vocabScore,
      literary_comprehension_score: csvRow.literaryComprehensionScore,
      informational_comprehension_score: csvRow.informationalComprehensionScore,
      
      // Math scores should be null for ELA
      number_and_operations_score: null,
      algebra_and_algebraic_thinking_score: null,
      measurement_and_data_score: null,
      geometry_score: null,
      
      // Performance indicators
      lessons_passed: csvRow.lessonsPassed,
      lessons_attempted: csvRow.lessonsAttempted,
      time_on_task_minutes: csvRow.timeOnTaskMinutes
    }
  }

  /**
   * Map Math CSV data to database schema
   */
  mapMathToDatabase(csvRow: IReadyCSVRow, academicYear: AcademicYear, schoolYear: string): any {
    return {
      student_id: csvRow.studentId,
      subject: 'MATH' as IReadySubject,
      academic_year: academicYear,
      school_year: schoolYear,
      diagnostic_date: this.formatDate(csvRow.diagnosticDate),
      overall_scale_score: csvRow.overallScaleScore,
      overall_placement: this.mapPlacement(csvRow.overallPlacement),
      annual_typical_growth_measure: null,
      percent_progress_to_annual_typical_growth: null,
      
      // ELA scores should be null for Math
      phonological_awareness_score: null,
      phonics_score: null,
      high_frequency_words_score: null,
      vocabulary_score: null,
      literary_comprehension_score: null,
      informational_comprehension_score: null,
      
      // Math-specific scores
      number_and_operations_score: csvRow.numberOperationsScore,
      algebra_and_algebraic_thinking_score: csvRow.algebraScore,
      measurement_and_data_score: csvRow.measurementDataScore,
      geometry_score: csvRow.geometryScore,
      
      // Performance indicators
      lessons_passed: csvRow.lessonsPassed,
      lessons_attempted: csvRow.lessonsAttempted,
      time_on_task_minutes: csvRow.timeOnTaskMinutes
    }
  }

  /**
   * Generic mapping function that routes to subject-specific mappers
   */
  mapToDatabase(csvRow: IReadyCSVRow, academicYear: AcademicYear, schoolYear: string): any {
    if (csvRow.subject === 'ELA') {
      return this.mapELAToDatabase(csvRow, academicYear, schoolYear)
    } else if (csvRow.subject === 'MATH') {
      return this.mapMathToDatabase(csvRow, academicYear, schoolYear)
    }
    return null
  }

  /**
   * Batch upsert iReady score records
   */
  async batchUpsertIReadyScores(records: any[]): Promise<boolean> {
    try {
      // Process in batches
      for (let i = 0; i < records.length; i += this.batchSize) {
        const batch = records.slice(i, i + this.batchSize)
        
        const { error } = await this.supabaseClient
          .from('iready_scores')
          .upsert(batch, {
            onConflict: 'student_id,subject,academic_year,diagnostic_date'
          })

        if (error) {
          this.logError(`Database batch upsert failed: ${error.message}`)
          return false
        }

        this.logInfo(`Successfully upserted batch ${Math.floor(i / this.batchSize) + 1} (${batch.length} records)`)
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
  ): Promise<IReadyImportResult> {
    const startTime = performance.now()
    const result: IReadyImportResult = {
      success: false,
      yearResults: [],
      totalRecords: 0,
      errors: []
    }

    try {
      const yearFolders = [
        { folder: 'Current_Year', academicYear: AcademicYear.CURRENT_YEAR, schoolYear: '2024-2025' },
        { folder: 'Current_Year-1', academicYear: AcademicYear.CURRENT_YEAR_MINUS_1, schoolYear: '2023-2024' },
        { folder: 'Current_Year-2', academicYear: AcademicYear.CURRENT_YEAR_MINUS_2, schoolYear: '2022-2023' }
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
        
        if (yearResult.errors.length > 0) {
          result.errors.push(...yearResult.errors)
        }

        this.logInfo(`Completed ${yearConfig.folder}: ${yearResult.totalRecords} records, ${yearResult.errors.length} errors`)
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

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Validate iReady record business rules
   */
  private validateIReadyRecord(csvRow: IReadyCSVRow): boolean {
    if (!isValidStudentId(csvRow.studentId)) {
      return false
    }

    if (!isValidScaleScore(csvRow.overallScaleScore)) {
      this.logError(`Invalid scale score for student ${this.maskStudentId(csvRow.studentId)}: ${csvRow.overallScaleScore}`)
      return false
    }

    return this.validateScoreRanges(csvRow)
  }

  /**
   * Validate score ranges are within acceptable bounds
   */
  validateScoreRanges(csvRow: any): boolean {
    const scores = [
      csvRow.overallScaleScore,
      csvRow.phonologicalAwarenessScore,
      csvRow.phonicsScore,
      csvRow.highFrequencyWordsScore,
      csvRow.vocabScore,
      csvRow.literaryComprehensionScore,
      csvRow.informationalComprehensionScore,
      csvRow.numberOperationsScore,
      csvRow.algebraScore,
      csvRow.measurementDataScore,
      csvRow.geometryScore
    ].filter(score => score !== undefined && score !== null)

    for (const score of scores) {
      if (!isValidScaleScore(score)) {
        this.logError(`Score out of valid range (100-800): ${score}`)
        return false
      }
    }

    return true
  }

  /**
   * Format date string to YYYY-MM-DD format
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      return date.toISOString().split('T')[0]
    } catch {
      // Return current date as fallback
      return new Date().toISOString().split('T')[0]
    }
  }

  /**
   * Map placement text to enum value
   */
  private mapPlacement(placement: string): IReadyPlacement {
    const placementMap: Record<string, IReadyPlacement> = {
      '3+ Grade Levels Below': IReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_BELOW,
      'THREE_OR_MORE_GRADE_LEVELS_BELOW': IReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_BELOW,
      '2 Grade Levels Below': IReadyPlacement.TWO_GRADE_LEVELS_BELOW,
      'TWO_GRADE_LEVELS_BELOW': IReadyPlacement.TWO_GRADE_LEVELS_BELOW,
      '1 Grade Level Below': IReadyPlacement.ONE_GRADE_LEVEL_BELOW,
      'ONE_GRADE_LEVEL_BELOW': IReadyPlacement.ONE_GRADE_LEVEL_BELOW,
      'On Grade Level': IReadyPlacement.ON_GRADE_LEVEL,
      'ON_GRADE_LEVEL': IReadyPlacement.ON_GRADE_LEVEL,
      '1 Grade Level Above': IReadyPlacement.ONE_GRADE_LEVEL_ABOVE,
      'ONE_GRADE_LEVEL_ABOVE': IReadyPlacement.ONE_GRADE_LEVEL_ABOVE,
      '2 Grade Levels Above': IReadyPlacement.TWO_GRADE_LEVELS_ABOVE,
      'TWO_GRADE_LEVELS_ABOVE': IReadyPlacement.TWO_GRADE_LEVELS_ABOVE,
      '3+ Grade Levels Above': IReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_ABOVE,
      'THREE_OR_MORE_GRADE_LEVELS_ABOVE': IReadyPlacement.THREE_OR_MORE_GRADE_LEVELS_ABOVE
    }

    return placementMap[placement] || IReadyPlacement.ON_GRADE_LEVEL
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
      console.log(`[IReadyImporter] ${message}`)
    }
  }

  private logWarn(message: string): void {
    if (['info', 'warn'].includes(this.logLevel)) {
      console.log(`[IReadyImporter] WARNING: ${message}`)
    }
  }

  private logError(message: string): void {
    console.error(`[IReadyImporter] ERROR: ${message}`)
  }
}

// =============================================================================
// CLI USAGE (if run directly)
// =============================================================================

if (require.main === module) {
  console.log('AttendlyV1 iReady Data Importer')
  console.log('Usage: node iReadyImporter.js <data-directory>')
  console.log('Example: node iReadyImporter.js ./data/iready-diagnostics/')
  console.log('')
  console.log('Directory should contain Current_Year, Current_Year-1, and Current_Year-2 folders')
  console.log('Each folder should contain ela_diagnostic.csv and/or math_diagnostic.csv files')
}