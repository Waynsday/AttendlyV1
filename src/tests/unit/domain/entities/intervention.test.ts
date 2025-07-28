import { Intervention, InterventionType, InterventionStatus } from '@/domain/entities/intervention'
import { StudentId } from '@/domain/value-objects/student-id'

describe('Intervention Entity', () => {
  const validStudentId = new StudentId('12345')
  const validInterventionType = InterventionType.PARENT_CONTACT
  const validDescription = 'Called parent regarding attendance concerns'
  const validCreatedBy = 'T12345'
  const validScheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow

  describe('constructor', () => {
    it('should create valid Intervention with all required fields', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      expect(intervention.studentId).toBe(validStudentId)
      expect(intervention.type).toBe(validInterventionType)
      expect(intervention.description).toBe(validDescription)
      expect(intervention.createdBy).toBe(validCreatedBy)
      expect(intervention.scheduledDate).toEqual(validScheduledDate)
      expect(intervention.status).toBe(InterventionStatus.SCHEDULED)
      expect(intervention.completedDate).toBeNull()
      expect(intervention.outcome).toBeNull()
      expect(intervention.createdAt).toBeInstanceOf(Date)
      expect(intervention.updatedAt).toBeInstanceOf(Date)
    })

    it('should throw error for empty description', () => {
      expect(() => new Intervention(
        validStudentId,
        validInterventionType,
        '',
        validCreatedBy,
        validScheduledDate
      )).toThrow('Description cannot be empty')
    })

    it('should throw error for whitespace-only description', () => {
      expect(() => new Intervention(
        validStudentId,
        validInterventionType,
        '   ',
        validCreatedBy,
        validScheduledDate
      )).toThrow('Description cannot be empty')
    })

    it('should throw error for empty createdBy', () => {
      expect(() => new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        '',
        validScheduledDate
      )).toThrow('CreatedBy cannot be empty')
    })

    it('should throw error for invalid createdBy format', () => {
      expect(() => new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        'invalid',
        validScheduledDate
      )).toThrow('CreatedBy must be a valid teacher employee ID')
    })

    it('should throw error for past scheduled date', () => {
      const pastDate = new Date('2020-01-01')
      
      expect(() => new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        pastDate
      )).toThrow('Scheduled date cannot be in the past')
    })
  })

  describe('markCompleted', () => {
    it('should mark intervention as completed with outcome', async () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      const outcome = 'Parent was contacted and is aware of attendance issue'
      const originalUpdatedAt = intervention.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      intervention.markCompleted(outcome)

      expect(intervention.status).toBe(InterventionStatus.COMPLETED)
      expect(intervention.outcome).toBe(outcome)
      expect(intervention.completedDate).toBeInstanceOf(Date)
      expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error when trying to complete already completed intervention', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      intervention.markCompleted('First completion')

      expect(() => intervention.markCompleted('Second completion'))
        .toThrow('Intervention is already completed')
    })

    it('should throw error for empty outcome', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      expect(() => intervention.markCompleted('')).toThrow('Outcome cannot be empty')
    })
  })

  describe('markCanceled', () => {
    it('should mark intervention as canceled with reason', async () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      const reason = 'Student attendance has improved'
      const originalUpdatedAt = intervention.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      intervention.markCanceled(reason)

      expect(intervention.status).toBe(InterventionStatus.CANCELED)
      expect(intervention.outcome).toBe(reason)
      expect(intervention.completedDate).toBeInstanceOf(Date)
      expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error when trying to cancel completed intervention', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      intervention.markCompleted('Already completed')

      expect(() => intervention.markCanceled('Cancel reason'))
        .toThrow('Cannot cancel a completed intervention')
    })

    it('should throw error for empty reason', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      expect(() => intervention.markCanceled('')).toThrow('Reason cannot be empty')
    })
  })

  describe('reschedule', () => {
    it('should reschedule intervention to new date', async () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      const newDate = new Date(Date.now() + 48 * 60 * 60 * 1000) // Day after tomorrow
      const originalUpdatedAt = intervention.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      intervention.reschedule(newDate)

      expect(intervention.scheduledDate).toEqual(newDate)
      expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error when trying to reschedule completed intervention', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      intervention.markCompleted('Already completed')
      const newDate = new Date(Date.now() + 48 * 60 * 60 * 1000) // Day after tomorrow

      expect(() => intervention.reschedule(newDate))
        .toThrow('Cannot reschedule a completed intervention')
    })

    it('should throw error when trying to reschedule canceled intervention', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      intervention.markCanceled('Canceled intervention')
      const newDate = new Date(Date.now() + 48 * 60 * 60 * 1000) // Day after tomorrow

      expect(() => intervention.reschedule(newDate))
        .toThrow('Cannot reschedule a canceled intervention')
    })

    it('should throw error for past reschedule date', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      const pastDate = new Date('2020-01-01')

      expect(() => intervention.reschedule(pastDate))
        .toThrow('Scheduled date cannot be in the past')
    })
  })

  describe('updateDescription', () => {
    it('should update description', async () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      const newDescription = 'Updated description with more details'
      const originalUpdatedAt = intervention.updatedAt

      await new Promise(resolve => setTimeout(resolve, 5))

      intervention.updateDescription(newDescription)

      expect(intervention.description).toBe(newDescription)
      expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })

    it('should throw error for empty description', () => {
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      expect(() => intervention.updateDescription('')).toThrow('Description cannot be empty')
    })
  })

  describe('isOverdue', () => {
    it('should return true for scheduled intervention past due date', () => {
      // Create intervention with future date first
      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      // Manually set the scheduled date to yesterday to simulate an overdue intervention
      // This simulates an intervention that was scheduled in the future but became overdue
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1) // Yesterday
      intervention['_scheduledDate'] = pastDate

      expect(intervention.isOverdue()).toBe(true)
    })

    it('should return false for scheduled intervention in the future', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1) // Tomorrow

      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        futureDate
      )

      expect(intervention.isOverdue()).toBe(false)
    })

    it('should return false for completed intervention', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1) // Yesterday

      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      intervention.markCompleted('Completed on time')

      expect(intervention.isOverdue()).toBe(false)
    })

    it('should return false for canceled intervention', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1) // Yesterday

      const intervention = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      intervention.markCanceled('No longer needed')

      expect(intervention.isOverdue()).toBe(false)
    })
  })

  describe('equals', () => {
    it('should return true for interventions with same student and creation timestamp', () => {
      const date1 = new Date('2025-02-01T10:00:00Z')
      const date2 = new Date('2025-02-01T10:00:00Z')

      // Mock the Date constructor to return specific timestamps
      const originalDate = Date
      global.Date = jest.fn(() => date1) as any
      global.Date.now = originalDate.now

      const intervention1 = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      const intervention2 = new Intervention(
        validStudentId,
        InterventionType.COUNSELOR_REFERRAL,
        'Different description',
        'T67890',
        new Date(Date.now() + 72 * 60 * 60 * 1000) // Three days from now
      )

      global.Date = originalDate

      expect(intervention1.equals(intervention2)).toBe(true)
    })

    it('should return false for interventions with different students', () => {
      const intervention1 = new Intervention(
        validStudentId,
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      const intervention2 = new Intervention(
        new StudentId('67890'),
        validInterventionType,
        validDescription,
        validCreatedBy,
        validScheduledDate
      )

      expect(intervention1.equals(intervention2)).toBe(false)
    })
  })
})

describe('InterventionType Enum', () => {
  it('should have correct string values', () => {
    expect(InterventionType.PARENT_CONTACT).toBe('PARENT_CONTACT')
    expect(InterventionType.COUNSELOR_REFERRAL).toBe('COUNSELOR_REFERRAL')
    expect(InterventionType.ATTENDANCE_CONTRACT).toBe('ATTENDANCE_CONTRACT')
    expect(InterventionType.SART_REFERRAL).toBe('SART_REFERRAL')
    expect(InterventionType.SARB_REFERRAL).toBe('SARB_REFERRAL')
    expect(InterventionType.OTHER).toBe('OTHER')
  })
})

describe('InterventionStatus Enum', () => {
  it('should have correct string values', () => {
    expect(InterventionStatus.SCHEDULED).toBe('SCHEDULED')
    expect(InterventionStatus.COMPLETED).toBe('COMPLETED')
    expect(InterventionStatus.CANCELED).toBe('CANCELED')
  })
})