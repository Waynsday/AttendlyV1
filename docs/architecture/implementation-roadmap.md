# Implementation Roadmap - AP Tool V1 Clean Hexagonal Architecture

## Phase 1: Foundation Layer (Weeks 1-4)

### Core Domain Implementation
```typescript
// Domain Entity Interfaces
export interface Student {
  readonly id: StudentId;
  readonly firstName: string;
  readonly lastName: string;
  readonly gradeLevel: Grade;
  readonly email: string;
  readonly isActive: boolean;
  readonly specialEducationStatus: SpecialEducationStatus;
  readonly section504Status: Section504Status;
  readonly fosterYouthStatus: boolean;
  readonly elpacLevel: ELPACLevel;
  
  getFullName(): string;
  updateEmail(newEmail: string): void;
  calculateAttendancePercentage(schoolYear: SchoolYear): AttendancePercentage;
  isEligibleForAttendanceRecovery(): boolean;
  getInterventionTier(): InterventionTier;
}

// Value Object Interfaces
export interface AttendancePercentage {
  readonly value: number;
  isChronicallyAbsent(): boolean;
  getTier(): InterventionTier;
  compare(other: AttendancePercentage): number;
}

export interface StudentId {
  readonly value: string;
  equals(other: StudentId): boolean;
  toString(): string;
}

// Repository Interfaces (Ports)
export interface StudentRepository {
  findById(id: StudentId): Promise<Student | null>;
  findBySchoolAndYear(schoolId: SchoolId, schoolYear: SchoolYear, grade?: Grade): Promise<Student[]>;
  findChronicallyAbsent(schoolId: SchoolId, threshold: number): Promise<Student[]>;
  save(student: Student): Promise<void>;
  delete(id: StudentId): Promise<void>;
}

export interface AttendanceRecordRepository {
  findByStudentAndYear(studentId: StudentId, schoolYear: SchoolYear): Promise<AttendanceRecord[]>;
  findByDateRange(studentId: StudentId, dateRange: DateRange): Promise<AttendanceRecord[]>;
  findFullDayAbsences(studentId: StudentId, dateRange: DateRange): Promise<AttendanceRecord[]>;
  save(record: AttendanceRecord): Promise<void>;
  saveBatch(records: AttendanceRecord[]): Promise<BatchSaveResult>;
  countAbsencesByStudent(studentId: StudentId, schoolYear: SchoolYear): Promise<number>;
}
```

### Basic Use Cases
```typescript
// Application Layer Use Case Interfaces
export interface IdentifyChronicAbsenteesUseCase {
  execute(request: IdentifyChronicAbsenteesRequest): Promise<IdentifyChronicAbsenteesResponse>;
}

export interface AssignStudentsToTeacherUseCase {
  execute(request: AssignStudentsToTeacherRequest): Promise<AssignStudentsToTeacherResponse>;
}

// Request/Response DTOs
export class IdentifyChronicAbsenteesRequest {
  constructor(
    public readonly schoolId: SchoolId,
    public readonly schoolYear: SchoolYear,
    public readonly gradeLevel?: Grade,
    public readonly minimumAbsenceThreshold: number = 10
  ) {}
}

export class IdentifyChronicAbsenteesResponse {
  constructor(
    public readonly chronicallyAbsentStudents: ChronicallyAbsentStudent[],
    public readonly totalStudentsEvaluated: number,
    public readonly complianceMetrics: ComplianceMetrics,
    public readonly generatedAt: Date
  ) {}
}
```

### Infrastructure Adapters
```typescript
// Supabase Repository Implementation
export class SupabaseStudentRepository implements StudentRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly auditLogger: AuditLogger
  ) {}

  async findById(id: StudentId): Promise<Student | null> {
    const { data, error } = await this.supabase
      .from('students')
      .select(`
        *,
        special_education_status,
        section_504_status,
        foster_youth_status,
        elpac_level
      `)
      .eq('id', id.value)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new RepositoryError(`Failed to find student: ${error.message}`);
    }

    return data ? this.mapToEntity(data) : null;
  }

  // Additional repository methods...
}

// Aeries API Port Interface
export interface AeriesApiPort {
  getStudentAttendance(studentId: StudentId, schoolYear: SchoolYear): Promise<AeriesAttendanceData[]>;
  getStudentsBySchool(schoolCode: string, schoolYear: SchoolYear): Promise<AeriesStudentData[]>;
  getAttendanceCorrections(schoolCode: string, dateRange: DateRange): Promise<AeriesAttendanceCorrectionData[]>;
}
```

## Phase 2: Core Business Logic (Weeks 5-8)

