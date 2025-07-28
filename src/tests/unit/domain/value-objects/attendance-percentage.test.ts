import { AttendancePercentage } from '@/domain/value-objects/attendance-percentage'

describe('AttendancePercentage Value Object', () => {
  describe('constructor', () => {
    it('should create valid AttendancePercentage with 0%', () => {
      const percentage = new AttendancePercentage(0)
      
      expect(percentage.value).toBe(0)
    })

    it('should create valid AttendancePercentage with 100%', () => {
      const percentage = new AttendancePercentage(100)
      
      expect(percentage.value).toBe(100)
    })

    it('should create valid AttendancePercentage with decimal value', () => {
      const percentage = new AttendancePercentage(85.5)
      
      expect(percentage.value).toBe(85.5)
    })

    it('should throw error for negative percentage', () => {
      expect(() => new AttendancePercentage(-1)).toThrow('Attendance percentage must be between 0 and 100')
    })

    it('should throw error for percentage above 100', () => {
      expect(() => new AttendancePercentage(101)).toThrow('Attendance percentage must be between 0 and 100')
    })

    it('should throw error for NaN', () => {
      expect(() => new AttendancePercentage(NaN)).toThrow('Attendance percentage must be a valid number')
    })

    it('should throw error for null', () => {
      expect(() => new AttendancePercentage(null as any)).toThrow('Attendance percentage must be a valid number')
    })

    it('should throw error for undefined', () => {
      expect(() => new AttendancePercentage(undefined as any)).toThrow('Attendance percentage must be a valid number')
    })
  })

  describe('equals', () => {
    it('should return true for equal percentages', () => {
      const percentage1 = new AttendancePercentage(85.5)
      const percentage2 = new AttendancePercentage(85.5)
      
      expect(percentage1.equals(percentage2)).toBe(true)
    })

    it('should return false for different percentages', () => {
      const percentage1 = new AttendancePercentage(85.5)
      const percentage2 = new AttendancePercentage(90.0)
      
      expect(percentage1.equals(percentage2)).toBe(false)
    })

    it('should return false when comparing with null', () => {
      const percentage = new AttendancePercentage(85.5)
      
      expect(percentage.equals(null as any)).toBe(false)
    })
  })

  describe('toString', () => {
    it('should return formatted percentage string', () => {
      const percentage = new AttendancePercentage(85.5)
      
      expect(percentage.toString()).toBe('85.5%')
    })

    it('should format whole numbers without decimal', () => {
      const percentage = new AttendancePercentage(90)
      
      expect(percentage.toString()).toBe('90%')
    })
  })

  describe('isAboveThreshold', () => {
    it('should return true when above threshold', () => {
      const percentage = new AttendancePercentage(95)
      
      expect(percentage.isAboveThreshold(90)).toBe(true)
    })

    it('should return false when below threshold', () => {
      const percentage = new AttendancePercentage(85)
      
      expect(percentage.isAboveThreshold(90)).toBe(false)
    })

    it('should return true when equal to threshold', () => {
      const percentage = new AttendancePercentage(90)
      
      expect(percentage.isAboveThreshold(90)).toBe(true)
    })
  })

  describe('static fromFraction', () => {
    it('should create AttendancePercentage from fraction', () => {
      const percentage = AttendancePercentage.fromFraction(85, 100)
      
      expect(percentage.value).toBe(85)
    })

    it('should calculate percentage from periods attended', () => {
      const percentage = AttendancePercentage.fromFraction(6, 7) // 6 out of 7 periods
      
      expect(percentage.value).toBeCloseTo(85.71428571428571, 2)
    })

    it('should handle zero denominator', () => {
      expect(() => AttendancePercentage.fromFraction(5, 0)).toThrow('Denominator cannot be zero')
    })

    it('should handle negative numerator', () => {
      expect(() => AttendancePercentage.fromFraction(-1, 7)).toThrow('Numerator cannot be negative')
    })
  })

  describe('static constants', () => {
    it('should have PERFECT constant for 100%', () => {
      expect(AttendancePercentage.PERFECT.value).toBe(100)
    })

    it('should have ZERO constant for 0%', () => {
      expect(AttendancePercentage.ZERO.value).toBe(0)
    })
  })
})