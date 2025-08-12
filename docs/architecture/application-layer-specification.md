# Application Layer Specification - AP Tool V1

## Use Cases

### 1. Identify Chronic Absentees Use Case
```typescript
export interface IdentifyChronicAbsenteesUseCase {
  execute(request: IdentifyChronicAbsenteesRequest): Promise<IdentifyChronicAbsenteesResponse>;
}

export class IdentifyChronicAbsenteesRequest {
  constructor(
    public readonly schoolId: SchoolId,
    public readonly schoolYear: SchoolYear,
    public readonly gradeLevel?: Grade,
    public readonly minimumAbsenceThreshold: number = 10 // 10% chronic absence threshold
  ) {}
}

export class IdentifyChronicAbsenteesResponse {
  constructor(
    public readonly chronicallyAbsentStudents: ChronicallyAbsentStudent[],
    public readonly totalStudentsEvaluated: number,
    public readonly complianceMetrics: ComplianceMetrics
  ) {}
}

// Implementation
export class IdentifyChronicAbsenteesUseCaseImpl implements IdentifyChronicAbsenteesUseCase {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly attendanceRepository: AttendanceRecordRepository,
    private readonly rankingService: StudentRankingService,
    private readonly complianceService: ComplianceCalculationService
  ) {}

  async execute(request: IdentifyChronicAbsenteesRequest): Promise<IdentifyChronicAbsenteesResponse> {
    // Retrieve students for evaluation
    const students = await this.studentRepository.findBySchoolAndYear(
      request.schoolId,
      request.schoolYear,
      request.gradeLevel
    );

    // Calculate attendance percentages
    const studentsWithAttendance = await Promise.all(
      students.map(async (student) => {
        const attendanceRecords = await this.attendanceRepository.findByStudentAndYear(
          student.id,
          request.schoolYear
        );
        
        const attendancePercentage = this.calculateAttendancePercentage(attendanceRecords);
        return { student, attendancePercentage, attendanceRecords };
      })
    );

    // Identify chronically absent students
    const chronicallyAbsentStudents = studentsWithAttendance
      .filter(({ attendancePercentage }) => 
        attendancePercentage.value < (100 - request.minimumAbsenceThreshold)
      )
      .map(({ student, attendancePercentage, attendanceRecords }) => 
        new ChronicallyAbsentStudent(student, attendancePercentage, attendanceRecords)
      );

    // Rank by priority
    const rankedStudents = this.rankingService.rankStudentsByPriority(
      chronicallyAbsentStudents.map(cas => cas.student)
    );

    // Calculate compliance metrics
    const complianceMetrics = this.complianceService.calculateSchoolMetrics(
      students.length,
      chronicallyAbsentStudents.length
    );

    return new IdentifyChronicAbsenteesResponse(
      chronicallyAbsentStudents,
      students.length,
      complianceMetrics
    );
  }
}
```

