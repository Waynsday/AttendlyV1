# Integration Patterns Specification - AP Tool V1

## Real-Time Sync Strategy for Aeries

### Event-Driven Architecture
```typescript
export class AeriesEventStreamProcessor {
  private readonly eventStream: EventStream;
  private readonly eventHandlers: Map<string, EventHandler>;
  private readonly deadLetterQueue: DeadLetterQueue;

  constructor(
    private readonly aeriesClient: AeriesApiClient,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {
    this.eventStream = new EventStream('aeries-events');
    this.eventHandlers = new Map();
    this.deadLetterQueue = new DeadLetterQueue();
    this.setupEventHandlers();
  }

  async startProcessing(): Promise<void> {
    this.eventStream.subscribe(async (event: AeriesEvent) => {
      try {
        await this.processEvent(event);
      } catch (error) {
        await this.handleEventError(event, error);
      }
    });

    // Start periodic sync for safety net
    setInterval(() => this.performSafetySync(), Duration.hours(1).milliseconds);
  }

  private async processEvent(event: AeriesEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.type);
    if (!handler) {
      throw new UnknownEventTypeError(event.type);
    }

    await handler.handle(event);
  }

  private setupEventHandlers(): void {
    this.eventHandlers.set('STUDENT_ENROLLED', new StudentEnrollmentHandler());
    this.eventHandlers.set('ATTENDANCE_UPDATED', new AttendanceUpdateHandler());
    this.eventHandlers.set('ATTENDANCE_CORRECTED', new AttendanceCorrectionHandler());
    this.eventHandlers.set('STUDENT_WITHDRAWN', new StudentWithdrawalHandler());
  }
}

// Specific Event Handlers
export class AttendanceUpdateHandler implements EventHandler {
  constructor(
    private readonly attendanceRepository: AttendanceRecordRepository,
    private readonly studentRepository: StudentRepository,
    private readonly rankingService: StudentRankingService
  ) {}

  async handle(event: AeriesEvent): Promise<void> {
    const attendanceData = event.payload as AeriesAttendanceUpdate;
    
    // Validate student exists
    const student = await this.studentRepository.findById(
      new StudentId(attendanceData.studentId)
    );
    
    if (!student) {
      throw new StudentNotFoundError(attendanceData.studentId);
    }

    // Create or update attendance record
    const attendanceRecord = new AttendanceRecord(
      new AttendanceRecordId(crypto.randomUUID()),
      student.id,
      new SchoolId(attendanceData.schoolId),
      new Date(attendanceData.attendanceDate),
      attendanceData.periodNumber,
      this.mapAttendanceStatus(attendanceData.status),
      attendanceData.minutes,
      attendanceData.attendanceCode
    );

    await this.attendanceRepository.save(attendanceRecord);

    // Trigger re-ranking if this affects chronic absentee status
    if (this.shouldTriggerReranking(attendanceRecord)) {
      await this.rankingService.updateStudentRanking(student.id);
    }
  }

  private shouldTriggerReranking(record: AttendanceRecord): boolean {
    // Trigger re-ranking for absences or significant attendance changes
    return record.status === AttendanceStatus.Absent ||
           record.isFullDayAbsence;
  }
}
```

