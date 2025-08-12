import { StudentId } from '@/domain/value-objects/student-id'

describe('StudentId Value Object', () => {
  describe('constructor', () => {
    it('should create a valid StudentId with a valid string', () => {
      const validId = '12345'
      const studentId = new StudentId(validId)
      
      expect(studentId.value).toBe(validId)
    })

    it('should create a valid StudentId with a valid numeric string', () => {
      const validId = '123456789'
      const studentId = new StudentId(validId)
      
      expect(studentId.value).toBe(validId)
    })

    it('should throw error for empty string', () => {
      expect(() => new StudentId('')).toThrow('Student ID cannot be empty')
    })

    it('should throw error for whitespace-only string', () => {
      expect(() => new StudentId('   ')).toThrow('Student ID cannot be empty')
    })

    it('should throw error for null', () => {
      expect(() => new StudentId(null as any)).toThrow('Student ID cannot be empty')
    })

    it('should throw error for undefined', () => {
      expect(() => new StudentId(undefined as any)).toThrow('Student ID cannot be empty')
    })

    it('should throw error for non-alphanumeric characters', () => {
      expect(() => new StudentId('123-456')).toThrow('Student ID must contain only alphanumeric characters')
    })

    it('should throw error for special characters', () => {
      expect(() => new StudentId('123@456')).toThrow('Student ID must contain only alphanumeric characters')
    })
  })

  describe('equals', () => {
    it('should return true for equal StudentIds', () => {
      const id1 = new StudentId('12345')
      const id2 = new StudentId('12345')
      
      expect(id1.equals(id2)).toBe(true)
    })

    it('should return false for different StudentIds', () => {
      const id1 = new StudentId('12345')
      const id2 = new StudentId('67890')
      
      expect(id1.equals(id2)).toBe(false)
    })

    it('should return false when comparing with null', () => {
      const id1 = new StudentId('12345')
      
      expect(id1.equals(null as any)).toBe(false)
    })

    it('should return false when comparing with undefined', () => {
      const id1 = new StudentId('12345')
      
      expect(id1.equals(undefined as any)).toBe(false)
    })
  })

  describe('toString', () => {
    it('should return the string representation of the StudentId', () => {
      const id = '12345'
      const studentId = new StudentId(id)
      
      expect(studentId.toString()).toBe(id)
    })
  })

  describe('static fromString', () => {
    it('should create StudentId from valid string', () => {
      const id = '12345'
      const studentId = StudentId.fromString(id)
      
      expect(studentId.value).toBe(id)
    })

    it('should throw error for invalid string', () => {
      expect(() => StudentId.fromString('')).toThrow('Student ID cannot be empty')
    })
  })
})