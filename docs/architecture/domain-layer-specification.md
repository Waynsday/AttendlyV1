# Domain Layer Specification - AP Tool V1

## Core Entities

### Student Entity Extensions
```typescript
// Enhanced Student entity for AP Romoland requirements
export class Student {
  // Existing properties...
  private _specialEducationStatus: SpecialEducationStatus;
  private _section504Status: Section504Status;
  private _fosterYouthStatus: boolean;
  private _elpacLevel: ELPACLevel;
  private _attendancePercentage: AttendancePercentage;
  private _academicRisk: AcademicRiskLevel;
  
  // Core methods for compliance tracking
  calculateChronicAbsenteeStatus(schoolYear: SchoolYear): ChronicAbsenteeStatus;
  isEligibleForAttendanceRecovery(): boolean;
  getInterventionTier(): InterventionTier;
}
```

### AttendanceRecord Entity
```typescript
export class AttendanceRecord {
  private _id: AttendanceRecordId;
  private _studentId: StudentId;
  private _schoolId: SchoolId;
  private _attendanceDate: Date;
  private _periodNumber: number; // 1-7 for middle school
  private _status: AttendanceStatus; // Present, Absent, Tardy, Excused
  private _minutes: number; // Total minutes for period
  private _attendanceCode: string;
  private _isFullDayAbsence: boolean;
  private _correctionHistory: AttendanceCorrection[];
  
  // Business logic methods
  markAsAbsent(reason: AbsenceReason): void;
  applyCorrection(correction: AttendanceCorrection, auditor: UserId): void;
  calculateFullDayStatus(allPeriodsForDay: AttendanceRecord[]): boolean;
}
```

### Intervention Entity
```typescript
export class Intervention {
  private _id: InterventionId;
  private _studentId: StudentId;
  private _type: InterventionType; // Letter, Conference, SARB, RecoveryProgram
  private _tier: InterventionTier; // Tier1, Tier2, Tier3
  private _dateInitiated: Date;
  private _dateCompleted?: Date;
  private _status: InterventionStatus;
  private _assignedStaff: StaffId;
  private _outcome: InterventionOutcome;
  private _parentResponse: ParentResponse;
  
  // Compliance tracking
  calculateComplianceScore(): ComplianceScore;
  escalateToNextTier(): Intervention;
  scheduleFollowUp(days: number): FollowUpTask;
}
```

### Teacher Entity
```typescript
export class Teacher {
  private _id: TeacherId;
  private _staffId: string;
  private _firstName: string;
  private _lastName: string;
  private _isCredentialed: boolean;
  private _subjects: Subject[];
  private _maxStudentLoad: number; // 20:1 ratio requirement
  private _currentAssignments: StudentAssignment[];
  
  // Assignment logic
  canAcceptAdditionalStudent(): boolean;
  assignStudent(student: Student, program: RecoveryProgram): StudentAssignment;
  getStudentRatio(): StudentTeacherRatio;
}
```

## Value Objects

### AttendancePercentage
```typescript
export class AttendancePercentage {
  private readonly _value: number;
  
  constructor(presentDays: number, enrolledDays: number) {
    if (enrolledDays === 0) throw new Error('Enrolled days cannot be zero');
    this._value = (presentDays / enrolledDays) * 100;
  }
  
  get value(): number { return this._value; }
  
  isChronicallyAbsent(): boolean {
    return this._value < 90; // 10% threshold
  }
  
  getTier(): InterventionTier {
    if (this._value >= 95) return InterventionTier.None;
    if (this._value >= 90) return InterventionTier.Tier1;
    if (this._value >= 85) return InterventionTier.Tier2;
    return InterventionTier.Tier3;
  }
}
```

### StudentId
```typescript
export class StudentId {
  private readonly _value: string;
  
  constructor(value: string) {
    this.validate(value);
    this._value = value;
  }
  
  private validate(value: string): void {
    if (!value || value.length < 5 || value.length > 10) {
      throw new Error('Student ID must be 5-10 characters');
    }
    if (!/^\d+$/.test(value)) {
      throw new Error('Student ID must contain only numbers');
    }
  }
  
  get value(): string { return this._value; }
  equals(other: StudentId): boolean { return this._value === other._value; }
}
```

### Grade
```typescript
export class Grade {
  private readonly _level: number;
  
  constructor(level: number) {
    if (level < 6 || level > 8) {
      throw new Error('Grade must be 6, 7, or 8 for middle school');
    }
    this._level = level;
  }
  
  get level(): number { return this._level; }
  get name(): string { return `${this._level}th Grade`; }
  
  isEligibleForRecovery(): boolean {
    return true; // All middle school grades eligible
  }
}
```

## Domain Services

### StudentRankingService
```typescript
export class StudentRankingService {
  calculateRiskScore(
    attendancePercentage: AttendancePercentage,
    academicPerformance: AcademicPerformance,
    interventionHistory: Intervention[]
  ): RiskScore {
    // Algorithm combining attendance, academic, and intervention factors
    const attendanceWeight = 0.5;
    const academicWeight = 0.3;
    const interventionWeight = 0.2;
    
    const attendanceScore = this.calculateAttendanceRiskScore(attendancePercentage);
    const academicScore = this.calculateAcademicRiskScore(academicPerformance);
    const interventionScore = this.calculateInterventionRiskScore(interventionHistory);
    
    return new RiskScore(
      (attendanceScore * attendanceWeight) +
      (academicScore * academicWeight) +
      (interventionScore * interventionWeight)
    );
  }
  
  rankStudentsByPriority(students: Student[]): RankedStudent[] {
    return students
      .map(student => ({
        student,
        riskScore: this.calculateRiskScore(student.attendancePercentage, student.academicPerformance, student.interventions)
      }))
      .sort((a, b) => b.riskScore.value - a.riskScore.value);
  }
}
```

### ComplianceCalculationService
```typescript
export class ComplianceCalculationService {
  calculateADARecoveryPotential(
    student: Student,
    recoveryHours: number
  ): ADARecoveryProjection {
    const maxRecoverableDays = Math.min(10, Math.floor(recoveryHours / 4));
    const currentAbsentDays = student.getAbsentDays();
    const potentialRecoveredDays = Math.min(maxRecoverableDays, currentAbsentDays);
    
    return new ADARecoveryProjection({
      studentId: student.id,
      currentAbsentDays,
      maxRecoverableDays,
      potentialRecoveredDays,
      adaFundingImpact: potentialRecoveredDays * this.getPerDayFunding()
    });
  }
  
  validateComplianceRequirements(intervention: Intervention): ComplianceResult {
    const results: ComplianceCheck[] = [];
    
    // Check SB 153/176 requirements
    results.push(this.checkAttendanceRecoveryEligibility(intervention));
    results.push(this.checkDocumentationRequirements(intervention));
    results.push(this.checkTimelineCompliance(intervention));
    
    return new ComplianceResult(results);
  }
}
```

## Security and Compliance Considerations

### FERPA Compliance
- All student data access requires proper authorization
- Audit logging for all data access and modifications
- Data encryption at rest and in transit
- Role-based access control (RBAC)

### California SB 153/176 Compliance
- Attendance recovery session tracking (4 hours = 1 day)
- Maximum 10 days recovery per session
- Standards-based instruction requirement
- Proper documentation and audit trails

### Multi-Year Data Tracking
- Support for Current_Year, Current_Year-1, Current_Year-2
- Historical trend analysis
- Year-over-year comparison capabilities