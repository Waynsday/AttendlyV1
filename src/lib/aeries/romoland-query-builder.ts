/**
 * @fileoverview Romoland Query Builder
 * 
 * Builds SQL queries specific to Romoland School District's Aeries configuration.
 * Handles period-based attendance, school-specific configurations, and
 * district-specific data requirements.
 * 
 * Features:
 * - School-specific period configurations
 * - Romoland district attendance codes
 * - SQL injection prevention
 * - Query optimization hints
 * - Batch processing support
 */

export interface QueryOptions {
  startDate?: string;
  endDate?: string;
  schoolCode?: string;
  schoolCodes?: string[];
  gradeLevel?: string;
  activeOnly?: boolean;
  includePeriods?: boolean;
  includeDemographics?: boolean;
  includeCourseAssignments?: boolean;
  includeSpecialPrograms?: boolean;
  includeAttendanceCodes?: boolean;
  includeCorrectionWindow?: boolean;
  correctionWindowDays?: number;
  enrollmentStatus?: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
  limit?: number;
  batchSize?: number;
}

export interface RomolandAttendanceQuery {
  fields: string[];
  tables: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  filters: {
    schoolCode?: string;
    schoolCodes?: string[];
    gradeLevel?: string;
    activeOnly?: boolean;
    enrollmentStatus?: string;
  };
  includePeriods?: boolean;
  periodConfiguration?: {
    totalPeriods: number;
    schoolType: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL';
    blockSchedule?: boolean;
  };
  correctionWindow?: {
    enabled: boolean;
    days: number;
  };
  attendanceCodeMapping?: Record<string, string>;
  limit?: number;
  batchProcessing?: {
    enabled: boolean;
    batchSize: number;
  };
}

/**
 * Query builder for Romoland School District Aeries integration
 */
export class RomolandQueryBuilder {
  private readonly ROMOLAND_SCHOOLS = {
    'RHS': { name: 'Romoland High School', type: 'HIGH_SCHOOL', periods: 6 },
    'HHS': { name: 'Heritage High School', type: 'HIGH_SCHOOL', periods: 6, blockSchedule: true },
    'RMS': { name: 'Romoland Middle School', type: 'MIDDLE_SCHOOL', periods: 7 },
    'RES': { name: 'Romoland Elementary School', type: 'ELEMENTARY', periods: 0 },
    'RKE': { name: 'Romoland K-8', type: 'ELEMENTARY', periods: 0 },
    'RIE': { name: 'Romoland Independent Elementary', type: 'ELEMENTARY', periods: 0 }
  };

  private readonly ATTENDANCE_CODE_MAPPING = {
    'P': 'PRESENT',
    'A': 'ABSENT',
    'T': 'TARDY',
    'X': 'EXCUSED_ABSENT',
    'U': 'UNEXCUSED_ABSENT',
    'S': 'SUSPENDED',
    'I': 'IN_SCHOOL_SUSPENSION',
    'E': 'EXCUSED_ABSENT',
    'L': 'LATE',
    'O': 'OFF_CAMPUS'
  };

  private readonly VALID_FIELDS = [
    // Student fields
    'STU.ID', 'STU.NM', 'STU.GR', 'STU.SC', 'STU.AD', 'STU.WD',
    'STU.ET', 'STU.SX', 'STU.LG', 'STU.SP1', 'STU.SP2', 'STU.EL',
    // Teacher fields
    'TCH.ID', 'TCH.NM', 'TCH.TE', 'TCH.SC', 'TCH.RM',
    // Attendance fields
    'AHS.STU', 'AHS.DT', 'AHS.SP', 'AHS.EN', 'AHS.AB', 'AHS.PR',
    'AHS.TE', 'AHS.CO', 'AHS.EX', 'AHS.TM',
    // Course fields
    'CSE.CO', 'CSE.CN', 'CSE.SC', 'CSE.TE'
  ];

  /**
   * Build attendance query for Romoland district
   */
  buildAttendanceQuery(options: QueryOptions): RomolandAttendanceQuery {
    this.validateQueryOptions(options);

    const query: RomolandAttendanceQuery = {
      fields: ['STU.NM', 'STU.GR', 'TCH.TE', 'STU.ID', 'AHS.SP', 'AHS.EN', 'AHS.AB', 'AHS.PR'],
      tables: ['STU', 'TCH', 'AHS'],
      filters: {
        activeOnly: options.activeOnly !== false // Default to true
      }
    };

    // Add date range
    if (options.startDate && options.endDate) {
      query.dateRange = {
        startDate: options.startDate,
        endDate: options.endDate
      };
    }

    // Add school filtering
    if (options.schoolCode) {
      query.filters.schoolCode = options.schoolCode;
      query.periodConfiguration = this.getPeriodConfiguration(options.schoolCode);
    }

    if (options.schoolCodes) {
      query.filters.schoolCodes = options.schoolCodes;
    }

    // Add grade level filter
    if (options.gradeLevel) {
      query.filters.gradeLevel = options.gradeLevel;
    }

    // Add enrollment status filter
    if (options.enrollmentStatus) {
      query.filters.enrollmentStatus = options.enrollmentStatus;
    }

    // Configure periods
    if (options.includePeriods) {
      query.includePeriods = true;
      if (!query.fields.includes('AHS.SP')) {
        query.fields.push('AHS.SP');
      }
    }

    // Configure correction window
    if (options.includeCorrectionWindow) {
      query.correctionWindow = {
        enabled: true,
        days: options.correctionWindowDays || 7
      };
    }

    // Add special program fields
    if (options.includeSpecialPrograms) {
      query.fields.push('STU.SP1', 'STU.SP2', 'STU.EL');
    }

    // Add attendance code mapping
    if (options.includeAttendanceCodes) {
      query.attendanceCodeMapping = { ...this.ATTENDANCE_CODE_MAPPING };
    }

    // Configure batch processing
    if (options.batchSize && options.batchSize > 1) {
      query.batchProcessing = {
        enabled: true,
        batchSize: options.batchSize
      };
    }

    // Set limit
    if (options.limit) {
      query.limit = options.limit;
    }

    return query;
  }

