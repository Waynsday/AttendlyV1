# AttendlyV1 Data Flow Architecture

## Overview

This document outlines the data flow patterns for AttendlyV1, covering CSV ingestion pipelines, real-time dashboard updates, and integration with external systems (Aeries SIS, iReady, A2A).

## 1. CSV Data Ingestion Pipeline

### 1.1 Attendance Data Import Flow

```mermaid
flowchart TD
    A[Aeries SIS Export] --> B[CSV File Upload]
    B --> C{File Validation}
    C -->|Invalid| D[Validation Error Log]
    C -->|Valid| E[Parse CSV Headers]
    E --> F{Schema Validation}
    F -->|Schema Mismatch| G[Schema Error Log]
    F -->|Valid Schema| H[Row-by-Row Processing]
    
    H --> I{Student Exists?}
    I -->|No| J[Create Student Record]
    I -->|Yes| K[Validate Student Data]
    
    J --> L[Insert Attendance Record]
    K --> M{Data Changed?}
    M -->|Yes| N[Update Attendance Record]
    M -->|No| O[Skip Record]
    
    L --> P[Calculate Daily Percentage]
    N --> P
    O --> Q[Process Next Row]
    P --> Q
    
    Q --> R{More Rows?}
    R -->|Yes| H
    R -->|No| S[Generate Import Summary]
    S --> T[Trigger Real-time Updates]
    T --> U[Audit Log Entry]
    
    D --> V[Notify Administrator]
    G --> V
    U --> W[Import Complete]
```

### 1.2 iReady Diagnostic Data Import Flow

```mermaid
flowchart TD
    A[iReady Platform Export] --> B[Multi-File CSV Upload]
    B --> C[Academic Year Classification]
    C --> D{Current/Historical?}
    
    D -->|Current Year| E[Process Current Diagnostics]
    D -->|Historical| F[Process Historical Diagnostics]
    
    E --> G[Validate Student Mapping]
    F --> G
    
    G --> H{Student Found?}
    H -->|No| I[Flag Unmapped Student]
    H -->|Yes| J[Validate Score Ranges]
    
    J --> K{Valid Scores?}
    K -->|Invalid| L[Data Quality Alert]
    K -->|Valid| M[Subject-Specific Processing]
    
    M --> N{Subject Type?}
    N -->|ELA| O[Process ELA Domains]
    N -->|Math| P[Process Math Domains]
    
    O --> Q[Validate ELA Constraints]
    P --> R[Validate Math Constraints]
    
    Q --> S[Insert/Update iReady Score]
    R --> S
    
    S --> T[Calculate Growth Metrics]
    T --> U[Update Student Summary View]
    U --> V[Trigger Dashboard Updates]
    
    I --> W[Generate Exception Report]
    L --> W
    V --> X[Import Complete]
    W --> X
```

### 1.3 CSV Processing Architecture

```typescript
// Edge Function for CSV Processing
interface CSVProcessor {
  // Validation Layer
  validateFileStructure(file: File): ValidationResult;
  validateRowData(row: CSVRow, schema: Schema): ValidationResult;
  
  // Processing Layer
  processAttendanceCSV(file: File): Promise<ProcessingResult>;
  processIReadyCSV(files: File[], academicYear: AcademicYear): Promise<ProcessingResult>;
  
  // Error Handling
  handleValidationErrors(errors: ValidationError[]): void;
  generateErrorReport(errors: ProcessingError[]): ErrorReport;
  
  // Audit Trail
  logImportActivity(
    userId: string, 
    fileType: string, 
    recordsProcessed: number,
    errors: ProcessingError[]
  ): Promise<void>;
}

interface ProcessingResult {
  success: boolean;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: ProcessingError[];
  summary: ImportSummary;
}
```

## 2. Real-time Dashboard Updates

### 2.1 Real-time Update Flow

```mermaid
flowchart TD
    A[Teacher Updates Attendance] --> B[Validate Input]
    B --> C{Validation Pass?}
    C -->|No| D[Show Validation Error]
    C -->|Yes| E[Update Database]
    
    E --> F[Trigger Supabase Realtime]
    F --> G[Calculate Affected Metrics]
    G --> H[Update Student Summary View]
    
    H --> I[Broadcast to Subscribed Clients]
    I --> J{Client Active?}
    J -->|Yes| K[Update Dashboard Components]
    J -->|No| L[Queue Update for Reconnection]
    
    K --> M[Update KPI Widgets]
    K --> N[Update Student Cards]
    K --> O[Update Risk Tier Indicators]
    
    M --> P[Smooth Animation Transition]
    N --> P
    O --> P
    
    P --> Q[Client Update Complete]
    
    D --> R[Focus on Error Field]
    L --> S[Store in Local Cache]
```