### Advanced Use Cases
```typescript
export interface GenerateComplianceReportUseCase {
  execute(request: GenerateComplianceReportRequest): Promise<GenerateComplianceReportResponse>;
}

export interface TrackInterventionProgressUseCase {
  execute(request: TrackInterventionProgressRequest): Promise<TrackInterventionProgressResponse>;
}

export interface CalculateADARecoveryProjectionUseCase {
  execute(request: ADARecoveryProjectionRequest): Promise<ADARecoveryProjectionResponse>;
}

// Intervention Management
export class InterventionManagementService {
  constructor(
    private readonly interventionRepository: InterventionRepository,
    private readonly studentRepository: StudentRepository,
    private readonly complianceService: ComplianceCalculationService,
    private readonly notificationService: NotificationService
  ) {}

  async createIntervention(
    studentId: StudentId,
    interventionType: InterventionType,
    assignedStaff: StaffId,
    reason: string
  ): Promise<Intervention> {
    const student = await this.studentRepository.findById(studentId);
    if (!student) {
      throw new StudentNotFoundError(studentId);
    }

    const intervention = new Intervention(
      new InterventionId(crypto.randomUUID()),
      studentId,
      interventionType,
      this.determineInterventionTier(student),
      new Date(),
      InterventionStatus.INITIATED,
      assignedStaff,
      reason
    );

    await this.interventionRepository.save(intervention);
    
    // Send notification to assigned staff
    await this.notificationService.sendInterventionAssignment(
      assignedStaff,
      intervention
    );

    return intervention;
  }

  async escalateIntervention(interventionId: InterventionId): Promise<Intervention> {
    const intervention = await this.interventionRepository.findById(interventionId);
    if (!intervention) {
      throw new InterventionNotFoundError(interventionId);
    }

    const escalatedIntervention = intervention.escalateToNextTier();
    await this.interventionRepository.save(escalatedIntervention);

    return escalatedIntervention;
  }
}
```

### Period-Based Attendance Logic
```typescript
export class MiddleSchoolAttendanceService {
  private readonly PERIODS_PER_DAY = 7;
  private readonly MINUTES_PER_PERIOD = 50;

  async calculateFullDayAbsence(
    studentId: StudentId,
    attendanceDate: Date
  ): Promise<boolean> {
    const dayRecords = await this.attendanceRepository.findByStudentAndDate(
      studentId,
      attendanceDate
    );

    if (dayRecords.length === 0) {
      return false; // No records means present (default)
    }

    // Count absent periods
    const absentPeriods = dayRecords.filter(
      record => record.status === AttendanceStatus.Absent
    ).length;

    // Full day absence = all 7 periods absent
    return absentPeriods === this.PERIODS_PER_DAY;
  }

  async calculateAttendancePercentage(
    studentId: StudentId,
    schoolYear: SchoolYear
  ): Promise<AttendancePercentage> {
    const allRecords = await this.attendanceRepository.findByStudentAndYear(
      studentId,
      schoolYear
    );

    // Group by date to calculate full day absences
    const recordsByDate = this.groupRecordsByDate(allRecords);
    
    let fullDayAbsences = 0;
    let totalDays = 0;

    for (const [date, dayRecords] of recordsByDate) {
      totalDays++;
      if (await this.isFullDayAbsent(dayRecords)) {
        fullDayAbsences++;
      }
    }

    const attendancePercentage = totalDays > 0 
      ? ((totalDays - fullDayAbsences) / totalDays) * 100 
      : 100;

    return new AttendancePercentage(attendancePercentage);
  }

  private async isFullDayAbsent(dayRecords: AttendanceRecord[]): Promise<boolean> {
    const absentPeriods = dayRecords.filter(
      record => record.status === AttendanceStatus.Absent
    ).length;

    return absentPeriods === this.PERIODS_PER_DAY;
  }
}
```

## Phase 3: Integration Layer (Weeks 9-12)