  /**
   * Build student query
   */
  buildStudentQuery(options: QueryOptions): RomolandAttendanceQuery {
    const query: RomolandAttendanceQuery = {
      fields: ['STU.ID', 'STU.NM', 'STU.GR', 'STU.SC', 'STU.AD', 'STU.WD'],
      tables: ['STU'],
      filters: {}
    };

    if (options.schoolCode) {
      query.filters.schoolCode = options.schoolCode;
    }

    if (options.activeOnly !== undefined) {
      query.filters.activeOnly = options.activeOnly;
    }

    if (options.enrollmentStatus) {
      query.filters.enrollmentStatus = options.enrollmentStatus;
    }

    // Add demographic fields
    if (options.includeDemographics) {
      query.fields.push('STU.ET', 'STU.SX', 'STU.LG');
    }

    return query;
  }

  /**
   * Build teacher query
   */
  buildTeacherQuery(options: QueryOptions): RomolandAttendanceQuery {
    const query: RomolandAttendanceQuery = {
      fields: ['TCH.ID', 'TCH.NM', 'TCH.TE', 'TCH.SC', 'TCH.RM'],
      tables: ['TCH'],
      filters: {
        activeOnly: true
      }
    };

    if (options.schoolCode) {
      query.filters.schoolCode = options.schoolCode;
    }

    // Add course assignment fields
    if (options.includeCourseAssignments) {
      query.fields.push('CSE.CO', 'CSE.CN');
      query.tables.push('CSE');
    }

    return query;
  }

  /**
   * Convert query object to SQL string
   */
  toSQL(query: RomolandAttendanceQuery): string {
    this.validateQuery(query);

    let sql = this.buildSelectClause(query);
    sql += this.buildFromClause(query);
    sql += this.buildWhereClause(query);
    sql += this.buildOrderClause(query);
    sql += this.buildLimitClause(query);

    // Add query optimization hints
    sql = this.addOptimizationHints(sql, query);

    return sql;
  }

  /**
   * Build SELECT clause
   */
  private buildSelectClause(query: RomolandAttendanceQuery): string {
    const fields = query.fields.map(field => this.escapeFieldName(field));
    return `SELECT ${fields.join(', ')}\n`;
  }

  /**
   * Build FROM clause with joins
   */
  private buildFromClause(query: RomolandAttendanceQuery): string {
    const tables = [...query.tables];
    let sql = `FROM ${tables[0]}\n`;

    // Add joins for multiple tables
    if (tables.includes('AHS') && tables.includes('STU')) {
      sql += 'JOIN AHS ON STU.ID = AHS.STU\n';
    }

    if (tables.includes('TCH') && tables.includes('AHS')) {
      sql += 'JOIN TCH ON AHS.TE = TCH.ID\n';
    }

    if (tables.includes('CSE') && tables.includes('TCH')) {
      sql += 'JOIN CSE ON TCH.ID = CSE.TE\n';
    }

    return sql;
  }

