import * as fc from 'fast-check';
import { Student } from '@/domain/entities/student';
import { AttendanceRecord, AttendanceStatus, PeriodAttendance } from '@/domain/entities/attendance-record';
import { Intervention, InterventionType, InterventionStatus } from '@/domain/entities/intervention';
import { Teacher } from '@/domain/entities/teacher';
import { StudentId } from '@/domain/value-objects/student-id';
import { AttendancePercentage } from '@/domain/value-objects/attendance-percentage';

/**
 * Test Data Factory for AP Tool V1
 * 
 * Creates realistic, anonymized test data for educational testing scenarios.
 * Focuses on Romoland Middle School requirements:
 * - Middle school grades (6-8)
 * - 7-period school day
 * - California attendance regulations
 * - Multi-year historical data
 * - FERPA-compliant anonymized data
 */

export class TestDataFactory {
  /**
   * Generate a valid Student entity with realistic data
   */
  static createStudent(overrides: Partial<{
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel: number;
    email: string;
    isActive: boolean;
  }> = {}): Student {
    const defaults = {
      id: TestDataFactory.generateStudentId(),
      firstName: TestDataFactory.generateFirstName(),
      lastName: TestDataFactory.generateLastName(), 
      gradeLevel: TestDataFactory.generateGradeLevel(),
      email: TestDataFactory.generateSchoolEmail(),
      isActive: true
    };
    
    const data = { ...defaults, ...overrides };
    
    return new Student(
      new StudentId(data.id),
      data.firstName,
      data.lastName,
      data.gradeLevel,
      data.email,
      data.isActive
    );
  }

  /**
   * Generate multiple students for a grade level
   */
  static createStudentsForGrade(gradeLevel: number, count: number = 25): Student[] {
    return Array.from({ length: count }, (_, index) => 
      TestDataFactory.createStudent({
        gradeLevel,
        id: `${gradeLevel}${String(index + 1).padStart(4, '0')}`
      })
    );
  }

  /**
   * Generate a complete middle school student body (grades 6-8)
   */
  static createMiddleSchoolStudents(): Student[] {
    const students: Student[] = [];
    
    // Grade 6: 180 students (6 classes of 30)
    students.push(...TestDataFactory.createStudentsForGrade(6, 180));
    
    // Grade 7: 175 students  
    students.push(...TestDataFactory.createStudentsForGrade(7, 175));
    
    // Grade 8: 165 students
    students.push(...TestDataFactory.createStudentsForGrade(8, 165));
    
    return students;
  }

  /**
   * Create attendance record with realistic period data
   */
  static createAttendanceRecord(overrides: Partial<{
    studentId: string;
    date: Date;
    schoolYear: string;
    attendancePattern: 'perfect' | 'partial' | 'absent' | 'tardy' | 'random';
  }> = {}): AttendanceRecord {
    const defaults = {
      studentId: TestDataFactory.generateStudentId(),
      date: TestDataFactory.generateSchoolDate(),
      schoolYear: TestDataFactory.getCurrentSchoolYear(),
      attendancePattern: 'random' as const
    };
    
    const data = { ...defaults, ...overrides };
    const periodAttendance = TestDataFactory.generatePeriodAttendance(data.attendancePattern);
    
    return new AttendanceRecord(
      new StudentId(data.studentId),
      data.date,
      data.schoolYear,
      periodAttendance
    );
  }

  /**
   * Generate period attendance based on pattern
   */
  static generatePeriodAttendance(pattern: 'perfect' | 'partial' | 'absent' | 'tardy' | 'random'): PeriodAttendance[] {
    const periods = Array.from({ length: 7 }, (_, i) => i + 1);
    
    switch (pattern) {
      case 'perfect':
        return periods.map(p => ({ period: p, status: AttendanceStatus.PRESENT }));
      
      case 'absent':
        return periods.map(p => ({ period: p, status: AttendanceStatus.ABSENT }));
      
      case 'tardy':
        return periods.map(p => ({ 
          period: p, 
          status: p <= 2 ? AttendanceStatus.TARDY : AttendanceStatus.PRESENT 
        }));
      
      case 'partial':
        // Absent for periods 1-3, present for 4-7 (common pattern for late arrival)
        return periods.map(p => ({ 
          period: p, 
          status: p <= 3 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT 
        }));
      
      case 'random':
      default:
        return periods.map(p => ({
          period: p,
          status: TestDataFactory.randomAttendanceStatus()
        }));
    }
  }