### Aeries Integration
```typescript
export interface AeriesIntegrationService {
  syncDailyAttendance(schoolId: SchoolId): Promise<SyncResult>;
  syncStudentRoster(schoolId: SchoolId): Promise<SyncResult>;
  syncAttendanceCorrections(schoolId: SchoolId, dateRange: DateRange): Promise<SyncResult>;
  handleWebhookEvent(event: AeriesWebhookEvent): Promise<void>;
}

export class AeriesIntegrationServiceImpl implements AeriesIntegrationService {
  constructor(
    private readonly aeriesClient: AeriesApiClient,
    private readonly studentRepository: StudentRepository,
    private readonly attendanceRepository: AttendanceRecordRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly logger: Logger
  ) {}

  async syncDailyAttendance(schoolId: SchoolId): Promise<SyncResult> {
    const syncResult = new SyncResult();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    try {
      // Get all students for the school
      const students = await this.studentRepository.findBySchoolAndYear(
        schoolId,
        SchoolYear.current()
      );

      // Process in batches to avoid overwhelming the API
      const batches = this.createBatches(students, 50);
      
      for (const batch of batches) {
        await this.processBatch(batch, yesterday, syncResult);
      }

      syncResult.markCompleted();
      
    } catch (error) {
      syncResult.markFailed(error.message);
      this.logger.error('Daily attendance sync failed', { schoolId: schoolId.value, error });
    }

    return syncResult;
  }

  private async processBatch(
    students: Student[],
    date: Date,
    syncResult: SyncResult
  ): Promise<void> {
    const attendancePromises = students.map(async (student) => {
      try {
        const attendanceData = await this.aeriesClient.getStudentAttendance(
          student.id,
          SchoolYear.current()
        );

        const yesterdayRecords = attendanceData.filter(
          record => this.isSameDate(record.attendanceDate, date)
        );

        for (const record of yesterdayRecords) {
          const attendanceRecord = this.mapToAttendanceRecord(record);
          await this.attendanceRepository.save(attendanceRecord);
        }

        syncResult.incrementSuccessCount();
        
      } catch (error) {
        syncResult.addError(student.id.value, error.message);
      }
    });

    await Promise.allSettled(attendancePromises);
  }
}
```

### i-Ready Integration
```typescript
export interface IReadyIntegrationService {
  importDiagnosticResults(schoolYear: SchoolYear, period: AssessmentPeriod): Promise<ImportResult>;
  processCSVFile(csvContent: string): Promise<ProcessingResult>;
  validateDataIntegrity(data: IReadyDiagnosticData[]): Promise<ValidationResult>;
}

export class IReadyIntegrationServiceImpl implements IReadyIntegrationService {
  constructor(
    private readonly sftpClient: SFTPClient,
    private readonly csvProcessor: CSVProcessor,
    private readonly academicPerformanceRepository: AcademicPerformanceRepository,
    private readonly dataValidator: DataValidator
  ) {}

  async importDiagnosticResults(
    schoolYear: SchoolYear,
    period: AssessmentPeriod
  ): Promise<ImportResult> {
    const importResult = new ImportResult();
    
    try {
      // Connect to i-Ready SFTP
      await this.sftpClient.connect();
      
      // Download diagnostic files
      const files = await this.sftpClient.listFiles(`diagnostic_${schoolYear.value}`);
      const relevantFiles = files.filter(f => f.includes(period.toLowerCase()));
      
      for (const file of relevantFiles) {
        const csvContent = await this.sftpClient.downloadFile(file);
        const processingResult = await this.processCSVFile(csvContent);
        importResult.merge(processingResult);
      }
      
    } catch (error) {
      importResult.markFailed(error.message);
    } finally {
      await this.sftpClient.disconnect();
    }
    
    return importResult;
  }

  async processCSVFile(csvContent: string): Promise<ProcessingResult> {
    const processingResult = new ProcessingResult();
    
    try {
      // Parse CSV content
      const rawData = await this.csvProcessor.parse<IReadyRawData>(csvContent, {
        headers: true,
        skipEmptyLines: true
      });

      // Validate data
      const validationResult = await this.dataValidator.validate(rawData);
      if (validationResult.hasErrors()) {
        throw new ValidationError(validationResult.errors);
      }

      // Transform and save data
      for (const record of rawData) {
        try {
          const academicPerformance = this.transformToAcademicPerformance(record);
          await this.academicPerformanceRepository.save(academicPerformance);
          processingResult.incrementSuccessCount();
        } catch (error) {
          processingResult.addError(record.studentId, error.message);
        }
      }
      
    } catch (error) {
      processingResult.markFailed(error.message);
    }
    
    return processingResult;
  }
}
```

## Phase 4: Security & Compliance (Weeks 13-16)