  /**
   * Build WHERE clause
   */
  private buildWhereClause(query: RomolandAttendanceQuery): string {
    const conditions: string[] = [];

    // Date range filter
    if (query.dateRange) {
      conditions.push(`AHS.DT >= '${this.escapeString(query.dateRange.startDate)}'`);
      conditions.push(`AHS.DT <= '${this.escapeString(query.dateRange.endDate)}'`);
    }

    // School code filter
    if (query.filters.schoolCode) {
      conditions.push(`STU.SC = '${this.escapeString(query.filters.schoolCode)}'`);
    }

    // Multiple school codes
    if (query.filters.schoolCodes && query.filters.schoolCodes.length > 0) {
      const schoolCodes = query.filters.schoolCodes.map(code => `'${this.escapeString(code)}'`);
      conditions.push(`STU.SC IN (${schoolCodes.join(', ')})`);
    }

    // Grade level filter
    if (query.filters.gradeLevel) {
      conditions.push(`STU.GR = '${this.escapeString(query.filters.gradeLevel)}'`);
    }

    // Active only filter
    if (query.filters.activeOnly) {
      conditions.push(`STU.DEL = 'N'`);
    }

    // Enrollment status filter
    if (query.filters.enrollmentStatus) {
      if (query.filters.enrollmentStatus === 'ACTIVE') {
        conditions.push(`STU.AD IS NOT NULL AND STU.WD IS NULL`);
      } else if (query.filters.enrollmentStatus === 'INACTIVE') {
        conditions.push(`STU.WD IS NOT NULL`);
      }
    }

    // Correction window filter
    if (query.correctionWindow?.enabled) {
      const correctionDate = new Date();
      correctionDate.setDate(correctionDate.getDate() - query.correctionWindow.days);
      const correctionDateStr = correctionDate.toISOString().split('T')[0];
      conditions.push(`AHS.LM >= '${correctionDateStr}'`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}\n` : '';
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderClause(query: RomolandAttendanceQuery): string {
    const orderFields = ['STU.SC', 'STU.GR', 'STU.NM'];
    
    if (query.dateRange) {
      orderFields.unshift('AHS.DT');
    }

    return `ORDER BY ${orderFields.join(', ')}\n`;
  }

  /**
   * Build LIMIT clause
   */
  private buildLimitClause(query: RomolandAttendanceQuery): string {
    if (query.limit && query.limit > 0) {
      return `LIMIT ${query.limit}\n`;
    }
    return '';
  }

  /**
   * Add SQL optimization hints
   */
  private addOptimizationHints(sql: string, query: RomolandAttendanceQuery): string {
    let hints = '';

    // Add index hints for date range queries
    if (query.dateRange) {
      hints += '/*+ INDEX(AHS, AHS_DATE_IDX) */\n';
    }

    // Add index hints for school queries
    if (query.filters.schoolCode || query.filters.schoolCodes) {
      hints += '/*+ INDEX(STU, STU_SCHOOL_IDX) */\n';
    }

    return hints + sql;
  }

  /**
   * Get period configuration for school
   */
  private getPeriodConfiguration(schoolCode: string): RomolandAttendanceQuery['periodConfiguration'] {
    const school = this.ROMOLAND_SCHOOLS[schoolCode as keyof typeof this.ROMOLAND_SCHOOLS];
    
    if (!school) {
      throw new Error(`Invalid school code: ${schoolCode}`);
    }

    return {
      totalPeriods: school.periods,
      schoolType: school.type as any,
      ...(school.blockSchedule && { blockSchedule: true })
    };
  }

  /**
   * Validate query options
   */
  private validateQueryOptions(options: QueryOptions): void {
    // Validate required fields for attendance queries
    if (options.startDate || options.endDate) {
      if (!options.startDate || !options.endDate) {
        throw new Error('Start date and end date are required for attendance queries');
      }

      // Validate date format
      if (!this.isValidDateFormat(options.startDate) || !this.isValidDateFormat(options.endDate)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      // Validate date range
      if (new Date(options.startDate) > new Date(options.endDate)) {
        throw new Error('End date must be after start date');
      }
    }

    // Validate school codes
    if (options.schoolCode && !this.ROMOLAND_SCHOOLS[options.schoolCode as keyof typeof this.ROMOLAND_SCHOOLS]) {
      throw new Error(`Invalid school code: ${options.schoolCode}`);
    }

    if (options.schoolCodes) {
      for (const code of options.schoolCodes) {
        if (!this.ROMOLAND_SCHOOLS[code as keyof typeof this.ROMOLAND_SCHOOLS]) {
          throw new Error(`Invalid school code: ${code}`);
        }
      }
    }
  }

  /**
   * Validate query object
   */
  private validateQuery(query: RomolandAttendanceQuery): void {
    // Validate field names
    for (const field of query.fields) {
      if (!this.VALID_FIELDS.includes(field)) {
        throw new Error(`Invalid field name: ${field}`);
      }
    }

    // Validate table names
    const validTables = ['STU', 'TCH', 'AHS', 'CSE'];
    for (const table of query.tables) {
      if (!validTables.includes(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }
    }
  }

  /**
   * Escape field names to prevent SQL injection
   */
  private escapeFieldName(fieldName: string): string {
    // Field names should only contain alphanumeric characters, dots, and underscores
    if (!/^[A-Za-z0-9_.]+$/.test(fieldName)) {
      throw new Error(`Invalid field name: ${fieldName}`);
    }
    return fieldName;
  }

  /**
   * Escape string values to prevent SQL injection
   */
  private escapeString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private isValidDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return false;
    }

    const parsedDate = new Date(date);
    return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
  }

  /**
   * Get list of valid school codes
   */
  getValidSchoolCodes(): string[] {
    return Object.keys(this.ROMOLAND_SCHOOLS);
  }

  /**
   * Get school information
   */
  getSchoolInfo(schoolCode: string) {
    return this.ROMOLAND_SCHOOLS[schoolCode as keyof typeof this.ROMOLAND_SCHOOLS];
  }

  /**
   * Get attendance code mapping
   */
  getAttendanceCodeMapping(): Record<string, string> {
    return { ...this.ATTENDANCE_CODE_MAPPING };
  }
}