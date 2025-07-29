/**
 * @fileoverview Input Validation Framework for AP_Tool_V1
 * 
 * Implements comprehensive input validation and sanitization to prevent:
 * - Command injection attacks (CWE-77)
 * - SQL injection attacks (CWE-89) 
 * - Cross-site scripting (CWE-79)
 * - Path traversal attacks (CWE-22)
 * - CSV injection attacks (CWE-1236)
 * 
 * FERPA COMPLIANCE:
 * - Validates student ID formats to prevent data exposure
 * - Sanitizes educational data inputs
 * - Prevents malicious data from being processed or logged
 * - Ensures all CSV imports are properly validated
 * 
 * SECURITY STANDARDS:
 * - Follows OWASP ASVS L2 validation requirements
 * - Implements defense-in-depth validation strategies
 * - Provides comprehensive logging for security monitoring
 */

import { z } from 'zod';
import validator from 'validator';
import { logSecurityEvent, SecurityError, ErrorSeverity } from './error-handler';

/**
 * Student data validation schemas for FERPA compliance
 */
export const StudentDataSchemas = {
  // Student ID: Alphanumeric, 6-12 characters
  studentId: z.string()
    .min(6, 'Student ID must be at least 6 characters')
    .max(12, 'Student ID must be at most 12 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Student ID must contain only alphanumeric characters'),
  
  // Employee ID: Alphanumeric, 4-10 characters
  employeeId: z.string()
    .min(4, 'Employee ID must be at least 4 characters')
    .max(10, 'Employee ID must be at most 10 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Employee ID must contain only alphanumeric characters'),
  
  // Student name: Letters, spaces, hyphens, apostrophes only
  studentName: z.string()
    .min(1, 'Student name is required')
    .max(100, 'Student name must be at most 100 characters')
    .regex(/^[A-Za-z\s\-']+$/, 'Student name contains invalid characters'),
  
  // Grade level: K-12 format
  gradeLevel: z.string()
    .regex(/^(K|[1-9]|1[0-2])$/, 'Invalid grade level format'),
  
  // Attendance percentage: 0-100
  attendancePercentage: z.number()
    .min(0, 'Attendance percentage cannot be negative')
    .max(100, 'Attendance percentage cannot exceed 100'),
  
  // Email validation for educational domain
  email: z.string()
    .email('Invalid email format')
    .refine((email) => {
      // Ensure educational domain or approved external domains
      const allowedDomains = [
        'romoland.k12.ca.us',
        'gmail.com', // For parent communication
        'outlook.com', // For parent communication
      ];
      const domain = email.split('@')[1];
      return allowedDomains.includes(domain);
    }, 'Email must be from approved educational domain'),
};

/**
 * API input validation schemas
 */
export const APIInputSchemas = {
  // Query parameters validation
  queryParams: z.object({
    page: z.string().regex(/^\d+$/).optional().transform(Number),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    sort: z.enum(['name', 'grade', 'attendance', 'created_at']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),
  
  // CSV upload validation
  csvData: z.object({
    filename: z.string()
      .min(1, 'Filename is required')
      .max(255, 'Filename too long')
      .regex(/^[A-Za-z0-9\-_\.]+\.csv$/, 'Invalid CSV filename format'),
    size: z.number()
      .min(1, 'File cannot be empty')
      .max(10 * 1024 * 1024, 'File too large (max 10MB)'), // 10MB limit
    headers: z.array(z.string()).min(1, 'CSV must have headers'),
  }),
};

/**
 * Input sanitization functions
 */
export class InputSanitizer {
  /**
   * Sanitize HTML to prevent XSS attacks (CWE-79)
   */
  static sanitizeHTML(input: string): string {
    if (typeof input !== 'string') {
      throw new SecurityError('Input must be a string for HTML sanitization', {
        severity: ErrorSeverity.MEDIUM,
        input: typeof input,
        timestamp: new Date()
      });
    }
    
    // Remove all HTML tags and decode entities
    return validator.escape(validator.stripLow(input));
  }
  
  /**
   * Sanitize SQL input to prevent injection (CWE-89)
   */
  static sanitizeSQL(input: string): string {
    if (typeof input !== 'string') {
      throw new SecurityError('Input must be a string for SQL sanitization', {
        severity: ErrorSeverity.HIGH,
        input: typeof input,
        timestamp: new Date()
      });
    }
    
    // Remove SQL injection patterns
    const dangerous = [
      /('|(\\'))/gi,
      /("|(\\""))/gi,
      /(-{2})/gi,
      /(\/\*[\s\S]*?\*\/)/gi,
      /(;)/gi,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi
    ];
    
    let sanitized = input;
    dangerous.forEach(pattern => {
      if (pattern.test(sanitized)) {
        logSecurityEvent({
          type: 'SQL_INJECTION_ATTEMPT',
          severity: ErrorSeverity.HIGH,
          input: input.substring(0, 100), // Log first 100 chars only
          pattern: pattern.toString(),
          timestamp: new Date()
        });
        sanitized = sanitized.replace(pattern, '');
      }
    });
    
    return sanitized.trim();
  }
  
  /**
   * Sanitize command input to prevent injection (CWE-77)
   */
  static sanitizeCommand(input: string): string {
    if (typeof input !== 'string') {
      throw new SecurityError('Input must be a string for command sanitization', {
        severity: ErrorSeverity.CRITICAL,
        input: typeof input,
        timestamp: new Date()
      });
    }
    
    // Reject any input containing command injection patterns
    const dangerousPatterns = [
      /[;&|`$(){}[\]]/g,
      /\s*(rm|del|format|mkfs)\s+/gi,
      /\s*(sudo|su|chmod|chown)\s+/gi,
      /[<>]/g,
      /\s*\|\s*/g,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        logSecurityEvent({
          type: 'COMMAND_INJECTION_ATTEMPT',
          severity: ErrorSeverity.CRITICAL,
          input: input.substring(0, 100),
          pattern: pattern.toString(),
          timestamp: new Date()
        });
        throw new SecurityError('Input contains potentially dangerous characters', {
          severity: ErrorSeverity.CRITICAL,
          input: input.substring(0, 50),
          timestamp: new Date()
        });
      }
    }
    
    return input.trim();
  }
  
  /**
   * Sanitize CSV data to prevent CSV injection (CWE-1236)
   */
  static sanitizeCSV(input: string): string {
    if (typeof input !== 'string') {
      throw new SecurityError('Input must be a string for CSV sanitization', {
        severity: ErrorSeverity.MEDIUM,
        input: typeof input,
        timestamp: new Date()
      });
    }
    
    // Remove CSV injection patterns
    const csvDangerous = /^[=+\-@]/;
    
    if (csvDangerous.test(input.trim())) {
      logSecurityEvent({
        type: 'CSV_INJECTION_ATTEMPT',
        severity: ErrorSeverity.MEDIUM,
        input: input.substring(0, 100),
        timestamp: new Date()
      });
      // Prefix with single quote to neutralize formula injection
      return `'${input}`;
    }
    
    return input;
  }
  
  /**
   * Sanitize file path to prevent traversal (CWE-22)
   */
  static sanitizeFilePath(input: string): string {
    if (typeof input !== 'string') {
      throw new SecurityError('Input must be a string for path sanitization', {
        severity: ErrorSeverity.HIGH,
        input: typeof input,
        timestamp: new Date()
      });
    }
    
    // Remove path traversal patterns
    const pathTraversal = /(\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c)/gi;
    
    if (pathTraversal.test(input)) {
      logSecurityEvent({
        type: 'PATH_TRAVERSAL_ATTEMPT',
        severity: ErrorSeverity.HIGH,
        input: input.substring(0, 100),
        timestamp: new Date()
      });
      throw new SecurityError('Path contains traversal characters', {
        severity: ErrorSeverity.HIGH,
        input: input.substring(0, 50),
        timestamp: new Date()
      });
    }
    
    // Ensure path doesn't access References directory
    if (input.toLowerCase().includes('references') || 
        input.toLowerCase().includes('refs')) {
      logSecurityEvent({
        type: 'REFERENCES_ACCESS_ATTEMPT',
        severity: ErrorSeverity.CRITICAL,
        input: input.substring(0, 100),
        timestamp: new Date()
      });
      throw new SecurityError('Access to References directory not allowed', {
        severity: ErrorSeverity.CRITICAL,
        input: input.substring(0, 50),
        timestamp: new Date()
      });
    }
    
    return input.replace(/[<>:"|?*]/g, '').trim();
  }
}

/**
 * Comprehensive input validator class
 */
export class InputValidator {
  /**
   * Validate student data input
   */
  static validateStudentData(data: any): {
    isValid: boolean;
    errors: string[];
    sanitizedData?: any;
  } {
    const errors: string[] = [];
    const sanitizedData: any = {};
    
    try {
      // Validate student ID
      if (data.studentId) {
        StudentDataSchemas.studentId.parse(data.studentId);
        sanitizedData.studentId = InputSanitizer.sanitizeHTML(data.studentId);
      }
      
      // Validate student name
      if (data.studentName) {
        StudentDataSchemas.studentName.parse(data.studentName);
        sanitizedData.studentName = InputSanitizer.sanitizeHTML(data.studentName);
      }
      
      // Validate grade level
      if (data.gradeLevel) {
        StudentDataSchemas.gradeLevel.parse(data.gradeLevel);
        sanitizedData.gradeLevel = data.gradeLevel;
      }
      
      // Validate attendance percentage
      if (data.attendancePercentage !== undefined) {
        StudentDataSchemas.attendancePercentage.parse(data.attendancePercentage);
        sanitizedData.attendancePercentage = data.attendancePercentage;
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => e.message));
      } else {
        errors.push('Unknown validation error');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }
  
  /**
   * Validate CSV upload data
   */
  static validateCSVUpload(data: any): {
    isValid: boolean;
    errors: string[];
    sanitizedData?: any;
  } {
    const errors: string[] = [];
    
    try {
      const validatedData = APIInputSchemas.csvData.parse(data);
      
      // Additional security checks for CSV content
      if (validatedData.headers) {
        const sanitizedHeaders = validatedData.headers.map(header => 
          InputSanitizer.sanitizeCSV(InputSanitizer.sanitizeHTML(header))
        );
        
        return {
          isValid: true,
          errors: [],
          sanitizedData: {
            ...validatedData,
            headers: sanitizedHeaders
          }
        };
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => e.message));
      } else {
        errors.push('CSV validation failed');
      }
    }
    
    return {
      isValid: false,
      errors
    };
  }
  
  /**
   * Validate API query parameters
   */
  static validateQueryParams(params: any): {
    isValid: boolean;
    errors: string[];
    sanitizedParams?: any;
  } {
    const errors: string[] = [];
    
    try {
      const validatedParams = APIInputSchemas.queryParams.parse(params);
      
      return {
        isValid: true,
        errors: [],
        sanitizedParams: validatedParams
      };
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => e.message));
      } else {
        errors.push('Query parameter validation failed');
      }
    }
    
    return {
      isValid: false,
      errors
    };
  }
}

/**
 * All validation utilities are exported above
 */