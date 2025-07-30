/**
 * @fileoverview Row-Level Security (RLS) Implementation for AP_Tool_V1
 * 
 * Implements comprehensive row-level security controls:
 * - School-based data access restrictions
 * - Teacher assignment validation
 * - Role-based data filtering
 * - Dynamic policy enforcement
 * - Educational interest validation at the data level
 * - Audit trail for all data access patterns
 * 
 * SECURITY REQUIREMENTS:
 * - Enforce school boundaries for all data access
 * - Validate teacher-student assignments
 * - Apply role-based filtering automatically
 * - Log all policy enforcement actions
 * - Support dynamic policy updates
 * - Integrate with FERPA compliance requirements
 */

import { 
  AuthorizationError,
  SecurityError,
  logSecurityEvent,
  ErrorSeverity
} from './error-handler';
import { UserRole, EducationalInterestLevel, AuthenticationContext } from './auth-middleware';
import { FERPADataClass } from './ferpa-compliance';

/**
 * RLS policy types
 */
export enum RLSPolicyType {
  SCHOOL_BOUNDARY = 'SCHOOL_BOUNDARY',
  TEACHER_ASSIGNMENT = 'TEACHER_ASSIGNMENT',
  ROLE_BASED = 'ROLE_BASED',
  TEMPORAL = 'TEMPORAL',
  CUSTOM = 'CUSTOM'
}

/**
 * RLS policy definition
 */
export interface RLSPolicy {
  id: string;
  name: string;
  type: RLSPolicyType;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  conditions: RLSCondition[];
  actions: RLSAction[];
  description: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * RLS condition
 */
export interface RLSCondition {
  field: string;
  operator: 'equals' | 'in' | 'not_in' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: any;
  userField?: string; // Field from user context to compare against
}

/**
 * RLS action
 */
export interface RLSAction {
  type: 'ALLOW' | 'DENY' | 'FILTER' | 'REDACT' | 'LOG';
  fields?: string[]; // Specific fields to apply action to
  message?: string;
}

/**
 * Data access context
 */
export interface DataAccessContext {
  userId: string;
  employeeId: string;
  role: UserRole;
  educationalInterest: EducationalInterestLevel;
  schoolIds: string[];
  teacherAssignments?: TeacherAssignment[];
  sessionId?: string;
  ipAddress?: string;
  operation: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT';
  tableName: string;
  timestamp: Date;
}

/**
 * Teacher assignment data
 */
export interface TeacherAssignment {
  teacherId: string;
  schoolId: string;
  gradeLevel?: string;
  subject?: string;
  classId?: string;
  studentIds: string[];
  startDate: Date;
  endDate?: Date;
  active: boolean;
}

/**
 * RLS enforcement result
 */
export interface RLSResult {
  allowed: boolean;
  filteredData?: any[];
  redactedFields?: string[];
  appliedPolicies: string[];
  warnings: string[];
  auditRequired: boolean;
}

/**
 * School boundary mapping
 */
export interface SchoolBoundary {
  schoolId: string;
  schoolName: string;
  districtId: string;
  boundaries: {
    grades: string[];
    programs: string[];
    departments: string[];
  };
  dataCategories: FERPADataClass[];
}

/**
 * Row-Level Security Service
 */
export class RowLevelSecurityService {
  private policies: Map<string, RLSPolicy> = new Map();
  private schoolBoundaries: Map<string, SchoolBoundary> = new Map();
  private teacherAssignments: Map<string, TeacherAssignment[]> = new Map();
  private policyCache: Map<string, RLSPolicy[]> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
    this.initializeSchoolBoundaries();
  }

  /**
   * Apply RLS policies to data query
   */
  async applyRLS(
    authContext: AuthenticationContext,
    tableName: string,
    operation: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT',
    data?: any[]
  ): Promise<RLSResult> {
    const context: DataAccessContext = {
      userId: authContext.userId,
      employeeId: authContext.employeeId,
      role: authContext.role,
      educationalInterest: authContext.educationalInterest,
      schoolIds: await this.getUserSchoolIds(authContext.userId),
      teacherAssignments: await this.getTeacherAssignments(authContext.employeeId),
      sessionId: authContext.sessionId,
      ipAddress: authContext.ipAddress,
      operation,
      tableName,
      timestamp: new Date()
    };

    // Get applicable policies
    const applicablePolicies = await this.getApplicablePolicies(context);
    
    // Sort by priority (highest first)
    applicablePolicies.sort((a, b) => b.priority - a.priority);

    let result: RLSResult = {
      allowed: true,
      filteredData: data ? [...data] : undefined,
      redactedFields: [],
      appliedPolicies: [],
      warnings: [],
      auditRequired: false
    };

    // Apply each policy in order
    for (const policy of applicablePolicies) {
      const policyResult = await this.applyPolicy(policy, context, result.filteredData);
      
      // Merge results
      result.allowed = result.allowed && policyResult.allowed;
      result.filteredData = policyResult.filteredData || result.filteredData;
      result.redactedFields = [...result.redactedFields, ...(policyResult.redactedFields || [])];
      result.appliedPolicies.push(policy.id);
      result.warnings.push(...policyResult.warnings);
      result.auditRequired = result.auditRequired || policyResult.auditRequired;

      // If denied, stop processing
      if (!policyResult.allowed) {
        break;
      }
    }

    // Log RLS enforcement
    await this.logRLSEnforcement(context, result);

    return result;
  }

