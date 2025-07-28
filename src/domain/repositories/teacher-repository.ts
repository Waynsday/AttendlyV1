import { Teacher, TeacherRole } from '@/domain/entities/teacher';

/**
 * Teacher Repository Interface
 * 
 * Defines the contract for teacher data persistence in the AP Romoland system.
 * Handles different teacher roles including regular teachers, assistant principals,
 * and administrators with appropriate access controls.
 * 
 * @example
 * ```typescript
 * class SupabaseTeacherRepository implements TeacherRepository {
 *   async findByEmployeeId(employeeId: string): Promise<Teacher | null> {
 *     // Implementation details...
 *   }
 * }
 * ```
 */
export interface TeacherRepository {
  /**
   * Finds a teacher by their employee ID
   * 
   * @param employeeId - The employee ID to search for
   * @returns Promise resolving to the teacher or null if not found
   */
  findByEmployeeId(employeeId: string): Promise<Teacher | null>;

  /**
   * Finds all teachers with optional filtering
   * 
   * @param filters - Optional filters to apply
   * @returns Promise resolving to an array of teachers
   */
  findAll(filters?: TeacherFilters): Promise<Teacher[]>;

  /**
   * Finds teachers by role
   * 
   * @param role - The teacher role to filter by
   * @returns Promise resolving to an array of teachers with the specified role
   */
  findByRole(role: TeacherRole): Promise<Teacher[]>;

  /**
   * Finds teachers by department
   * 
   * @param department - The department to filter by
   * @returns Promise resolving to an array of teachers in the department
   */
  findByDepartment(department: string): Promise<Teacher[]>;

  /**
   * Finds active teachers only
   * 
   * @returns Promise resolving to an array of active teachers
   */
  findActiveTeachers(): Promise<Teacher[]>;

  /**
   * Finds teachers with attendance management permissions
   * (Assistant Principals and Administrators)
   * 
   * @returns Promise resolving to an array of teachers with attendance permissions
   */
  findAttendanceManagers(): Promise<Teacher[]>;

  /**
   * Finds teachers with intervention management permissions
   * (Assistant Principals and Administrators)
   * 
   * @returns Promise resolving to an array of teachers with intervention permissions
   */
  findInterventionManagers(): Promise<Teacher[]>;

  /**
   * Searches teachers by name (first name or last name)
   * 
   * @param searchTerm - The search term to match against names
   * @returns Promise resolving to an array of matching teachers
   */
  searchByName(searchTerm: string): Promise<Teacher[]>;

  /**
   * Finds a teacher by email address
   * 
   * @param email - The email address to search for
   * @returns Promise resolving to the teacher or null if not found
   */
  findByEmail(email: string): Promise<Teacher | null>;

  /**
   * Saves a teacher (create or update)
   * 
   * @param teacher - The teacher to save
   * @returns Promise resolving to the saved teacher
   */
  save(teacher: Teacher): Promise<Teacher>;

  /**
   * Creates a new teacher
   * 
   * @param teacher - The teacher to create
   * @returns Promise resolving to the created teacher
   */
  create(teacher: Teacher): Promise<Teacher>;

  /**
   * Updates an existing teacher
   * 
   * @param teacher - The teacher to update
   * @returns Promise resolving to the updated teacher
   * @throws Error if teacher is not found
   */
  update(teacher: Teacher): Promise<Teacher>;

  /**
   * Soft deletes a teacher (sets isActive to false)
   * 
   * @param employeeId - The employee ID of the teacher to delete
   * @returns Promise resolving to true if successful
   */
  delete(employeeId: string): Promise<boolean>;

  /**
   * Permanently removes a teacher from the database
   * WARNING: This is irreversible and should be used with extreme caution
   * 
   * @param employeeId - The employee ID of the teacher to permanently delete
   * @returns Promise resolving to true if successful
   */
  permanentlyDelete(employeeId: string): Promise<boolean>;

  /**
   * Checks if a teacher exists
   * 
   * @param employeeId - The employee ID to check
   * @returns Promise resolving to true if teacher exists
   */
  exists(employeeId: string): Promise<boolean>;

  /**
   * Gets the total count of teachers with optional filtering
   * 
   * @param filters - Optional filters to apply
   * @returns Promise resolving to the count
   */
  count(filters?: TeacherFilters): Promise<number>;

  /**
   * Finds teachers with pagination support
   * 
   * @param offset - Number of records to skip
   * @param limit - Maximum number of records to return
   * @param filters - Optional filters to apply
   * @returns Promise resolving to paginated teacher results
   */
  findWithPagination(
    offset: number,
    limit: number,
    filters?: TeacherFilters
  ): Promise<PaginatedTeacherResult>;

  /**
   * Gets all unique departments
   * 
   * @returns Promise resolving to an array of department names
   */
  getAllDepartments(): Promise<string[]>;

  /**
   * Validates teacher permissions for a specific action
   * 
   * @param employeeId - The employee ID to check
   * @param permission - The permission to validate
   * @returns Promise resolving to true if teacher has permission
   */
  hasPermission(employeeId: string, permission: TeacherPermission): Promise<boolean>;
}

/**
 * Teacher Filters Interface
 * 
 * Defines optional filters that can be applied when querying teachers
 */
export interface TeacherFilters {
  role?: TeacherRole;
  department?: string;
  isActive?: boolean;
  searchTerm?: string;
  hasAttendancePermissions?: boolean;
  hasInterventionPermissions?: boolean;
}

/**
 * Paginated Teacher Result Interface
 * 
 * Represents a paginated response from the teacher repository
 */
export interface PaginatedTeacherResult {
  data: Teacher[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  departments: string[];
}

/**
 * Teacher Permission Enum
 * 
 * Defines the different permissions that can be checked for teachers
 */
export enum TeacherPermission {
  VIEW_ATTENDANCE = 'VIEW_ATTENDANCE',
  MANAGE_ATTENDANCE = 'MANAGE_ATTENDANCE',
  VIEW_INTERVENTIONS = 'VIEW_INTERVENTIONS',
  MANAGE_INTERVENTIONS = 'MANAGE_INTERVENTIONS',
  GENERATE_REPORTS = 'GENERATE_REPORTS',
  MANAGE_STUDENTS = 'MANAGE_STUDENTS',
  MANAGE_TEACHERS = 'MANAGE_TEACHERS',
  SYSTEM_ADMINISTRATION = 'SYSTEM_ADMINISTRATION'
}