  /**
   * Create multiple attendance records for a student across a date range
   */
  static createAttendanceHistory(
    studentId: string, 
    startDate: Date, 
    endDate: Date,
    attendanceRate: number = 0.85 // 85% attendance rate
  ): AttendanceRecord[] {
    const records: AttendanceRecord[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Skip weekends
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const isPresent = Math.random() < attendanceRate;
        const pattern = isPresent ? 'perfect' : 
                      Math.random() < 0.1 ? 'tardy' : 
                      Math.random() < 0.3 ? 'partial' : 'absent';
        
        records.push(TestDataFactory.createAttendanceRecord({
          studentId,
          date: new Date(currentDate),
          attendancePattern: pattern
        }));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return records;
  }

  /**
   * Create intervention record
   */
  static createIntervention(overrides: Partial<{
    studentId: string;
    type: InterventionType;
    status: InterventionStatus;
    description: string;
    assignedStaff: string;
    dueDate: Date;
  }> = {}): Intervention {
    const defaults = {
      studentId: TestDataFactory.generateStudentId(),
      type: TestDataFactory.randomInterventionType(),
      status: InterventionStatus.ACTIVE,
      description: TestDataFactory.generateInterventionDescription(),
      assignedStaff: TestDataFactory.generateStaffName(),
      dueDate: TestDataFactory.generateFutureDate()
    };
    
    const data = { ...defaults, ...overrides };
    
    return new Intervention(
      new StudentId(data.studentId),
      data.type,
      data.description,
      data.assignedStaff,
      data.dueDate
    );
  }

  /**
   * Create teacher with realistic assignment data
   */
  static createTeacher(overrides: Partial<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    subjects: string[];
    maxStudents: number;
  }> = {}): Teacher {
    const defaults = {
      id: TestDataFactory.generateTeacherId(),
      firstName: TestDataFactory.generateFirstName(),
      lastName: TestDataFactory.generateLastName(),
      email: TestDataFactory.generateStaffEmail(),
      department: TestDataFactory.randomDepartment(),
      subjects: TestDataFactory.generateSubjects(),
      maxStudents: 150 // 20:1 ratio * 7 periods = ~140-150 students
    };
    
    const data = { ...defaults, ...overrides };
    
    return new Teacher(
      data.id,
      data.firstName,
      data.lastName,
      data.email,
      data.department,
      data.subjects,
      data.maxStudents
    );
  }

  /**
   * Generate i-Ready diagnostic score data
   */
  static createIReadyScore(overrides: Partial<{
    studentId: string;
    subject: 'ELA' | 'Math';
    testPeriod: 'BOY' | 'MOY' | 'EOY'; // Beginning/Middle/End of Year
    scale_score: number;
    overall_relative_placement: string;
    annual_typical_growth_measure: number;
    percent_progress_to_annual_typical_growth: number;
    lexile_measure?: number; // ELA only
    quantile_measure?: number; // Math only
    school_year: string;
  }> = {}): any {
    const subject = overrides.subject || (Math.random() < 0.5 ? 'ELA' : 'Math');
    const testPeriod = overrides.testPeriod || TestDataFactory.randomTestPeriod();
    
    const baseScore = {
      studentId: overrides.studentId || TestDataFactory.generateStudentId(),
      subject,
      testPeriod,
      scale_score: overrides.scale_score || TestDataFactory.generateScaleScore(subject, testPeriod),
      overall_relative_placement: overrides.overall_relative_placement || TestDataFactory.generatePlacement(),
      annual_typical_growth_measure: overrides.annual_typical_growth_measure || TestDataFactory.generateGrowthMeasure(),
      percent_progress_to_annual_typical_growth: overrides.percent_progress_to_annual_typical_growth || TestDataFactory.generateProgressPercent(),
      school_year: overrides.school_year || TestDataFactory.getCurrentSchoolYear(),
      test_date: TestDataFactory.generateTestDate(testPeriod),
    };
    
    // Add subject-specific measures
    if (subject === 'ELA') {
      return {
        ...baseScore,
        lexile_measure: overrides.lexile_measure || TestDataFactory.generateLexileMeasure()
      };
    } else {
      return {
        ...baseScore,
        quantile_measure: overrides.quantile_measure || TestDataFactory.generateQuantileMeasure()
      };
    }
  }