### 2. Assign Students To Teacher Use Case
```typescript
export interface AssignStudentsToTeacherUseCase {
  execute(request: AssignStudentsToTeacherRequest): Promise<AssignStudentsToTeacherResponse>;
}

export class AssignStudentsToTeacherRequest {
  constructor(
    public readonly teacherId: TeacherId,
    public readonly studentIds: StudentId[],
    public readonly recoveryProgram: RecoveryProgram,
    public readonly assignedBy: UserId
  ) {}
}

export class AssignStudentsToTeacherResponse {
  constructor(
    public readonly successfulAssignments: StudentAssignment[],
    public readonly failedAssignments: AssignmentFailure[],
    public readonly teacherCapacityInfo: TeacherCapacityInfo
  ) {}
}

// Implementation
export class AssignStudentsToTeacherUseCaseImpl implements AssignStudentsToTeacherUseCase {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly teacherRepository: TeacherRepository,
    private readonly assignmentRepository: StudentAssignmentRepository,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(request: AssignStudentsToTeacherRequest): Promise<AssignStudentsToTeacherResponse> {
    // Validate teacher exists and capacity
    const teacher = await this.teacherRepository.findById(request.teacherId);
    if (!teacher) {
      throw new TeacherNotFoundError(request.teacherId);
    }

    // Check current capacity (20:1 ratio enforcement)
    const currentAssignments = await this.assignmentRepository.findByTeacher(request.teacherId);
    const availableCapacity = 20 - currentAssignments.length;

    if (request.studentIds.length > availableCapacity) {
      throw new TeacherCapacityExceededError(
        request.teacherId,
        availableCapacity,
        request.studentIds.length
      );
    }

    // Retrieve and validate students
    const students = await this.studentRepository.findByIds(request.studentIds);
    const successfulAssignments: StudentAssignment[] = [];
    const failedAssignments: AssignmentFailure[] = [];

    for (const student of students) {
      try {
        // Validate student eligibility
        if (!student.isEligibleForAttendanceRecovery()) {
          failedAssignments.push(new AssignmentFailure(
            student.id,
            'Student not eligible for attendance recovery'
          ));
          continue;
        }

        // Create assignment
        const assignment = teacher.assignStudent(student, request.recoveryProgram);
        assignment.recordAssignedBy(request.assignedBy);
        
        await this.assignmentRepository.save(assignment);
        successfulAssignments.push(assignment);

        // Publish domain event
        await this.eventPublisher.publish(
          new StudentAssignedToRecoveryProgramEvent(
            student.id,
            request.teacherId,
            request.recoveryProgram.id,
            new Date()
          )
        );
      } catch (error) {
        failedAssignments.push(new AssignmentFailure(
          student.id,
          error.message
        ));
      }
    }

    // Update teacher capacity info
    const updatedAssignments = await this.assignmentRepository.findByTeacher(request.teacherId);
    const teacherCapacityInfo = new TeacherCapacityInfo(
      request.teacherId,
      updatedAssignments.length,
      20,
      20 - updatedAssignments.length
    );

    return new AssignStudentsToTeacherResponse(
      successfulAssignments,
      failedAssignments,
      teacherCapacityInfo
    );
  }
}
```

### 3. Generate Compliance Report Use Case
```typescript
export interface GenerateComplianceReportUseCase {
  execute(request: GenerateComplianceReportRequest): Promise<GenerateComplianceReportResponse>;
}

export class GenerateComplianceReportRequest {
  constructor(
    public readonly schoolId: SchoolId,
    public readonly reportingPeriod: ReportingPeriod,
    public readonly reportType: ComplianceReportType, // P1, P2, Annual
    public readonly includeProjections: boolean = true
  ) {}
}

export class GenerateComplianceReportResponse {
  constructor(
    public readonly report: ComplianceReport,
    public readonly generatedAt: Date,
    public readonly reportId: ReportId
  ) {}
}

// Implementation
export class GenerateComplianceReportUseCaseImpl implements GenerateComplianceReportUseCase {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly attendanceRepository: AttendanceRecordRepository,
    private readonly interventionRepository: InterventionRepository,
    private readonly complianceService: ComplianceCalculationService,
    private readonly reportRepository: ComplianceReportRepository
  ) {}

  async execute(request: GenerateComplianceReportRequest): Promise<GenerateComplianceReportResponse> {
    // Gather all required data
    const students = await this.studentRepository.findBySchoolAndPeriod(
      request.schoolId,
      request.reportingPeriod
    );

    const attendanceData = await this.attendanceRepository.findBySchoolAndPeriod(
      request.schoolId,
      request.reportingPeriod
    );

    const interventions = await this.interventionRepository.findBySchoolAndPeriod(
      request.schoolId,
      request.reportingPeriod
    );

    // Calculate compliance metrics
    const complianceMetrics = this.complianceService.calculatePeriodMetrics(
      students,
      attendanceData,
      interventions,
      request.reportingPeriod
    );

    // Generate projections if requested
    let adaProjections: ADAProjection[] = [];
    if (request.includeProjections) {
      adaProjections = this.complianceService.calculateADAProjections(
        students,
        attendanceData,
        request.reportingPeriod
      );
    }

    // Create compliance report
    const report = new ComplianceReport({
      schoolId: request.schoolId,
      reportingPeriod: request.reportingPeriod,
      reportType: request.reportType,
      complianceMetrics,
      adaProjections,
      studentBreakdown: this.generateStudentBreakdown(students, attendanceData),
      interventionSummary: this.generateInterventionSummary(interventions),
      recommendedActions: this.generateRecommendations(complianceMetrics)
    });

    // Save report
    const reportId = await this.reportRepository.save(report);
    
    return new GenerateComplianceReportResponse(
      report,
      new Date(),
      reportId
    );
  }
}
```

## Service Orchestration Patterns