  /**
   * Apply a specific policy
   */
  private async applyPolicy(
    policy: RLSPolicy,
    context: DataAccessContext,
    data?: any[]
  ): Promise<RLSResult> {
    const result: RLSResult = {
      allowed: true,
      filteredData: data,
      redactedFields: [],
      appliedPolicies: [policy.id],
      warnings: [],
      auditRequired: false
    };

    // Check if policy conditions are met
    const conditionsMet = await this.evaluateConditions(policy.conditions, context, data);
    
    if (!conditionsMet) {
      return result; // Policy doesn't apply
    }

    // Apply policy actions
    for (const action of policy.actions) {
      switch (action.type) {
        case 'DENY':
          result.allowed = false;
          result.warnings.push(action.message || `Access denied by policy: ${policy.name}`);
          break;

        case 'FILTER':
          if (data && policy.type === RLSPolicyType.SCHOOL_BOUNDARY) {
            result.filteredData = await this.applySchoolBoundaryFilter(data, context);
          } else if (data && policy.type === RLSPolicyType.TEACHER_ASSIGNMENT) {
            result.filteredData = await this.applyTeacherAssignmentFilter(data, context);
          }
          break;

        case 'REDACT':
          if (action.fields) {
            result.redactedFields.push(...action.fields);
          }
          break;

        case 'LOG':
          result.auditRequired = true;
          break;

        case 'ALLOW':
        default:
          // No additional action needed
          break;
      }
    }

    return result;
  }