### Webhook Integration for Real-Time Updates
```typescript
export class AeriesWebhookService {
  private readonly webhookValidator: WebhookValidator;
  private readonly eventProcessor: AeriesEventStreamProcessor;

  constructor(
    private readonly config: AeriesWebhookConfig,
    eventProcessor: AeriesEventStreamProcessor
  ) {
    this.webhookValidator = new WebhookValidator(config.secretKey);
    this.eventProcessor = eventProcessor;
  }

  async handleWebhook(request: WebhookRequest): Promise<WebhookResponse> {
    // Validate webhook signature
    const isValid = await this.webhookValidator.validate(
      request.body,
      request.headers['x-aeries-signature']
    );

    if (!isValid) {
      throw new InvalidWebhookSignatureError();
    }

    // Parse webhook payload
    const webhookEvent = this.parseWebhookEvent(request.body);
    
    // Convert to internal event format
    const internalEvent = this.convertToInternalEvent(webhookEvent);
    
    // Process event asynchronously
    await this.eventProcessor.processEvent(internalEvent);
    
    return new WebhookResponse(200, 'Event processed successfully');
  }

  private convertToInternalEvent(webhookEvent: AeriesWebhookEvent): AeriesEvent {
    switch (webhookEvent.eventType) {
      case 'attendance.updated':
        return new AeriesEvent('ATTENDANCE_UPDATED', {
          studentId: webhookEvent.data.studentId,
          schoolId: webhookEvent.data.schoolId,
          attendanceDate: webhookEvent.data.date,
          periodNumber: webhookEvent.data.period,
          status: webhookEvent.data.attendanceCode,
          minutes: webhookEvent.data.minutes || 0,
          timestamp: new Date(webhookEvent.timestamp)
        });

      case 'attendance.corrected':
        return new AeriesEvent('ATTENDANCE_CORRECTED', {
          attendanceRecordId: webhookEvent.data.recordId,
          originalStatus: webhookEvent.data.originalStatus,
          newStatus: webhookEvent.data.newStatus,
          correctionReason: webhookEvent.data.reason,
          correctedBy: webhookEvent.data.correctedBy,
          timestamp: new Date(webhookEvent.timestamp)
        });

      default:
        throw new UnsupportedWebhookEventError(webhookEvent.eventType);
    }
  }
}
```

### Change Data Capture (CDC) Pattern
```typescript
export class AeriesChangeDataCapture {
  private readonly changeStreamProcessor: ChangeStreamProcessor;
  private readonly conflictResolver: ConflictResolver;
  private readonly synchronizationState: SynchronizationState;

  async startCapturing(): Promise<void> {
    // Start monitoring Aeries database changes
    this.changeStreamProcessor.start({
      tables: ['ATT', 'STU', 'TCH'], // Aeries table names
      operations: ['INSERT', 'UPDATE', 'DELETE'],
      batchSize: 100,
      flushInterval: Duration.seconds(30)
    });

    this.changeStreamProcessor.onBatch(async (changes: DatabaseChange[]) => {
      await this.processBatchedChanges(changes);
    });
  }

  private async processBatchedChanges(changes: DatabaseChange[]): Promise<void> {
    const groupedChanges = this.groupChangesByTable(changes);
    
    for (const [tableName, tableChanges] of groupedChanges) {
      try {
        await this.processTableChanges(tableName, tableChanges);
      } catch (error) {
        this.logger.error(`Failed to process changes for table ${tableName}`, error);
        await this.handleProcessingError(tableName, tableChanges, error);
      }
    }
  }

  private async processTableChanges(
    tableName: string,
    changes: DatabaseChange[]
  ): Promise<void> {
    const processor = this.getTableProcessor(tableName);
    
    for (const change of changes) {
      const currentState = await this.synchronizationState.getLastSync(
        tableName,
        change.recordId
      );

      // Check for conflicts
      if (this.hasConflict(change, currentState)) {
        const resolution = await this.conflictResolver.resolve(change, currentState);
        await processor.applyResolution(resolution);
      } else {
        await processor.applyChange(change);
      }

      // Update synchronization state
      await this.synchronizationState.updateLastSync(
        tableName,
        change.recordId,
        change.timestamp
      );
    }
  }

  private hasConflict(change: DatabaseChange, currentState: SyncState): boolean {
    if (!currentState) return false;
    
    // Check if our local changes are newer than the incoming change
    return currentState.lastModified > change.timestamp;
  }
}
```

## Batch Processing for i-Ready Data

