/**
 * StudentId Value Object
 * 
 * Represents a unique identifier for a student in the attendance system.
 * Ensures that student IDs are valid and properly formatted.
 * 
 * @example
 * ```typescript
 * const studentId = new StudentId('12345');
 * console.log(studentId.value); // '12345'
 * ```
 */
export class StudentId {
  private readonly _value: string;

  /**
   * Creates a new StudentId instance
   * 
   * @param value - The student ID value
   * @throws {Error} If the student ID is empty or contains invalid characters
   */
  constructor(value: string) {
    this.validateStudentId(value);
    this._value = value.trim();
  }

  /**
   * Gets the string value of the StudentId
   */
  get value(): string {
    return this._value;
  }

  /**
   * Validates the student ID format
   * 
   * @param value - The value to validate
   * @throws {Error} If validation fails
   */
  private validateStudentId(value: string): void {
    if (!value || typeof value !== 'string') {
      throw new Error('Student ID cannot be empty');
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      throw new Error('Student ID cannot be empty');
    }

    // Check for alphanumeric characters only
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumericRegex.test(trimmedValue)) {
      throw new Error('Student ID must contain only alphanumeric characters');
    }
  }

  /**
   * Compares this StudentId with another StudentId for equality
   * 
   * @param other - The other StudentId to compare with
   * @returns true if both StudentIds have the same value
   */
  equals(other: StudentId | null | undefined): boolean {
    if (!other || !(other instanceof StudentId)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Returns the string representation of the StudentId
   * 
   * @returns The student ID value as a string
   */
  toString(): string {
    return this._value;
  }

  /**
   * Creates a StudentId from a string value
   * 
   * @param value - The string value to create a StudentId from
   * @returns A new StudentId instance
   * @throws {Error} If the value is invalid
   */
  static fromString(value: string): StudentId {
    return new StudentId(value);
  }
}