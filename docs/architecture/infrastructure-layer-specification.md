# Infrastructure Layer Specification - AP Tool V1

## Supabase Adapter with Repository Pattern

### Base Repository Implementation
```typescript
export abstract class SupabaseRepository<TEntity, TId> {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName: string;

  constructor(supabase: SupabaseClient, tableName: string) {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  protected async executeWithAudit<T>(
    operation: () => Promise<T>,
    auditContext: AuditContext
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      
      await this.logAuditEvent({
        ...auditContext,
        status: 'success',
        duration: performance.now() - startTime
      });
      
      return result;
    } catch (error) {
      await this.logAuditEvent({
        ...auditContext,
        status: 'error',
        error: error.message,
        duration: performance.now() - startTime
      });
      throw error;
    }
  }

  protected async logAuditEvent(auditData: AuditEvent): Promise<void> {
    await this.supabase
      .from('audit_logs')
      .insert({
        table_name: this.tableName,
        action: auditData.action,
        user_id: auditData.userId,
        record_id: auditData.recordId,
        status: auditData.status,
        duration_ms: auditData.duration,
        error_message: auditData.error,
        created_at: new Date().toISOString()
      });
  }
}
```

### Student Repository Implementation
```typescript
export class SupabaseStudentRepository 
  extends SupabaseRepository<Student, StudentId> 
  implements StudentRepository {
  
  constructor(supabase: SupabaseClient) {
    super(supabase, 'students');
  }

  async findById(id: StudentId): Promise<Student | null> {
    return this.executeWithAudit(
      async () => {
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

        if (error) {
          if (error.code === 'PGRST116') return null; // Not found
          throw new RepositoryError(`Failed to find student: ${error.message}`);
        }

        return this.mapToEntity(data);
      },
      {
        action: 'find_by_id',
        userId: this.getCurrentUserId(),
        recordId: id.value
      }
    );
  }

  async findBySchoolAndYear(
    schoolId: SchoolId,
    schoolYear: SchoolYear,
    gradeLevel?: Grade
  ): Promise<Student[]> {
    return this.executeWithAudit(
      async () => {
        let query = this.supabase
          .from('students')
          .select(`
            *,
            special_education_status,
            section_504_status,
            foster_youth_status,
            elpac_level,
            attendance_records!inner(*)
          `)
          .eq('school_id', schoolId.value)
          .eq('attendance_records.school_year', schoolYear.value);

        if (gradeLevel) {
          query = query.eq('grade_level', gradeLevel.level);
        }

        const { data, error } = await query;

        if (error) {
          throw new RepositoryError(`Failed to find students: ${error.message}`);
        }

        return data.map(this.mapToEntity);
      },
      {
        action: 'find_by_school_and_year',
        userId: this.getCurrentUserId(),
        recordId: `${schoolId.value}-${schoolYear.value}`
      }
    );
  }

  async save(student: Student): Promise<void> {
    return this.executeWithAudit(
      async () => {
        const data = this.mapFromEntity(student);
        
        const { error } = await this.supabase
          .from('students')
          .upsert(data, { onConflict: 'id' });

        if (error) {
          throw new RepositoryError(`Failed to save student: ${error.message}`);
        }
      },
      {
        action: 'save',
        userId: this.getCurrentUserId(),
        recordId: student.id.value
      }
    );
  }

  private mapToEntity(data: any): Student {
    const studentId = new StudentId(data.id);
    const grade = new Grade(data.grade_level);
    
    const student = new Student(
      studentId,
      data.first_name,
      data.last_name,
      grade.level,
      data.email,
      data.is_active
    );

    // Set additional properties
    student.setSpecialEducationStatus(data.special_education_status);
    student.setSection504Status(data.section_504_status);
    student.setFosterYouthStatus(data.foster_youth_status);
    student.setELPACLevel(data.elpac_level);

    return student;
  }

  private mapFromEntity(student: Student): any {
    return {
      id: student.id.value,
      first_name: student.firstName,
      last_name: student.lastName,
      grade_level: student.gradeLevel,
      email: student.email,
      is_active: student.isActive,
      special_education_status: student.specialEducationStatus,
      section_504_status: student.section504Status,
      foster_youth_status: student.fosterYouthStatus,
      elpac_level: student.elpacLevel,
      updated_at: new Date().toISOString()
    };
  }
}
```