  /**
   * Generate multi-year i-Ready data for a student
   */
  static createIReadyHistory(studentId: string, yearsBack: number = 3): any[] {
    const scores: any[] = [];
    const currentYear = new Date().getFullYear();
    
    for (let yearOffset = 0; yearOffset < yearsBack; yearOffset++) {
      const schoolYear = `${currentYear - yearOffset - 1}-${currentYear - yearOffset}`;
      const testPeriods: Array<'BOY' | 'MOY' | 'EOY'> = ['BOY', 'MOY', 'EOY'];
      
      // ELA scores for all test periods
      testPeriods.forEach(period => {
        scores.push(TestDataFactory.createIReadyScore({
          studentId,
          subject: 'ELA',
          testPeriod: period,
          school_year: schoolYear
        }));
        
        scores.push(TestDataFactory.createIReadyScore({
          studentId,
          subject: 'Math',
          testPeriod: period,
          school_year: schoolYear
        }));
      });
    }
    
    return scores;
  }

  // Private helper methods for generating realistic data
  
  private static generateStudentId(): string {
    return fc.sample(fc.integer({ min: 100000, max: 999999 }), 1)[0].toString();
  }

  private static generateTeacherId(): string {
    return `T${fc.sample(fc.integer({ min: 1000, max: 9999 }), 1)[0]}`;
  }

  private static generateFirstName(): string {
    const names = [
      'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
      'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
      'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Abigail', 'Michael',
      'Emily', 'Daniel', 'Elizabeth', 'Jacob', 'Sofia', 'Logan', 'Avery', 'Jackson'
    ];
    return fc.sample(fc.constantFrom(...names), 1)[0];
  }

