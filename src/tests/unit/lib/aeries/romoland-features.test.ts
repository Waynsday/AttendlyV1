/**
 * @fileoverview Romoland-Specific Features Test Suite
 * 
 * Tests for Romoland School District specific implementations including:
 * - Custom Aeries query support
 * - 7-period attendance calculations
 * - Full-day absence logic
 * - 7-day correction window
 * - California compliance features
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  RomolandAttendanceProcessor,
  RomolandQueryBuilder,
  AttendanceCorrectionService,
  CaliforniaComplianceValidator
} from '../../../../lib/aeries/romoland-features';
import { AeriesAttendanceRecord, AeriesStudent } from '../../../../types/aeries';

describe('Romoland-Specific Features', () => {
  describe('RomolandQueryBuilder', () => {
    let queryBuilder: RomolandQueryBuilder;

    beforeEach(() => {
      queryBuilder = new RomolandQueryBuilder();
    });

    describe('existing query format support', () => {
      it('should parse the standard Romoland query format', () => {
        const query = 'LIST STU TCH AHS STU.NM STU.GR TCH.TE STU.ID AHS.SP AHS.EN AHS.AB AHS.PR';
        
        const parsedQuery = queryBuilder.parseQuery(query);

        expect(parsedQuery).toMatchObject({
          operation: 'LIST',
          tables: ['STU', 'TCH', 'AHS'],
          fields: [
            'STU.NM', // Student Name
            'STU.GR', // Student Grade
            'TCH.TE', // Teacher Name
            'STU.ID', // Student ID
            'AHS.SP', // School Period
            'AHS.EN', // Entry Date
            'AHS.AB', // Absent Count
            'AHS.PR'  // Present Count
          ]
        });
      });

      it('should validate query syntax and required fields', () => {
        const invalidQuery = 'LIST STU INVALID.FIELD';
        
        expect(() => queryBuilder.parseQuery(invalidQuery))
          .toThrow('Invalid query field: INVALID.FIELD');
      });

      it('should build query parameters for API execution', () => {
        const query = 'LIST STU TCH AHS STU.NM STU.GR TCH.TE STU.ID AHS.SP AHS.EN AHS.AB AHS.PR';
        const filters = {
          schoolCode: 'RIS',
          gradeLevel: '7',
          dateRange: {
            start: '2024-08-15',
            end: '2024-08-16'
          }
        };

        const apiParams = queryBuilder.buildApiParameters(query, filters);

        expect(apiParams).toMatchObject({
          query: expect.stringContaining('LIST STU TCH AHS'),
          filters: expect.objectContaining({
            'STU.SC': 'RIS',
            'STU.GR': '7',
            'AHS.DT': expect.objectContaining({
              '$gte': '2024-08-15',
              '$lte': '2024-08-16'
            })
          }),
          limit: 1000,
          offset: 0
        });
      });

      it('should transform API response to expected format', () => {
        const apiResponse = [{
          'STU.NM': 'Doe, John',
          'STU.GR': '7',
          'TCH.TE': 'Smith, Jane',
          'STU.ID': 'STU123',
          'AHS.SP': '3',
          'AHS.EN': '2024-08-15',
          'AHS.AB': '1',
          'AHS.PR': '6'
        }];

        const transformed = queryBuilder.transformResponse(apiResponse);

        expect(transformed).toEqual([{
          studentName: 'Doe, John',
          grade: '7',
          teacherName: 'Smith, Jane',
          studentId: 'STU123',
          schoolPeriod: 3,
          entryDate: '2024-08-15',
          absentCount: 1,
          presentCount: 6,
          attendanceRate: 85.71 // 6/7 * 100
        }]);
      });

      it('should handle missing or null fields gracefully', () => {
        const incompleteResponse = [{
          'STU.NM': 'Doe, John',
          'STU.GR': '7',
          'STU.ID': 'STU123',
          'AHS.SP': null,
          'AHS.AB': '0',
          'AHS.PR': '7'
        }];

        const transformed = queryBuilder.transformResponse(incompleteResponse);

        expect(transformed[0]).toMatchObject({
          studentName: 'Doe, John',
          grade: '7',
          studentId: 'STU123',
          schoolPeriod: null,
          absentCount: 0,
          presentCount: 7,
          attendanceRate: 100
        });
      });

      it('should support custom query extensions for specific reports', () => {
        const customQuery = queryBuilder.buildCustomQuery({
          operation: 'REPORT',
          reportType: 'CHRONIC_ABSENTEEISM',
          fields: ['STU.ID', 'STU.NM', 'ATTENDANCE_RATE'],
          filters: {
            attendanceRate: { $lt: 90 },
            schoolCode: 'RIS'
          }
        });

        expect(customQuery).toContain('REPORT');
        expect(customQuery).toContain('CHRONIC_ABSENTEEISM');
        expect(customQuery).toContain('ATTENDANCE_RATE < 90');
      });
    });
  });

  describe('RomolandAttendanceProcessor', () => {
    let processor: RomolandAttendanceProcessor;

    beforeEach(() => {
      processor = new RomolandAttendanceProcessor({
        totalPeriods: 7,
        minimumPeriodsForFullDay: 4,
        tardyCountsAsPresent: true
      });
    });

    describe('7-period attendance handling', () => {
      it('should validate that all 7 periods are provided', () => {
        const incompleteAttendance = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'ABSENT' }
            // Missing periods 3-7
          ]
        };

        expect(() => processor.calculatePeriodAttendance(incompleteAttendance))
          .toThrow('All 7 periods must be provided for middle school attendance');
      });

      it('should calculate period-based attendance statistics', () => {
        const attendanceData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'ABSENT' },
            { period: 3, status: 'PRESENT' },
            { period: 4, status: 'TARDY' },
            { period: 5, status: 'EXCUSED_ABSENT' },
            { period: 6, status: 'PRESENT' },
            { period: 7, status: 'UNEXCUSED_ABSENT' }
          ]
        };

        const result = processor.calculatePeriodAttendance(attendanceData);

        expect(result).toMatchObject({
          totalPeriods: 7,
          periodsPresent: 3,
          periodsTardy: 1,
          periodsExcusedAbsent: 1,
          periodsUnexcusedAbsent: 1,
          periodsAbsent: 1, // Generic absent
          attendancePercentage: 57.14, // (3 + 1) / 7 * 100 (tardy counts as present)
          presentForAttendanceCalculation: 4
        });
      });

      it('should handle different tardy policies', () => {
        const strictProcessor = new RomolandAttendanceProcessor({
          totalPeriods: 7,
          tardyCountsAsPresent: false
        });

        const attendanceData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'TARDY' },
            { period: 3, status: 'PRESENT' },
            { period: 4, status: 'TARDY' },
            { period: 5, status: 'PRESENT' },
            { period: 6, status: 'PRESENT' },
            { period: 7, status: 'PRESENT' }
          ]
        };

        const result = strictProcessor.calculatePeriodAttendance(attendanceData);

        expect(result.attendancePercentage).toBe(71.43); // 5/7 * 100 (tardy doesn't count)
        expect(result.presentForAttendanceCalculation).toBe(5);
      });

      it('should validate period numbers are 1-7', () => {
        const invalidPeriodData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 0, status: 'PRESENT' }, // Invalid period number
            { period: 2, status: 'PRESENT' },
            { period: 3, status: 'PRESENT' },
            { period: 4, status: 'PRESENT' },
            { period: 5, status: 'PRESENT' },
            { period: 6, status: 'PRESENT' },
            { period: 7, status: 'PRESENT' }
          ]
        };

        expect(() => processor.calculatePeriodAttendance(invalidPeriodData))
          .toThrow('Invalid period number: 0. Periods must be 1-7');
      });

      it('should detect duplicate period entries', () => {
        const duplicatePeriodData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 1, status: 'ABSENT' }, // Duplicate period 1
            { period: 2, status: 'PRESENT' },
            { period: 3, status: 'PRESENT' },
            { period: 4, status: 'PRESENT' },
            { period: 5, status: 'PRESENT' },
            { period: 6, status: 'PRESENT' }
          ]
        };

        expect(() => processor.calculatePeriodAttendance(duplicatePeriodData))
          .toThrow('Duplicate period entry found: 1');
      });
    });

    describe('full-day absence calculation', () => {
      it('should mark as full-day absent when all periods are absent', () => {
        const allAbsentData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: Array(7).fill(null).map((_, i) => ({
            period: i + 1,
            status: 'ABSENT'
          }))
        };

        const result = processor.calculateDailyAttendanceStatus(allAbsentData);

        expect(result).toMatchObject({
          dailyStatus: 'FULL_DAY_ABSENT',
          isFullDayAbsent: true,
          attendancePercentage: 0,
          qualifiesForAdaDeduction: true
        });
      });

      it('should not mark as full-day absent if student was present for minimum periods', () => {
        const partialAttendanceData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'PRESENT' },
            { period: 3, status: 'PRESENT' },
            { period: 4, status: 'PRESENT' },
            { period: 5, status: 'ABSENT' },
            { period: 6, status: 'ABSENT' },
            { period: 7, status: 'ABSENT' }
          ]
        };

        const result = processor.calculateDailyAttendanceStatus(partialAttendanceData);

        expect(result).toMatchObject({
          dailyStatus: 'PARTIAL_DAY_PRESENT',
          isFullDayAbsent: false,
          attendancePercentage: 57.14,
          qualifiesForAdaDeduction: false
        });
      });

      it('should handle mixed excuse statuses in daily calculation', () => {
        const mixedExcuseData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'EXCUSED_ABSENT' },
            { period: 2, status: 'EXCUSED_ABSENT' },
            { period: 3, status: 'UNEXCUSED_ABSENT' },
            { period: 4, status: 'UNEXCUSED_ABSENT' },
            { period: 5, status: 'UNEXCUSED_ABSENT' },
            { period: 6, status: 'UNEXCUSED_ABSENT' },
            { period: 7, status: 'UNEXCUSED_ABSENT' }
          ]
        };

        const result = processor.calculateDailyAttendanceStatus(mixedExcuseData);

        expect(result).toMatchObject({
          dailyStatus: 'FULL_DAY_UNEXCUSED_ABSENT',
          isFullDayAbsent: true,
          excuseBreakdown: {
            excusedPeriods: 2,
            unexcusedPeriods: 5,
            majorityStatus: 'UNEXCUSED_ABSENT'
          },
          interventionRequired: true
        });
      });

      it('should calculate ADA (Average Daily Attendance) impact', () => {
        const attendanceData = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [
            { period: 1, status: 'PRESENT' },
            { period: 2, status: 'PRESENT' },
            { period: 3, status: 'ABSENT' },
            { period: 4, status: 'ABSENT' },
            { period: 5, status: 'ABSENT' },
            { period: 6, status: 'ABSENT' },
            { period: 7, status: 'ABSENT' }
          ]
        };

        const result = processor.calculateAdaImpact(attendanceData);

        expect(result).toMatchObject({
          adaCredit: 0.286, // 2/7 periods present
          fullDayEquivalent: false,
          fundingImpact: {
            estimatedDailyFunding: expect.any(Number),
            actualFunding: expect.any(Number),
            fundingLoss: expect.any(Number)
          }
        });
      });

      it('should identify patterns requiring intervention', () => {
        const chronicAbsencePattern = [
          { date: '2024-08-15', periodsAbsent: 5 },
          { date: '2024-08-16', periodsAbsent: 6 },
          { date: '2024-08-17', periodsAbsent: 7 },
          { date: '2024-08-18', periodsAbsent: 4 },
          { date: '2024-08-19', periodsAbsent: 5 }
        ];

        const interventionAnalysis = processor.analyzeInterventionNeeds(
          'STU123',
          chronicAbsencePattern
        );

        expect(interventionAnalysis).toMatchObject({
          riskLevel: 'HIGH',
          interventionRequired: true,
          recommendedActions: expect.arrayContaining([
            'PARENT_CONTACT',
            'ATTENDANCE_CONTRACT',
            'COUNSELOR_REFERRAL'
          ]),
          chronicAbsenteeism: true,
          attendanceRate: expect.any(Number)
        });
      });
    });
  });

  describe('AttendanceCorrectionService', () => {
    let correctionService: AttendanceCorrectionService;

    beforeEach(() => {
      correctionService = new AttendanceCorrectionService({
        correctionWindowDays: 7,
        requiresApproval: true,
        auditingEnabled: true
      });
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('7-day correction window support', () => {
      it('should allow corrections within 7-day window', async () => {
        const originalDate = new Date('2024-08-15');
        const correctionDate = new Date('2024-08-20'); // 5 days later

        const originalAttendance = {
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          periods: [{ period: 1, status: 'ABSENT' }]
        };

        const correctedAttendance = {
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          periods: [{ period: 1, status: 'EXCUSED_ABSENT' }]
        };

        jest.setSystemTime(correctionDate);

        const result = await correctionService.processCorrection(
          originalAttendance,
          correctedAttendance,
          {
            reason: 'Medical excuse provided',
            correctedBy: 'attendance.clerk@romoland.k12.ca.us',
            approvedBy: 'principal@romoland.k12.ca.us'
          }
        );

        expect(result).toMatchObject({
          success: true,
          isWithinWindow: true,
          correctionApplied: true,
          auditTrail: expect.arrayContaining([
            expect.objectContaining({
              action: 'ATTENDANCE_CORRECTED',
              originalStatus: 'ABSENT',
              newStatus: 'EXCUSED_ABSENT',
              reason: 'Medical excuse provided'
            })
          ])
        });
      });

      it('should reject corrections outside 7-day window', async () => {
        const originalDate = new Date('2024-08-15');
        const correctionDate = new Date('2024-08-25'); // 10 days later

        const originalAttendance = {
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          periods: [{ period: 1, status: 'ABSENT' }]
        };

        const correctedAttendance = {
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          periods: [{ period: 1, status: 'EXCUSED_ABSENT' }]
        };

        jest.setSystemTime(correctionDate);

        await expect(
          correctionService.processCorrection(originalAttendance, correctedAttendance, {
            reason: 'Late medical excuse',
            correctedBy: 'attendance.clerk@romoland.k12.ca.us'
          })
        ).rejects.toThrow('Correction window has expired');
      });

      it('should allow emergency corrections outside window with proper authorization', async () => {
        const originalDate = new Date('2024-08-15');
        const correctionDate = new Date('2024-08-30'); // 15 days later

        const originalAttendance = {
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          periods: [{ period: 1, status: 'ABSENT' }]
        };

        const correctedAttendance = {
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          periods: [{ period: 1, status: 'EXCUSED_ABSENT' }]
        };

        jest.setSystemTime(correctionDate);

        const result = await correctionService.processEmergencyCorrection(
          originalAttendance,
          correctedAttendance,
          {
            reason: 'Court-ordered correction',
            emergencyAuthorization: 'DISTRICT_SUPERINTENDENT',
            correctedBy: 'superintendent@romoland.k12.ca.us',
            legalJustification: 'Court order #12345 dated 2024-08-29'
          }
        );

        expect(result).toMatchObject({
          success: true,
          isEmergencyCorrection: true,
          correctionApplied: true,
          requiresDistrictNotification: true
        });
      });

      it('should maintain complete audit trail for all corrections', async () => {
        const originalDate = new Date('2024-08-15');
        const correctionDate = new Date('2024-08-18');

        const originalAttendance = {
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          periods: [
            { period: 1, status: 'ABSENT' },
            { period: 2, status: 'ABSENT' }
          ]
        };

        jest.setSystemTime(correctionDate);

        // Make multiple corrections
        await correctionService.processCorrection(originalAttendance, {
          ...originalAttendance,
          periods: [
            { period: 1, status: 'EXCUSED_ABSENT' },
            { period: 2, status: 'ABSENT' }
          ]
        }, {
          reason: 'Medical excuse for period 1',
          correctedBy: 'nurse@romoland.k12.ca.us'
        });

        await correctionService.processCorrection(originalAttendance, {
          ...originalAttendance,
          periods: [
            { period: 1, status: 'EXCUSED_ABSENT' },
            { period: 2, status: 'EXCUSED_ABSENT' }
          ]
        }, {
          reason: 'Medical excuse for period 2',
          correctedBy: 'nurse@romoland.k12.ca.us'
        });

        const auditTrail = await correctionService.getAuditTrail('STU123', originalDate.toISOString().split('T')[0]);

        expect(auditTrail).toMatchObject({
          studentId: 'STU123',
          date: originalDate.toISOString().split('T')[0],
          corrections: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(String),
              correctedBy: 'nurse@romoland.k12.ca.us',
              changes: expect.arrayContaining([
                expect.objectContaining({
                  period: 1,
                  from: 'ABSENT',
                  to: 'EXCUSED_ABSENT'
                })
              ])
            })
          ]),
          totalCorrections: 2
        });
      });

      it('should validate correction permissions based on user role', async () => {
        const originalAttendance = {
          studentId: 'STU123',
          date: '2024-08-15',
          periods: [{ period: 1, status: 'ABSENT' }]
        };

        const correctedAttendance = {
          ...originalAttendance,
          periods: [{ period: 1, status: 'EXCUSED_ABSENT' }]
        };

        // Test different user roles
        const teacherCorrection = await correctionService.validateCorrectionPermissions({
          userRole: 'TEACHER',
          userId: 'teacher@romoland.k12.ca.us',
          correctionType: 'EXCUSE_CHANGE'
        });

        const clerkCorrection = await correctionService.validateCorrectionPermissions({
          userRole: 'ATTENDANCE_CLERK',
          userId: 'clerk@romoland.k12.ca.us',
          correctionType: 'EXCUSE_CHANGE'
        });

        expect(teacherCorrection.canCorrect).toBe(false);
        expect(teacherCorrection.reason).toContain('insufficient permissions');

        expect(clerkCorrection.canCorrect).toBe(true);
        expect(clerkCorrection.maxCorrectionsPerDay).toBe(50);
      });
    });
  });

  describe('CaliforniaComplianceValidator', () => {
    let validator: CaliforniaComplianceValidator;

    beforeEach(() => {
      validator = new CaliforniaComplianceValidator();
    });

    describe('California education code compliance', () => {
      it('should validate chronic absenteeism thresholds (10% rule)', () => {
        const studentAttendance = {
          studentId: 'STU123',
          totalSchoolDays: 180,
          daysAbsent: 18, // Exactly 10%
          excusedAbsent: 5,
          unexcusedAbsent: 13
        };

        const validation = validator.validateChronicAbsenteeism(studentAttendance);

        expect(validation).toMatchObject({
          isChronicallyAbsent: true,
          absenteeismRate: 10.0,
          threshold: 10.0,
          requiresIntervention: true,
          complianceStatus: 'AT_RISK',
          recommendedActions: expect.arrayContaining([
            'PARENT_NOTIFICATION',
            'INTERVENTION_PLAN',
            'MONITORING_PROTOCOL'
          ])
        });
      });

      it('should validate truancy intervention requirements', () => {
        const truancyCase = {
          studentId: 'STU123',
          unexcusedAbsences: 3,
          interventionsCompleted: ['PARENT_CONTACT'],
          lastInterventionDate: '2024-08-10',
          schoolYear: '2024-2025'
        };

        const validation = validator.validateTruancyIntervention(truancyCase);

        expect(validation).toMatchObject({
          complianceLevel: 'TIER_2',
          nextRequiredAction: 'ATTENDANCE_CONFERENCE',
          timelineRequirement: expect.objectContaining({
            dueDate: expect.any(String),
            daysRemaining: expect.any(Number)
          }),
          legalRequirements: expect.arrayContaining([
            'EC_48260_NOTIFICATION',
            'EC_48261_CONFERENCE'
          ])
        });
      });

      it('should validate SARB referral requirements', () => {
        const sarbCase = {
          studentId: 'STU123',
          unexcusedAbsences: 15,
          interventionsCompleted: [
            'PARENT_CONTACT',
            'ATTENDANCE_CONFERENCE',
            'TRUANCY_LETTER_1',
            'TRUANCY_LETTER_2'
          ],
          lastInterventionDate: '2024-07-15',
          studentAge: 14,
          gradeLevel: 7
        };

        const validation = validator.validateSarbReferral(sarbCase);

        expect(validation).toMatchObject({
          referralRequired: true,
          complianceStatus: 'READY_FOR_SARB',
          legalBasis: expect.arrayContaining([
            'EC_48263_SARB_REFERRAL',
            'EC_48264_HABITUAL_TRUANT'
          ]),
          requiredDocumentation: expect.arrayContaining([
            'ATTENDANCE_RECORD',
            'INTERVENTION_LOG',
            'PARENT_NOTIFICATIONS'
          ])
        });
      });

      it('should validate attendance recovery program compliance (SB 153/176)', () => {
        const recoveryProgram = {
          studentId: 'STU123',
          hoursCompleted: 16, // 4 hours = 1 day, so 4 days recovered
          hoursRequired: 28, // 7 days needed recovery
          teacherCertified: true,
          classSize: 18, // Under 20:1 ratio
          standardsAligned: true,
          programType: 'SB_153_RECOVERY'
        };

        const validation = validator.validateRecoveryProgram(recoveryProgram);

        expect(validation).toMatchObject({
          complianceStatus: 'IN_PROGRESS',
          ratioCompliance: true,
          teacherQualified: true,
          hoursCompleted: 16,
          hoursRemaining: 12,
          estimatedCompletionDate: expect.any(String),
          sb153Compliant: true
        });
      });

      it('should validate student-teacher ratio requirements (20:1)', () => {
        const classAssignment = {
          teacherId: 'TCH123',
          programType: 'ATTENDANCE_RECOVERY',
          currentStudents: 22, // Over limit
          maxCapacity: 20,
          teacherCertifications: ['AR_CERTIFIED', 'CLEAR_CREDENTIAL']
        };

        const validation = validator.validateTeacherRatio(classAssignment);

        expect(validation).toMatchObject({
          ratioCompliant: false,
          currentRatio: 22,
          maxAllowedRatio: 20,
          overCapacityBy: 2,
          complianceViolation: 'RATIO_EXCEEDED',
          correctiveAction: 'REDUCE_CLASS_SIZE'
        });
      });

      it('should generate compliance reports for state audits', () => {
        const reportData = {
          districtCode: 'ROMOLAND',
          schoolYear: '2024-2025',
          reportingPeriod: 'Q1',
          students: [
            {
              studentId: 'STU123',
              chronicAbsenteeism: true,
              interventionsProvided: 3,
              recoveryHours: 16
            },
            {
              studentId: 'STU124',
              chronicAbsenteeism: false,
              interventionsProvided: 0,
              recoveryHours: 0
            }
          ]
        };

        const complianceReport = validator.generateComplianceReport(reportData);

        expect(complianceReport).toMatchObject({
          districtCode: 'ROMOLAND',
          reportingPeriod: 'Q1 2024-2025',
          summary: {
            totalStudents: 2,
            chronicallyAbsentStudents: 1,
            studentsInRecovery: 1,
            complianceRate: 100, // All required interventions provided
            riskStudents: 1
          },
          detailedMetrics: expect.objectContaining({
            interventionEffectiveness: expect.any(Number),
            recoveryProgramParticipation: expect.any(Number),
            sarbReferrals: expect.any(Number)
          }),
          recommendations: expect.any(Array)
        });
      });
    });
  });
});