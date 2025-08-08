import * as fc from 'fast-check';
import { Intervention, InterventionType, InterventionStatus } from '@/domain/entities/intervention';
import { StudentId } from '@/domain/value-objects/student-id';
import { TestDataFactory } from '@/tests/fixtures/test-data-factory';

/**
 * Comprehensive Intervention Entity Tests
 * 
 * Tests all edge cases and scenarios for attendance interventions
 * specific to California school attendance requirements and Romoland processes:
 * - SART (Student Attendance Review Team) processes
 * - SARB (Student Attendance Review Board) compliance
 * - Teacher employee ID validation
 * - Intervention workflow state management
 * - Date validation and scheduling constraints
 * - California Education Code requirements
 */

describe('Intervention Entity - Comprehensive Tests', () => {
  const validStudentId = new StudentId('123456');
  const validType = InterventionType.PARENT_CONTACT;
  const validDescription = 'Parent contact regarding attendance concerns';
  const validCreatedBy = 'T1234';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  describe('California Attendance Law Compliance', () => {
    describe('Intervention Type Hierarchy', () => {
      it('should support all required intervention types per CA Education Code', () => {
        const requiredTypes = [
          InterventionType.PARENT_CONTACT,
          InterventionType.COUNSELOR_REFERRAL,
          InterventionType.ATTENDANCE_CONTRACT,
          InterventionType.SART_REFERRAL,
          InterventionType.SARB_REFERRAL,
          InterventionType.OTHER
        ];

        requiredTypes.forEach(type => {
          const intervention = new Intervention(
            validStudentId,
            type,
            `Test intervention for ${type}`,
            validCreatedBy,
            tomorrow
          );

          expect(intervention.type).toBe(type);
        });
      });

      it('should validate SART referral intervention creation', () => {
        const sartIntervention = new Intervention(
          validStudentId,
          InterventionType.SART_REFERRAL,
          'SART referral for team-based intervention planning after multiple parent contacts',
          'T5678',
          tomorrow
        );

        expect(sartIntervention.type).toBe(InterventionType.SART_REFERRAL);
        expect(sartIntervention.status).toBe(InterventionStatus.SCHEDULED);
      });

      it('should validate SARB referral intervention creation', () => {
        const sarbIntervention = new Intervention(
          validStudentId,
          InterventionType.SARB_REFERRAL,
          'SARB referral due to continued attendance issues after SART interventions',
          'T9999',
          tomorrow
        );

        expect(sarbIntervention.type).toBe(InterventionType.SARB_REFERRAL);
        expect(sarbIntervention.status).toBe(InterventionStatus.SCHEDULED);
      });
    });

    describe('Progressive Intervention Process', () => {
      it('should track intervention escalation from parent contact to SARB', () => {
        const student = validStudentId;
        const baseDate = new Date();
        
        // Level 1: Parent Contact
        const parentContact = new Intervention(
          student,
          InterventionType.PARENT_CONTACT,
          'Initial parent contact regarding attendance patterns',
          'T1001',
          new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000) // Tomorrow
        );

        // Level 2: Counselor Referral
        const counselorReferral = new Intervention(
          student,
          InterventionType.COUNSELOR_REFERRAL,
          'Counselor referral after continued absences post parent contact',
          'T1001',
          new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000) // 1 week later
        );

        // Level 3: SART Referral
        const sartReferral = new Intervention(
          student,
          InterventionType.SART_REFERRAL,
          'SART referral for comprehensive team review',
          'T1001',
          new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000) // 2 weeks later
        );

        // Level 4: SARB Referral
        const sarbReferral = new Intervention(
          student,
          InterventionType.SARB_REFERRAL,
          'SARB referral after unsuccessful SART interventions',
          'T1001',
          new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 1 month later
        );

        // All should be for the same student
        expect(parentContact.studentId.equals(student)).toBe(true);
        expect(counselorReferral.studentId.equals(student)).toBe(true);
        expect(sartReferral.studentId.equals(student)).toBe(true);
        expect(sarbReferral.studentId.equals(student)).toBe(true);

        // Should escalate in complexity
        expect(parentContact.type).toBe(InterventionType.PARENT_CONTACT);
        expect(counselorReferral.type).toBe(InterventionType.COUNSELOR_REFERRAL);
        expect(sartReferral.type).toBe(InterventionType.SART_REFERRAL);
        expect(sarbReferral.type).toBe(InterventionType.SARB_REFERRAL);
      });
    });
  });

  describe('Teacher Employee ID Validation', () => {
    it('should accept valid teacher employee IDs', () => {
      const validTeacherIds = [
        'T1234',
        'T5678',
        'T9999',
        'T12345',
        'T999999'
      ];

      validTeacherIds.forEach(teacherId => {
        const intervention = new Intervention(
          validStudentId,
          validType,
          validDescription,
          teacherId,
          tomorrow
        );

        expect(intervention.createdBy).toBe(teacherId);
      });
    });

    it('should reject invalid teacher employee ID formats', () => {
      const invalidTeacherIds = [
        'T123',      // Too short
        'T',         // No number
        '1234',      // No T prefix
        'Teacher1234', // Wrong format
        'T12AB',     // Contains letters
        'S1234',     // Wrong prefix (S for staff?)
        't1234',     // Lowercase
        'T-1234',    // Hyphen
        'T 1234',    // Space
        '',          // Empty
        '  T1234  '  // Whitespace (should be trimmed but still valid)
      ];

      invalidTeacherIds.forEach(teacherId => {
        expect(() => new Intervention(
          validStudentId,
          validType,
          validDescription,
          teacherId,
          tomorrow
        )).toThrow('CreatedBy must be a valid teacher employee ID');
      });
    });

    it('should handle teacher ID with whitespace correctly', () => {
      // This should be valid after trimming
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        '  T1234  ',
        tomorrow
      );

      expect(intervention.createdBy).toBe('T1234');
    });
  });

  describe('Scheduling and Date Validation', () => {
    it('should reject past scheduled dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      expect(() => new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        yesterday
      )).toThrow('Scheduled date cannot be in the past');
    });

    it('should accept today as scheduled date', () => {
      const today = new Date();
      
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        today
      );

      expect(intervention.scheduledDate.toDateString()).toBe(today.toDateString());
    });

    it('should accept future dates', () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        nextWeek
      );

      expect(intervention.scheduledDate.getTime()).toBeGreaterThanOrEqual(nextWeek.getTime());
    });

    it('should handle edge case of exactly midnight today', () => {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      
      // Should be valid since it's today
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        todayMidnight
      );

      expect(intervention.scheduledDate.toDateString()).toBe(todayMidnight.toDateString());
    });
  });

  describe('Intervention Status Management', () => {
    let intervention: Intervention;

    beforeEach(() => {
      intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
    });

    describe('Completion Workflow', () => {
      it('should mark intervention as completed with outcome', async () => {
        const outcome = 'Parent meeting held, attendance plan established';
        const originalUpdatedAt = intervention.updatedAt;
        
        // Wait to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 5));
        
        intervention.markCompleted(outcome);
        
        expect(intervention.status).toBe(InterventionStatus.COMPLETED);
        expect(intervention.outcome).toBe(outcome);
        expect(intervention.completedDate).toBeInstanceOf(Date);
        expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      });

      it('should reject empty outcome when completing', () => {
        expect(() => intervention.markCompleted('')).toThrow('Outcome cannot be empty');
        expect(() => intervention.markCompleted('   ')).toThrow('Outcome cannot be empty');
      });

      it('should reject completing already completed intervention', () => {
        intervention.markCompleted('First completion');
        
        expect(() => intervention.markCompleted('Second completion'))
          .toThrow('Intervention is already completed');
      });

      it('should trim outcome text', () => {
        intervention.markCompleted('  Successful parent meeting  ');
        expect(intervention.outcome).toBe('Successful parent meeting');
      });
    });

    describe('Cancellation Workflow', () => {
      it('should mark intervention as canceled with reason', async () => {
        const reason = 'Student transferred to another school';
        const originalUpdatedAt = intervention.updatedAt;
        
        await new Promise(resolve => setTimeout(resolve, 5));
        
        intervention.markCanceled(reason);
        
        expect(intervention.status).toBe(InterventionStatus.CANCELED);
        expect(intervention.outcome).toBe(reason);
        expect(intervention.completedDate).toBeInstanceOf(Date);
        expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      });

      it('should reject empty reason when canceling', () => {
        expect(() => intervention.markCanceled('')).toThrow('Reason cannot be empty');
        expect(() => intervention.markCanceled('   ')).toThrow('Reason cannot be empty');
      });

      it('should reject canceling completed intervention', () => {
        intervention.markCompleted('Intervention completed successfully');
        
        expect(() => intervention.markCanceled('Trying to cancel'))
          .toThrow('Cannot cancel a completed intervention');
      });
    });

    describe('Rescheduling Workflow', () => {
      it('should reschedule to future date', async () => {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + 3);
        const originalUpdatedAt = intervention.updatedAt;
        
        await new Promise(resolve => setTimeout(resolve, 5));
        
        intervention.reschedule(newDate);
        
        expect(intervention.scheduledDate.toDateString()).toBe(newDate.toDateString());
        expect(intervention.status).toBe(InterventionStatus.SCHEDULED);
        expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      });

      it('should reject rescheduling to past date', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        
        expect(() => intervention.reschedule(pastDate))
          .toThrow('Scheduled date cannot be in the past');
      });

      it('should reject rescheduling completed intervention', () => {
        intervention.markCompleted('Already completed');
        
        expect(() => intervention.reschedule(tomorrow))
          .toThrow('Cannot reschedule a completed intervention');
      });

      it('should reject rescheduling canceled intervention', () => {
        intervention.markCanceled('Already canceled');
        
        expect(() => intervention.reschedule(tomorrow))
          .toThrow('Cannot reschedule a canceled intervention');
      });
    });
  });

  describe('Overdue Detection', () => {
    it('should identify overdue scheduled interventions', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Create intervention with past date by bypassing validation
      const intervention = TestDataFactory.createIntervention({
        dueDate: yesterday
      });
      
      // Manually set to scheduled and past date for testing
      const pastIntervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      // Use reflection to set past date (for testing purposes)
      (pastIntervention as any)._scheduledDate = yesterday;
      
      expect(pastIntervention.isOverdue()).toBe(true);
    });

    it('should not identify future interventions as overdue', () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        nextWeek
      );
      
      expect(intervention.isOverdue()).toBe(false);
    });

    it('should not identify completed interventions as overdue', () => {
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      intervention.markCompleted('Completed successfully');
      
      expect(intervention.isOverdue()).toBe(false);
    });

    it('should not identify canceled interventions as overdue', () => {
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      intervention.markCanceled('Student transferred');
      
      expect(intervention.isOverdue()).toBe(false);
    });
  });

  describe('Description Management', () => {
    let intervention: Intervention;

    beforeEach(() => {
      intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
    });

    it('should update description', async () => {
      const newDescription = 'Updated description with more details about attendance concerns';
      const originalUpdatedAt = intervention.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 5));
      
      intervention.updateDescription(newDescription);
      
      expect(intervention.description).toBe(newDescription);
      expect(intervention.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should reject empty description updates', () => {
      expect(() => intervention.updateDescription('')).toThrow('Description cannot be empty');
      expect(() => intervention.updateDescription('   ')).toThrow('Description cannot be empty');
    });

    it('should trim description when updating', () => {
      intervention.updateDescription('  New description  ');
      expect(intervention.description).toBe('New description');
    });

    it('should reject non-string description', () => {
      expect(() => intervention.updateDescription(null as any)).toThrow('Description cannot be empty');
      expect(() => intervention.updateDescription(undefined as any)).toThrow('Description cannot be empty');
      expect(() => intervention.updateDescription(123 as any)).toThrow('Description cannot be empty');
    });
  });

  describe('Data Integrity and Immutability', () => {
    it('should return immutable date objects', () => {
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      // Modifying returned date shouldn't affect intervention
      const scheduledDate = intervention.scheduledDate;
      scheduledDate.setDate(scheduledDate.getDate() + 10);
      
      expect(intervention.scheduledDate.toDateString()).toBe(tomorrow.toDateString());
    });

    it('should handle completed date immutability', () => {
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      intervention.markCompleted('Test completion');
      
      const completedDate = intervention.completedDate!;
      completedDate.setDate(completedDate.getDate() + 5);
      
      // Original completed date should be unchanged
      expect(intervention.completedDate!.getDate()).not.toBe(completedDate.getDate());
    });

    it('should maintain data consistency after multiple operations', async () => {
      const intervention = new Intervention(
        validStudentId,
        validType,
        'Original description',
        validCreatedBy,
        tomorrow
      );
      
      const originalCreatedAt = intervention.createdAt;
      
      // Perform multiple operations
      await new Promise(resolve => setTimeout(resolve, 5));
      intervention.updateDescription('Updated description');
      
      await new Promise(resolve => setTimeout(resolve, 5));
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 2);
      intervention.reschedule(newDate);
      
      await new Promise(resolve => setTimeout(resolve, 5));
      intervention.markCompleted('Final outcome');
      
      // Verify data consistency
      expect(intervention.createdAt.getTime()).toBe(originalCreatedAt.getTime()); // Should not change
      expect(intervention.description).toBe('Updated description');
      expect(intervention.scheduledDate.toDateString()).toBe(newDate.toDateString());
      expect(intervention.status).toBe(InterventionStatus.COMPLETED);
      expect(intervention.outcome).toBe('Final outcome');
    });
  });

  describe('Equality and Comparison', () => {
    it('should identify equal interventions by student ID and creation time', () => {
      const intervention1 = new Intervention(
        validStudentId,
        InterventionType.PARENT_CONTACT,
        'First description',
        'T1111',
        tomorrow
      );
      
      // Create another intervention at exact same time (unlikely but possible)
      const sameCreationTime = intervention1.createdAt;
      const intervention2 = new Intervention(
        validStudentId,
        InterventionType.SARB_REFERRAL,
        'Different description',
        'T2222',
        tomorrow
      );
      
      // Manually set same creation time for testing
      (intervention2 as any)._createdAt = sameCreationTime;
      
      expect(intervention1.equals(intervention2)).toBe(true);
    });

    it('should identify different interventions by student ID', () => {
      const differentStudentId = new StudentId('789012');
      
      const intervention1 = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      const intervention2 = new Intervention(
        differentStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      expect(intervention1.equals(intervention2)).toBe(false);
    });

    it('should handle null/undefined comparisons safely', () => {
      const intervention = new Intervention(
        validStudentId,
        validType,
        validDescription,
        validCreatedBy,
        tomorrow
      );
      
      expect(intervention.equals(null as any)).toBe(false);
      expect(intervention.equals(undefined as any)).toBe(false);
      expect(intervention.equals({} as any)).toBe(false);
    });
  });

  describe('Property-Based Testing with fast-check', () => {
    it('should always maintain valid status transitions', () => {
      fc.assert(fc.property(
        fc.constantFrom(
          InterventionType.PARENT_CONTACT,
          InterventionType.COUNSELOR_REFERRAL,
          InterventionType.ATTENDANCE_CONTRACT,
          InterventionType.SART_REFERRAL,
          InterventionType.SARB_REFERRAL
        ),
        fc.string({ minLength: 5, maxLength: 100 }),
        fc.string({ minLength: 5, maxLength: 200 }),
        (type, description, outcome) => {
          const teacherId = `T${Math.floor(Math.random() * 9000) + 1000}`;
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 30) + 1);
          
          const intervention = new Intervention(
            validStudentId,
            type,
            description,
            teacherId,
            futureDate
          );
          
          // Initial state should always be SCHEDULED
          expect(intervention.status).toBe(InterventionStatus.SCHEDULED);
          expect(intervention.completedDate).toBeNull();
          expect(intervention.outcome).toBeNull();
          
          // After completion, should have outcome and completed date
          intervention.markCompleted(outcome);
          expect(intervention.status).toBe(InterventionStatus.COMPLETED);
          expect(intervention.completedDate).not.toBeNull();
          expect(intervention.outcome).toBe(outcome.trim());
        }
      ));
    });

    it('should maintain teacher ID format invariant', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1000, max: 99999 }),
        (teacherNumber) => {
          const teacherId = `T${teacherNumber}`;
          
          const intervention = new Intervention(
            validStudentId,
            InterventionType.PARENT_CONTACT,
            'Test intervention',
            teacherId,
            tomorrow
          );
          
          expect(intervention.createdBy).toBe(teacherId);
          expect(intervention.createdBy).toMatch(/^T\d{4,}$/);
        }
      ));
    });

    it('should handle date range variations correctly', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 365 }), // Days in future
        (daysInFuture) => {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + daysInFuture);
          
          const intervention = new Intervention(
            validStudentId,
            InterventionType.PARENT_CONTACT,
            'Test intervention',
            'T1234',
            futureDate
          );
          
          expect(intervention.scheduledDate.getTime()).toBeGreaterThanOrEqual(
            new Date().setHours(0, 0, 0, 0)
          );
          expect(intervention.isOverdue()).toBe(false);
        }
      ));
    });
  });

  describe('Real-World Scenario Testing', () => {
    it('should handle typical SARB escalation timeline', async () => {
      const student = new StudentId('567890');
      const teacher = 'T3456';
      
      // Step 1: Initial parent contact (Day 1)
      const day1 = new Date();
      day1.setDate(day1.getDate() + 1);
      
      const parentContact = new Intervention(
        student,
        InterventionType.PARENT_CONTACT,
        'Initial parent contact via phone regarding 5 unexcused absences',
        teacher,
        day1
      );
      
      // Complete parent contact
      await new Promise(resolve => setTimeout(resolve, 5));
      parentContact.markCompleted('Parent acknowledged concerns, will monitor attendance');
      
      // Step 2: Follow-up meeting (Day 8)
      const day8 = new Date();
      day8.setDate(day8.getDate() + 8);
      
      const parentMeeting = new Intervention(
        student,
        InterventionType.PARENT_CONTACT,
        'In-person parent meeting due to continued absences after phone contact',
        teacher,
        day8
      );
      
      await new Promise(resolve => setTimeout(resolve, 5));
      parentMeeting.markCompleted('Attendance contract signed, barriers discussed');
      
      // Step 3: SART referral (Day 15)
      const day15 = new Date();
      day15.setDate(day15.getDate() + 15);
      
      const sartReferral = new Intervention(
        student,
        InterventionType.SART_REFERRAL,
        'SART referral after unsuccessful parent interventions, total 12 absences',
        teacher,
        day15
      );
      
      await new Promise(resolve => setTimeout(resolve, 5));
      sartReferral.markCompleted('SART team developed comprehensive support plan');
      
      // Step 4: SARB referral (Day 30)
      const day30 = new Date();
      day30.setDate(day30.getDate() + 30);
      
      const sarbReferral = new Intervention(
        student,
        InterventionType.SARB_REFERRAL,
        'SARB referral due to continued chronic absenteeism despite SART interventions',
        teacher,
        day30
      );
      
      // Verify escalation process
      expect(parentContact.status).toBe(InterventionStatus.COMPLETED);
      expect(parentMeeting.status).toBe(InterventionStatus.COMPLETED);
      expect(sartReferral.status).toBe(InterventionStatus.COMPLETED);
      expect(sarbReferral.status).toBe(InterventionStatus.SCHEDULED);
      
      // Verify all are for same student
      [parentContact, parentMeeting, sartReferral, sarbReferral].forEach(intervention => {
        expect(intervention.studentId.equals(student)).toBe(true);
        expect(intervention.createdBy).toBe(teacher);
      });
    });

    it('should handle intervention cancellation due to student transfer', () => {
      const intervention = new Intervention(
        validStudentId,
        InterventionType.COUNSELOR_REFERRAL,
        'Counselor referral for attendance support and barrier assessment',
        'T7890',
        tomorrow
      );
      
      // Student transfers before intervention
      intervention.markCanceled('Student transferred to Heritage Elementary mid-semester');
      
      expect(intervention.status).toBe(InterventionStatus.CANCELED);
      expect(intervention.outcome).toBe('Student transferred to Heritage Elementary mid-semester');
      expect(intervention.completedDate).toBeInstanceOf(Date);
    });

    it('should handle multiple rescheduling scenarios', async () => {
      const intervention = new Intervention(
        validStudentId,
        InterventionType.ATTENDANCE_CONTRACT,
        'Attendance contract meeting to establish goals and monitoring',
        'T4567',
        tomorrow
      );
      
      // First reschedule - parent unavailable
      const newDate1 = new Date();
      newDate1.setDate(newDate1.getDate() + 3);
      
      await new Promise(resolve => setTimeout(resolve, 5));
      intervention.reschedule(newDate1);
      expect(intervention.scheduledDate.toDateString()).toBe(newDate1.toDateString());
      
      // Second reschedule - school holiday
      const newDate2 = new Date();
      newDate2.setDate(newDate2.getDate() + 5);
      
      await new Promise(resolve => setTimeout(resolve, 5));
      intervention.reschedule(newDate2);
      expect(intervention.scheduledDate.toDateString()).toBe(newDate2.toDateString());
      
      // Finally complete
      await new Promise(resolve => setTimeout(resolve, 5));
      intervention.markCompleted('Contract established with weekly check-ins');
      
      expect(intervention.status).toBe(InterventionStatus.COMPLETED);
    });
  });
});