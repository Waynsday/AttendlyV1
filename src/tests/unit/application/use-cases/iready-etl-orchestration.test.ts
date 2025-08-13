/**
 * TDD Tests for IReady ETL Orchestration Use Cases
 * 
 * This test suite follows strict TDD methodology for application-layer use cases
 * that orchestrate the complete iReady ETL pipeline. Use cases coordinate domain
 * services, ports, and business workflows to fulfill application requirements.
 * 
 * Key Use Cases Under Test:
 * - ProcessMultiYearDiagnosticsUseCase: Complete multi-year data processing
 * - ProcessSingleFileUseCase: Individual CSV file processing
 * - DataQualityAssessmentUseCase: Comprehensive data quality evaluation
 * - ProgressReportingUseCase: Real-time ETL progress tracking
 * - ErrorRecoveryUseCase: Failure handling and recovery workflows
 * 
 * These tests WILL FAIL until the use case classes are implemented.
 * This is intentional and follows the Red-Green-Refactor TDD cycle.
 * 
 * @group unit
 * @group application
 * @group use-cases
 * @group iready
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { 
  ProcessMultiYearDiagnosticsUseCase,
  ProcessSingleFileUseCase,
  DataQualityAssessmentUseCase,
  ProgressReportingUseCase,
  ErrorRecoveryUseCase
} from '../../../../application/use-cases'
import {
  DataExtractor,
  DataTransformer,
  DataLoader
} from '../../../../core/etl'
import {
  DataQualityAnalyzer,
  ValidationService,
  ReportingService
} from '../../../../core/services'
import {
  FileSystemPort,
  IReadyRepositoryPort,
  ConfigurationPort,
  LoggingPort
} from '../../../../core/ports'
import {
  IReadyDiagnosticResult,
  StudentId,
  AcademicYear,
  Subject,
  ScaleScore,
  PlacementLevel,
  DiagnosticDate
} from '../../../../core/domain/iready'
import {
  ETLError,
  UseCaseError,
  InfrastructureError
} from '../../../../core/domain/iready/errors'

describe('ProcessMultiYearDiagnosticsUseCase', () => {
  let mockExtractor: DataExtractor
  let mockTransformer: DataTransformer
  let mockLoader: DataLoader
  let mockQualityAnalyzer: DataQualityAnalyzer
  let mockValidationService: ValidationService
  let mockConfiguration: ConfigurationPort
  let mockLogging: LoggingPort
  let useCase: ProcessMultiYearDiagnosticsUseCase

  beforeEach(() => {
    mockExtractor = {
      discoverCSVFiles: jest.fn(),
      extractCSVData: jest.fn()
    } as any

    mockTransformer = {
      transformToIReadyResult: jest.fn(),
      transformBatch: jest.fn()
    } as any

    mockLoader = {
      loadSingle: jest.fn(),
      loadBatch: jest.fn()
    } as any

    mockQualityAnalyzer = {
      analyzeRecord: jest.fn(),
      analyzeBatch: jest.fn()
    } as any

    mockValidationService = {
      validateRequiredFields: jest.fn(),
      validateAcademicYearConsistency: jest.fn(),
      validatePlacementAlignment: jest.fn()
    } as any

    mockConfiguration = {
      get: jest.fn(),
      getRequired: jest.fn(),
      getAcademicYearMapping: jest.fn(),
      getBatchSize: jest.fn(),
      getValidationRules: jest.fn()
    }

    mockLogging = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      logETLOperation: jest.fn(),
      logDataQualityIssue: jest.fn()
    }
  })

  describe('Complete Multi-Year Processing', () => {
    it('should process all three academic years with comprehensive reporting', async () => {
      // This test will fail until ProcessMultiYearDiagnosticsUseCase is implemented
      const request = {
        rootDataPath: '/data/iReady',
        yearFolders: [
          { folder: 'Current_Year', academicYear: AcademicYear.CURRENT_YEAR, schoolYear: '2024-2025' },
          { folder: 'Current_Year-1', academicYear: AcademicYear.CURRENT_YEAR_MINUS_1, schoolYear: '2023-2024' },
          { folder: 'Current_Year-2', academicYear: AcademicYear.CURRENT_YEAR_MINUS_2, schoolYear: '2022-2023' }
        ],
        processingOptions: {
          skipDuplicates: true,
          validateDataQuality: true,
          batchSize: 100,
          enableProgressReporting: true
        }
      }

      // Mock successful discovery and processing
      mockExtractor.discoverCSVFiles = jest.fn()
        .mockResolvedValueOnce([{ path: '/data/Current_Year/ela.csv', subject: Subject.ELA }])
        .mockResolvedValueOnce([{ path: '/data/Current_Year-1/ela.csv', subject: Subject.ELA }])
        .mockResolvedValueOnce([{ path: '/data/Current_Year-2/ela.csv', subject: Subject.ELA }])

      mockExtractor.extractCSVData = jest.fn().mockResolvedValue([
        { 'Student ID': 'STU001', 'Student Name': 'Test Student', 'Grade': '7' }
      ])

      mockTransformer.transformBatch = jest.fn().mockResolvedValue({
        successful: 1,
        failed: 0,
        domainObjects: [
          IReadyDiagnosticResult.create({
            studentId: StudentId.create('STU001'),
            academicYear: AcademicYear.CURRENT_YEAR,
            subject: Subject.ELA,
            diagnosticDate: DiagnosticDate.fromString('2025-01-15'),
            gradeLevel: 7,
            overallScaleScore: ScaleScore.create(450),
            overallPlacement: PlacementLevel.ON_GRADE_LEVEL,
            schoolYear: '2024-2025'
          })
        ]
      })

      mockLoader.loadBatch = jest.fn().mockResolvedValue({
        successful: 1,
        failed: 0,
        results: []
      })

      mockQualityAnalyzer.analyzeBatch = jest.fn().mockResolvedValue({
        overallQualityScore: 0.95,
        recordCount: 1,
        issueCount: 0
      })

      mockConfiguration.getBatchSize = jest.fn().mockResolvedValue(100)
      mockConfiguration.getAcademicYearMapping = jest.fn().mockResolvedValue({
        'Current_Year': '2024-2025',
        'Current_Year-1': '2023-2024',
        'Current_Year-2': '2022-2023'
      })

      useCase = new ProcessMultiYearDiagnosticsUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockQualityAnalyzer,
        mockValidationService,
        mockConfiguration,
        mockLogging
      )

      const progressCallback = jest.fn()
      const response = await useCase.execute(request, progressCallback)
      
      expect(response.success).toBe(true)
      expect(response.processedYears).toBe(3)
      expect(response.totalRecordsProcessed).toBe(3) // One record per year
      expect(response.totalRecordsLoaded).toBe(3)
      expect(response.overallDataQualityScore).toBeGreaterThanOrEqual(0.9)
      expect(response.processingDuration).toBeGreaterThan(0)
      
      // Verify progress reporting
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: expect.stringContaining('PROCESSING'),
          currentYear: expect.any(String),
          progress: expect.any(Number)
        })
      )
    })

    it('should handle partial failures across academic years', async () => {
      // This test will fail until error handling is implemented
      const request = {
        rootDataPath: '/data/iReady',
        yearFolders: [
          { folder: 'Current_Year', academicYear: AcademicYear.CURRENT_YEAR, schoolYear: '2024-2025' },
          { folder: 'Missing_Year', academicYear: AcademicYear.CURRENT_YEAR_MINUS_1, schoolYear: '2023-2024' }
        ],
        processingOptions: {
          continueOnError: true,
          skipDuplicates: true
        }
      }

      mockExtractor.discoverCSVFiles = jest.fn()
        .mockResolvedValueOnce([{ path: '/data/Current_Year/ela.csv', subject: Subject.ELA }])
        .mockRejectedValueOnce(new ETLError('Directory not found: Missing_Year'))

      mockExtractor.extractCSVData = jest.fn().mockResolvedValue([
        { 'Student ID': 'STU001', 'Grade': '7' }
      ])

      mockTransformer.transformBatch = jest.fn().mockResolvedValue({
        successful: 1,
        failed: 0,
        domainObjects: [
          IReadyDiagnosticResult.create({
            studentId: StudentId.create('STU001'),
            academicYear: AcademicYear.CURRENT_YEAR,
            subject: Subject.ELA,
            diagnosticDate: DiagnosticDate.fromString('2025-01-15'),
            gradeLevel: 7,
            overallScaleScore: ScaleScore.create(450),
            overallPlacement: PlacementLevel.ON_GRADE_LEVEL,
            schoolYear: '2024-2025'
          })
        ]
      })

      mockLoader.loadBatch = jest.fn().mockResolvedValue({
        successful: 1,
        failed: 0
      })

      mockConfiguration.getBatchSize = jest.fn().mockResolvedValue(100)

      useCase = new ProcessMultiYearDiagnosticsUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockQualityAnalyzer,
        mockValidationService,
        mockConfiguration,
        mockLogging
      )

      const response = await useCase.execute(request)
      
      expect(response.success).toBe(true) // Partial success
      expect(response.processedYears).toBe(1)
      expect(response.failedYears).toBe(1)
      expect(response.errors).toHaveLength(1)
      expect(response.errors[0]).toContain('Directory not found: Missing_Year')
    })

    it('should enforce data quality thresholds and halt processing if needed', async () => {
      // This test will fail until quality enforcement is implemented
      const request = {
        rootDataPath: '/data/iReady',
        yearFolders: [
          { folder: 'Current_Year', academicYear: AcademicYear.CURRENT_YEAR, schoolYear: '2024-2025' }
        ],
        processingOptions: {
          enforceQualityThreshold: true,
          minimumQualityScore: 0.8,
          haltOnLowQuality: true
        }
      }

      mockExtractor.discoverCSVFiles = jest.fn().mockResolvedValue([
        { path: '/data/Current_Year/ela.csv', subject: Subject.ELA }
      ])

      mockExtractor.extractCSVData = jest.fn().mockResolvedValue([
        { 'Student ID': 'INVALID', 'Grade': 'INVALID' } // Poor quality data
      ])

      mockTransformer.transformBatch = jest.fn().mockResolvedValue({
        successful: 0,
        failed: 1,
        domainObjects: [],
        errors: ['Invalid student ID format']
      })

      mockQualityAnalyzer.analyzeBatch = jest.fn().mockResolvedValue({
        overallQualityScore: 0.3, // Below threshold
        recordCount: 1,
        issueCount: 5,
        criticalIssueCount: 3
      })

      mockConfiguration.getBatchSize = jest.fn().mockResolvedValue(100)

      useCase = new ProcessMultiYearDiagnosticsUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockQualityAnalyzer,
        mockValidationService,
        mockConfiguration,
        mockLogging
      )

      const response = await useCase.execute(request)
      
      expect(response.success).toBe(false)
      expect(response.halted).toBe(true)
      expect(response.haltReason).toBe('DATA_QUALITY_BELOW_THRESHOLD')
      expect(response.overallDataQualityScore).toBe(0.3)
      
      expect(mockLogging.error).toHaveBeenCalledWith(
        expect.stringContaining('Processing halted due to low data quality'),
        expect.any(Object)
      )
    })
  })

  describe('Configuration-Driven Processing', () => {
    it('should adapt processing behavior based on configuration', async () => {
      // This test will fail until configuration integration is implemented
      const request = {
        rootDataPath: '/data/iReady',
        yearFolders: [
          { folder: 'Current_Year', academicYear: AcademicYear.CURRENT_YEAR, schoolYear: '2024-2025' }
        ],
        processingOptions: {
          useConfigurationDefaults: true
        }
      }

      mockConfiguration.getBatchSize = jest.fn().mockResolvedValue(250) // Custom batch size
      mockConfiguration.get = jest.fn()
        .mockResolvedValueOnce('true') // enableDetailedLogging
        .mockResolvedValueOnce('0.9') // qualityThreshold
        .mockResolvedValueOnce('false') // strictValidation

      mockExtractor.discoverCSVFiles = jest.fn().mockResolvedValue([])
      
      useCase = new ProcessMultiYearDiagnosticsUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockQualityAnalyzer,
        mockValidationService,
        mockConfiguration,
        mockLogging
      )

      await useCase.execute(request)
      
      expect(mockConfiguration.getBatchSize).toHaveBeenCalled()
      expect(mockConfiguration.get).toHaveBeenCalledWith('etl.enableDetailedLogging', 'false')
      expect(mockConfiguration.get).toHaveBeenCalledWith('dataQuality.threshold', '0.85')
      expect(mockConfiguration.get).toHaveBeenCalledWith('validation.strictMode', 'true')
    })
  })
})

describe('ProcessSingleFileUseCase', () => {
  let mockExtractor: DataExtractor
  let mockTransformer: DataTransformer
  let mockLoader: DataLoader
  let mockValidationService: ValidationService
  let mockLogging: LoggingPort
  let useCase: ProcessSingleFileUseCase

  beforeEach(() => {
    mockExtractor = {
      extractCSVData: jest.fn()
    } as any

    mockTransformer = {
      transformBatch: jest.fn()
    } as any

    mockLoader = {
      loadBatch: jest.fn()
    } as any

    mockValidationService = {
      validateRequiredFields: jest.fn(),
      validateBatch: jest.fn()
    } as any

    mockLogging = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      logETLOperation: jest.fn(),
      logDataQualityIssue: jest.fn()
    }
  })

  describe('Single File Processing', () => {
    it('should process individual CSV file with detailed validation', async () => {
      // This test will fail until ProcessSingleFileUseCase is implemented
      const request = {
        filePath: '/data/Current_Year/diagnostic_results_ela_CONFIDENTIAL.csv',
        subject: Subject.ELA,
        academicYear: AcademicYear.CURRENT_YEAR,
        schoolYear: '2024-2025',
        processingOptions: {
          validateEachRecord: true,
          reportProgress: true,
          batchSize: 50
        }
      }

      const mockRawData = [
        {
          'Student ID': 'STU001',
          'Student Name': 'Test Student',
          'Grade': '7',
          'Overall Scale Score': '450',
          'Overall Placement': 'ON_GRADE_LEVEL'
        }
      ]

      const mockDomainObject = IReadyDiagnosticResult.create({
        studentId: StudentId.create('STU001'),
        academicYear: AcademicYear.CURRENT_YEAR,
        subject: Subject.ELA,
        diagnosticDate: DiagnosticDate.fromString('2025-01-15'),
        gradeLevel: 7,
        overallScaleScore: ScaleScore.create(450),
        overallPlacement: PlacementLevel.ON_GRADE_LEVEL,
        schoolYear: '2024-2025'
      })

      mockExtractor.extractCSVData = jest.fn().mockResolvedValue(mockRawData)
      mockTransformer.transformBatch = jest.fn().mockResolvedValue({
        successful: 1,
        failed: 0,
        domainObjects: [mockDomainObject]
      })
      mockValidationService.validateBatch = jest.fn().mockResolvedValue({
        allValid: true,
        validationResults: []
      })
      mockLoader.loadBatch = jest.fn().mockResolvedValue({
        successful: 1,
        failed: 0
      })

      useCase = new ProcessSingleFileUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockValidationService,
        mockLogging
      )

      const progressCallback = jest.fn()
      const response = await useCase.execute(request, progressCallback)
      
      expect(response.success).toBe(true)
      expect(response.recordsProcessed).toBe(1)
      expect(response.recordsLoaded).toBe(1)
      expect(response.validationPassed).toBe(true)
      expect(progressCallback).toHaveBeenCalled()
    })

    it('should handle file processing errors gracefully', async () => {
      // This test will fail until error handling is implemented
      const request = {
        filePath: '/data/corrupted-file.csv',
        subject: Subject.ELA,
        academicYear: AcademicYear.CURRENT_YEAR,
        schoolYear: '2024-2025'
      }

      mockExtractor.extractCSVData = jest.fn().mockRejectedValue(
        new ETLError('CSV parsing failed: malformed data at line 15')
      )

      useCase = new ProcessSingleFileUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockValidationService,
        mockLogging
      )

      const response = await useCase.execute(request)
      
      expect(response.success).toBe(false)
      expect(response.errors).toContain('CSV parsing failed: malformed data at line 15')
      expect(mockLogging.error).toHaveBeenCalledWith(
        expect.stringContaining('File processing failed'),
        expect.objectContaining({
          filePath: '/data/corrupted-file.csv',
          error: expect.any(ETLError)
        })
      )
    })
  })
})

describe('DataQualityAssessmentUseCase', () => {
  let mockRepository: IReadyRepositoryPort
  let mockQualityAnalyzer: DataQualityAnalyzer
  let mockReportingService: ReportingService
  let mockLogging: LoggingPort
  let useCase: DataQualityAssessmentUseCase

  beforeEach(() => {
    mockRepository = {
      findByAcademicYear: jest.fn(),
      findByStudentId: jest.fn()
    } as any

    mockQualityAnalyzer = {
      analyzeBatch: jest.fn(),
      analyzeRecord: jest.fn()
    } as any

    mockReportingService = {
      generateDataQualityReport: jest.fn()
    } as any

    mockLogging = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      logETLOperation: jest.fn(),
      logDataQualityIssue: jest.fn()
    }
  })

  describe('Comprehensive Quality Assessment', () => {
    it('should assess data quality across all academic years', async () => {
      // This test will fail until DataQualityAssessmentUseCase is implemented
      const request = {
        scope: 'ALL_YEARS',
        includeHistoricalTrends: true,
        generateDetailedReport: true
      }

      const mockResults = [
        IReadyDiagnosticResult.create({
          studentId: StudentId.create('STU001'),
          academicYear: AcademicYear.CURRENT_YEAR,
          subject: Subject.ELA,
          diagnosticDate: DiagnosticDate.fromString('2025-01-15'),
          gradeLevel: 7,
          overallScaleScore: ScaleScore.create(450),
          overallPlacement: PlacementLevel.ON_GRADE_LEVEL,
          schoolYear: '2024-2025'
        })
      ]

      mockRepository.findByAcademicYear = jest.fn().mockResolvedValue(mockResults)
      mockQualityAnalyzer.analyzeBatch = jest.fn().mockResolvedValue({
        overallQualityScore: 0.92,
        recordCount: 1,
        issueCount: 2,
        criticalIssueCount: 0,
        issuesSummary: {
          'MISSING_TEACHER_NAME': 1,
          'LOW_ENGAGEMENT': 1
        }
      })
      mockReportingService.generateDataQualityReport = jest.fn().mockResolvedValue({
        executiveSummary: 'Data quality is good with minor issues',
        recommendations: ['Improve teacher name data collection']
      })

      useCase = new DataQualityAssessmentUseCase(
        mockRepository,
        mockQualityAnalyzer,
        mockReportingService,
        mockLogging
      )

      const response = await useCase.execute(request)
      
      expect(response.success).toBe(true)
      expect(response.overallQualityScore).toBe(0.92)
      expect(response.assessmentScope).toBe('ALL_YEARS')
      expect(response.totalRecordsAnalyzed).toBe(3) // One per academic year
      expect(response.detailedReport).toBeDefined()
      expect(response.recommendations).toContain('Improve teacher name data collection')
    })

    it('should identify systemic data quality issues', async () => {
      // This test will fail until systemic issue detection is implemented
      const request = {
        scope: 'CURRENT_YEAR',
        detectPatterns: true,
        flagSystemicIssues: true
      }

      const problematicResults = Array(100).fill(0).map((_, index) =>
        IReadyDiagnosticResult.create({
          studentId: StudentId.create(`STU${String(index).padStart(3, '0')}`),
          academicYear: AcademicYear.CURRENT_YEAR,
          subject: Subject.ELA,
          gradeLevel: 7,
          performanceIndicators: {
            lessonsPassed: 0, // Systemic issue - no engagement data
            lessonsAttempted: 0,
            timeOnTaskMinutes: 0
          }
        })
      )

      mockRepository.findByAcademicYear = jest.fn().mockResolvedValue(problematicResults)
      mockQualityAnalyzer.analyzeBatch = jest.fn().mockResolvedValue({
        overallQualityScore: 0.4,
        recordCount: 100,
        issueCount: 300,
        criticalIssueCount: 100,
        systematicIssues: [
          {
            type: 'ZERO_ENGAGEMENT_DATA_PATTERN',
            affectedRecords: 100,
            severity: 'CRITICAL',
            description: 'All records show zero engagement metrics'
          }
        ]
      })

      useCase = new DataQualityAssessmentUseCase(
        mockRepository,
        mockQualityAnalyzer,
        mockReportingService,
        mockLogging
      )

      const response = await useCase.execute(request)
      
      expect(response.success).toBe(true)
      expect(response.systematicIssuesDetected).toBe(true)
      expect(response.criticalIssueCount).toBe(100)
      expect(response.systemicIssues).toContainEqual(
        expect.objectContaining({
          type: 'ZERO_ENGAGEMENT_DATA_PATTERN',
          severity: 'CRITICAL'
        })
      )
    })
  })
})

describe('ErrorRecoveryUseCase', () => {
  let mockExtractor: DataExtractor
  let mockTransformer: DataTransformer
  let mockLoader: DataLoader
  let mockRepository: IReadyRepositoryPort
  let mockLogging: LoggingPort
  let useCase: ErrorRecoveryUseCase

  beforeEach(() => {
    mockExtractor = {
      extractCSVData: jest.fn()
    } as any

    mockTransformer = {
      transformBatch: jest.fn()
    } as any

    mockLoader = {
      loadBatch: jest.fn()
    } as any

    mockRepository = {
      findDuplicates: jest.fn(),
      deleteById: jest.fn()
    } as any

    mockLogging = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      logETLOperation: jest.fn(),
      logDataQualityIssue: jest.fn()
    }
  })

  describe('Failed Operation Recovery', () => {
    it('should recover from partial ETL failures with checkpoint resume', async () => {
      // This test will fail until ErrorRecoveryUseCase is implemented
      const request = {
        recoveryType: 'RESUME_FROM_CHECKPOINT',
        failedOperation: {
          operationId: 'etl-operation-123',
          lastSuccessfulBatch: 150,
          totalBatches: 300,
          filePath: '/data/large-file.csv',
          academicYear: AcademicYear.CURRENT_YEAR
        },
        recoveryOptions: {
          skipProcessedRecords: true,
          validateRecoveryData: true
        }
      }

      // Mock resuming from batch 151
      const remainingData = Array(50).fill(0).map((_, index) => ({
        'Student ID': `STU${String(index + 151).padStart(3, '0')}`,
        'Grade': '7'
      }))

      mockExtractor.extractCSVData = jest.fn().mockResolvedValue(remainingData)
      mockTransformer.transformBatch = jest.fn().mockResolvedValue({
        successful: 50,
        failed: 0,
        domainObjects: []
      })
      mockLoader.loadBatch = jest.fn().mockResolvedValue({
        successful: 50,
        failed: 0
      })

      useCase = new ErrorRecoveryUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockRepository,
        mockLogging
      )

      const response = await useCase.execute(request)
      
      expect(response.success).toBe(true)
      expect(response.recoveryType).toBe('RESUME_FROM_CHECKPOINT')
      expect(response.recordsRecovered).toBe(50)
      expect(response.resumedFromBatch).toBe(151)
      expect(mockLogging.info).toHaveBeenCalledWith(
        expect.stringContaining('Recovery completed successfully'),
        expect.any(Object)
      )
    })

    it('should handle data corruption recovery with re-processing', async () => {
      // This test will fail until corruption recovery is implemented
      const request = {
        recoveryType: 'REPROCESS_CORRUPTED_DATA',
        corruptedRecords: [
          { studentId: 'STU001', recordId: 'record-123', issue: 'INVALID_SCORE_RANGE' },
          { studentId: 'STU002', recordId: 'record-124', issue: 'MISSING_DOMAIN_SCORES' }
        ],
        recoveryOptions: {
          useDataValidation: true,
          backupCorruptedData: true
        }
      }

      mockRepository.findDuplicates = jest.fn().mockResolvedValue([]) // No duplicates
      mockRepository.deleteById = jest.fn().mockResolvedValue(true)

      // Mock re-extracting and processing corrected data
      const correctedData = [
        { 'Student ID': 'STU001', 'Overall Scale Score': '450' }, // Corrected
        { 'Student ID': 'STU002', 'Phonological Awareness': '420' } // Added missing scores
      ]

      mockExtractor.extractCSVData = jest.fn().mockResolvedValue(correctedData)
      mockTransformer.transformBatch = jest.fn().mockResolvedValue({
        successful: 2,
        failed: 0,
        domainObjects: []
      })
      mockLoader.loadBatch = jest.fn().mockResolvedValue({
        successful: 2,
        failed: 0
      })

      useCase = new ErrorRecoveryUseCase(
        mockExtractor,
        mockTransformer,
        mockLoader,
        mockRepository,
        mockLogging
      )

      const response = await useCase.execute(request)
      
      expect(response.success).toBe(true)
      expect(response.recoveryType).toBe('REPROCESS_CORRUPTED_DATA')
      expect(response.recordsRecovered).toBe(2)
      expect(response.corruptedRecordsFixed).toBe(2)
      expect(mockRepository.deleteById).toHaveBeenCalledTimes(2) // Removed corrupted records
    })
  })
})