### Attendance Record Repository with Period Handling
```typescript
export class SupabaseAttendanceRecordRepository 
  extends SupabaseRepository<AttendanceRecord, AttendanceRecordId>
  implements AttendanceRecordRepository {

  async findByStudentAndYear(
    studentId: StudentId,
    schoolYear: SchoolYear
  ): Promise<AttendanceRecord[]> {
    return this.executeWithAudit(
      async () => {
        const { data, error } = await this.supabase
          .from('attendance_records')
          .select('*')
          .eq('student_id', studentId.value)
          .eq('school_year', schoolYear.value)
          .order('attendance_date', { ascending: true })
          .order('period_number', { ascending: true });

        if (error) {
          throw new RepositoryError(`Failed to find attendance records: ${error.message}`);
        }

        return data.map(this.mapToEntity);
      },
      {
        action: 'find_by_student_and_year',
        userId: this.getCurrentUserId(),
        recordId: `${studentId.value}-${schoolYear.value}`
      }
    );
  }

  async findFullDayAbsences(
    studentId: StudentId,
    dateRange: DateRange
  ): Promise<AttendanceRecord[]> {
    return this.executeWithAudit(
      async () => {
        // Query for days with 7 period absences (full day)
        const { data, error } = await this.supabase
          .rpc('get_full_day_absences', {
            p_student_id: studentId.value,
            p_start_date: dateRange.start.toISOString(),
            p_end_date: dateRange.end.toISOString()
          });

        if (error) {
          throw new RepositoryError(`Failed to find full day absences: ${error.message}`);
        }

        return data.map(this.mapToEntity);
      },
      {
        action: 'find_full_day_absences',
        userId: this.getCurrentUserId(),
        recordId: studentId.value
      }
    );
  }

  async saveAttendanceCorrection(
    record: AttendanceRecord,
    correction: AttendanceCorrection,
    auditor: UserId
  ): Promise<void> {
    return this.executeWithAudit(
      async () => {
        // Start transaction
        const { error: transactionError } = await this.supabase.rpc('begin_transaction');
        if (transactionError) throw transactionError;

        try {
          // Update attendance record
          const { error: updateError } = await this.supabase
            .from('attendance_records')
            .update({
              status: record.status,
              attendance_code: record.attendanceCode,
              is_corrected: true,
              corrected_at: new Date().toISOString(),
              corrected_by: auditor.value
            })
            .eq('id', record.id.value);

          if (updateError) throw updateError;

          // Log correction history
          const { error: historyError } = await this.supabase
            .from('attendance_corrections')
            .insert({
              attendance_record_id: record.id.value,
              original_status: correction.originalStatus,
              new_status: correction.newStatus,
              reason: correction.reason,
              corrected_by: auditor.value,
              correction_date: new Date().toISOString()
            });

          if (historyError) throw historyError;

          // Commit transaction
          const { error: commitError } = await this.supabase.rpc('commit_transaction');
          if (commitError) throw commitError;

        } catch (error) {
          await this.supabase.rpc('rollback_transaction');
          throw error;
        }
      },
      {
        action: 'save_attendance_correction',
        userId: auditor.value,
        recordId: record.id.value
      }
    );
  }
}
```

## Aeries API Client with Circuit Breaker Pattern

### Circuit Breaker Implementation
```typescript
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeoutMs: number = 60000, // 1 minute
    private readonly monitoringWindow: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
           (Date.now() - this.lastFailureTime.getTime()) >= this.recoveryTimeoutMs;
  }
}
```