### Security Implementation
```typescript
export interface SecurityService {
  authenticate(credentials: UserCredentials): Promise<AuthenticationResult>;
  authorize(userId: UserId, resource: Resource, action: Action): Promise<AuthorizationResult>;
  encryptSensitiveData<T>(data: T): Promise<EncryptedData<T>>;
  auditDataAccess(userId: UserId, dataType: DataType, recordId: string): Promise<void>;
}

export class SecurityServiceImpl implements SecurityService {
  constructor(
    private readonly jwtService: JWTService,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogger: AuditLogger,
    private readonly roleManager: RoleManager
  ) {}

  async authorize(
    userId: UserId,
    resource: Resource,
    action: Action
  ): Promise<AuthorizationResult> {
    // Get user roles and context
    const userContext = await this.buildUserContext(userId);
    
    // Apply RBAC (Role-Based Access Control)
    const rbacResult = await this.evaluateRBAC(userContext, resource, action);
    if (!rbacResult.granted) {
      return AuthorizationResult.denied(rbacResult.reason);
    }
    
    // Apply ABAC (Attribute-Based Access Control)
    const abacResult = await this.evaluateABAC(userContext, resource, action);
    if (!abacResult.granted) {
      return AuthorizationResult.denied(abacResult.reason);
    }
    
    // Check FERPA compliance for student data
    if (resource.type === ResourceType.STUDENT_DATA) {
      const ferpaResult = await this.evaluateFERPACompliance(userContext, resource);
      if (!ferpaResult.compliant) {
        return AuthorizationResult.denied('FERPA compliance violation');
      }
    }
    
    return AuthorizationResult.granted();
  }

  async auditDataAccess(
    userId: UserId,
    dataType: DataType,
    recordId: string
  ): Promise<void> {
    const auditEvent = new DataAccessAuditEvent({
      userId,
      dataType,
      recordId,
      timestamp: new Date(),
      ipAddress: this.getCurrentIPAddress(),
      userAgent: this.getCurrentUserAgent(),
      sessionId: this.getCurrentSessionId()
    });
    
    await this.auditLogger.log(auditEvent);
  }
}
```

### FERPA Compliance
```typescript
export interface FERPAComplianceService {
  validateEducationalInterest(userId: UserId, studentId: StudentId, purpose: AccessPurpose): Promise<ValidationResult>;
  checkConsentRequirements(studentId: StudentId, disclosureType: DisclosureType): Promise<ConsentResult>;
  logEducationalRecordAccess(userId: UserId, studentId: StudentId, fields: string[]): Promise<void>;
  generatePrivacyReport(dateRange: DateRange): Promise<PrivacyReport>;
}

export class FERPAComplianceServiceImpl implements FERPAComplianceService {
  async validateEducationalInterest(
    userId: UserId,
    studentId: StudentId,
    purpose: AccessPurpose
  ): Promise<ValidationResult> {
    // Check if user has legitimate educational interest
    const user = await this.userRepository.findById(userId);
    const student = await this.studentRepository.findById(studentId);
    
    if (!user || !student) {
      return ValidationResult.invalid('User or student not found');
    }
    
    // Verify educational relationship
    const relationship = await this.checkEducationalRelationship(user, student);
    if (!relationship.exists) {
      return ValidationResult.invalid('No educational relationship exists');
    }
    
    // Validate purpose against allowed purposes for role
    const allowedPurposes = await this.getAllowedPurposes(user.role);
    if (!allowedPurposes.includes(purpose)) {
      return ValidationResult.invalid(`Purpose ${purpose} not allowed for role ${user.role}`);
    }
    
    return ValidationResult.valid();
  }

  async logEducationalRecordAccess(
    userId: UserId,
    studentId: StudentId,
    fields: string[]
  ): Promise<void> {
    const accessLog = new EducationalRecordAccessLog({
      userId,
      studentId,
      fieldsAccessed: fields,
      timestamp: new Date(),
      purpose: this.getCurrentAccessPurpose(),
      justification: this.getCurrentJustification()
    });
    
    await this.privacyAuditRepository.save(accessLog);
  }
}
```

## Phase 5: Reporting & Analytics (Weeks 17-20)

