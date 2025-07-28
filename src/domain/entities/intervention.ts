import { StudentId } from '@/domain/value-objects/student-id';

/**
 * Intervention Type Enum
 * 
 * Represents the different types of interventions available in the AP Romoland system
 */
export enum InterventionType {
  PARENT_CONTACT = 'PARENT_CONTACT',
  COUNSELOR_REFERRAL = 'COUNSELOR_REFERRAL',
  ATTENDANCE_CONTRACT = 'ATTENDANCE_CONTRACT',
  SART_REFERRAL = 'SART_REFERRAL', // Student Attendance Review Team
  SARB_REFERRAL = 'SARB_REFERRAL', // Student Attendance Review Board
  OTHER = 'OTHER'
}

/**
 * Intervention Status Enum
 * 
 * Represents the current status of an intervention
 */
export enum InterventionStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED'
}

/**
 * Intervention Entity
 * 
 * Represents an attendance intervention for a student in the AP Romoland system.
 * Interventions are actions taken to address attendance issues and improve student
 * attendance rates.
 * 
 * @example
 * ```typescript
 * const studentId = new StudentId('12345');
 * const intervention = new Intervention(
 *   studentId,
 *   InterventionType.PARENT_CONTACT,
 *   'Called parent regarding attendance concerns',
 *   'T12345',
 *   new Date('2025-02-01')
 * );
 * ```
 */
export class Intervention {
  private readonly _studentId: StudentId;
  private readonly _type: InterventionType;
  private _description: string;
  private readonly _createdBy: string;
  private _scheduledDate: Date;
  private _status: InterventionStatus;
  private _completedDate: Date | null;
  private _outcome: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  /**
   * Creates a new Intervention instance
   * 
   * @param studentId - The ID of the student this intervention is for
   * @param type - The type of intervention
   * @param description - Description of the intervention
   * @param createdBy - Employee ID of the person who created this intervention
   * @param scheduledDate - When the intervention is scheduled to occur
   * @throws {Error} If any validation fails
   */
  constructor(
    studentId: StudentId,
    type: InterventionType,
    description: string,
    createdBy: string,
    scheduledDate: Date
  ) {
    this.validateDescription(description);
    this.validateCreatedBy(createdBy);
    this.validateScheduledDate(scheduledDate);

    this._studentId = studentId;
    this._type = type;
    this._description = description.trim();
    this._createdBy = createdBy.trim();
    this._scheduledDate = new Date(scheduledDate);
    this._status = InterventionStatus.SCHEDULED;
    this._completedDate = null;
    this._outcome = null;
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Gets the student ID
   */
  get studentId(): StudentId {
    return this._studentId;
  }

  /**
   * Gets the intervention type
   */
  get type(): InterventionType {
    return this._type;
  }

  /**
   * Gets the intervention description
   */
  get description(): string {
    return this._description;
  }

  /**
   * Gets the employee ID who created this intervention
   */
  get createdBy(): string {
    return this._createdBy;
  }

  /**
   * Gets the scheduled date
   */
  get scheduledDate(): Date {
    return new Date(this._scheduledDate);
  }

  /**
   * Gets the intervention status
   */
  get status(): InterventionStatus {
    return this._status;
  }

  /**
   * Gets the completed date (null if not completed)
   */
  get completedDate(): Date | null {
    return this._completedDate ? new Date(this._completedDate) : null;
  }

  /**
   * Gets the outcome/result of the intervention (null if not completed)
   */
  get outcome(): string | null {
    return this._outcome;
  }

  /**
   * Gets the date when the intervention was created
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Gets the date when the intervention was last updated
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Validates the description
   * 
   * @param description - The description to validate
   * @throws {Error} If validation fails
   */
  private validateDescription(description: string): void {
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new Error('Description cannot be empty');
    }
  }

  /**
   * Validates the createdBy field (should be teacher employee ID)
   * 
   * @param createdBy - The createdBy value to validate
   * @throws {Error} If validation fails
   */
  private validateCreatedBy(createdBy: string): void {
    if (!createdBy || typeof createdBy !== 'string' || createdBy.trim().length === 0) {
      throw new Error('CreatedBy cannot be empty');
    }

    // Should be a valid teacher employee ID (T followed by digits)
    const employeeIdRegex = /^T\d{4,}$/;
    if (!employeeIdRegex.test(createdBy.trim())) {
      throw new Error('CreatedBy must be a valid teacher employee ID');
    }
  }

  /**
   * Validates the scheduled date
   * 
   * @param scheduledDate - The scheduled date to validate
   * @throws {Error} If validation fails
   */
  private validateScheduledDate(scheduledDate: Date): void {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set to start of today
    
    const scheduleDate = new Date(scheduledDate);
    scheduleDate.setHours(0, 0, 0, 0); // Set to start of scheduled day

    if (scheduleDate < now) {
      throw new Error('Scheduled date cannot be in the past');
    }
  }

  /**
   * Marks the intervention as completed with an outcome
   * 
   * @param outcome - The result/outcome of the intervention
   * @throws {Error} If the intervention is already completed or outcome is empty
   */
  markCompleted(outcome: string): void {
    if (this._status === InterventionStatus.COMPLETED) {
      throw new Error('Intervention is already completed');
    }

    if (!outcome || typeof outcome !== 'string' || outcome.trim().length === 0) {
      throw new Error('Outcome cannot be empty');
    }

    this._status = InterventionStatus.COMPLETED;
    this._outcome = outcome.trim();
    this._completedDate = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Marks the intervention as canceled with a reason
   * 
   * @param reason - The reason for cancellation
   * @throws {Error} If the intervention is already completed or reason is empty
   */
  markCanceled(reason: string): void {
    if (this._status === InterventionStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed intervention');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('Reason cannot be empty');
    }

    this._status = InterventionStatus.CANCELED;
    this._outcome = reason.trim();
    this._completedDate = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Reschedules the intervention to a new date
   * 
   * @param newDate - The new scheduled date
   * @throws {Error} If the intervention is completed/canceled or date is invalid
   */
  reschedule(newDate: Date): void {
    if (this._status === InterventionStatus.COMPLETED) {
      throw new Error('Cannot reschedule a completed intervention');
    }

    if (this._status === InterventionStatus.CANCELED) {
      throw new Error('Cannot reschedule a canceled intervention');
    }

    this.validateScheduledDate(newDate);

    this._scheduledDate = new Date(newDate);
    this._updatedAt = new Date();
  }

  /**
   * Updates the intervention description
   * 
   * @param newDescription - The new description
   * @throws {Error} If the description is empty
   */
  updateDescription(newDescription: string): void {
    this.validateDescription(newDescription);
    this._description = newDescription.trim();
    this._updatedAt = new Date();
  }

  /**
   * Checks if the intervention is overdue
   * An intervention is overdue if it's scheduled and the scheduled date has passed
   * 
   * @returns true if the intervention is overdue
   */
  isOverdue(): boolean {
    if (this._status !== InterventionStatus.SCHEDULED) {
      return false; // Completed or canceled interventions are not overdue
    }

    const now = new Date();
    now.setHours(23, 59, 59, 999); // Set to end of today
    
    return this._scheduledDate < now;
  }

  /**
   * Compares this intervention with another for equality
   * Interventions are considered equal if they have the same student ID and creation timestamp
   * 
   * @param other - The other intervention to compare with
   * @returns true if interventions are equal
   */
  equals(other: Intervention): boolean {
    if (!other || !(other instanceof Intervention)) {
      return false;
    }

    return this._studentId.equals(other._studentId) && 
           this._createdAt.getTime() === other._createdAt.getTime();
  }
}