### Aeries API Client Implementation
```typescript
export class AeriesApiClient implements AeriesApiPort {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly httpClient: HttpClient;
  private readonly rateLimiter: RateLimiter;

  constructor(
    private readonly config: AeriesConfig,
    httpClient: HttpClient
  ) {
    this.httpClient = httpClient;
    this.circuitBreaker = new CircuitBreaker(5, 60000, 60000);
    this.rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
  }

  async getStudentAttendance(
    studentId: StudentId,
    schoolYear: SchoolYear
  ): Promise<AeriesAttendanceData[]> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.acquire();

      const response = await this.httpClient.get<AeriesAttendanceResponse>(
        `/api/v5/schools/${this.config.schoolCode}/students/${studentId.value}/attendance/${schoolYear.value}`,
        {
          headers: {
            'AERIES-CERT': this.config.certificateKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      if (!response.data) {
        throw new AeriesApiError('No attendance data returned');
      }

      return response.data.map(this.mapAttendanceData);
    });
  }

  async getStudentsBySchool(
    schoolCode: string,
    schoolYear: SchoolYear
  ): Promise<AeriesStudentData[]> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.acquire();

      const response = await this.httpClient.get<AeriesStudentResponse>(
        `/api/v5/schools/${schoolCode}/students`,
        {
          headers: {
            'AERIES-CERT': this.config.certificateKey,
            'Content-Type': 'application/json'
          },
          params: {
            year: schoolYear.value
          },
          timeout: 60000 // 60 second timeout for bulk data
        }
      );

      return response.data.map(this.mapStudentData);
    });
  }

  async getAttendanceCorrections(
    schoolCode: string,
    dateRange: DateRange
  ): Promise<AeriesAttendanceCorrectionData[]> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.acquire();

      // Aeries tracks corrections within 7-day window
      const response = await this.httpClient.get<AeriesAttendanceCorrectionResponse>(
        `/api/v5/schools/${schoolCode}/attendance/corrections`,
        {
          headers: {
            'AERIES-CERT': this.config.certificateKey,
            'Content-Type': 'application/json'
          },
          params: {
            startDate: dateRange.start.toISOString().split('T')[0],
            endDate: dateRange.end.toISOString().split('T')[0]
          },
          timeout: 30000
        }
      );

      return response.data.map(this.mapCorrectionData);
    });
  }

  private mapAttendanceData(data: any): AeriesAttendanceData {
    return new AeriesAttendanceData({
      studentId: data.StudentID,
      attendanceDate: new Date(data.Date),
      periodNumber: data.Period,
      status: this.mapAttendanceStatus(data.Attendance),
      attendanceCode: data.AttendanceCode,
      minutes: data.Minutes || 0
    });
  }

  private mapStudentData(data: any): AeriesStudentData {
    return new AeriesStudentData({
      studentId: data.StudentID,
      firstName: data.FirstName,
      lastName: data.LastName,
      gradeLevel: data.Grade,
      schoolCode: data.SchoolCode,
      isActive: data.InactiveStatusCode === null
    });
  }

  private mapAttendanceStatus(aeriesStatus: string): AttendanceStatus {
    const statusMap: Record<string, AttendanceStatus> = {
      'P': AttendanceStatus.Present,
      'A': AttendanceStatus.Absent,
      'T': AttendanceStatus.Tardy,
      'E': AttendanceStatus.Excused
    };

    return statusMap[aeriesStatus] || AttendanceStatus.Absent;
  }
}
```

## External Service Integrations

### i-Ready Integration
```typescript
export class IReadyApiClient implements IReadyApiPort {
  private readonly sftpClient: SFTPClient;

  constructor(private readonly config: IReadyConfig) {
    this.sftpClient = new SFTPClient(config.sftpConfig);
  }

  async fetchDiagnosticResults(
    schoolYear: SchoolYear,
    assessmentPeriod: AssessmentPeriod
  ): Promise<IReadyDiagnosticData[]> {
    try {
      await this.sftpClient.connect();
      
      const fileName = `diagnostic_results_${schoolYear.value}_${assessmentPeriod}.csv`;
      const fileData = await this.sftpClient.downloadFile(fileName);
      
      const csvParser = new CSVParser<IReadyDiagnosticData>();
      const diagnosticData = await csvParser.parse(fileData, {
        mapping: {
          'Student ID': 'studentId',
          'Reading Overall Scale Score': 'readingScaleScore',
          'Reading Overall Performance Level': 'readingPerformanceLevel',
          'Math Overall Scale Score': 'mathScaleScore',
          'Math Overall Performance Level': 'mathPerformanceLevel',
          'Grade Equivalent Reading': 'gradeEquivalentReading',
          'Grade Equivalent Math': 'gradeEquivalentMath'
        },
        validation: this.validateDiagnosticData
      });

      return diagnosticData;
    } finally {
      await this.sftpClient.disconnect();
    }
  }

  private validateDiagnosticData(record: any): boolean {
    return record.studentId &&
           typeof record.readingScaleScore === 'number' &&
           typeof record.mathScaleScore === 'number';
  }
}
```

