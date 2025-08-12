/**
 * Teacher Role Enum
 * 
 * Represents the different roles a teacher can have in the AP Romoland system
 */
export enum TeacherRole {
  TEACHER = 'TEACHER',
  ASSISTANT_PRINCIPAL = 'ASSISTANT_PRINCIPAL',
  ADMINISTRATOR = 'ADMINISTRATOR'
}

/**
 * Teacher Entity
 * 
 * Represents a teacher, assistant principal, or administrator in the AP Romoland
 * attendance tracking system. Handles role-based permissions and teacher information.
 * 
 * @example
 * ```typescript
 * const teacher = new Teacher(
 *   'T12345',
 *   'Jane',
 *   'Smith',
 *   'jane.smith@romoland.k12.ca.us',
 *   'Mathematics',
 *   TeacherRole.TEACHER
 * );
 * ```
 */
export class Teacher {
  private readonly _employeeId: string;
  private readonly _firstName: string;
  private readonly _lastName: string;
  private _email: string;
  private _department: string;
  private _role: TeacherRole;
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  /**
   * Creates a new Teacher instance
   * 
   * @param employeeId - Unique employee identifier (format: T followed by digits)
   * @param firstName - Teacher's first name
   * @param lastName - Teacher's last name
   * @param email - Teacher's email address
   * @param department - Department the teacher belongs to
   * @param role - The teacher's role in the system
   * @param isActive - Whether the teacher is currently active (defaults to true)
   * @throws {Error} If any validation fails
   */
  constructor(
    employeeId: string,
    firstName: string,
    lastName: string,
    email: string,
    department: string,
    role: TeacherRole,
    isActive: boolean = true
  ) {
    this.validateEmployeeId(employeeId);
    this.validateFirstName(firstName);
    this.validateLastName(lastName);
    this.validateEmail(email);
    this.validateDepartment(department);

    this._employeeId = employeeId.trim();
    this._firstName = firstName.trim();
    this._lastName = lastName.trim();
    this._email = email.trim();
    this._department = department.trim();
    this._role = role;
    this._isActive = isActive;
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Gets the teacher's employee ID
   */
  get employeeId(): string {
    return this._employeeId;
  }

  /**
   * Gets the teacher's first name
   */
  get firstName(): string {
    return this._firstName;
  }

  /**
   * Gets the teacher's last name
   */
  get lastName(): string {
    return this._lastName;
  }

  /**
   * Gets the teacher's email address
   */
  get email(): string {
    return this._email;
  }

  /**
   * Gets the teacher's department
   */
  get department(): string {
    return this._department;
  }

  /**
   * Gets the teacher's role
   */
  get role(): TeacherRole {
    return this._role;
  }

  /**
   * Gets whether the teacher is currently active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Gets the date when the teacher record was created
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Gets the date when the teacher record was last updated
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Validates the employee ID format
   * 
   * @param employeeId - The employee ID to validate
   * @throws {Error} If validation fails
   */
  private validateEmployeeId(employeeId: string): void {
    if (!employeeId || typeof employeeId !== 'string' || employeeId.trim().length === 0) {
      throw new Error('Employee ID cannot be empty');
    }

    // Must start with T and have at least 4 digits
    const employeeIdRegex = /^T\d{4,}$/;
    if (!employeeIdRegex.test(employeeId.trim())) {
      throw new Error('Employee ID must start with T and contain at least 4 digits');
    }
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
   * Validates the department
   * 
   * @param department - The department to validate
   * @throws {Error} If validation fails
   */
  private validateDepartment(department: string): void {
    if (!department || typeof department !== 'string' || department.trim().length === 0) {
      throw new Error('Department cannot be empty');
    }
  }

  /**
   * Returns the teacher's full name
   * 
   * @returns Formatted full name (First Last)
   */
  getFullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }

  /**
   * Updates the teacher's email address
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
   * Updates the teacher's department
   * 
   * @param newDepartment - The new department
   * @throws {Error} If the department is empty
   */
  updateDepartment(newDepartment: string): void {
    this.validateDepartment(newDepartment);
    this._department = newDepartment.trim();
    this._updatedAt = new Date();
  }

  /**
   * Changes the teacher's role
   * 
   * @param newRole - The new role
   */
  changeRole(newRole: TeacherRole): void {
    this._role = newRole;
    this._updatedAt = new Date();
  }

  /**
   * Deactivates the teacher
   */
  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * Activates the teacher
   */
  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * Checks if the teacher can access attendance records
   * Only Assistant Principals and Administrators have this permission
   * 
   * @returns true if the teacher can access attendance records
   */
  canAccessAttendanceRecords(): boolean {
    return this._role === TeacherRole.ASSISTANT_PRINCIPAL || 
           this._role === TeacherRole.ADMINISTRATOR;
  }

  /**
   * Checks if the teacher can manage interventions
   * Only Assistant Principals and Administrators have this permission
   * 
   * @returns true if the teacher can manage interventions
   */
  canManageInterventions(): boolean {
    return this._role === TeacherRole.ASSISTANT_PRINCIPAL || 
           this._role === TeacherRole.ADMINISTRATOR;
  }

  /**
   * Compares this teacher with another teacher for equality based on employee ID
   * 
   * @param other - The other teacher to compare with
   * @returns true if both teachers have the same employee ID
   */
  equals(other: Teacher): boolean {
    if (!other || !(other instanceof Teacher)) {
      return false;
    }
    return this._employeeId === other._employeeId;
  }
}