/**
 * @fileoverview Romoland-Specific Features Implementation
 * 
 * Implements specialized features for Romoland School District including:
 * - Custom Aeries query parsing and execution
 * - 7-period middle school attendance processing
 * - Full-day absence calculation logic
 * - 7-day correction window support
 * - California compliance validation
 */

import { z } from 'zod';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================

interface RomolandQueryConfig {
  operation: string;
  tables: string[];
  fields: string[];
  filters?: Record<string, any>;
}

interface AttendancePeriod {
  period: number;
  status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT';
  minutesAbsent?: number;
  minutesTardy?: number;
}

interface AttendanceData {
  studentId: string;
  date: string;
  periods: AttendancePeriod[];
}

interface AttendanceProcessorConfig {
  totalPeriods: number;
  minimumPeriodsForFullDay: number;
  tardyCountsAsPresent: boolean;
}

interface CorrectionServiceConfig {
  correctionWindowDays: number;
  requiresApproval: boolean;
  auditingEnabled: boolean;
}

// =============================================================================
// ROMOLAND QUERY BUILDER
// =============================================================================

/**
 * Handles Romoland's custom Aeries query format parsing and execution
 */
export class RomolandQueryBuilder {
  private readonly VALID_TABLES = ['STU', 'TCH', 'AHS', 'ATT', 'SCH'];
  private readonly VALID_FIELDS = {
    'STU': ['NM', 'GR', 'ID', 'SC', 'EN', 'EX', 'BD', 'GN'],
    'TCH': ['TE', 'ID', 'EM', 'SC'],
    'AHS': ['SP', 'EN', 'AB', 'PR', 'DT', 'ST'],
    'ATT': ['DT', 'SP', 'ST', 'AB', 'PR', 'EX'],
    'SCH': ['SC', 'NM', 'AD', 'PH']
  };
  
  /**
   * Parse Romoland's custom query format
   */
  parseQuery(query: string): RomolandQueryConfig {
    const parts = query.trim().split(/\s+/);
    
    if (parts.length < 3) {
      throw new Error('Invalid query format. Expected: OPERATION TABLES FIELDS');
    }
    
    const operation = parts[0];
    const tables: string[] = [];
    const fields: string[] = [];
    
    // Parse tables and fields
    let currentSection = 'tables';
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      // Check if this looks like a field (contains dot)
      if (part.includes('.')) {
        currentSection = 'fields';
        fields.push(part);
      } else if (currentSection === 'tables') {
        tables.push(part);
      } else {
        fields.push(part);
      }
    }
    
    // Validate tables and fields
    this.validateTablesAndFields(tables, fields);
    