### Compliance Reporting
```typescript
export interface ComplianceReportingService {
  generateP1Report(schoolId: SchoolId, reportingPeriod: ReportingPeriod): Promise<P1Report>;
  generateP2Report(schoolId: SchoolId, reportingPeriod: ReportingPeriod): Promise<P2Report>;
  generateAnnualReport(schoolId: SchoolId, schoolYear: SchoolYear): Promise<AnnualComplianceReport>;
  calculateADARecoveryProjections(schoolId: SchoolId): Promise<ADAProjection>;
}

export class ComplianceReportingServiceImpl implements ComplianceReportingService {
  async generateP1Report(
    schoolId: SchoolId,
    reportingPeriod: ReportingPeriod
  ): Promise<P1Report> {
    // P1 Report - First Principal Apportionment
    const students = await this.studentRepository.findBySchoolAndPeriod(
      schoolId,
      reportingPeriod
    );
    
    const attendanceData = await this.attendanceRepository.findBySchoolAndPeriod(
      schoolId,
      reportingPeriod
    );
    
    const metrics = this.calculateP1Metrics(students, attendanceData);
    
    return new P1Report({
      schoolId,
      reportingPeriod,
      totalEnrollment: students.length,
      averageDailyAttendance: metrics.ada,
      chronicallyAbsentCount: metrics.chronicallyAbsent,
      attendanceRate: metrics.attendanceRate,
      complianceScore: metrics.complianceScore,
      generatedAt: new Date()
    });
  }

  async calculateADARecoveryProjections(schoolId: SchoolId): Promise<ADAProjection> {
    const chronicallyAbsentStudents = await this.studentRepository.findChronicallyAbsent(
      schoolId,
      10 // 10% threshold
    );
    
    let totalRecoveryPotential = 0;
    const studentProjections: StudentADAProjection[] = [];
    
    for (const student of chronicallyAbsentStudents) {
      const currentAbsences = await this.calculateAbsences(student.id);
      const maxRecoverable = Math.min(currentAbsences, 10); // Max 10 days per SB 153/176
      const adaValue = maxRecoverable * this.getPerDayADAValue();
      
      totalRecoveryPotential += adaValue;
      studentProjections.push(new StudentADAProjection(
        student.id,
        currentAbsences,
        maxRecoverable,
        adaValue
      ));
    }
    
    return new ADAProjection({
      schoolId,
      totalStudents: chronicallyAbsentStudents.length,
      totalRecoveryPotential,
      averageRecoveryPerStudent: totalRecoveryPotential / chronicallyAbsentStudents.length,
      studentProjections,
      calculatedAt: new Date()
    });
  }
}
```

### Teacher Assignment Ratios
```typescript
export interface TeacherAssignmentService {
  assignStudentsToTeacher(teacherId: TeacherId, studentIds: StudentId[]): Promise<AssignmentResult>;
  checkTeacherCapacity(teacherId: TeacherId): Promise<CapacityInfo>;
  balanceTeacherLoads(schoolId: SchoolId): Promise<BalancingResult>;
  enforceRatioCompliance(schoolId: SchoolId): Promise<ComplianceResult>;
}

export class TeacherAssignmentServiceImpl implements TeacherAssignmentService {
  private readonly MAX_STUDENT_RATIO = 20; // 20:1 ratio requirement

  async assignStudentsToTeacher(
    teacherId: TeacherId,
    studentIds: StudentId[]
  ): Promise<AssignmentResult> {
    const teacher = await this.teacherRepository.findById(teacherId);
    if (!teacher) {
      throw new TeacherNotFoundError(teacherId);
    }

    // Check current capacity
    const currentAssignments = await this.assignmentRepository.findByTeacher(teacherId);
    const availableCapacity = this.MAX_STUDENT_RATIO - currentAssignments.length;

    if (studentIds.length > availableCapacity) {
      throw new CapacityExceededError(
        teacherId,
        availableCapacity,
        studentIds.length
      );
    }

    // Validate teacher credentials for subject area
    const students = await this.studentRepository.findByIds(studentIds);
    for (const student of students) {
      const requiredSubjects = this.determineRequiredSubjects(student);
      if (!teacher.isQualifiedFor(requiredSubjects)) {
        throw new TeacherNotQualifiedError(teacherId, requiredSubjects);
      }
    }

    // Create assignments
    const assignments: StudentAssignment[] = [];
    for (const studentId of studentIds) {
      const assignment = new StudentAssignment(
        new AssignmentId(crypto.randomUUID()),
        studentId,
        teacherId,
        RecoveryProgram.ATTENDANCE_RECOVERY,
        AssignmentStatus.ACTIVE,
        new Date()
      );
      
      assignments.push(assignment);
      await this.assignmentRepository.save(assignment);
    }

    return new AssignmentResult(assignments, teacher.getRemainingCapacity());
  }

  async enforceRatioCompliance(schoolId: SchoolId): Promise<ComplianceResult> {
    const teachers = await this.teacherRepository.findBySchool(schoolId);
    const violations: RatioViolation[] = [];
    
    for (const teacher of teachers) {
      const assignments = await this.assignmentRepository.findByTeacher(teacher.id);
      if (assignments.length > this.MAX_STUDENT_RATIO) {
        violations.push(new RatioViolation(
          teacher.id,
          assignments.length,
          this.MAX_STUDENT_RATIO
        ));
      }
    }
    
    return new ComplianceResult(violations.length === 0, violations);
  }
}
```

This implementation roadmap provides a structured approach to building the Clean Hexagonal Architecture for AP Tool V1, ensuring proper separation of concerns, testability, and maintainability while addressing all the specific requirements from the AP Romoland specification.