  /**
   * Evaluate policy conditions
   */
  private async evaluateConditions(
    conditions: RLSCondition[],
    context: DataAccessContext,
    data?: any[]
  ): Promise<boolean> {
    for (const condition of conditions) {
      const contextValue = this.getContextValue(context, condition.userField || condition.field);
      const conditionValue = condition.value;

      let conditionMet = false;

      switch (condition.operator) {
        case 'equals':
          conditionMet = contextValue === conditionValue;
          break;
        case 'in':
          conditionMet = Array.isArray(conditionValue) && conditionValue.includes(contextValue);
          break;
        case 'not_in':
          conditionMet = Array.isArray(conditionValue) && !conditionValue.includes(contextValue);
          break;
        case 'contains':
          conditionMet = Array.isArray(contextValue) && contextValue.includes(conditionValue);
          break;
        case 'not_contains':
          conditionMet = Array.isArray(contextValue) && !contextValue.includes(conditionValue);
          break;
        case 'gt':
          conditionMet = contextValue > conditionValue;
          break;
        case 'lt':
          conditionMet = contextValue < conditionValue;
          break;
        case 'gte':
          conditionMet = contextValue >= conditionValue;
          break;
        case 'lte':
          conditionMet = contextValue <= conditionValue;
          break;
      }

      if (!conditionMet) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply school boundary filtering
   */
  private async applySchoolBoundaryFilter(data: any[], context: DataAccessContext): Promise<any[]> {
    if (!context.schoolIds.length) {
      return []; // No school access
    }

    return data.filter(record => {
      // Check if record has school_id field
      const recordSchoolId = record.school_id || record.schoolId;
      if (recordSchoolId) {
        return context.schoolIds.includes(recordSchoolId);
      }

      // For student records, check via student-school relationship
      if (record.student_id || record.studentId) {
        return this.isStudentInUserSchools(record.student_id || record.studentId, context.schoolIds);
      }

      return false;
    });
  }

  /**
   * Apply teacher assignment filtering
   */
  private async applyTeacherAssignmentFilter(data: any[], context: DataAccessContext): Promise<any[]> {
    if (!context.teacherAssignments?.length) {
      return data; // No filtering if no assignments
    }

    const assignedStudentIds = new Set<string>();
    context.teacherAssignments.forEach(assignment => {
      assignment.studentIds.forEach(studentId => assignedStudentIds.add(studentId));
    });

    return data.filter(record => {
      const studentId = record.student_id || record.studentId;
      return studentId && assignedStudentIds.has(studentId);
    });
  }

  /**
   * Get applicable policies for context
   */
  private async getApplicablePolicies(context: DataAccessContext): Promise<RLSPolicy[]> {
    const cacheKey = `${context.tableName}-${context.operation}-${context.role}`;
    
    // Check cache first
    if (this.policyCache.has(cacheKey)) {
      return this.policyCache.get(cacheKey)!.filter(policy => policy.enabled);
    }

    const policies: RLSPolicy[] = [];

    // Get policies for table and operation
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      // Check if policy applies to this table/operation
      const appliesToTable = this.policyAppliesToTable(policy, context.tableName);
      const appliesToOperation = this.policyAppliesToOperation(policy, context.operation);
      const appliesToRole = this.policyAppliesToRole(policy, context.role);

      if (appliesToTable && appliesToOperation && appliesToRole) {
        policies.push(policy);
      }
    }

    // Cache the result
    this.policyCache.set(cacheKey, policies);

    return policies;
  }

  /**
   * Redact sensitive fields from data
   */
  async redactFields(data: any[], fieldsToRedact: string[]): Promise<any[]> {
    if (!fieldsToRedact.length) return data;

    return data.map(record => {
      const redactedRecord = { ...record };
      
      fieldsToRedact.forEach(field => {
        if (redactedRecord.hasOwnProperty(field)) {
          redactedRecord[field] = '[REDACTED]';
        }
      });

      return redactedRecord;
    });
  }

  /**
   * Create new RLS policy
   */
  async createPolicy(policy: Omit<RLSPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const policyId = crypto.randomUUID();
    const fullPolicy: RLSPolicy = {
      id: policyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...policy
    };

    this.policies.set(policyId, fullPolicy);
    this.clearPolicyCache();

    logSecurityEvent({
      type: 'RLS_POLICY_CREATED',
      severity: ErrorSeverity.MEDIUM,
      policyId,
      policyName: policy.name,
      createdBy: policy.createdBy,
      timestamp: new Date()
    });

    return policyId;
  }

  /**
   * Update RLS policy
   */
  async updatePolicy(policyId: string, updates: Partial<RLSPolicy>): Promise<void> {
    const existingPolicy = this.policies.get(policyId);
    
    if (!existingPolicy) {
      throw new SecurityError('Policy not found', {
        severity: ErrorSeverity.MEDIUM,
        policyId,
        timestamp: new Date()
      });
    }

    const updatedPolicy: RLSPolicy = {
      ...existingPolicy,
      ...updates,
      updatedAt: new Date()
    };

    this.policies.set(policyId, updatedPolicy);
    this.clearPolicyCache();

    logSecurityEvent({
      type: 'RLS_POLICY_UPDATED',
      severity: ErrorSeverity.MEDIUM,
      policyId,
      updatedFields: Object.keys(updates),
      timestamp: new Date()
    });
  }

  /**
   * Delete RLS policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    const policy = this.policies.get(policyId);
    
    if (!policy) {
      throw new SecurityError('Policy not found', {
        severity: ErrorSeverity.MEDIUM,
        policyId,
        timestamp: new Date()
      });
    }

    this.policies.delete(policyId);
    this.clearPolicyCache();

    logSecurityEvent({
      type: 'RLS_POLICY_DELETED',
      severity: ErrorSeverity.HIGH,
      policyId,
      policyName: policy.name,
      timestamp: new Date()
    });
  }

  /**
   * Get user's school IDs
   */
  private async getUserSchoolIds(userId: string): Promise<string[]> {
    // In production, query from database
    // Mock implementation
    return ['SCHOOL001', 'SCHOOL002'];
  }

  /**
   * Get teacher assignments
   */
  private async getTeacherAssignments(employeeId: string): Promise<TeacherAssignment[]> {
    return this.teacherAssignments.get(employeeId) || [];
  }

  /**
   * Check if student is in user's schools
   */
  private isStudentInUserSchools(studentId: string, schoolIds: string[]): boolean {
    // In production, query student-school relationship
    // Mock implementation
    return true;
  }

  /**
   * Get context value for condition evaluation
   */
  private getContextValue(context: DataAccessContext, field: string): any {
    switch (field) {
      case 'userId': return context.userId;
      case 'role': return context.role;
      case 'educationalInterest': return context.educationalInterest;
      case 'schoolIds': return context.schoolIds;
      case 'operation': return context.operation;
      case 'tableName': return context.tableName;
      default: return undefined;
    }
  }

  /**
   * Check if policy applies to table
   */
  private policyAppliesToTable(policy: RLSPolicy, tableName: string): boolean {
    // Check policy conditions for table applicability
    return policy.conditions.some(condition => 
      condition.field === 'tableName' && 
      (condition.value === tableName || 
       (Array.isArray(condition.value) && condition.value.includes(tableName)))
    );
  }

  /**
   * Check if policy applies to operation
   */
  private policyAppliesToOperation(policy: RLSPolicy, operation: string): boolean {
    return policy.conditions.some(condition => 
      condition.field === 'operation' && 
      (condition.value === operation || 
       (Array.isArray(condition.value) && condition.value.includes(operation)))
    );
  }

  /**
   * Check if policy applies to role
   */
  private policyAppliesToRole(policy: RLSPolicy, role: UserRole): boolean {
    return policy.conditions.some(condition => 
      condition.field === 'role' && 
      (condition.value === role || 
       (Array.isArray(condition.value) && condition.value.includes(role)))
    );
  }

  /**
   * Log RLS enforcement
   */
  private async logRLSEnforcement(context: DataAccessContext, result: RLSResult): Promise<void> {
    logSecurityEvent({
      type: 'RLS_POLICY_ENFORCED',
      severity: result.allowed ? ErrorSeverity.LOW : ErrorSeverity.MEDIUM,
      userId: context.userId,
      employeeId: context.employeeId,
      tableName: context.tableName,
      operation: context.operation,
      appliedPolicies: result.appliedPolicies,
      accessAllowed: result.allowed,
      recordsFiltered: result.filteredData?.length || 0,
      fieldsRedacted: result.redactedFields?.length || 0,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      timestamp: context.timestamp
    });
  }

  /**
   * Clear policy cache
   */
  private clearPolicyCache(): void {
    this.policyCache.clear();
  }

  /**
   * Initialize default policies
   */
  private initializeDefaultPolicies(): void {
    // School boundary policy for students table
    this.policies.set('school-boundary-students', {
      id: 'school-boundary-students',
      name: 'School Boundary - Students',
      type: RLSPolicyType.SCHOOL_BOUNDARY,
      enabled: true,
      priority: 100,
      conditions: [
        { field: 'tableName', operator: 'equals', value: 'students' }
      ],
      actions: [
        { type: 'FILTER' },
        { type: 'LOG' }
      ],
      description: 'Filter student records based on user school assignments',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system'
    });

    // Teacher assignment policy
    this.policies.set('teacher-assignment-students', {
      id: 'teacher-assignment-students',
      name: 'Teacher Assignment - Students',
      type: RLSPolicyType.TEACHER_ASSIGNMENT,
      enabled: true,
      priority: 90,
      conditions: [
        { field: 'tableName', operator: 'equals', value: 'students' },
        { field: 'role', operator: 'equals', value: UserRole.TEACHER }
      ],
      actions: [
        { type: 'FILTER' },
        { type: 'LOG' }
      ],
      description: 'Filter students based on teacher assignments',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system'
    });

    // Administrative access policy
    this.policies.set('admin-full-access', {
      id: 'admin-full-access',
      name: 'Administrator Full Access',
      type: RLSPolicyType.ROLE_BASED,
      enabled: true,
      priority: 200,
      conditions: [
        { field: 'role', operator: 'in', value: [UserRole.ADMINISTRATOR, UserRole.ASSISTANT_PRINCIPAL] }
      ],
      actions: [
        { type: 'ALLOW' },
        { type: 'LOG' }
      ],
      description: 'Allow full access for administrators',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system'
    });
  }

  /**
   * Initialize school boundaries
   */
  private initializeSchoolBoundaries(): void {
    // Mock school boundaries - in production, load from database
    this.schoolBoundaries.set('SCHOOL001', {
      schoolId: 'SCHOOL001',
      schoolName: 'Elementary School 1',
      districtId: 'ROMOLAND',
      boundaries: {
        grades: ['K', '1', '2', '3', '4', '5'],
        programs: ['GENERAL', 'SPECIAL_ED'],
        departments: ['GENERAL']
      },
      dataCategories: [FERPADataClass.EDUCATIONAL_RECORD, FERPADataClass.PII]
    });
  }
}

// Export singleton instance
export const rowLevelSecurityService = new RowLevelSecurityService();