    return {
      operation,
      tables,
      fields
    };
  }
  
  /**
   * Validate tables and fields against known Aeries schema
   */
  private validateTablesAndFields(tables: string[], fields: string[]): void {
    // Validate tables
    for (const table of tables) {
      if (!this.VALID_TABLES.includes(table)) {
        throw new Error(`Invalid table: ${table}`);
      }
    }
    
    // Validate fields
    for (const field of fields) {
      if (field.includes('.')) {
        const [table, fieldName] = field.split('.');
        if (!this.VALID_TABLES.includes(table)) {
          throw new Error(`Invalid table in field: ${field}`);
        }
        if (!this.VALID_FIELDS[table]?.includes(fieldName)) {
          throw new Error(`Invalid query field: ${field}`);
        }
      }
    }
  }
  
  /**
   * Build API parameters from parsed query and filters
   */
  buildApiParameters(query: string, filters: any = {}): any {
    const parsedQuery = this.parseQuery(query);
    
    const apiParams: any = {
      query: query,
      limit: 1000,
      offset: 0
    };
    
    // Convert filters to Aeries API format
    const aeriesFilters: any = {};
    
    if (filters.schoolCode) {
      aeriesFilters['STU.SC'] = filters.schoolCode;
    }
    
    if (filters.gradeLevel) {
      aeriesFilters['STU.GR'] = filters.gradeLevel;
    }
    
    if (filters.dateRange) {
      aeriesFilters['AHS.DT'] = {
        '$gte': filters.dateRange.start,
        '$lte': filters.dateRange.end
      };
    }
    
    if (Object.keys(aeriesFilters).length > 0) {
      apiParams.filters = aeriesFilters;
    }
    
    return apiParams;
  }
  
  /**
   * Transform API response to expected format
   */
  transformResponse(apiResponse: any[]): any[] {
    return apiResponse.map(record => {
      const transformed: any = {};
      
      // Map common fields
      if (record['STU.NM']) {
        transformed.studentName = record['STU.NM'];
      }
      
      if (record['STU.GR']) {
        transformed.grade = record['STU.GR'];
      }
      
      if (record['TCH.TE']) {
        transformed.teacherName = record['TCH.TE'];
      }
      
      if (record['STU.ID']) {
        transformed.studentId = record['STU.ID'];
      }
      
      if (record['AHS.SP']) {
        transformed.schoolPeriod = parseInt(record['AHS.SP'], 10);
      }
      
      if (record['AHS.EN']) {
        transformed.entryDate = record['AHS.EN'];
      }
      
      if (record['AHS.AB']) {
        transformed.absentCount = parseInt(record['AHS.AB'], 10) || 0;
      }
      
      if (record['AHS.PR']) {
        transformed.presentCount = parseInt(record['AHS.PR'], 10) || 0;
      }
      
      // Calculate attendance rate
      if (transformed.absentCount !== undefined && transformed.presentCount !== undefined) {
        const total = transformed.absentCount + transformed.presentCount;
        transformed.attendanceRate = total > 0 ? 
          Math.round((transformed.presentCount / total) * 10000) / 100 : 0;
      }
      
      return transformed;
    });
  }
  
  /**
   * Build custom query for specific reports
   */
  buildCustomQuery(config: {
    operation: string;
    reportType: string;
    fields: string[];
    filters: any;
  }): string {
    let query = `${config.operation}`;
    
    if (config.reportType) {
      query += ` ${config.reportType}`;
    }
    
    // Add fields
    query += ` ${config.fields.join(' ')}`;
    
    // Add filters as WHERE clause
    if (config.filters) {
      const whereConditions: string[] = [];
      
      for (const [key, value] of Object.entries(config.filters)) {
        if (typeof value === 'object' && value.$lt !== undefined) {
          whereConditions.push(`${key} < ${value.$lt}`);
        } else {
          whereConditions.push(`${key} = '${value}'`);
        }
      }
      
      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }
    }
    
    return query;
  }
}

// =============================================================================
// ROMOLAND ATTENDANCE PROCESSOR
// =============================================================================

/**
 * Processes attendance data according to Romoland's 7-period middle school structure
 */
export class RomolandAttendanceProcessor {
  constructor(private config: AttendanceProcessorConfig) {
    if (config.totalPeriods !== 7) {
      console.warn('Romoland uses 7-period days. Configuration may not match district requirements.');
    }
  }
  
