import { StudentId } from '@/domain/value-objects/student-id';

/**
 * Student Entity
 * 
 * Represents a student in the AP Romoland attendance tracking system.
 * Handles middle school students (grades 6-8) with period-based attendance.
 * 
 * @example
 * ```typescript
 * const studentId = new StudentId('12345');
 * const student = new Student(
 *   studentId,
 *   'John',
 *   'Doe',
 *   7,
 *   'john.doe@school.edu'
 * );
 * ```
 */
export class Student {
  private readonly _id: StudentId;
  private readonly _firstName: string;
  private readonly _lastName: string;
  private readonly _gradeLevel: number;
  private _email: string;
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  /**
   * Creates a new Student instance
   * 
   * @param id - Unique student identifier
   * @param firstName - Student's first name
   * @param lastName - Student's last name
   * @param gradeLevel - Grade level (6-8 for middle school)
   * @param email - Student's email address
   * @param isActive - Whether the student is currently active (defaults to true)
   * @throws {Error} If any validation fails
   */
  constructor(
    id: StudentId,
    firstName: string,
    lastName: string,
    gradeLevel: number,
    email: string,
    isActive: boolean = true
  ) {
    this.validateFirstName(firstName);
    this.validateLastName(lastName);
    this.validateGradeLevel(gradeLevel);
    this.validateEmail(email);

    this._id = id;
    this._firstName = firstName.trim();
    this._lastName = lastName.trim();
    this._gradeLevel = gradeLevel;
    this._email = email.trim();
    this._isActive = isActive;
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Gets the student's unique identifier
   */
  get id(): StudentId {
    return this._id;
  }

  /**
   * Gets the student's first name
   */
  get firstName(): string {
    return this._firstName;
  }

  /**
   * Gets the student's last name
   */
  get lastName(): string {
    return this._lastName;
  }

  /**
   * Gets the student's grade level
   */
  get gradeLevel(): number {
    return this._gradeLevel;
  }

  /**
   * Gets the student's email address
   */
  get email(): string {
    return this._email;
  }

  /**
   * Gets whether the student is currently active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Gets the date when the student record was created
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Gets the date when the student record was last updated
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Validates the first name
   * 
   * @param firstName - The first name to validate
   * @throws {Error} If validation fails
   */
  private validateFirstName(firstName: string): void {
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      throw new Error('First name cannot be empty');
    }
  }

  /**
   * Validates the last name
   * 
   * @param lastName - The last name to validate
   * @throws {Error} If validation fails
   */
  private validateLastName(lastName: string): void {
    if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
      throw new Error('Last name cannot be empty');
    }
  }

  /**
   * Validates the grade level for middle school (6-8)
   * 
   * @param gradeLevel - The grade level to validate
   * @throws {Error} If validation fails
   */
  private validateGradeLevel(gradeLevel: number): void {
    if (typeof gradeLevel !== 'number' || gradeLevel < 6 || gradeLevel > 8) {
      throw new Error('Grade level must be between 6 and 8 for middle school');
    }
  }

  /**
   * Validates email format
   * 
   * @param email - The email to validate
   * @throws {Error} If validation fails
   */
  private validateEmail(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email format');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Returns the student's full name
   * 
   * @returns Formatted full name (First Last)
   */
  getFullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }

  /**
   * Updates the student's email address
   * 
   * @param newEmail - The new email address
   * @throws {Error} If the email format is invalid
   */
  updateEmail(newEmail: string): void {
    this.validateEmail(newEmail);
    this._email = newEmail.trim();
    this._updatedAt = new Date();
  }

  /**
   * Deactivates the student
   */
  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * Activates the student
   */
  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * Compares this student with another student for equality based on ID
   * 
   * @param other - The other student to compare with
   * @returns true if both students have the same ID
   */
  equals(other: Student): boolean {
    if (!other || !(other instanceof Student)) {
      return false;
    }
    return this._id.equals(other._id);
  }
}