import { Teacher, TeacherRole } from '@/domain/entities/teacher'
import { StudentId } from '@/domain/value-objects/student-id'

describe('Teacher Entity', () => {
  const validEmployeeId = 'T12345'
  const validFirstName = 'Jane'
  const validLastName = 'Smith'
  const validEmail = 'jane.smith@romoland.k12.ca.us'
  const validDepartment = 'Mathematics'

  describe('constructor', () => {
    it('should create valid Teacher with all required fields', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(teacher.employeeId).toBe(validEmployeeId)
      expect(teacher.firstName).toBe(validFirstName)
      expect(teacher.lastName).toBe(validLastName)
      expect(teacher.email).toBe(validEmail)
      expect(teacher.department).toBe(validDepartment)
      expect(teacher.role).toBe(TeacherRole.TEACHER)
      expect(teacher.isActive).toBe(true)
      expect(teacher.createdAt).toBeInstanceOf(Date)
      expect(teacher.updatedAt).toBeInstanceOf(Date)
    })

    it('should create Teacher with Assistant Principal role', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        'Administration',
        TeacherRole.ASSISTANT_PRINCIPAL
      )

      expect(teacher.role).toBe(TeacherRole.ASSISTANT_PRINCIPAL)
    })

    it('should create Teacher with Administrator role', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        'Administration',
        TeacherRole.ADMINISTRATOR
      )

      expect(teacher.role).toBe(TeacherRole.ADMINISTRATOR)
    })

    it('should throw error for empty employee ID', () => {
      expect(() => new Teacher(
        '',
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )).toThrow('Employee ID cannot be empty')
    })

    it('should throw error for invalid employee ID format', () => {
      expect(() => new Teacher(
        '123',
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )).toThrow('Employee ID must start with T and contain at least 4 digits')
    })

    it('should throw error for empty first name', () => {
      expect(() => new Teacher(
        validEmployeeId,
        '',
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )).toThrow('First name cannot be empty')
    })

    it('should throw error for empty last name', () => {
      expect(() => new Teacher(
        validEmployeeId,
        validFirstName,
        '',
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )).toThrow('Last name cannot be empty')
    })

    it('should throw error for invalid email format', () => {
      expect(() => new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        'invalid-email',
        validDepartment,
        TeacherRole.TEACHER
      )).toThrow('Invalid email format')
    })

    it('should throw error for empty department', () => {
      expect(() => new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        '',
        TeacherRole.TEACHER
      )).toThrow('Department cannot be empty')
    })
  })

  describe('getFullName', () => {
    it('should return formatted full name', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(teacher.getFullName()).toBe('Jane Smith')
    })

    it('should handle names with extra whitespace', () => {
      const teacher = new Teacher(
        validEmployeeId,
        '  Jane  ',
        '  Smith  ',
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(teacher.getFullName()).toBe('Jane Smith')
    })
  })

  describe('updateEmail', () => {
    it('should update email with valid format', async () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      const newEmail = 'jane.smith.new@romoland.k12.ca.us'
      const originalUpdatedAt = teacher.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      teacher.updateEmail(newEmail)

      expect(teacher.email).toBe(newEmail)
      expect(teacher.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error for invalid email format', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(() => teacher.updateEmail('invalid-email')).toThrow('Invalid email format')
    })
  })

  describe('updateDepartment', () => {
    it('should update department', async () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      const newDepartment = 'Science'
      const originalUpdatedAt = teacher.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      teacher.updateDepartment(newDepartment)

      expect(teacher.department).toBe(newDepartment)
      expect(teacher.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error for empty department', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(() => teacher.updateDepartment('')).toThrow('Department cannot be empty')
    })
  })

  describe('changeRole', () => {
    it('should change teacher role', async () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      const originalUpdatedAt = teacher.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      teacher.changeRole(TeacherRole.ASSISTANT_PRINCIPAL)

      expect(teacher.role).toBe(TeacherRole.ASSISTANT_PRINCIPAL)
      expect(teacher.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      const originalUpdatedAt = teacher.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      teacher.deactivate()

      expect(teacher.isActive).toBe(false)
      expect(teacher.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('activate', () => {
    it('should set isActive to true', async () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER,
        false
      )

      const originalUpdatedAt = teacher.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      teacher.activate()

      expect(teacher.isActive).toBe(true)
      expect(teacher.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('canAccessAttendanceRecords', () => {
    it('should return true for Assistant Principal', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        'Administration',
        TeacherRole.ASSISTANT_PRINCIPAL
      )

      expect(teacher.canAccessAttendanceRecords()).toBe(true)
    })

    it('should return true for Administrator', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        'Administration',
        TeacherRole.ADMINISTRATOR
      )

      expect(teacher.canAccessAttendanceRecords()).toBe(true)
    })

    it('should return false for regular Teacher', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(teacher.canAccessAttendanceRecords()).toBe(false)
    })
  })

  describe('canManageInterventions', () => {
    it('should return true for Assistant Principal', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        'Administration',
        TeacherRole.ASSISTANT_PRINCIPAL
      )

      expect(teacher.canManageInterventions()).toBe(true)
    })

    it('should return true for Administrator', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        'Administration',
        TeacherRole.ADMINISTRATOR
      )

      expect(teacher.canManageInterventions()).toBe(true)
    })

    it('should return false for regular Teacher', () => {
      const teacher = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(teacher.canManageInterventions()).toBe(false)
    })
  })

  describe('equals', () => {
    it('should return true for teachers with same employee ID', () => {
      const teacher1 = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      const teacher2 = new Teacher(
        validEmployeeId,
        'Different',
        'Name',
        'different@email.com',
        'Different Department',
        TeacherRole.ADMINISTRATOR
      )

      expect(teacher1.equals(teacher2)).toBe(true)
    })

    it('should return false for teachers with different employee IDs', () => {
      const teacher1 = new Teacher(
        validEmployeeId,
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      const teacher2 = new Teacher(
        'T67890',
        validFirstName,
        validLastName,
        validEmail,
        validDepartment,
        TeacherRole.TEACHER
      )

      expect(teacher1.equals(teacher2)).toBe(false)
    })
  })
})

describe('TeacherRole Enum', () => {
  it('should have correct string values', () => {
    expect(TeacherRole.TEACHER).toBe('TEACHER')
    expect(TeacherRole.ASSISTANT_PRINCIPAL).toBe('ASSISTANT_PRINCIPAL')
    expect(TeacherRole.ADMINISTRATOR).toBe('ADMINISTRATOR')
  })
})