  /**
   * Calculate period-based attendance statistics
   */
  calculatePeriodAttendance(attendanceData: AttendanceData): {
    totalPeriods: number;
    periodsPresent: number;
    periodsTardy: number;
    periodsExcusedAbsent: number;
    periodsUnexcusedAbsent: number;
    periodsAbsent: number;
    attendancePercentage: number;
    presentForAttendanceCalculation: number;
  } {
    // Validate input
    this.validateAttendanceData(attendanceData);
    
    const periods = attendanceData.periods;
    
    let periodsPresent = 0;
    let periodsTardy = 0;
    let periodsExcusedAbsent = 0;
    let periodsUnexcusedAbsent = 0;
    let periodsAbsent = 0;
    
    for (const period of periods) {
      switch (period.status) {
        case 'PRESENT':
          periodsPresent++;
          break;
        case 'TARDY':
          periodsTardy++;
          break;
        case 'EXCUSED_ABSENT':
          periodsExcusedAbsent++;
          break;
        case 'UNEXCUSED_ABSENT':
          periodsUnexcusedAbsent++;
          break;
        case 'ABSENT':
          periodsAbsent++;
          break;
      }
    }
    
    // Calculate attendance for ADA purposes
    const presentForCalculation = this.config.tardyCountsAsPresent ? 
      periodsPresent + periodsTardy : periodsPresent;
    
    const attendancePercentage = Math.round(
      (presentForCalculation / this.config.totalPeriods) * 10000
    ) / 100;
    
    return {
      totalPeriods: this.config.totalPeriods,
      periodsPresent,
      periodsTardy,
      periodsExcusedAbsent,
      periodsUnexcusedAbsent,
      periodsAbsent,
      attendancePercentage,
      presentForAttendanceCalculation: presentForCalculation
    };
  }
  
  /**
   * Calculate daily attendance status with full-day absence logic
   */
  calculateDailyAttendanceStatus(attendanceData: AttendanceData): {
    dailyStatus: string;
    isFullDayAbsent: boolean;
    attendancePercentage: number;
    qualifiesForAdaDeduction: boolean;
    excuseBreakdown?: {
      excusedPeriods: number;
      unexcusedPeriods: number;
      majorityStatus: string;
    };
    interventionRequired?: boolean;
  } {
    const periodStats = this.calculatePeriodAttendance(attendanceData);
    
    // Determine if full day absent
    const isFullDayAbsent = periodStats.presentForAttendanceCalculation === 0;
    
    // Determine daily status
    let dailyStatus = 'PARTIAL_DAY_PRESENT';
    let interventionRequired = false;
    
    if (isFullDayAbsent) {
      // Check excuse status
      const excusedPeriods = periodStats.periodsExcusedAbsent;
      const unexcusedPeriods = periodStats.periodsUnexcusedAbsent + periodStats.periodsAbsent;
      
      if (unexcusedPeriods > excusedPeriods) {
        dailyStatus = 'FULL_DAY_UNEXCUSED_ABSENT';
        interventionRequired = true;
      } else {
        dailyStatus = 'FULL_DAY_EXCUSED_ABSENT';
      }
      
      return {
        dailyStatus,
        isFullDayAbsent: true,
        attendancePercentage: 0,
        qualifiesForAdaDeduction: true,
        excuseBreakdown: {
          excusedPeriods,
          unexcusedPeriods,
          majorityStatus: unexcusedPeriods > excusedPeriods ? 'UNEXCUSED_ABSENT' : 'EXCUSED_ABSENT'
        },
        interventionRequired
      };
    } else if (periodStats.presentForAttendanceCalculation >= this.config.minimumPeriodsForFullDay) {
      dailyStatus = 'PARTIAL_DAY_PRESENT';
    } else {
      dailyStatus = 'INSUFFICIENT_ATTENDANCE';
    }
    
    return {
      dailyStatus,
      isFullDayAbsent: false,
      attendancePercentage: periodStats.attendancePercentage,
      qualifiesForAdaDeduction: periodStats.presentForAttendanceCalculation < this.config.minimumPeriodsForFullDay
    };
  }
  
  /**
   * Calculate ADA (Average Daily Attendance) impact
   */
  calculateAdaImpact(attendanceData: AttendanceData): {
    adaCredit: number;
    fullDayEquivalent: boolean;
    fundingImpact: {
      estimatedDailyFunding: number;
      actualFunding: number;
      fundingLoss: number;
    };
  } {
    const periodStats = this.calculatePeriodAttendance(attendanceData);
    const adaCredit = Math.round((periodStats.presentForAttendanceCalculation / this.config.totalPeriods) * 1000) / 1000;
    const fullDayEquivalent = periodStats.presentForAttendanceCalculation >= this.config.minimumPeriodsForFullDay;
    
    // California ADA funding estimate (rough calculation)
    const estimatedDailyFunding = 85; // Approximate per-pupil daily funding
    const actualFunding = adaCredit * estimatedDailyFunding;
    const fundingLoss = estimatedDailyFunding - actualFunding;
    
    return {
      adaCredit,
      fullDayEquivalent,
      fundingImpact: {
        estimatedDailyFunding,
        actualFunding: Math.round(actualFunding * 100) / 100,
        fundingLoss: Math.round(fundingLoss * 100) / 100
      }
    };
  }
  