### ETL Pipeline for Diagnostic Results
```typescript
export class IReadyETLPipeline {
  private readonly extractor: IReadyDataExtractor;
  private readonly transformer: IReadyDataTransformer;
  private readonly loader: IReadyDataLoader;
  private readonly validator: DataValidator;

  constructor(
    private readonly config: IReadyETLConfig,
    private readonly logger: Logger
  ) {
    this.extractor = new IReadyDataExtractor(config.sftpConfig);
    this.transformer = new IReadyDataTransformer();
    this.loader = new IReadyDataLoader();
    this.validator = new DataValidator();
  }

  async processDiagnosticResults(
    schoolYear: SchoolYear,
    assessmentPeriod: AssessmentPeriod
  ): Promise<ETLResult> {
    const pipelineId = crypto.randomUUID();
    const startTime = new Date();

    try {
      // Extract phase
      const rawData = await this.extractData(schoolYear, assessmentPeriod);
      this.logger.info(`Extracted ${rawData.length} records`, { pipelineId });

      // Transform phase
      const transformedData = await this.transformData(rawData);
      this.logger.info(`Transformed ${transformedData.length} records`, { pipelineId });

      // Validate phase
      const validationResult = await this.validateData(transformedData);
      if (validationResult.hasErrors) {
        throw new DataValidationError(validationResult.errors);
      }

      // Load phase
      const loadResult = await this.loadData(transformedData);
      this.logger.info(`Loaded ${loadResult.successCount} records`, { pipelineId });

      return new ETLResult({
        pipelineId,
        startTime,
        endTime: new Date(),
        recordsProcessed: rawData.length,
        recordsLoaded: loadResult.successCount,
        errors: loadResult.errors
      });

    } catch (error) {
      this.logger.error('ETL pipeline failed', { pipelineId, error });
      throw error;
    }
  }

  private async extractData(
    schoolYear: SchoolYear,
    assessmentPeriod: AssessmentPeriod
  ): Promise<IReadyRawData[]> {
    const files = await this.extractor.listAvailableFiles(schoolYear, assessmentPeriod);
    const allData: IReadyRawData[] = [];

    for (const file of files) {
      try {
        const fileData = await this.extractor.extractFile(file);
        allData.push(...fileData);
      } catch (error) {
        this.logger.warn(`Failed to extract file ${file.name}`, error);
        // Continue with other files
      }
    }

    return allData;
  }

  private async transformData(rawData: IReadyRawData[]): Promise<IReadyTransformedData[]> {
    const transformedData: IReadyTransformedData[] = [];
    
    for (const record of rawData) {
      try {
        const transformed = await this.transformer.transform(record);
        transformedData.push(transformed);
      } catch (error) {
        this.logger.warn(`Failed to transform record ${record.studentId}`, error);
        // Add to error collection but continue processing
      }
    }

    return transformedData;
  }

  private async loadData(data: IReadyTransformedData[]): Promise<LoadResult> {
    const batchSize = 100;
    const batches = this.createBatches(data, batchSize);
    
    let successCount = 0;
    const errors: LoadError[] = [];

    for (const batch of batches) {
      try {
        await this.loader.loadBatch(batch);
        successCount += batch.length;
      } catch (error) {
        errors.push(new LoadError(batch, error.message));
      }
    }

    return new LoadResult(successCount, errors);
  }
}

// Data Transformer for i-Ready specific logic
export class IReadyDataTransformer {
  async transform(rawData: IReadyRawData): Promise<IReadyTransformedData> {
    return {
      studentId: new StudentId(rawData.studentId),
      assessmentDate: new Date(rawData.assessmentDate),
      schoolYear: new SchoolYear(rawData.schoolYear),
      assessmentPeriod: this.mapAssessmentPeriod(rawData.period),
      readingResults: this.transformReadingResults(rawData.reading),
      mathResults: this.transformMathResults(rawData.math),
      overallPerformance: this.calculateOverallPerformance(rawData),
      gradeEquivalent: this.calculateGradeEquivalent(rawData),
      riskLevel: this.calculateRiskLevel(rawData)
    };
  }

  private transformReadingResults(readingData: IReadyRawReadingData): ReadingDiagnosticResults {
    return new ReadingDiagnosticResults({
      overallScaleScore: readingData.overallScaleScore,
      performanceLevel: this.mapPerformanceLevel(readingData.performanceLevel),
      domainScores: {
        foundationalSkills: readingData.foundationalSkills,
        informationalText: readingData.informationalText,
        literature: readingData.literature,
        vocabulary: readingData.vocabulary
      },
      gradeEquivalent: readingData.gradeEquivalent
    });
  }

  private calculateRiskLevel(rawData: IReadyRawData): AcademicRiskLevel {
    const readingLevel = this.mapPerformanceLevel(rawData.reading.performanceLevel);
    const mathLevel = this.mapPerformanceLevel(rawData.math.performanceLevel);
    
    // Determine overall risk based on both subjects
    if (readingLevel === PerformanceLevel.WELL_BELOW_PROFICIENT || 
        mathLevel === PerformanceLevel.WELL_BELOW_PROFICIENT) {
      return AcademicRiskLevel.HIGH;
    }
    
    if (readingLevel === PerformanceLevel.BELOW_PROFICIENT || 
        mathLevel === PerformanceLevel.BELOW_PROFICIENT) {
      return AcademicRiskLevel.MEDIUM;
    }
    
    return AcademicRiskLevel.LOW;
  }
}
```