### A2A (School Status Attend) Integration
```typescript
export class A2AIntegrationService implements A2AIntegrationPort {
  private readonly csvProcessor: CSVProcessor;

  constructor() {
    this.csvProcessor = new CSVProcessor();
  }

  async processTruancyLetterData(csvData: string): Promise<TruancyLetterData[]> {
    const records = await this.csvProcessor.parse<A2ATruancyRecord>(csvData, {
      skipEmptyLines: true,
      headers: true,
      transform: this.transformA2ARecord
    });

    return records.map(this.mapToTruancyLetterData);
  }

  async processConferenceData(csvData: string): Promise<ConferenceData[]> {
    const records = await this.csvProcessor.parse<A2AConferenceRecord>(csvData, {
      skipEmptyLines: true,
      headers: true
    });

    return records.map(this.mapToConferenceData);
  }

  async processSARBReferralData(csvData: string): Promise<SARBReferralData[]> {
    const records = await this.csvProcessor.parse<A2ASARBRecord>(csvData, {
      skipEmptyLines: true,
      headers: true
    });

    return records.map(this.mapToSARBReferralData);
  }

  private transformA2ARecord(record: any): A2ATruancyRecord {
    return {
      studentId: record['Student ID'],
      studentName: record['Student Name'],
      gradeLevel: parseInt(record['Grade']),
      letterType: record['Letter Type'],
      dateSent: new Date(record['Date Sent']),
      letterCount: parseInt(record['Letter Count']) || 1
    };
  }

  private mapToTruancyLetterData(record: A2ATruancyRecord): TruancyLetterData {
    return new TruancyLetterData({
      studentId: new StudentId(record.studentId),
      letterType: this.mapLetterType(record.letterType),
      dateSent: record.dateSent,
      letterCount: record.letterCount
    });
  }
}
```

## Error Handling and Retry Mechanisms

### Retry Policy Implementation
```typescript
export class RetryPolicy {
  constructor(
    private readonly maxAttempts: number = 3,
    private readonly baseDelayMs: number = 1000,
    private readonly maxDelayMs: number = 30000,
    private readonly backoffMultiplier: number = 2
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: Error) => boolean = () => true
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.maxAttempts || !shouldRetry(lastError)) {
          throw lastError;
        }
        
        const delay = Math.min(
          this.baseDelayMs * Math.pow(this.backoffMultiplier, attempt - 1),
          this.maxDelayMs
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Data Synchronization Strategy
```typescript
export class AeriesDataSyncService {
  constructor(
    private readonly aeriesClient: AeriesApiClient,
    private readonly studentRepository: StudentRepository,
    private readonly attendanceRepository: AttendanceRecordRepository,
    private readonly retryPolicy: RetryPolicy,
    private readonly logger: Logger
  ) {}

  async performDailySync(schoolId: SchoolId): Promise<SyncResult> {
    const syncStartTime = new Date();
    const syncResult = new SyncResult();

    try {
      // Sync students first
      await this.syncStudents(schoolId, syncResult);
      
      // Sync attendance data
      await this.syncAttendanceData(schoolId, syncResult);
      
      // Sync corrections (7-day window)
      await this.syncAttendanceCorrections(schoolId, syncResult);
      
      syncResult.markCompleted(syncStartTime);
      
    } catch (error) {
      syncResult.markFailed(error.message, syncStartTime);
      this.logger.error('Daily sync failed', { schoolId: schoolId.value, error });
      throw error;
    }

    return syncResult;
  }

  private async syncStudents(schoolId: SchoolId, syncResult: SyncResult): Promise<void> {
    const currentYear = SchoolYear.current();
    
    const aeriesStudents = await this.retryPolicy.execute(
      () => this.aeriesClient.getStudentsBySchool(schoolId.value, currentYear),
      (error) => error instanceof AeriesApiError && error.isRetryable
    );

    for (const aeriesStudent of aeriesStudents) {
      try {
        const student = this.mapAeriesStudentToEntity(aeriesStudent);
        await this.studentRepository.save(student);
        syncResult.incrementStudentsSynced();
      } catch (error) {
        syncResult.addStudentError(aeriesStudent.studentId, error.message);
      }
    }
  }

  private async syncAttendanceData(schoolId: SchoolId, syncResult: SyncResult): Promise<void> {
    const students = await this.studentRepository.findBySchoolAndYear(
      schoolId,
      SchoolYear.current()
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    for (const student of students) {
      try {
        const attendanceData = await this.retryPolicy.execute(
          () => this.aeriesClient.getStudentAttendance(student.id, SchoolYear.current()),
          (error) => error instanceof AeriesApiError && error.isRetryable
        );

        const recentAttendance = attendanceData.filter(
          record => record.attendanceDate >= yesterday
        );

        for (const record of recentAttendance) {
          const attendanceRecord = this.mapAeriesAttendanceToEntity(record);
          await this.attendanceRepository.save(attendanceRecord);
        }

        syncResult.incrementAttendanceRecordsSynced(recentAttendance.length);
      } catch (error) {
        syncResult.addAttendanceError(student.id.value, error.message);
      }
    }
  }
}