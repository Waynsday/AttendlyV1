/**
 * @fileoverview Aeries Data Validator
 * 
 * Validates and sanitizes data from Aeries API responses to ensure
 * data quality, security, and compliance with FERPA requirements.
 * 
 * Features:
 * - Comprehensive data validation
 * - PII detection and sanitization
 * - Data consistency checks
 * - Performance monitoring
 * - Batch processing support
 * - FERPA compliance
 */

import type { AeriesAttendanceRecord, AeriesStudent } from '../../types/aeries';

export interface ValidationError {
  field: string;
  message: string;
  recordIndex: number;
  severity: 'ERROR' | 'WARNING';
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  sanitizedData: any;
}

export interface BatchValidationResult {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  batchResults: ValidationResult[];
}

export interface PIIViolation {
  field: string;
  type: 'SSN_PATTERN' | 'PHONE_PATTERN' | 'EMAIL_PATTERN' | 'ADDRESS_PATTERN';
  confidence: number;
}

export interface PIIScanResult {
  hasPII: boolean;
  piiFields: string[];
  violations?: PIIViolation[];
}

export interface PIIScanner {
  scanForPII(data: any): PIIScanResult;
  sanitizeData(data: any): any;
  maskSensitiveFields(message: string): string;
}

export interface DataValidatorConfig {
  strictMode?: boolean;
  enablePIIScanning?: boolean;
  maxRecordSize?: number;
  allowedSchools?: string[];
  piiScanner?: PIIScanner;
}

/**
 * PII Scanner implementation
 */
class DefaultPIIScanner implements PIIScanner {
  private readonly SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
  private readonly PHONE_PATTERN = /\b\d{3}-\d{3}-\d{4}\b/g;
  private readonly EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  scanForPII(data: any): PIIScanResult {
    const violations: PIIViolation[] = [];
    const piiFields: string[] = [];
    const dataStr = JSON.stringify(data);

    // Check for SSN patterns
    if (this.SSN_PATTERN.test(dataStr)) {
      violations.push({ field: 'unknown', type: 'SSN_PATTERN', confidence: 0.9 });
    }

    // Check for phone patterns
    if (this.PHONE_PATTERN.test(dataStr)) {
      violations.push({ field: 'unknown', type: 'PHONE_PATTERN', confidence: 0.8 });
    }

    // Check for email patterns
    if (this.EMAIL_PATTERN.test(dataStr)) {
      violations.push({ field: 'unknown', type: 'EMAIL_PATTERN', confidence: 0.7 });
    }

    // Check specific fields that commonly contain PII
    if (Array.isArray(data)) {
      data.forEach((record, index) => {
        if (record.firstName || record.lastName || record.birthDate) {
          piiFields.push(`record[${index}].personalInfo`);
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      if (data.firstName || data.lastName || data.birthDate) {
        piiFields.push('personalInfo');
      }
    }

    return {
      hasPII: violations.length > 0 || piiFields.length > 0,
      piiFields,
      violations
    };
  }

  sanitizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(record => this.sanitizeRecord(record));
    } else if (typeof data === 'object' && data !== null) {
      return this.sanitizeRecord(data);
    }
    return data;
  }

  private sanitizeRecord(record: any): any {
    const sanitized = { ...record };

    // Mask personal information
    if (sanitized.firstName && typeof sanitized.firstName === 'string') {
      sanitized.firstName = this.maskString(sanitized.firstName);
    }
    
    if (sanitized.lastName && typeof sanitized.lastName === 'string') {
      sanitized.lastName = this.maskString(sanitized.lastName);
    }

    if (sanitized.birthDate && typeof sanitized.birthDate === 'string') {
      sanitized.birthDate = sanitized.birthDate.replace(/\d{4}-\d{2}-(\d{2})/, '****-**-$1');
    }

    return sanitized;
  }

  private maskString(str: string): string {
    if (str.length <= 1) return str;
    return str.charAt(0) + '*'.repeat(Math.max(0, str.length - 2)) + (str.length > 1 ? str.charAt(str.length - 1) : '');
  }

  maskSensitiveFields(message: string): string {
    return message
      .replace(this.SSN_PATTERN, '***-**-****')
      .replace(this.PHONE_PATTERN, '***-***-****')
      .replace(this.EMAIL_PATTERN, '***@***.***');
  }
}

/**
 * Aeries Data Validator
 */
export class AeriesDataValidator {
  private config: Required<DataValidatorConfig>;
  private piiScanner: PIIScanner;