  private static generateLastName(): string {
    const names = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
      'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
      'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
      'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
      'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King'
    ];
    return fc.sample(fc.constantFrom(...names), 1)[0];
  }

  private static generateGradeLevel(): number {
    return fc.sample(fc.constantFrom(6, 7, 8), 1)[0];
  }

  private static generateSchoolEmail(): string {
    const firstName = TestDataFactory.generateFirstName().toLowerCase();
    const lastName = TestDataFactory.generateLastName().toLowerCase();
    const studentId = TestDataFactory.generateStudentId();
    return `${firstName}.${lastName}.${studentId}@student.romoland.k12.ca.us`;
  }

  private static generateStaffEmail(): string {
    const firstName = TestDataFactory.generateFirstName().toLowerCase();
    const lastName = TestDataFactory.generateLastName().toLowerCase();
    return `${firstName}.${lastName}@romoland.k12.ca.us`;
  }

  private static generateSchoolDate(): Date {
    // Generate date within current school year (Aug 15 - Jun 12)
    const currentYear = new Date().getFullYear();
    const schoolStart = new Date(currentYear, 7, 15); // Aug 15
    const schoolEnd = new Date(currentYear + 1, 5, 12); // Jun 12
    
    return fc.sample(fc.date({ min: schoolStart, max: schoolEnd }), 1)[0];
  }

  private static getCurrentSchoolYear(): string {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    // If before August, we're in the previous school year
    const schoolYear = currentDate.getMonth() < 7 ? year - 1 : year;
    return `${schoolYear}-${schoolYear + 1}`;
  }

  private static randomAttendanceStatus(): AttendanceStatus {
    // Weighted towards present (85% present, 10% tardy, 5% absent)
    const rand = Math.random();
    if (rand < 0.85) return AttendanceStatus.PRESENT;
    if (rand < 0.95) return AttendanceStatus.TARDY;
    return AttendanceStatus.ABSENT;
  }

  private static randomInterventionType(): InterventionType {
    return fc.sample(fc.constantFrom(
      InterventionType.PARENT_CONTACT,
      InterventionType.COUNSELOR_REFERRAL,
      InterventionType.ATTENDANCE_CONTRACT,
      InterventionType.SART_REFERRAL,
      InterventionType.SARB_REFERRAL,
      InterventionType.OTHER
    ), 1)[0];
  }

  private static generateInterventionDescription(): string {
    const descriptions = [
      'Parent contact made regarding attendance concerns and patterns',
      'Counselor referral to address attendance barriers and support needs',
      'Attendance contract established with specific goals and timeline',
      'SART referral for team-based attendance intervention planning',
      'SARB referral due to continued attendance issues after interventions',
      'Other intervention strategy implemented based on individual needs'
    ];
    return fc.sample(fc.constantFrom(...descriptions), 1)[0];
  }

  private static generateStaffName(): string {
    return `${TestDataFactory.generateFirstName()} ${TestDataFactory.generateLastName()}`;
  }

  private static generateFutureDate(): Date {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + fc.sample(fc.integer({ min: 7, max: 30 }), 1)[0]);
    return futureDate;
  }

  private static randomDepartment(): string {
    const departments = [
      'English Language Arts',
      'Mathematics', 
      'Science',
      'Social Studies',
      'Physical Education',
      'Art',
      'Music',
      'Technology',
      'Special Education'
    ];
    return fc.sample(fc.constantFrom(...departments), 1)[0];
  }

  private static generateSubjects(): string[] {
    const subjectsByDepartment: Record<string, string[]> = {
      'English Language Arts': ['English 6', 'English 7', 'English 8', 'Reading'],
      'Mathematics': ['Math 6', 'Math 7', 'Math 8', 'Algebra 1', 'Geometry'],
      'Science': ['Science 6', 'Life Science', 'Physical Science', 'Earth Science'],
      'Social Studies': ['World History', 'US History', 'Geography', 'Civics'],
      'Physical Education': ['PE 6', 'PE 7', 'PE 8', 'Health'],
      'Art': ['Art 6', 'Art 7', 'Art 8', 'Digital Art'],
      'Music': ['Band', 'Choir', 'Orchestra', 'Music Theory'],
      'Technology': ['Computer Science', 'Digital Literacy', 'Robotics'],
      'Special Education': ['Resource Specialist', 'Special Day Class']
    };
    
    const department = TestDataFactory.randomDepartment();
    const subjects = subjectsByDepartment[department] || ['General Education'];
    
    // Return 1-3 subjects
    const count = fc.sample(fc.integer({ min: 1, max: 3 }), 1)[0];
    return fc.sample(fc.subarray(subjects, { minLength: count, maxLength: count }), 1)[0];
  }

  private static randomTestPeriod(): 'BOY' | 'MOY' | 'EOY' {
    return fc.sample(fc.constantFrom('BOY', 'MOY', 'EOY'), 1)[0];
  }

  private static generateScaleScore(subject: 'ELA' | 'Math', testPeriod: 'BOY' | 'MOY' | 'EOY'): number {
    // i-Ready scale scores typically range from 300-800+
    const baseRanges = {
      ELA: { min: 350, max: 750 },
      Math: { min: 320, max: 780 }
    };
    
    const range = baseRanges[subject];
    let score = fc.sample(fc.integer({ min: range.min, max: range.max }), 1)[0];
    
    // Slight growth throughout the year
    if (testPeriod === 'MOY') score += fc.sample(fc.integer({ min: 0, max: 30 }), 1)[0];
    if (testPeriod === 'EOY') score += fc.sample(fc.integer({ min: 0, max: 50 }), 1)[0];
    
    return Math.min(score, range.max);
  }

  private static generatePlacement(): string {
    const placements = [
      'Three or More Grade Levels Below',
      'Two Grade Levels Below', 
      'One Grade Level Below',
      'Early On Grade Level',
      'Mid or Above Grade Level'
    ];
    
    // Weight towards grade level appropriate
    const weights = [0.05, 0.15, 0.25, 0.3, 0.25];
    const rand = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) {
        return placements[i];
      }
    }
    
    return placements[4]; // Default to highest
  }

  private static generateGrowthMeasure(): number {
    return fc.sample(fc.integer({ min: 15, max: 85 }), 1)[0];
  }

  private static generateProgressPercent(): number {
    return fc.sample(fc.integer({ min: 0, max: 150 }), 1)[0];
  }

  private static generateLexileMeasure(): number {
    // Lexile measures for middle school typically range from 200L to 1200L+
    return fc.sample(fc.integer({ min: 200, max: 1200 }), 1)[0];
  }

  private static generateQuantileMeasure(): number {
    // Quantile measures range from 0.0 to above 1.0
    return Math.round(fc.sample(fc.float({ min: 0.1, max: 1.4 }), 1)[0] * 100) / 100;
  }

  private static generateTestDate(testPeriod: 'BOY' | 'MOY' | 'EOY'): Date {
    const currentYear = new Date().getFullYear();
    
    switch (testPeriod) {
      case 'BOY':
        // September testing window
        return new Date(currentYear, 8, fc.sample(fc.integer({ min: 1, max: 30 }), 1)[0]);
      case 'MOY':
        // January testing window  
        return new Date(currentYear + 1, 0, fc.sample(fc.integer({ min: 1, max: 31 }), 1)[0]);
      case 'EOY':
        // May testing window
        return new Date(currentYear + 1, 4, fc.sample(fc.integer({ min: 1, max: 31 }), 1)[0]);
    }
  }
}