### Application Services
```typescript
export class AttendanceRecoveryService {
  constructor(
    private readonly identifyChronicAbsenteesUseCase: IdentifyChronicAbsenteesUseCase,
    private readonly assignStudentsUseCase: AssignStudentsToTeacherUseCase,
    private readonly generateReportUseCase: GenerateComplianceReportUseCase,
    private readonly notificationService: NotificationService
  ) {}

  async orchestrateWeeklyAttendanceReview(schoolId: SchoolId): Promise<WeeklyReviewResult> {
    // Step 1: Identify chronic absentees
    const identifyRequest = new IdentifyChronicAbsenteesRequest(
      schoolId,
      SchoolYear.current()
    );
    const identifyResponse = await this.identifyChronicAbsenteesUseCase.execute(identifyRequest);

    // Step 2: Auto-assign high-priority students to available teachers
    const autoAssignmentResults = await this.performAutoAssignments(
      identifyResponse.chronicallyAbsentStudents
    );

    // Step 3: Generate notifications for manual review
    await this.notificationService.sendChronicAbsenteeAlerts(
      identifyResponse.chronicallyAbsentStudents
    );

    // Step 4: Generate compliance report
    const reportRequest = new GenerateComplianceReportRequest(
      schoolId,
      ReportingPeriod.currentWeek(),
      ComplianceReportType.Weekly
    );
    const reportResponse = await this.generateReportUseCase.execute(reportRequest);

    return new WeeklyReviewResult({
      chronicallyAbsentStudents: identifyResponse.chronicallyAbsentStudents,
      autoAssignments: autoAssignmentResults,
      complianceReport: reportResponse.report,
      alertsSent: identifyResponse.chronicallyAbsentStudents.length
    });
  }
}
```

## Input/Output Validation

### Request Validation
```typescript
export class RequestValidator {
  static validateIdentifyChronicAbsenteesRequest(
    request: IdentifyChronicAbsenteesRequest
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (!request.schoolId) {
      errors.push(new ValidationError('schoolId', 'School ID is required'));
    }

    if (!request.schoolYear) {
      errors.push(new ValidationError('schoolYear', 'School year is required'));
    }

    if (request.minimumAbsenceThreshold < 0 || request.minimumAbsenceThreshold > 100) {
      errors.push(new ValidationError(
        'minimumAbsenceThreshold',
        'Absence threshold must be between 0 and 100'
      ));
    }

    return new ValidationResult(errors);
  }

  static validateAssignStudentsRequest(
    request: AssignStudentsToTeacherRequest
  ): ValidationResult {
    const errors: ValidationError[] = [];

    if (!request.teacherId) {
      errors.push(new ValidationError('teacherId', 'Teacher ID is required'));
    }

    if (!request.studentIds || request.studentIds.length === 0) {
      errors.push(new ValidationError('studentIds', 'At least one student ID is required'));
    }

    if (request.studentIds.length > 20) {
      errors.push(new ValidationError(
        'studentIds',
        'Cannot assign more than 20 students to a single teacher'
      ));
    }

    return new ValidationResult(errors);
  }
}
```

## Command and Query Separation

### Commands (Write Operations)
```typescript
export interface Command {
  readonly commandId: string;
  readonly timestamp: Date;
  readonly userId: UserId;
}

export class AssignStudentToTeacherCommand implements Command {
  readonly commandId: string = crypto.randomUUID();
  readonly timestamp: Date = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly teacherId: TeacherId,
    public readonly studentId: StudentId,
    public readonly recoveryProgramId: RecoveryProgramId
  ) {}
}

export class UpdateAttendanceRecordCommand implements Command {
  readonly commandId: string = crypto.randomUUID();
  readonly timestamp: Date = new Date();

  constructor(
    public readonly userId: UserId,
    public readonly attendanceRecordId: AttendanceRecordId,
    public readonly newStatus: AttendanceStatus,
    public readonly correctionReason: string
  ) {}
}
```

### Queries (Read Operations)
```typescript
export interface Query {
  readonly queryId: string;
  readonly timestamp: Date;
}

export class GetChronicallyAbsentStudentsQuery implements Query {
  readonly queryId: string = crypto.randomUUID();
  readonly timestamp: Date = new Date();

  constructor(
    public readonly schoolId: SchoolId,
    public readonly gradeLevel?: Grade,
    public readonly sortBy?: SortCriteria
  ) {}
}

export class GetTeacherCapacityQuery implements Query {
  readonly queryId: string = crypto.randomUUID();
  readonly timestamp: Date = new Date();

  constructor(
    public readonly teacherId: TeacherId
  ) {}
}
```