  /**
   * Analyze intervention needs based on attendance patterns
   */
  analyzeInterventionNeeds(
    studentId: string,
    attendancePattern: Array<{ date: string; periodsAbsent: number }>
  ): {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    interventionRequired: boolean;
    recommendedActions: string[];
    chronicAbsenteeism: boolean;
    attendanceRate: number;
  } {
    const totalDays = attendancePattern.length;
    const totalPeriodsAbsent = attendancePattern.reduce((sum, day) => sum + day.periodsAbsent, 0);
    const totalPossiblePeriods = totalDays * this.config.totalPeriods;
    const attendanceRate = ((totalPossiblePeriods - totalPeriodsAbsent) / totalPossiblePeriods) * 100;
    
    // California chronic absenteeism threshold is 10%
    const chronicAbsenteeism = attendanceRate < 90;
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    let recommendedActions: string[] = [];
    
    if (attendanceRate >= 95) {
      riskLevel = 'LOW';
      recommendedActions = ['MONITOR'];
    } else if (attendanceRate >= 90) {
      riskLevel = 'MEDIUM';
      recommendedActions = ['PARENT_CONTACT', 'ATTENDANCE_AWARENESS'];
    } else if (attendanceRate >= 80) {
      riskLevel = 'HIGH';
      recommendedActions = ['PARENT_CONTACT', 'ATTENDANCE_CONTRACT', 'COUNSELOR_REFERRAL'];
    } else {
      riskLevel = 'CRITICAL';
      recommendedActions = ['IMMEDIATE_INTERVENTION', 'SARB_REFERRAL', 'HOME_VISIT'];
    }
    
    return {
      riskLevel,
      interventionRequired: riskLevel !== 'LOW',
      recommendedActions,
      chronicAbsenteeism,
      attendanceRate: Math.round(attendanceRate * 100) / 100
    };
  }
  
  /**
   * Validate attendance data structure
   */
  private validateAttendanceData(attendanceData: AttendanceData): void {
    if (!attendanceData.periods || !Array.isArray(attendanceData.periods)) {
      throw new Error('Attendance data must include periods array');
    }
    
    if (attendanceData.periods.length !== this.config.totalPeriods) {
      throw new Error(`All ${this.config.totalPeriods} periods must be provided for middle school attendance`);
    }
    
    // Check for valid period numbers
    const periodNumbers = attendanceData.periods.map(p => p.period);
    const expectedPeriods = Array.from({ length: this.config.totalPeriods }, (_, i) => i + 1);
    
    for (const period of expectedPeriods) {
      if (!periodNumbers.includes(period)) {
        throw new Error(`Missing period ${period} in attendance data`);
      }
    }
    
    // Check for duplicates
    const uniquePeriods = new Set(periodNumbers);
    if (uniquePeriods.size !== this.config.totalPeriods) {
      const duplicates = periodNumbers.filter((period, index) => periodNumbers.indexOf(period) !== index);
      throw new Error(`Duplicate period entry found: ${duplicates[0]}`);
    }
    
    // Validate period numbers are in range
    for (const period of attendanceData.periods) {
      if (period.period < 1 || period.period > this.config.totalPeriods) {
        throw new Error(`Invalid period number: ${period.period}. Periods must be 1-${this.config.totalPeriods}`);
      }
    }
  }
}

// =============================================================================
// ATTENDANCE CORRECTION SERVICE
// =============================================================================