### Scheduled Batch Processing
```typescript
export class IReadyBatchScheduler {
  private readonly scheduler: JobScheduler;
  private readonly etlPipeline: IReadyETLPipeline;
  private readonly notificationService: NotificationService;

  constructor() {
    this.scheduler = new JobScheduler();
    this.setupScheduledJobs();
  }

  private setupScheduledJobs(): void {
    // Daily check for new i-Ready data
    this.scheduler.schedule('check-iready-updates', {
      cron: '0 2 * * *', // Daily at 2 AM
      job: () => this.checkForNewData()
    });

    // Weekly comprehensive sync
    this.scheduler.schedule('weekly-iready-sync', {
      cron: '0 1 * * 0', // Sunday at 1 AM
      job: () => this.performWeeklySync()
    });

    // End-of-assessment-period processing
    this.scheduler.schedule('assessment-period-processing', {
      cron: '0 0 15 */4 *', // 15th of every 4th month (approximate)
      job: () => this.processAssessmentPeriod()
    });
  }

  private async checkForNewData(): Promise<void> {
    try {
      const availableFiles = await this.getAvailableFiles();
      const unprocessedFiles = await this.filterUnprocessedFiles(availableFiles);

      if (unprocessedFiles.length > 0) {
        const result = await this.etlPipeline.processFiles(unprocessedFiles);
        await this.notificationService.sendProcessingReport(result);
      }
    } catch (error) {
      await this.notificationService.sendErrorAlert('Daily i-Ready check failed', error);
    }
  }

  private async performWeeklySync(): Promise<void> {
    // Full synchronization to catch any missed updates
    const currentYear = SchoolYear.current();
    const allPeriods = [
      AssessmentPeriod.BOY,
      AssessmentPeriod.MOY,
      AssessmentPeriod.EOY
    ];

    for (const period of allPeriods) {
      try {
        await this.etlPipeline.processDiagnosticResults(currentYear, period);
      } catch (error) {
        this.logger.error(`Weekly sync failed for ${period}`, error);
      }
    }
  }
}
```

## Error Handling and Retry Mechanisms

