import { AttendanceRecord, AttendanceStatus, PeriodAttendance } from '@/domain/entities/attendance-record'
import { AttendancePercentage } from '@/domain/value-objects/attendance-percentage'
import { StudentId } from '@/domain/value-objects/student-id'

describe('AttendanceRecord Entity', () => {
  const validStudentId = new StudentId('12345')
  const validDate = new Date('2025-01-15')
  const validSchoolYear = '2024-2025'

  const createValidPeriodAttendance = (): PeriodAttendance[] => [
    { period: 1, status: AttendanceStatus.PRESENT },
    { period: 2, status: AttendanceStatus.PRESENT },
    { period: 3, status: AttendanceStatus.ABSENT },
    { period: 4, status: AttendanceStatus.PRESENT },
    { period: 5, status: AttendanceStatus.TARDY },
    { period: 6, status: AttendanceStatus.PRESENT },
    { period: 7, status: AttendanceStatus.PRESENT }
  ]

  describe('constructor', () => {
    it('should create valid AttendanceRecord with all required fields', () => {
      const periodAttendance = createValidPeriodAttendance()
      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        periodAttendance
      )

      expect(record.studentId).toBe(validStudentId)
      expect(record.date).toEqual(validDate)
      expect(record.schoolYear).toBe(validSchoolYear)
      expect(record.periodAttendance).toEqual(periodAttendance)
      expect(record.createdAt).toBeInstanceOf(Date)
      expect(record.updatedAt).toBeInstanceOf(Date)
    })

    it('should throw error for empty school year', () => {
      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        '',
        createValidPeriodAttendance()
      )).toThrow('School year cannot be empty')
    })

    it('should throw error for invalid school year format', () => {
      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        '2025',
        createValidPeriodAttendance()
      )).toThrow('School year must be in format YYYY-YYYY')
    })

    it('should throw error for empty period attendance', () => {
      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        []
      )).toThrow('Period attendance cannot be empty')
    })

    it('should throw error for invalid number of periods', () => {
      const invalidPeriods = [
        { period: 1, status: AttendanceStatus.PRESENT },
        { period: 2, status: AttendanceStatus.PRESENT }
      ]
      
      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        invalidPeriods
      )).toThrow('Middle school must have exactly 7 periods')
    })

    it('should throw error for duplicate periods', () => {
      const duplicatePeriods = [
        { period: 1, status: AttendanceStatus.PRESENT },
        { period: 1, status: AttendanceStatus.ABSENT },
        { period: 3, status: AttendanceStatus.PRESENT },
        { period: 4, status: AttendanceStatus.PRESENT },
        { period: 5, status: AttendanceStatus.PRESENT },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ]

      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        duplicatePeriods
      )).toThrow('Duplicate periods are not allowed')
    })

    it('should throw error for invalid period numbers', () => {
      const invalidPeriods = [
        { period: 0, status: AttendanceStatus.PRESENT },
        { period: 2, status: AttendanceStatus.PRESENT },
        { period: 3, status: AttendanceStatus.PRESENT },
        { period: 4, status: AttendanceStatus.PRESENT },
        { period: 5, status: AttendanceStatus.PRESENT },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ]

      expect(() => new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        invalidPeriods
      )).toThrow('Period numbers must be between 1 and 7')
    })

    it('should accept valid middle school periods (1-7)', () => {
      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      expect(record.periodAttendance).toHaveLength(7)
      record.periodAttendance.forEach((period, index) => {
        expect(period.period).toBe(index + 1)
      })
    })
  })

  describe('calculateDailyAttendancePercentage', () => {
    it('should calculate 100% for perfect attendance', () => {
      const perfectAttendance = Array.from({ length: 7 }, (_, i) => ({
        period: i + 1,
        status: AttendanceStatus.PRESENT
      }))

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        perfectAttendance
      )

      const percentage = record.calculateDailyAttendancePercentage()
      expect(percentage.value).toBe(100)
    })

    it('should calculate 0% for all absences', () => {
      const allAbsent = Array.from({ length: 7 }, (_, i) => ({
        period: i + 1,
        status: AttendanceStatus.ABSENT
      }))

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        allAbsent
      )

      const percentage = record.calculateDailyAttendancePercentage()
      expect(percentage.value).toBe(0)
    })

    it('should calculate partial attendance percentage', () => {
      // 5 present, 2 absent = 5/7 ≈ 71.43%
      const partialAttendance = [
        { period: 1, status: AttendanceStatus.PRESENT },
        { period: 2, status: AttendanceStatus.PRESENT },
        { period: 3, status: AttendanceStatus.ABSENT },
        { period: 4, status: AttendanceStatus.PRESENT },
        { period: 5, status: AttendanceStatus.ABSENT },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ]

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        partialAttendance
      )

      const percentage = record.calculateDailyAttendancePercentage()
      expect(percentage.value).toBeCloseTo(71.43, 2)
    })

    it('should count TARDY as present', () => {
      // 6 present, 1 tardy = 7/7 = 100%
      const tardyAttendance = [
        { period: 1, status: AttendanceStatus.PRESENT },
        { period: 2, status: AttendanceStatus.PRESENT },
        { period: 3, status: AttendanceStatus.PRESENT },
        { period: 4, status: AttendanceStatus.PRESENT },
        { period: 5, status: AttendanceStatus.TARDY },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ]

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        tardyAttendance
      )

      const percentage = record.calculateDailyAttendancePercentage()
      expect(percentage.value).toBe(100)
    })
  })

  describe('getPresentPeriods', () => {
    it('should return periods where student was present', () => {
      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      const presentPeriods = record.getPresentPeriods()
      expect(presentPeriods).toEqual([1, 2, 4, 5, 6, 7]) // Period 5 is TARDY which counts as present
    })

    it('should include tardy periods as present', () => {
      const attendanceWithTardy = [
        { period: 1, status: AttendanceStatus.PRESENT },
        { period: 2, status: AttendanceStatus.TARDY },
        { period: 3, status: AttendanceStatus.ABSENT },
        { period: 4, status: AttendanceStatus.PRESENT },
        { period: 5, status: AttendanceStatus.TARDY },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ]

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        attendanceWithTardy
      )

      const presentPeriods = record.getPresentPeriods()
      expect(presentPeriods).toEqual([1, 2, 4, 5, 6, 7])
    })
  })

  describe('getAbsentPeriods', () => {
    it('should return periods where student was absent', () => {
      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      const absentPeriods = record.getAbsentPeriods()
      expect(absentPeriods).toEqual([3])
    })

    it('should not include tardy periods as absent', () => {
      const attendanceWithTardy = [
        { period: 1, status: AttendanceStatus.PRESENT },
        { period: 2, status: AttendanceStatus.TARDY },
        { period: 3, status: AttendanceStatus.ABSENT },
        { period: 4, status: AttendanceStatus.ABSENT },
        { period: 5, status: AttendanceStatus.TARDY },
        { period: 6, status: AttendanceStatus.PRESENT },
        { period: 7, status: AttendanceStatus.PRESENT }
      ]

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        attendanceWithTardy
      )

      const absentPeriods = record.getAbsentPeriods()
      expect(absentPeriods).toEqual([3, 4])
    })
  })

  describe('updatePeriodAttendance', () => {
    it('should update attendance for specific period', async () => {
      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      const originalUpdatedAt = record.updatedAt
      
      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 5))

      record.updatePeriodAttendance(3, AttendanceStatus.PRESENT)

      const period3 = record.periodAttendance.find(p => p.period === 3)
      expect(period3?.status).toBe(AttendanceStatus.PRESENT)
      expect(record.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error for invalid period number', () => {
      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      expect(() => record.updatePeriodAttendance(8, AttendanceStatus.PRESENT))
        .toThrow('Period number must be between 1 and 7')
    })
  })

  describe('isFullDayAbsent', () => {
    it('should return true when all periods are absent', () => {
      const allAbsent = Array.from({ length: 7 }, (_, i) => ({
        period: i + 1,
        status: AttendanceStatus.ABSENT
      }))

      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        allAbsent
      )

      expect(record.isFullDayAbsent()).toBe(true)
    })

    it('should return false when at least one period is present', () => {
      const record = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      expect(record.isFullDayAbsent()).toBe(false)
    })
  })

  describe('equals', () => {
    it('should return true for records with same student and date', () => {
      const attendance1 = createValidPeriodAttendance()
      const attendance2 = createValidPeriodAttendance()

      const record1 = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        attendance1
      )

      const record2 = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        attendance2
      )

      expect(record1.equals(record2)).toBe(true)
    })

    it('should return false for records with different students', () => {
      const record1 = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      const record2 = new AttendanceRecord(
        new StudentId('67890'),
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      expect(record1.equals(record2)).toBe(false)
    })

    it('should return false for records with different dates', () => {
      const record1 = new AttendanceRecord(
        validStudentId,
        validDate,
        validSchoolYear,
        createValidPeriodAttendance()
      )

      const record2 = new AttendanceRecord(
        validStudentId,
        new Date('2025-01-16'),
        validSchoolYear,
        createValidPeriodAttendance()
      )

      expect(record1.equals(record2)).toBe(false)
    })
  })
})

describe('AttendanceStatus Enum', () => {
  it('should have correct string values', () => {
    expect(AttendanceStatus.PRESENT).toBe('PRESENT')
    expect(AttendanceStatus.ABSENT).toBe('ABSENT')
    expect(AttendanceStatus.TARDY).toBe('TARDY')
  })
})