/**
 * Handles attendance corrections within the 7-day window with audit trails
 */
export class AttendanceCorrectionService {
  private auditTrail: Map<string, any[]> = new Map();
  
  constructor(private config: CorrectionServiceConfig) {}
  
  /**
   * Process attendance correction within allowable window
   */
  async processCorrection(
    originalAttendance: AttendanceData,
    correctedAttendance: AttendanceData,
    metadata: {
      reason: string;
      correctedBy: string;
      approvedBy?: string;
    }
  ): Promise<{
    success: boolean;
    isWithinWindow: boolean;
    correctionApplied: boolean;
    auditTrail: any[];
  }> {
    const correctionDate = new Date();
    const originalDate = new Date(originalAttendance.date);
    const daysDifference = Math.floor((correctionDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if within correction window
    if (daysDifference > this.config.correctionWindowDays) {
      throw new Error(`Correction window has expired. Changes must be made within ${this.config.correctionWindowDays} days.`);
    }
    
    // Validate correction permissions if required
    if (this.config.requiresApproval && !metadata.approvedBy) {
      throw new Error('Approval required for attendance corrections');
    }
    
    // Create audit entry
    const auditEntry = {
      action: 'ATTENDANCE_CORRECTED',
      timestamp: correctionDate.toISOString(),
      studentId: originalAttendance.studentId,
      date: originalAttendance.date,
      originalStatus: this.summarizeAttendance(originalAttendance),
      newStatus: this.summarizeAttendance(correctedAttendance),
      changes: this.identifyChanges(originalAttendance, correctedAttendance),
      reason: metadata.reason,
      correctedBy: metadata.correctedBy,
      approvedBy: metadata.approvedBy,
      daysSinceOriginal: daysDifference
    };
    
    // Add to audit trail
    this.addToAuditTrail(originalAttendance.studentId, originalAttendance.date, auditEntry);
    
    return {
      success: true,
      isWithinWindow: true,
      correctionApplied: true,
      auditTrail: [auditEntry]
    };
  }
  
  /**
   * Process emergency correction outside normal window
   */
  async processEmergencyCorrection(
    originalAttendance: AttendanceData,
    correctedAttendance: AttendanceData,
    metadata: {
      reason: string;
      emergencyAuthorization: string;
      correctedBy: string;
      legalJustification: string;
    }
  ): Promise<{
    success: boolean;
    isEmergencyCorrection: boolean;
    correctionApplied: boolean;
    requiresDistrictNotification: boolean;
  }> {
    // Validate emergency authorization
    const validAuthorizations = ['DISTRICT_SUPERINTENDENT', 'LEGAL_ORDER', 'STATE_AUDIT'];
    if (!validAuthorizations.includes(metadata.emergencyAuthorization)) {
      throw new Error('Invalid emergency authorization level');
    }
    
    const auditEntry = {
      action: 'EMERGENCY_CORRECTION',
      timestamp: new Date().toISOString(),
      studentId: originalAttendance.studentId,
      date: originalAttendance.date,
      originalStatus: this.summarizeAttendance(originalAttendance),
      newStatus: this.summarizeAttendance(correctedAttendance),
      changes: this.identifyChanges(originalAttendance, correctedAttendance),
      reason: metadata.reason,
      emergencyAuthorization: metadata.emergencyAuthorization,
      correctedBy: metadata.correctedBy,
      legalJustification: metadata.legalJustification,
      requiresReporting: true
    };
    
    this.addToAuditTrail(originalAttendance.studentId, originalAttendance.date, auditEntry);
    
    return {
      success: true,
      isEmergencyCorrection: true,
      correctionApplied: true,
      requiresDistrictNotification: true
    };
  }
  
  /**
   * Validate correction permissions based on user role
   */
  async validateCorrectionPermissions(request: {
    userRole: string;
    userId: string;
    correctionType: string;
  }): Promise<{
    canCorrect: boolean;
    reason?: string;
    maxCorrectionsPerDay?: number;
  }> {
    const rolePermissions = {
      'TEACHER': { canCorrect: false, reason: 'Teachers have insufficient permissions for attendance corrections' },
      'ATTENDANCE_CLERK': { canCorrect: true, maxCorrectionsPerDay: 50 },
      'ASSISTANT_PRINCIPAL': { canCorrect: true, maxCorrectionsPerDay: 100 },
      'PRINCIPAL': { canCorrect: true, maxCorrectionsPerDay: 200 },
      'DISTRICT_ADMIN': { canCorrect: true, maxCorrectionsPerDay: 1000 }
    };
    
    const permission = rolePermissions[request.userRole as keyof typeof rolePermissions];
    
    if (!permission) {
      return {
        canCorrect: false,
        reason: 'Unknown user role'
      };
    }
    
    return permission;
  }
  
  /**
   * Get audit trail for specific student and date
   */
  async getAuditTrail(studentId: string, date: string): Promise<{
    studentId: string;
    date: string;
    corrections: any[];
    totalCorrections: number;
  }> {
    const key = `${studentId}:${date}`;
    const corrections = this.auditTrail.get(key) || [];
    
    return {
      studentId,
      date,
      corrections,
      totalCorrections: corrections.length
    };
  }
  
  /**
   * Summarize attendance for audit purposes
   */
  private summarizeAttendance(attendance: AttendanceData): string {
    const statusCounts = attendance.periods.reduce((counts, period) => {
      counts[period.status] = (counts[period.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return Object.entries(statusCounts)
      .map(([status, count]) => `${status}:${count}`)
      .join(', ');
  }
  
  /**
   * Identify specific changes between attendance records
   */
  private identifyChanges(original: AttendanceData, corrected: AttendanceData): any[] {
    const changes: any[] = [];
    
    for (let i = 0; i < original.periods.length; i++) {
      const originalPeriod = original.periods[i];
      const correctedPeriod = corrected.periods.find(p => p.period === originalPeriod.period);
      
      if (correctedPeriod && originalPeriod.status !== correctedPeriod.status) {
        changes.push({
          period: originalPeriod.period,
          from: originalPeriod.status,
          to: correctedPeriod.status
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Add entry to audit trail
   */
  private addToAuditTrail(studentId: string, date: string, entry: any): void {
    const key = `${studentId}:${date}`;
    const existing = this.auditTrail.get(key) || [];
    existing.push(entry);
    this.auditTrail.set(key, existing);
  }
}

// =============================================================================
// CALIFORNIA COMPLIANCE VALIDATOR
// =============================================================================

/**
 * Validates attendance data against California education code requirements
 */
export class CaliforniaComplianceValidator {
  
  /**
   * Validate chronic absenteeism thresholds (California 10% rule)
   */
  validateChronicAbsenteeism(studentAttendance: {
    studentId: string;
    totalSchoolDays: number;
    daysAbsent: number;
    excusedAbsent: number;
    unexcusedAbsent: number;
  }): {
    isChronicallyAbsent: boolean;
    absenteeismRate: number;
    threshold: number;
    requiresIntervention: boolean;
    complianceStatus: string;
    recommendedActions: string[];
  } {
    const absenteeismRate = (studentAttendance.daysAbsent / studentAttendance.totalSchoolDays) * 100;
    const threshold = 10.0; // California threshold
    
    const isChronicallyAbsent = absenteeismRate >= threshold;
    
    return {
      isChronicallyAbsent,
      absenteeismRate: Math.round(absenteeismRate * 100) / 100,
      threshold,
      requiresIntervention: isChronicallyAbsent,
      complianceStatus: isChronicallyAbsent ? 'AT_RISK' : 'COMPLIANT',
      recommendedActions: isChronicallyAbsent ? 
        ['PARENT_NOTIFICATION', 'INTERVENTION_PLAN', 'MONITORING_PROTOCOL'] : 
        ['CONTINUE_MONITORING']
    };
  }
  
  /**
   * Validate truancy intervention requirements
   */
  validateTruancyIntervention(truancyCase: {
    studentId: string;
    unexcusedAbsences: number;
    interventionsCompleted: string[];
    lastInterventionDate: string;
    schoolYear: string;
  }): {
    complianceLevel: string;
    nextRequiredAction: string;
    timelineRequirement: {
      dueDate: string;
      daysRemaining: number;
    };
    legalRequirements: string[];
  } {
    let complianceLevel = 'TIER_1';
    let nextAction = 'PARENT_CONTACT';
    let legalRequirements = ['EC_48260_NOTIFICATION'];
    
    if (truancyCase.unexcusedAbsences >= 3) {
      complianceLevel = 'TIER_2';
      nextAction = 'ATTENDANCE_CONFERENCE';
      legalRequirements.push('EC_48261_CONFERENCE');
    }
    
    if (truancyCase.unexcusedAbsences >= 6) {
      complianceLevel = 'TIER_3';
      nextAction = 'SARB_REFERRAL';
      legalRequirements.push('EC_48263_SARB_REFERRAL');
    }
    
    // Calculate timeline (typically 10 school days for most interventions)
    const lastInterventionDate = new Date(truancyCase.lastInterventionDate);
    const dueDate = new Date(lastInterventionDate);
    dueDate.setDate(dueDate.getDate() + 14); // 10 school days ≈ 14 calendar days
    
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      complianceLevel,
      nextRequiredAction: nextAction,
      timelineRequirement: {
        dueDate: dueDate.toISOString().split('T')[0],
        daysRemaining
      },
      legalRequirements
    };
  }
  
  /**
   * Validate SARB referral requirements
   */
  validateSarbReferral(sarbCase: {
    studentId: string;
    unexcusedAbsences: number;
    interventionsCompleted: string[];
    lastInterventionDate: string;
    studentAge: number;
    gradeLevel: number;
  }): {
    referralRequired: boolean;
    complianceStatus: string;
    legalBasis: string[];
    requiredDocumentation: string[];
  } {
    const referralRequired = sarbCase.unexcusedAbsences >= 10 || 
                           (sarbCase.unexcusedAbsences >= 6 && sarbCase.interventionsCompleted.length >= 2);
    
    return {
      referralRequired,
      complianceStatus: referralRequired ? 'READY_FOR_SARB' : 'CONTINUE_INTERVENTIONS',
      legalBasis: referralRequired ? 
        ['EC_48263_SARB_REFERRAL', 'EC_48264_HABITUAL_TRUANT'] : 
        ['EC_48260_CONTINUE_MONITORING'],
      requiredDocumentation: referralRequired ? 
        ['ATTENDANCE_RECORD', 'INTERVENTION_LOG', 'PARENT_NOTIFICATIONS'] : 
        ['ATTENDANCE_MONITORING']
    };
  }
  
  /**
   * Validate attendance recovery program compliance (SB 153/176)
   */
  validateRecoveryProgram(recoveryProgram: {
    studentId: string;
    hoursCompleted: number;
    hoursRequired: number;
    teacherCertified: boolean;
    classSize: number;
    standardsAligned: boolean;
    programType: string;
  }): {
    complianceStatus: string;
    ratioCompliance: boolean;
    teacherQualified: boolean;
    hoursCompleted: number;
    hoursRemaining: number;
    estimatedCompletionDate: string;
    sb153Compliant: boolean;
  } {
    const ratioCompliant = recoveryProgram.classSize <= 20; // 20:1 ratio requirement
    const teacherQualified = recoveryProgram.teacherCertified;
    const hoursRemaining = Math.max(0, recoveryProgram.hoursRequired - recoveryProgram.hoursCompleted);
    
    // Estimate completion (assuming 4 hours per week)
    const weeksRemaining = Math.ceil(hoursRemaining / 4);
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + (weeksRemaining * 7));
    
    const sb153Compliant = ratioCompliant && teacherQualified && recoveryProgram.standardsAligned;
    
    return {
      complianceStatus: hoursRemaining === 0 ? 'COMPLETED' : 'IN_PROGRESS',
      ratioCompliance: ratioCompliant,
      teacherQualified,
      hoursCompleted: recoveryProgram.hoursCompleted,
      hoursRemaining,
      estimatedCompletionDate: estimatedCompletion.toISOString().split('T')[0],
      sb153Compliant
    };
  }
  
  /**
   * Validate teacher ratio requirements (20:1 for attendance recovery)
   */
  validateTeacherRatio(classAssignment: {
    teacherId: string;
    programType: string;
    currentStudents: number;
    maxCapacity: number;
    teacherCertifications: string[];
  }): {
    ratioCompliant: boolean;
    currentRatio: number;
    maxAllowedRatio: number;
    overCapacityBy?: number;
    complianceViolation?: string;
    correctiveAction?: string;
  } {
    const maxAllowedRatio = 20;
    const ratioCompliant = classAssignment.currentStudents <= maxAllowedRatio;
    
    const result: any = {
      ratioCompliant,
      currentRatio: classAssignment.currentStudents,
      maxAllowedRatio
    };
    
    if (!ratioCompliant) {
      result.overCapacityBy = classAssignment.currentStudents - maxAllowedRatio;
      result.complianceViolation = 'RATIO_EXCEEDED';
      result.correctiveAction = 'REDUCE_CLASS_SIZE';
    }
    
    return result;
  }
  
  /**
   * Generate compliance report for state audits
   */
  generateComplianceReport(reportData: {
    districtCode: string;
    schoolYear: string;
    reportingPeriod: string;
    students: Array<{
      studentId: string;
      chronicAbsenteeism: boolean;
      interventionsProvided: number;
      recoveryHours: number;
    }>;
  }): {
    districtCode: string;
    reportingPeriod: string;
    summary: {
      totalStudents: number;
      chronicallyAbsentStudents: number;
      studentsInRecovery: number;
      complianceRate: number;
      riskStudents: number;
    };
    detailedMetrics: {
      interventionEffectiveness: number;
      recoveryProgramParticipation: number;
      sarbReferrals: number;
    };
    recommendations: string[];
  } {
    const totalStudents = reportData.students.length;
    const chronicallyAbsentStudents = reportData.students.filter(s => s.chronicAbsenteeism).length;
    const studentsInRecovery = reportData.students.filter(s => s.recoveryHours > 0).length;
    const studentsWithInterventions = reportData.students.filter(s => s.interventionsProvided > 0).length;
    
    const complianceRate = totalStudents > 0 ? 
      Math.round((studentsWithInterventions / totalStudents) * 100) : 100;
    
    const recommendations: string[] = [];
    
    if (complianceRate < 95) {
      recommendations.push('INCREASE_EARLY_INTERVENTION_CAPACITY');
    }
    
    if (chronicallyAbsentStudents / totalStudents > 0.15) {
      recommendations.push('IMPLEMENT_COMPREHENSIVE_ATTENDANCE_STRATEGY');
    }
    
    return {
      districtCode: reportData.districtCode,
      reportingPeriod: `${reportData.reportingPeriod} ${reportData.schoolYear}`,
      summary: {
        totalStudents,
        chronicallyAbsentStudents,
        studentsInRecovery,
        complianceRate,
        riskStudents: chronicallyAbsentStudents
      },
      detailedMetrics: {
        interventionEffectiveness: Math.round((studentsWithInterventions / Math.max(chronicallyAbsentStudents, 1)) * 100),
        recoveryProgramParticipation: Math.round((studentsInRecovery / Math.max(chronicallyAbsentStudents, 1)) * 100),
        sarbReferrals: 0 // Would be calculated from actual SARB data
      },
      recommendations
    };
  }
}