  constructor(config: DataValidatorConfig = {}) {
    this.config = {
      strictMode: config.strictMode !== undefined ? config.strictMode : true,
      enablePIIScanning: config.enablePIIScanning !== undefined ? config.enablePIIScanning : true,
      maxRecordSize: config.maxRecordSize || 10000,
      allowedSchools: config.allowedSchools || ['RHS', 'RMS', 'RES', 'HHS'],
      piiScanner: config.piiScanner || new DefaultPIIScanner()
    };

    this.piiScanner = this.config.piiScanner;
  }

  /**
   * Validate attendance data
   */
  validateAttendanceData(data: AeriesAttendanceRecord[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let sanitizedData = data;

    // Validate each record
    data.forEach((record, index) => {
      this.validateAttendanceRecord(record, index, errors, warnings);
    });

    // Check for duplicates
    this.checkForDuplicateAttendance(data, warnings);

    // PII scanning if enabled
    if (this.config.enablePIIScanning) {
      const piiResult = this.piiScanner.scanForPII(data);
      if (piiResult.hasPII) {
        if (piiResult.violations) {
          piiResult.violations.forEach(violation => {
            warnings.push({
              field: violation.field,
              message: `Potential PII detected: ${violation.type} (confidence: ${Math.round(violation.confidence * 100)}%)`,
              recordIndex: 0,
              severity: 'WARNING'
            });
          });
        }
        
        // Sanitize data
        sanitizedData = this.piiScanner.sanitizeData(data);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData
    };
  }

  /**
   * Validate student data
   */
  validateStudentData(data: AeriesStudent[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let sanitizedData = data;

    // Validate each record
    data.forEach((record, index) => {
      this.validateStudentRecord(record, index, errors, warnings);
    });

    // PII scanning if enabled
    if (this.config.enablePIIScanning) {
      const piiResult = this.piiScanner.scanForPII(data);
      if (piiResult.hasPII) {
        sanitizedData = this.piiScanner.sanitizeData(data);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData
    };
  }

  /**
   * Validate attendance record
   */
  private validateAttendanceRecord(
    record: AeriesAttendanceRecord,
    index: number,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Check record size
    const recordSize = JSON.stringify(record).length;
    if (recordSize > this.config.maxRecordSize) {
      errors.push({
        field: 'record',
        message: `Record size exceeds maximum allowed size of ${this.config.maxRecordSize} bytes`,
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    // Validate required fields
    if (!record.studentId) {
      errors.push({
        field: 'studentId',
        message: 'Student ID is required',
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    if (!record.studentNumber) {
      errors.push({
        field: 'studentNumber',
        message: 'Student Number is required',
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    if (!record.schoolCode) {
      errors.push({
        field: 'schoolCode',
        message: 'School Code is required',
        recordIndex: index,
        severity: 'ERROR'
      });
    } else if (!this.config.allowedSchools.includes(record.schoolCode)) {
      errors.push({
        field: 'schoolCode',
        message: `Invalid school code: ${record.schoolCode}. Allowed codes: ${this.config.allowedSchools.join(', ')}`,
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    // Validate date format
    if (!this.isValidISODate(record.attendanceDate)) {
      errors.push({
        field: 'attendanceDate',
        message: 'Invalid date format. Expected ISO 8601 date (YYYY-MM-DD)',
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    if (!this.isValidISODateTime(record.lastModified)) {
      errors.push({
        field: 'lastModified',
        message: 'Invalid datetime format. Expected ISO 8601 datetime',
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    // Validate periods
    if (record.periods && Array.isArray(record.periods)) {
      record.periods.forEach((period, periodIndex) => {
        if (period.period < 1 || period.period > 8) {
          errors.push({
            field: `periods[${periodIndex}].period`,
            message: 'Period number must be between 1 and 8',
            recordIndex: index,
            severity: 'ERROR'
          });
        }

        if (!this.isValidAttendanceStatus(period.status)) {
          errors.push({
            field: `periods[${periodIndex}].status`,
            message: `Invalid attendance status: ${period.status}`,
            recordIndex: index,
            severity: 'ERROR'
          });
        }
      });

      // Check period count for school type
      this.validatePeriodCount(record, index, warnings);
    }

    // Validate daily attendance consistency
    this.validateDailyAttendanceConsistency(record, index, warnings);
  }

  /**
   * Validate student record
   */
  private validateStudentRecord(
    record: AeriesStudent,
    index: number,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Validate required fields
    if (!record.studentId) {
      errors.push({
        field: 'studentId',
        message: 'Student ID is required',
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    // Validate grade level
    if (record.grade && !this.isValidGradeLevel(record.grade)) {
      errors.push({
        field: 'grade',
        message: `Invalid grade level: ${record.grade}. Allowed grades: K, 1-12`,
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    // Validate enrollment status
    if (record.enrollmentStatus && !['ACTIVE', 'INACTIVE', 'TRANSFERRED'].includes(record.enrollmentStatus)) {
      errors.push({
        field: 'enrollmentStatus',
        message: `Invalid enrollment status: ${record.enrollmentStatus}. Allowed values: ACTIVE, INACTIVE, TRANSFERRED`,
        recordIndex: index,
        severity: 'ERROR'
      });
    }

    // Validate school code
    if (record.schoolCode && !this.config.allowedSchools.includes(record.schoolCode)) {
      errors.push({
        field: 'schoolCode',
        message: `Invalid school code: ${record.schoolCode}. Allowed codes: ${this.config.allowedSchools.join(', ')}`,
        recordIndex: index,
        severity: 'ERROR'
      });
    }
  }

  /**
   * Validate period count for school type
   */
  private validatePeriodCount(record: AeriesAttendanceRecord, index: number, warnings: ValidationError[]): void {
    const expectedPeriods: Record<string, number> = {
      'RMS': 7, // Middle school
      'RHS': 6, // High school
      'HHS': 6  // Heritage High School
    };

    const expected = expectedPeriods[record.schoolCode];
    if (expected && record.periods && record.periods.length !== expected) {
      const schoolType = record.schoolCode === 'RMS' ? 'Middle school' : 'High school';
      warnings.push({
        field: 'periods',
        message: `${schoolType} (${record.schoolCode}) typically has ${expected} periods, but found ${record.periods.length}`,
        recordIndex: index,
        severity: 'WARNING'
      });
    }
  }

  /**
   * Validate daily attendance consistency
   */
  private validateDailyAttendanceConsistency(
    record: AeriesAttendanceRecord,
    index: number,
    warnings: ValidationError[]
  ): void {
    if (!record.periods || !record.dailyAttendance) {
      return;
    }

    // For middle school, check if absent all periods
    if (record.schoolCode === 'RMS' && record.periods.length >= 6) {
      const absentPeriods = record.periods.filter(p => p.status === 'ABSENT').length;
      const totalPeriods = record.periods.length;
      
      if (absentPeriods === totalPeriods && record.dailyAttendance.status === 'PRESENT') {
        warnings.push({
          field: 'dailyAttendance.status',
          message: `Daily status PRESENT inconsistent with all periods being ABSENT`,
          recordIndex: index,
          severity: 'WARNING'
        });
      }
    }
  }

  /**
   * Check for duplicate attendance records
   */
  private checkForDuplicateAttendance(data: AeriesAttendanceRecord[], warnings: ValidationError[]): void {
    const seen = new Set<string>();
    
    data.forEach((record, index) => {
      const key = `${record.studentId}-${record.attendanceDate}`;
      if (seen.has(key)) {
        warnings.push({
          field: 'record',
          message: `Duplicate attendance record found for student ${record.studentId} on ${record.attendanceDate}`,
          recordIndex: index,
          severity: 'WARNING'
        });
      }
      seen.add(key);
    });
  }

  /**
   * Batch validation for large datasets
   */
  async validateAttendanceDataBatch(
    data: AeriesAttendanceRecord[],
    options: { batchSize?: number } = {}
  ): Promise<BatchValidationResult> {
    const batchSize = options.batchSize || 100;
    const batchResults: ValidationResult[] = [];
    let validRecords = 0;
    let invalidRecords = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const result = this.validateAttendanceData(batch);
      
      batchResults.push(result);
      
      if (result.isValid) {
        validRecords += batch.length;
      } else {
        invalidRecords += batch.length;
      }

      // Allow event loop to process other tasks
      await new Promise(resolve => setImmediate(resolve));
    }

    return {
      totalRecords: data.length,
      validRecords,
      invalidRecords,
      batchResults
    };
  }

  /**
   * Utility validation methods
   */
  private isValidISODate(date: string): boolean {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return isoDateRegex.test(date) && !isNaN(Date.parse(date));
  }

  private isValidISODateTime(datetime: string): boolean {
    const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoDateTimeRegex.test(datetime) && !isNaN(Date.parse(datetime));
  }

  private isValidAttendanceStatus(status: string): boolean {
    const validStatuses = ['PRESENT', 'ABSENT', 'TARDY', 'EXCUSED_ABSENT', 'UNEXCUSED_ABSENT'];
    return validStatuses.includes(status);
  }

  private isValidGradeLevel(grade: string): boolean {
    const validGrades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    return validGrades.includes(grade);
  }

  /**
   * Get validation statistics
   */
  getValidationStatistics(result: ValidationResult): any {
    return {
      totalRecords: Array.isArray(result.sanitizedData) ? result.sanitizedData.length : 1,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      isValid: result.isValid,
      errorsByField: this.groupErrorsByField(result.errors),
      warningsByField: this.groupErrorsByField(result.warnings)
    };
  }

  private groupErrorsByField(errors: ValidationError[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      acc[error.field] = (acc[error.field] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}