### 2.2 Dashboard Subscription Architecture

```typescript
// Real-time Subscription Manager
interface DashboardSubscription {
  // Grade-level subscriptions for teachers
  subscribeToGradeLevel(gradeLevel: number, callback: UpdateCallback): Subscription;
  
  // School-wide subscriptions for administrators
  subscribeToSchoolWide(callback: UpdateCallback): Subscription;
  
  // Student-specific subscriptions
  subscribeToStudent(studentId: string, callback: UpdateCallback): Subscription;
  
  // Intervention updates
  subscribeToInterventions(callback: UpdateCallback): Subscription;
}

interface UpdateCallback {
  onAttendanceUpdate(update: AttendanceUpdate): void;
  onInterventionUpdate(update: InterventionUpdate): void;
  onStudentSummaryUpdate(update: StudentSummaryUpdate): void;
  onKPIUpdate(update: KPIUpdate): void;
}

// Supabase Realtime Configuration
const realtimeConfig = {
  channels: [
    {
      name: 'attendance_updates',
      table: 'attendance_records',
      filter: `grade_level=eq.${userGradeLevel}`,
      events: ['INSERT', 'UPDATE']
    },
    {
      name: 'intervention_updates',
      table: 'interventions',
      filter: `created_by=eq.${userEmployeeId}`,
      events: ['INSERT', 'UPDATE', 'DELETE']
    }
  ]
};
```

## 3. Integration Data Flow

### 3.1 Aeries SIS Integration

```mermaid
sequenceDiagram
    participant AS as Aeries SIS
    participant SF as Supabase Function
    participant DB as PostgreSQL
    participant UI as Dashboard UI
    
    Note over AS,UI: Nightly Batch Sync Process
    
    AS->>SF: Export Student Roster CSV
    AS->>SF: Export Daily Attendance CSV
    
    SF->>SF: Validate File Integrity
    SF->>DB: Begin Transaction
    
    loop For Each Student Record
        SF->>DB: Upsert Student
        SF->>DB: Insert/Update Attendance
    end
    
    SF->>DB: Commit Transaction
    SF->>DB: Refresh Materialized Views
    SF->>UI: Broadcast Updates via Realtime
    
    UI->>UI: Update Dashboard Metrics
    UI->>UI: Refresh Student Cards
```

### 3.2 iReady Integration Flow

```mermaid
sequenceDiagram
    participant IR as iReady Platform
    participant SF as Supabase Function
    participant DB as PostgreSQL
    participant UI as Dashboard UI
    
    Note over IR,UI: Weekly Diagnostic Sync
    
    IR->>SF: Export ELA Diagnostics CSV
    IR->>SF: Export Math Diagnostics CSV
    
    SF->>SF: Classify Academic Year
    SF->>SF: Validate Score Ranges
    
    SF->>DB: Begin Transaction
    
    loop For Each Diagnostic Record
        SF->>DB: Validate Student Mapping
        SF->>DB: Insert/Update iReady Score
        SF->>DB: Calculate Growth Metrics
    end
    
    SF->>DB: Update Student Summary View
    SF->>DB: Commit Transaction
    
    SF->>UI: Trigger Dashboard Refresh
    UI->>UI: Update Academic Performance Cards
    UI->>UI: Refresh Correlation Charts
```

## 4. Data Validation Pipeline

### 4.1 Multi-Layer Validation Strategy

```mermaid
flowchart TD
    A[Raw CSV Data] --> B[File Structure Validation]
    B --> C{Valid Structure?}
    C -->|No| D[File Format Error]
    C -->|Yes| E[Header Schema Validation]
    
    E --> F{Valid Headers?}
    F -->|No| G[Schema Mismatch Error]
    F -->|Yes| H[Row Data Type Validation]
    
    H --> I{Valid Data Types?}
    I -->|No| J[Data Type Error]
    I -->|Yes| K[Business Rule Validation]
    
    K --> L{Valid Business Rules?}
    L -->|No| M[Business Logic Error]
    L -->|Yes| N[Cross-Reference Validation]
    
    N --> O{Student Exists?}
    O -->|No| P[Student Mapping Error]
    O -->|Yes| Q[Duplicate Detection]
    
    Q --> R{Duplicate Found?}
    R -->|Yes| S[Merge Strategy Decision]
    R -->|No| T[Data Ready for Insert]
    
    S --> U{Newer Data?}
    U -->|Yes| V[Update Existing Record]
    U -->|No| W[Skip Duplicate]
    
    V --> T
    W --> T
    T --> X[Successful Validation]
    
    D --> Y[Error Collection]
    G --> Y
    J --> Y
    M --> Y
    P --> Y
    Y --> Z[Generate Error Report]
```

