import { Student } from '@/domain/entities/student';
import { StudentId } from '@/domain/value-objects/student-id';

/**
 * Student Repository Interface
 * 
 * Defines the contract for student data persistence in the AP Romoland system.
 * This interface follows Clean Architecture principles by separating the domain
 * logic from infrastructure concerns.
 * 
 * @example
 * ```typescript
 * class SupabaseStudentRepository implements StudentRepository {
 *   async findById(id: StudentId): Promise<Student | null> {
 *     // Implementation details...
 *   }
 * }
 * ```
 */
export interface StudentRepository {
  /**
   * Finds a student by their unique ID
   * 
   * @param id - The student ID to search for
   * @returns Promise resolving to the student or null if not found
   */
  findById(id: StudentId): Promise<Student | null>;

  /**
   * Finds all students with optional filtering
   * 
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of students
   */
  findAll(filters?: StudentFilters): Promise<Student[]>;

  /**
   * Finds students by grade level
   * 
   * @param gradeLevel - The grade level to filter by (6, 7, or 8)
   * @returns Promise resolving to an array of students
   */
  findByGradeLevel(gradeLevel: number): Promise<Student[]>;

  /**
   * Finds active students only
   * 
   * @returns Promise resolving to an array of active students
   */
  findActiveStudents(): Promise<Student[]>;

  /**
   * Searches students by name (first name or last name)
   * 
   * @param searchTerm - The search term to match against names
   * @returns Promise resolving to an array of matching students
   */
  searchByName(searchTerm: string): Promise<Student[]>;

  /**
   * Saves a student (create or update)
   * 
   * @param student - The student to save
   * @returns Promise resolving to the saved student
   */
  save(student: Student): Promise<Student>;

  /**
   * Creates a new student
   * 
   * @param student - The student to create
   * @returns Promise resolving to the created student
   */
  create(student: Student): Promise<Student>;

  /**
   * Updates an existing student
   * 
   * @param student - The student to update
   * @returns Promise resolving to the updated student
   * @throws Error if student is not found
   */
  update(student: Student): Promise<Student>;

  /**
   * Soft deletes a student (sets isActive to false)
   * 
   * @param id - The ID of the student to delete
   * @returns Promise resolving to true if successful
   */
  delete(id: StudentId): Promise<boolean>;

  /**
   * Permanently removes a student from the database
   * WARNING: This is irreversible and should be used with extreme caution
   * 
   * @param id - The ID of the student to permanently delete
   * @returns Promise resolving to true if successful
   */
  permanentlyDelete(id: StudentId): Promise<boolean>;

  /**
   * Checks if a student exists
   * 
   * @param id - The student ID to check
   * @returns Promise resolving to true if student exists
   */
  exists(id: StudentId): Promise<boolean>;

  /**
   * Gets the total count of students with optional filtering
   * 
   * @param filters - Optional filters to apply
   * @returns Promise resolving to the count
   */
  count(filters?: StudentFilters): Promise<number>;

  /**
   * Finds students with pagination support
   * 
   * @param offset - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param filters - Optional filters to apply
   * @returns Promise resolving to paginated student results
   */
  findWithPagination(
    offset: number, 
    limit: number, 
    filters?: StudentFilters
  ): Promise<PaginatedResult<Student>>;
}

/**
 * Student Filters Interface
 * 
 * Defines optional filters that can be applied when querying students
 */
export interface StudentFilters {
  gradeLevel?: number;
  isActive?: boolean;
  searchTerm?: string;
}

/**
 * Paginated Result Interface
 * 
 * Represents a paginated response from the repository
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}