### Resilient Integration Pattern
```typescript
export class ResilientIntegrationService {
  private readonly retryPolicies: Map<string, RetryPolicy>;
  private readonly circuitBreakers: Map<string, CircuitBreaker>;
  private readonly deadLetterQueue: DeadLetterQueue;

  constructor() {
    this.setupRetryPolicies();
    this.setupCircuitBreakers();
    this.deadLetterQueue = new DeadLetterQueue();
  }

  async executeWithResilience<T>(
    operation: () => Promise<T>,
    context: IntegrationContext
  ): Promise<T> {
    const retryPolicy = this.retryPolicies.get(context.service);
    const circuitBreaker = this.circuitBreakers.get(context.service);

    if (!retryPolicy || !circuitBreaker) {
      throw new ConfigurationError(`No resilience policy configured for ${context.service}`);
    }

    return circuitBreaker.execute(async () => {
      return retryPolicy.execute(operation, context.shouldRetry);
    });
  }

  private setupRetryPolicies(): void {
    // Aeries API - more aggressive retry for transient failures
    this.retryPolicies.set('aeries', new RetryPolicy({
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL_WITH_JITTER
    }));

    // i-Ready SFTP - fewer retries due to file-based nature
    this.retryPolicies.set('iready', new RetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 5000,
      maxDelayMs: 60000,
      backoffStrategy: BackoffStrategy.LINEAR
    }));

    // Supabase - moderate retry policy
    this.retryPolicies.set('supabase', new RetryPolicy({
      maxAttempts: 4,
      baseDelayMs: 500,
      maxDelayMs: 10000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    }));
  }

  private setupCircuitBreakers(): void {
    // Aeries API circuit breaker
    this.circuitBreakers.set('aeries', new CircuitBreaker({
      failureThreshold: 10,
      recoveryTimeoutMs: 60000,
      monitoringWindowMs: 300000 // 5 minutes
    }));

    // i-Ready circuit breaker
    this.circuitBreakers.set('iready', new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeoutMs: 300000, // 5 minutes
      monitoringWindowMs: 600000 // 10 minutes
    }));
  }
}

// Specific error handling for different integration points
export class AeriesIntegrationErrorHandler {
  async handleError(error: Error, context: AeriesContext): Promise<ErrorHandlingResult> {
    if (error instanceof AeriesRateLimitError) {
      return new ErrorHandlingResult({
        shouldRetry: true,
        delayMs: error.resetTimeMs,
        action: 'WAIT_AND_RETRY'
      });
    }

    if (error instanceof AeriesAuthenticationError) {
      // Certificate might have expired
      await this.refreshCertificate(context.schoolCode);
      return new ErrorHandlingResult({
        shouldRetry: true,
        delayMs: 1000,
        action: 'REFRESH_AUTH_AND_RETRY'
      });
    }

    if (error instanceof AeriesDataNotFoundError) {
      // Student might not exist in Aeries
      return new ErrorHandlingResult({
        shouldRetry: false,
        action: 'LOG_AND_SKIP'
      });
    }

    if (error instanceof AeriesMaintenanceError) {
      // Aeries is down for maintenance
      return new ErrorHandlingResult({
        shouldRetry: true,
        delayMs: Duration.minutes(30).milliseconds,
        action: 'WAIT_FOR_MAINTENANCE'
      });
    }

    // Unknown error - send to dead letter queue
    await this.deadLetterQueue.send(new FailedOperation(
      context,
      error,
      new Date()
    ));

    return new ErrorHandlingResult({
      shouldRetry: false,
      action: 'SEND_TO_DLQ'
    });
  }
}
```

### Compensation Pattern for Data Consistency
```typescript
export class DataConsistencyManager {
  private readonly compensationLog: CompensationLog;
  private readonly sagaOrchestrator: SagaOrchestrator;

  async executeConsistentOperation(
    operations: IntegrationOperation[]
  ): Promise<ConsistencyResult> {
    const sagaId = crypto.randomUUID();
    const compensations: CompensationAction[] = [];

    try {
      for (const operation of operations) {
        const result = await this.executeOperation(operation);
        
        // Record compensation action for rollback if needed
        compensations.push(this.createCompensation(operation, result));
        
        await this.compensationLog.record(sagaId, operation, result);
      }

      return new ConsistencyResult('SUCCESS', sagaId);

    } catch (error) {
      // Execute compensations in reverse order
      await this.executeCompensations(compensations.reverse());
      
      return new ConsistencyResult('FAILED', sagaId, error);
    }
  }

  private async executeCompensations(
    compensations: CompensationAction[]
  ): Promise<void> {
    for (const compensation of compensations) {
      try {
        await compensation.execute();
      } catch (compensationError) {
        // Log compensation failure but continue with others
        this.logger.error('Compensation failed', {
          originalOperation: compensation.originalOperation,
          error: compensationError
        });
      }
    }
  }

  private createCompensation(
    operation: IntegrationOperation,
    result: OperationResult
  ): CompensationAction {
    switch (operation.type) {
      case 'CREATE_STUDENT':
        return new DeleteStudentCompensation(result.createdId);
      
      case 'UPDATE_ATTENDANCE':
        return new RestoreAttendanceCompensation(
          operation.recordId,
          result.previousState
        );
      
      case 'SEND_NOTIFICATION':
        return new LogNotificationCompensation(
          operation.notificationId,
          'COMPENSATED'
        );
      
      default:
        return new NoOpCompensation();
    }
  }
}
```

This comprehensive integration architecture provides:

1. **Real-time Data Sync**: Event-driven architecture with webhooks and change data capture
2. **Batch Processing**: Robust ETL pipeline for i-Ready diagnostic data
3. **Error Resilience**: Circuit breakers, retry policies, and compensation patterns
4. **Data Consistency**: Saga pattern for maintaining consistency across services
5. **Monitoring**: Comprehensive logging and alerting for integration health
6. **Scalability**: Asynchronous processing and batch optimization
7. **Fault Tolerance**: Dead letter queues and graceful degradation