import { Student } from '@/domain/entities/student'
import { StudentId } from '@/domain/value-objects/student-id'

describe('Student Entity', () => {
  const validStudentId = new StudentId('12345')
  const validFirstName = 'John'
  const validLastName = 'Doe'
  const validGradeLevel = 7
  const validEmail = 'john.doe@school.edu'

  describe('constructor', () => {
    it('should create a valid Student with all required fields', () => {
      const student = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )

      expect(student.id).toBe(validStudentId)
      expect(student.firstName).toBe(validFirstName)
      expect(student.lastName).toBe(validLastName)
      expect(student.gradeLevel).toBe(validGradeLevel)
      expect(student.email).toBe(validEmail)
      expect(student.isActive).toBe(true) // default value
      expect(student.createdAt).toBeInstanceOf(Date)
      expect(student.updatedAt).toBeInstanceOf(Date)
    })

    it('should create Student with optional isActive parameter set to false', () => {
      const student = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail,
        false
      )

      expect(student.isActive).toBe(false)
    })

    it('should throw error for empty first name', () => {
      expect(() => new Student(
        validStudentId,
        '',
        validLastName,
        validGradeLevel,
        validEmail
      )).toThrow('First name cannot be empty')
    })

    it('should throw error for whitespace-only first name', () => {
      expect(() => new Student(
        validStudentId,
        '   ',
        validLastName,
        validGradeLevel,
        validEmail
      )).toThrow('First name cannot be empty')
    })

    it('should throw error for empty last name', () => {
      expect(() => new Student(
        validStudentId,
        validFirstName,
        '',
        validGradeLevel,
        validEmail
      )).toThrow('Last name cannot be empty')
    })

    it('should throw error for invalid grade level below 6', () => {
      expect(() => new Student(
        validStudentId,
        validFirstName,
        validLastName,
        5,
        validEmail
      )).toThrow('Grade level must be between 6 and 8 for middle school')
    })

    it('should throw error for invalid grade level above 8', () => {
      expect(() => new Student(
        validStudentId,
        validFirstName,
        validLastName,
        9,
        validEmail
      )).toThrow('Grade level must be between 6 and 8 for middle school')
    })

    it('should throw error for invalid email format', () => {
      expect(() => new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        'invalid-email'
      )).toThrow('Invalid email format')
    })

    it('should accept valid middle school grade levels (6, 7, 8)', () => {
      const grades = [6, 7, 8]
      
      grades.forEach(grade => {
        const student = new Student(
          validStudentId,
          validFirstName,
          validLastName,
          grade,
          validEmail
        )
        expect(student.gradeLevel).toBe(grade)
      })
    })
  })

  describe('getFullName', () => {
    it('should return formatted full name', () => {
      const student = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )

      expect(student.getFullName()).toBe('John Doe')
    })

    it('should handle names with extra whitespace', () => {
      const student = new Student(
        validStudentId,
        '  John  ',
        '  Doe  ',
        validGradeLevel,
        validEmail
      )

      expect(student.getFullName()).toBe('John Doe')
    })
  })

  describe('updateEmail', () => {
    it('should update email with valid format', async () => {
      const student = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )
      
      const newEmail = 'john.doe.new@school.edu'
      const originalUpdatedAt = student.updatedAt
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 5))
      
      student.updateEmail(newEmail)
      
      expect(student.email).toBe(newEmail)
      expect(student.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error for invalid email format', () => {
      const student = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )

      expect(() => student.updateEmail('invalid-email')).toThrow('Invalid email format')
    })
  })

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      const student = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )
      
      const originalUpdatedAt = student.updatedAt
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 5))
      
      student.deactivate()
      
      expect(student.isActive).toBe(false)
      expect(student.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('activate', () => {
    it('should set isActive to true', async () => {
      const student = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail,
        false
      )
      
      const originalUpdatedAt = student.updatedAt
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 5))
      
      student.activate()
      
      expect(student.isActive).toBe(true)
      expect(student.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('equals', () => {
    it('should return true for students with same ID', () => {
      const student1 = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )
      
      const student2 = new Student(
        validStudentId,
        'Jane',
        'Smith',
        8,
        'jane.smith@school.edu'
      )

      expect(student1.equals(student2)).toBe(true)
    })

    it('should return false for students with different IDs', () => {
      const student1 = new Student(
        validStudentId,
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )
      
      const student2 = new Student(
        new StudentId('67890'),
        validFirstName,
        validLastName,
        validGradeLevel,
        validEmail
      )

      expect(student1.equals(student2)).toBe(false)
    })
  })
})