import { Intervention, InterventionType, InterventionStatus } from '@/domain/entities/intervention';
import { StudentId } from '@/domain/value-objects/student-id';

/**
 * Intervention Repository Interface
 * 
 * Defines the contract for intervention data persistence in the AP Romoland system.
 * Handles attendance interventions including parent contacts, counselor referrals,
 * SART/SARB referrals, and attendance contracts.
 * 
 * @example
 * ```typescript
 * class SupabaseInterventionRepository implements InterventionRepository {
 *   async findByStudent(studentId: StudentId): Promise<Intervention[]> {
 *     // Implementation details...
 *   }
 * }
 * ```
 */
export interface InterventionRepository {
  /**
   * Finds an intervention by its unique ID
   * 
   * @param id - The intervention ID
   * @returns Promise resolving to the intervention or null if not found
   */
  findById(id: string): Promise<Intervention | null>;

  /**
   * Finds all interventions for a specific student
   * 
   * @param studentId - The student ID
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of interventions
   */
  findByStudent(studentId: StudentId, filters?: InterventionFilters): Promise<Intervention[]>;

  /**
   * Finds interventions by type
   * 
   * @param type - The intervention type to filter by
   * @param filters - Optional additional filters to apply
   * @returns Promise resolving to an array of interventions
   */
  findByType(type: InterventionType, filters?: InterventionFilters): Promise<Intervention[]>;

  /**
   * Finds interventions by status
   * 
   * @param status - The intervention status to filter by
   * @param filters - Optional additional filters to apply
   * @returns Promise resolving to an array of interventions
   */
  findByStatus(status: InterventionStatus, filters?: InterventionFilters): Promise<Intervention[]>;

  /**
   * Finds interventions created by a specific teacher
   * 
   * @param createdBy - The employee ID of the teacher who created the interventions
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of interventions
   */
  findByCreatedBy(createdBy: string, filters?: InterventionFilters): Promise<Intervention[]>;

  /**
   * Finds interventions scheduled within a date range
   * 
   * @param startDate - Start date of the range (inclusive)
   * @param endDate - End date of the range (inclusive)
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of interventions
   */
  findByScheduledDateRange(
    startDate: Date,
    endDate: Date,
    filters?: InterventionFilters
  ): Promise<Intervention[]>;

  /**
   * Finds overdue interventions (scheduled but not completed past due date)
   * 
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of overdue interventions
   */
  findOverdueInterventions(filters?: InterventionFilters): Promise<Intervention[]>;

  /**
   * Finds upcoming interventions scheduled within the next specified days
   * 
   * @param days - Number of days to look ahead
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of upcoming interventions
   */
  findUpcomingInterventions(days: number, filters?: InterventionFilters): Promise<Intervention[]>;

  /**
   * Gets intervention statistics for a student
   * 
   * @param studentId - The student ID
   * @param startDate - Start date for statistics calculation
   * @param endDate - End date for statistics calculation
   * @returns Promise resolving to intervention statistics
   */
  getInterventionStatistics(
    studentId: StudentId,
    startDate: Date,
    endDate: Date
  ): Promise<InterventionStatistics>;

  /**
   * Gets intervention summary for reporting
   * 
   * @param startDate - Start date for summary
   * @param endDate - End date for summary
   * @param filters - Optional filters to apply
   * @returns Promise resolving to intervention summary
   */
  getInterventionSummary(
    startDate: Date,
    endDate: Date,
    filters?: InterventionFilters
  ): Promise<InterventionSummary>;

  /**
   * Saves an intervention (create or update)
   * 
   * @param intervention - The intervention to save
   * @returns Promise resolving to the saved intervention
   */
  save(intervention: Intervention): Promise<Intervention>;

  /**
   * Creates a new intervention
   * 
   * @param intervention - The intervention to create
   * @returns Promise resolving to the created intervention
   */
  create(intervention: Intervention): Promise<Intervention>;

  /**
   * Updates an existing intervention
   * 
   * @param intervention - The intervention to update
   * @returns Promise resolving to the updated intervention
   * @throws Error if intervention is not found
   */
  update(intervention: Intervention): Promise<Intervention>;

  /**
   * Deletes an intervention
   * 
   * @param id - The ID of the intervention to delete
   * @returns Promise resolving to true if successful
   */
  delete(id: string): Promise<boolean>;

  /**
   * Bulk creates multiple interventions
   * 
   * @param interventions - Array of interventions to create
   * @returns Promise resolving to the created interventions
   */
  bulkCreate(interventions: Intervention[]): Promise<Intervention[]>;

  /**
   * Finds interventions with pagination support
   * 
   * @param offset - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param filters - Optional filters to apply
   * @returns Promise resolving to paginated intervention results
   */
  findWithPagination(
    offset: number,
    limit: number,
    filters?: InterventionFilters
  ): Promise<PaginatedInterventionResult>;

  /**
   * Gets count of interventions with optional filtering
   * 
   * @param filters - Optional filters to apply
   * @returns Promise resolving to the count
   */
  count(filters?: InterventionFilters): Promise<number>;

  /**
   * Finds students who may need interventions based on attendance patterns
   * 
   * @param criteria - Criteria for identifying students needing interventions
   * @returns Promise resolving to student IDs that may need interventions
   */
  findStudentsNeedingInterventions(criteria: InterventionCriteria): Promise<StudentId[]>;
}

/**
 * Intervention Filters Interface
 * 
 * Defines optional filters that can be applied when querying interventions
 */
export interface InterventionFilters {
  studentIds?: StudentId[];
  types?: InterventionType[];
  statuses?: InterventionStatus[];
  createdBy?: string[];
  startDate?: Date;
  endDate?: Date;
  overdueOnly?: boolean;
  upcomingDays?: number;
}

/**
 * Intervention Statistics Interface
 * 
 * Represents comprehensive intervention statistics for a student
 */
export interface InterventionStatistics {
  totalInterventions: number;
  completedInterventions: number;
  canceledInterventions: number;
  scheduledInterventions: number;
  overdueInterventions: number;
  byType: {
    [key in InterventionType]: number;
  };
  averageDaysToCompletion: number;
  completionRate: number;
  mostRecentIntervention: Date | null;
  nextScheduledIntervention: Date | null;
}

/**
 * Intervention Summary Interface
 * 
 * Represents a summary of interventions for reporting purposes
 */
export interface InterventionSummary {
  totalInterventions: number;
  completedInterventions: number;
  canceledInterventions: number;
  scheduledInterventions: number;
  overdueInterventions: number;
  byType: {
    [key in InterventionType]: {
      total: number;
      completed: number;
      canceled: number;
      scheduled: number;
      overdue: number;
    };
  };
  byCreator: {
    [employeeId: string]: {
      name: string;
      total: number;
      completed: number;
      canceled: number;
      scheduled: number;
    };
  };
  completionRate: number;
  averageDaysToCompletion: number;
}

/**
 * Paginated Intervention Result Interface
 * 
 * Represents a paginated response from the intervention repository
 */
export interface PaginatedInterventionResult {
  data: Intervention[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  statistics?: InterventionStatistics;
}

/**
 * Intervention Criteria Interface
 * 
 * Defines criteria for identifying students who may need interventions
 */
export interface InterventionCriteria {
  attendanceThreshold: number; // Percentage below which interventions may be needed
  consecutiveAbsences: number; // Number of consecutive absences to trigger intervention
  periodRange: {
    startDate: Date;
    endDate: Date;
  };
  excludeExistingInterventions?: boolean; // Whether to exclude students with existing interventions
  gradeLevel?: number; // Optional grade level filter
}