/**
 * AttendancePercentage Value Object
 * 
 * Represents an attendance percentage in the AP Romoland attendance system.
 * Ensures that percentages are valid (0-100) and provides utility methods
 * for attendance calculations.
 * 
 * @example
 * ```typescript
 * const percentage = new AttendancePercentage(85.5);
 * console.log(percentage.toString()); // '85.5%'
 * 
 * const fromFraction = AttendancePercentage.fromFraction(6, 7); // 6 out of 7 periods
 * console.log(fromFraction.value); // 85.71428571428571
 * ```
 */
export class AttendancePercentage {
  private readonly _value: number;

  /**
   * Static constant for perfect attendance (100%)
   */
  static readonly PERFECT = new AttendancePercentage(100);

  /**
   * Static constant for zero attendance (0%)
   */
  static readonly ZERO = new AttendancePercentage(0);

  /**
   * Creates a new AttendancePercentage instance
   * 
   * @param value - The percentage value (0-100)
   * @throws {Error} If the percentage is invalid
   */
  constructor(value: number) {
    this.validatePercentage(value);
    this._value = value;
  }

  /**
   * Gets the numeric value of the percentage
   */
  get value(): number {
    return this._value;
  }

  /**
   * Validates the percentage value
   * 
   * @param value - The value to validate
   * @throws {Error} If validation fails
   */
  private validatePercentage(value: number): void {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Attendance percentage must be a valid number');
    }

    if (value < 0 || value > 100) {
      throw new Error('Attendance percentage must be between 0 and 100');
    }
  }

  /**
   * Compares this AttendancePercentage with another for equality
   * 
   * @param other - The other AttendancePercentage to compare with
   * @returns true if both percentages have the same value
   */
  equals(other: AttendancePercentage | null | undefined): boolean {
    if (!other || !(other instanceof AttendancePercentage)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Returns the formatted string representation of the percentage
   * 
   * @returns The percentage value formatted with % symbol
   */
  toString(): string {
    // Format to remove unnecessary decimals for whole numbers
    const formattedValue = this._value % 1 === 0 
      ? this._value.toString() 
      : this._value.toString();
    
    return `${formattedValue}%`;
  }

  /**
   * Checks if this percentage is above or equal to a given threshold
   * 
   * @param threshold - The threshold percentage to compare against
   * @returns true if this percentage is >= threshold
   */
  isAboveThreshold(threshold: number): boolean {
    return this._value >= threshold;
  }

  /**
   * Creates an AttendancePercentage from a fraction
   * 
   * @param numerator - The number of periods attended
   * @param denominator - The total number of periods
   * @returns A new AttendancePercentage instance
   * @throws {Error} If the fraction is invalid
   */
  static fromFraction(numerator: number, denominator: number): AttendancePercentage {
    if (denominator === 0) {
      throw new Error('Denominator cannot be zero');
    }

    if (numerator < 0) {
      throw new Error('Numerator cannot be negative');
    }

    const percentage = (numerator / denominator) * 100;
    return new AttendancePercentage(percentage);
  }
}