### 4.2 Validation Rules Configuration

```typescript
// Validation Schema Definitions
interface ValidationSchema {
  attendance: {
    required: ['student_id', 'date', 'period_1_status', /* ... */];
    types: {
      student_id: 'string',
      date: 'date',
      daily_attendance_percentage: 'number'
    };
    constraints: {
      date: { minDate: '2020-08-01', maxDate: 'current_date + 30' },
      grade_level: { min: 6, max: 8 },
      daily_attendance_percentage: { min: 0, max: 100 }
    };
  };
  
  iready: {
    required: ['student_id', 'subject', 'diagnostic_date', 'overall_scale_score'];
    types: {
      overall_scale_score: 'integer',
      academic_year: 'enum'
    };
    constraints: {
      overall_scale_score: { min: 100, max: 800 },
      subject: { enum: ['ELA', 'MATH'] }
    };
    conditionalRequirements: {
      ela: ['phonological_awareness_score', 'phonics_score', /* ... */],
      math: ['number_and_operations_score', 'algebra_and_algebraic_thinking_score', /* ... */]
    };
  };
}
```

## 5. Error Handling and Recovery

### 5.1 Error Classification and Recovery

```mermaid
flowchart TD
    A[Processing Error Detected] --> B{Error Type?}
    
    B -->|Validation Error| C[Data Quality Issue]
    B -->|System Error| D[Infrastructure Issue]
    B -->|Business Rule Error| E[Logic Violation]
    
    C --> F[Flag Record for Review]
    D --> G[Retry with Exponential Backoff]
    E --> H[Administrator Notification]
    
    F --> I[Continue Processing Other Records]
    G --> J{Retry Successful?}
    H --> K[Manual Review Required]
    
    J -->|Yes| L[Mark as Resolved]
    J -->|No| M[Escalate to System Admin]
    
    I --> N[Generate Exception Report]
    K --> N
    L --> O[Process Complete]
    M --> P[System Health Alert]
    
    N --> Q[Schedule Manual Review]
    P --> Q
    Q --> R[End Processing with Partial Success]
```

### 5.2 Data Recovery Strategies

```typescript
// Error Recovery Service
interface DataRecoveryService {
  // Retry failed imports with intelligent backoff
  retryFailedImports(failedJobs: FailedJob[]): Promise<RecoveryResult>;
  
  // Recover from partial imports
  resumePartialImport(importId: string, lastProcessedRow: number): Promise<void>;
  
  // Data integrity verification
  verifyDataIntegrity(tableName: string, importBatch: string): Promise<IntegrityReport>;
  
  // Rollback capabilities for critical failures
  rollbackImport(importId: string): Promise<RollbackResult>;
}

interface RecoveryStrategy {
  maxRetries: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
  escalationThreshold: number;
  notificationChannels: NotificationChannel[];
}
```

## 6. Performance Optimization

### 6.1 Batch Processing Strategy

- **Chunk Size**: Process CSV files in 1000-record batches
- **Parallel Processing**: Utilize multiple Edge Functions for concurrent processing
- **Memory Management**: Stream large files to prevent memory exhaustion
- **Progress Tracking**: Real-time progress updates for long-running imports

### 6.2 Caching Strategy

- **Student Summary Cache**: Redis cache for frequently accessed student data
- **Dashboard Metrics Cache**: 5-minute TTL for KPI calculations
- **Static Reference Data**: Long-term caching for grade levels, school calendar

### 6.3 Database Optimization

- **Materialized Views**: Pre-calculated aggregations for dashboard queries
- **Partitioning**: Attendance records partitioned by school year
- **Indexing Strategy**: Optimized indexes for common query patterns
- **Connection Pooling**: Efficient database connection management

## 7. Monitoring and Observability

### 7.1 Data Flow Monitoring

```mermaid
graph LR
    A[CSV Upload] --> B[Processing Metrics]
    B --> C[Success Rate Tracking]
    B --> D[Performance Metrics]
    B --> E[Error Rate Monitoring]
    
    C --> F[Alerting Rules]
    D --> F
    E --> F
    
    F --> G[Administrator Notifications]
    F --> H[System Health Dashboard]
```

### 7.2 Key Performance Indicators

- **Import Success Rate**: Target >99% for routine imports
- **Processing Time**: <5 minutes for 1000-record attendance files
- **Real-time Latency**: <100ms for dashboard updates
- **Data Quality Score**: Automated scoring based on validation rules
- **System Availability**: 99.9% uptime target for dashboard access

---

**Last Updated**: 2025-07-29  
**Version**: 1.0  
**Next Review**: 2025-08-29