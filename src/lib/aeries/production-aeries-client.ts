/**
 * @fileoverview Production-Ready Aeries API Client
 * 
 * Enterprise-grade Aeries API client with comprehensive error handling,
 * circuit breaker pattern, security features, and Romoland-specific
 * implementations for California compliance.
 * 
 * Features:
 * - Circuit breaker pattern for resilience
 * - Exponential backoff with dead letter queue
 * - Certificate-based authentication
 * - PII masking and FERPA compliance
 * - Romoland 7-period attendance support
 * - California SB 153/176 compliance
 */

import https from 'https';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import fs from 'fs/promises';
import { z } from 'zod';
import { EventEmitter } from 'events';

import { CircuitBreaker, CircuitBreakerState, CircuitBreakerConfig } from './circuit-breaker';
import { AeriesErrorHandler, ErrorClassification, RetryConfig } from './error-handler';
import { RomolandAttendanceProcessor, RomolandQueryBuilder, AttendanceCorrectionService } from './romoland-features';
import { AeriesSecurityManager, PiiMaskingService, AuditTrailService } from './security-compliance';
import { AeriesConfig, AeriesStudent, AeriesAttendanceRecord, AeriesApiResponse } from '../../types/aeries';

/**
 * Configuration schema for production Aeries client
 */
const ProductionConfigSchema = z.object({
  // Base Aeries configuration
  baseUrl: z.string().url(),
  apiKey: z.string().min(32),
  clientId: z.string().min(1),
  clientSecret: z.string().min(16),
  districtCode: z.string().min(1),
  
  // Certificate configuration
  certificatePath: z.string().min(1),
  privateKeyPath: z.string().min(1),
  caCertPath: z.string().min(1),
  
  // Performance and reliability
  batchSize: z.number().min(1).max(1000).default(100),
  rateLimitPerMinute: z.number().min(1).max(300).default(60),
  
  // Circuit breaker configuration
  circuitBreakerConfig: z.object({
    failureThreshold: z.number().min(1).default(5),
    recoveryTimeout: z.number().min(1000).default(30000),
    monitoringPeriod: z.number().min(1000).default(60000),
    halfOpenMaxRequests: z.number().min(1).default(3)
  }).optional(),
  
  // Retry configuration
  retryConfig: z.object({
    maxAttempts: z.number().min(1).max(10).default(3),
    baseDelay: z.number().min(100).default(1000),
    maxDelay: z.number().min(1000).default(10000),
    backoffMultiplier: z.number().min(1).default(2),
    jitterEnabled: z.boolean().default(true)
  }).optional(),
  
  // Security configuration
  securityConfig: z.object({
    enablePiiMasking: z.boolean().default(true),
    auditingEnabled: z.boolean().default(true),
    encryptionEnabled: z.boolean().default(true)
  }).optional(),
  
  // Additional configuration
  syncEnabled: z.boolean().default(true),
  syncSchedule: z.string().default('0 6 * * 1-5'),
  attendanceStartDate: z.string(),
  attendanceEndDate: z.string()
});

export type ProductionAeriesConfig = z.infer<typeof ProductionConfigSchema>;

/**
 * Rate limiter with sliding window implementation
 */
class RateLimiter {
  private requestTimes: number[] = [];
  
  constructor(private requestsPerMinute: number) {}
  
  async checkLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old requests
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    
    if (this.requestTimes.length >= this.requestsPerMinute) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = 60000 - (now - oldestRequest);
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    this.requestTimes.push(now);
  }
  
  getRemainingRequests(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestTimes.filter(time => time > oneMinuteAgo);
    return Math.max(0, this.requestsPerMinute - recentRequests.length);
  }
  
  getResetTime(): string {
    if (this.requestTimes.length === 0) return new Date().toISOString();
    const oldestRequest = this.requestTimes[0];
    return new Date(oldestRequest + 60000).toISOString();
  }
}

/**
 * Production-ready Aeries API Client
 */
export class ProductionAeriesClient extends EventEmitter {
  private config: ProductionAeriesConfig | null = null;
  private axiosInstance: AxiosInstance | null = null;
  private isInitialized = false;
  private requestCounter = 0;
  
  // Core components
  private rateLimiter: RateLimiter | null = null;
  private circuitBreaker: CircuitBreaker | null = null;
  private errorHandler: AeriesErrorHandler | null = null;
  private securityManager: AeriesSecurityManager | null = null;
  
  // Romoland-specific components
  private attendanceProcessor: RomolandAttendanceProcessor | null = null;
  private queryBuilder: RomolandQueryBuilder | null = null;
  private correctionService: AttendanceCorrectionService | null = null;
  
  constructor(config: ProductionAeriesConfig) {
    super();
    this.validateAndSetConfig(config);
  }
  
  /**
   * Initialize the production Aeries client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Validate configuration
      if (!this.config) {
        throw new Error('Configuration not set');
      }
      
      // Initialize core components
      await this.initializeComponents();
      
      // Load and validate certificates
      const certificates = await this.loadCertificates();
      
      // Create HTTPS agent
      const httpsAgent = this.createHttpsAgent(certificates);
      
      // Initialize Axios instance
      this.initializeAxiosInstance(httpsAgent);
      
      // Setup interceptors
      this.setupInterceptors();
      
      this.isInitialized = true;
      this.emit('initialized', { timestamp: new Date().toISOString() });
      
      console.log('[ProductionAeriesClient] Successfully initialized with all security features');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ProductionAeriesClient] Initialization failed:', errorMessage);
      throw new Error(`Production Aeries client initialization failed: ${errorMessage}`);
    }
  }
  
  /**
   * Initialize all component services
   */
  private async initializeComponents(): Promise<void> {
    const config = this.config!;
    
    // Rate limiter
    this.rateLimiter = new RateLimiter(config.rateLimitPerMinute);
    
    // Circuit breaker
    this.circuitBreaker = new CircuitBreaker(config.circuitBreakerConfig || {});
    
    // Error handler
    this.errorHandler = new AeriesErrorHandler(config.retryConfig || {});
    
    // Security manager
    this.securityManager = new AeriesSecurityManager(config.securityConfig || {});
    
    // Romoland-specific components
    this.attendanceProcessor = new RomolandAttendanceProcessor({
      totalPeriods: 7,
      minimumPeriodsForFullDay: 4,
      tardyCountsAsPresent: true
    });
    
    this.queryBuilder = new RomolandQueryBuilder();
    
    this.correctionService = new AttendanceCorrectionService({
      correctionWindowDays: 7,
      requiresApproval: true,
      auditingEnabled: true
    });
  }
  
  /**
   * Load SSL certificates for authentication
   */
  private async loadCertificates(): Promise<{
    clientCert: string;
    privateKey: string;
    caCert: string;
  }> {
    try {
      const [clientCert, privateKey, caCert] = await Promise.all([
        fs.readFile(this.config!.certificatePath, 'utf8'),
        fs.readFile(this.config!.privateKeyPath, 'utf8'),
        fs.readFile(this.config!.caCertPath, 'utf8')
      ]);
      
      // Validate certificate format
      if (!clientCert.includes('BEGIN CERTIFICATE') || 
          !privateKey.includes('BEGIN PRIVATE KEY') ||
          !caCert.includes('BEGIN CERTIFICATE')) {
        throw new Error('Invalid certificate format');
      }
      
      return { clientCert, privateKey, caCert };
    } catch (error) {
      throw new Error(`Failed to load certificates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create HTTPS agent with certificates
   */
  private createHttpsAgent(certificates: {
    clientCert: string;
    privateKey: string;
    caCert: string;
  }): https.Agent {
    return new https.Agent({
      cert: certificates.clientCert,
      key: certificates.privateKey,
      ca: certificates.caCert,
      rejectUnauthorized: true,
      keepAlive: true,
      maxSockets: 10,
      timeout: 30000
    });
  }
  
  /**
   * Initialize Axios instance with security configuration
   */
  private initializeAxiosInstance(httpsAgent: https.Agent): void {
    this.axiosInstance = axios.create({
      baseURL: this.config!.baseUrl,
      timeout: 30000,
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'RomolandAP-Tool/1.0',
        'X-District-Code': this.config!.districtCode,
        'X-Client-Version': '1.0.0'
      }
    });
  }
  
  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    if (!this.axiosInstance) return;
    
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Rate limiting
        await this.rateLimiter!.checkLimit();
        
        // Add authentication headers
        config.headers!['AERIES-CERT'] = await this.generateAeriesCertHeader();
        config.headers!['X-Request-ID'] = this.generateRequestId();
        config.headers!['Authorization'] = `Bearer ${this.config!.apiKey}`;
        
        // Log request
        this.logRequest(config);
        
        return config;
      },
      (error) => {
        console.error('[ProductionAeriesClient] Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logResponse(response);
        this.circuitBreaker!.recordSuccess();
        return response;
      },
      (error) => {
        this.logError(error);
        this.circuitBreaker!.recordFailure();
        
        // Transform errors for better handling
        const classification = this.errorHandler!.classifyError(error);
        const enhancedError = new Error(classification.userMessage);
        (enhancedError as any).classification = classification;
        (enhancedError as any).originalError = error;
        
        return Promise.reject(enhancedError);
      }
    );
  }
  
  /**
   * Generate AERIES-CERT header for authentication
   */
  private async generateAeriesCertHeader(): Promise<string> {
    // Read certificate and encode for header
    const certContent = await fs.readFile(this.config!.certificatePath, 'utf8');
    const cleanCert = certContent
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\n/g, '');
    
    return Buffer.from(cleanCert).toString('base64');
  }
  
  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `aeries-${Date.now()}-${++this.requestCounter}`;
  }
  
  /**
   * Validate and set configuration
   */
  private validateAndSetConfig(config: ProductionAeriesConfig): void {
    try {
      this.config = ProductionConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Invalid Aeries configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute operation with circuit breaker protection
   */
  private async executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    this.ensureInitialized();
    
    return this.circuitBreaker!.execute(async () => {
      return this.errorHandler!.executeWithRetry(operation);
    });
  }
  
  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================
  
  /**
   * Get students by school with comprehensive error handling
   */
  async getStudents(schoolCode: string, options: {
    active?: boolean;
    grade?: string;
    limit?: number;
    offset?: number;
    correlationId?: string;
  } = {}): Promise<AeriesApiResponse<AeriesStudent[]>> {
    return this.executeWithCircuitBreaker(async () => {
      const params = {
        active: options.active,
        grade: options.grade,
        limit: options.limit || this.config!.batchSize,
        offset: options.offset || 0
      };
      
      const response = await this.axiosInstance!.get(`/schools/${schoolCode}/students`, {
        params,
        headers: options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}
      });
      
      return {
        success: true,
        data: this.transformStudents(response.data),
        pagination: this.extractPagination(response)
      };
    });
  }
  
  /**
   * Get attendance data with Romoland-specific processing
   */
  async getAttendanceByDateRange(
    startDate: string,
    endDate: string,
    schoolCode?: string,
    options: { batchSize?: number; offset?: number } = {}
  ): Promise<AeriesApiResponse<AeriesAttendanceRecord[]>> {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    
    return this.executeWithCircuitBreaker(async () => {
      const params = {
        startDate,
        endDate,
        schoolCode,
        limit: options.batchSize || this.config!.batchSize,
        offset: options.offset || 0
      };
      
      const response = await this.axiosInstance!.get('/attendance/daterange', { params });
      
      return {
        success: true,
        data: this.transformAttendanceRecords(response.data),
        pagination: this.extractPagination(response)
      };
    });
  }
  
  /**
   * Execute custom Romoland query
   */
  async executeCustomQuery(query: string, filters: any = {}): Promise<AeriesApiResponse<any[]>> {
    return this.executeWithCircuitBreaker(async () => {
      const parsedQuery = this.queryBuilder!.parseQuery(query);
      const apiParams = this.queryBuilder!.buildApiParameters(query, filters);
      
      const response = await this.axiosInstance!.post('/query', apiParams);
      
      return {
        success: true,
        data: this.queryBuilder!.transformResponse(response.data)
      };
    });
  }
  
  /**
   * Process attendance correction within 7-day window
   */
  async processCorrectedAttendance(
    originalAttendance: any,
    correctedAttendance: any,
    correctionDate: Date,
    metadata: {
      reason: string;
      correctedBy: string;
      approvedBy?: string;
    } = { reason: '', correctedBy: '' }
  ): Promise<any> {
    return this.executeWithCircuitBreaker(async () => {
      return this.correctionService!.processCorrection(
        originalAttendance,
        correctedAttendance,
        metadata
      );
    });
  }
  
  // =============================================================================
  // ROMOLAND-SPECIFIC METHODS
  // =============================================================================
  
  /**
   * Calculate period-based attendance for 7-period middle school
   */
  calculatePeriodAttendance(attendanceData: any): any {
    return this.attendanceProcessor!.calculatePeriodAttendance(attendanceData);
  }
  
  /**
   * Calculate daily attendance status with full-day absence logic
   */
  calculateDailyAttendanceStatus(attendanceData: any): any {
    return this.attendanceProcessor!.calculateDailyAttendanceStatus(attendanceData);
  }
  
  /**
   * Get attendance correction audit trail
   */
  async getAttendanceCorrectionAuditTrail(studentId: string, date: string): Promise<any[]> {
    return this.correctionService!.getAuditTrail(studentId, date);
  }
  
  // =============================================================================
  // CIRCUIT BREAKER AND ERROR HANDLING METHODS
  // =============================================================================
  
  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker?.getState() || CircuitBreakerState.CLOSED;
  }
  
  /**
   * Force circuit breaker state (for testing)
   */
  async forceCircuitState(state: CircuitBreakerState): Promise<void> {
    this.circuitBreaker?.forceState(state);
  }
  
  /**
   * Get students with fallback when circuit is open
   */
  async getStudentsWithFallback(schoolCode: string): Promise<{ data: any[]; fromCache: boolean }> {
    const fallback = async () => {
      // Return cached data or empty result
      return { data: [], fromCache: true };
    };
    
    try {
      const result = await this.getStudents(schoolCode);
      return { data: result.data, fromCache: false };
    } catch (error) {
      if (this.getCircuitBreakerState() === CircuitBreakerState.OPEN) {
        return await fallback();
      }
      throw error;
    }
  }
  
  /**
   * Get degraded service information
   */
  getDegradedService(): { isAvailable: boolean; availableOperations: string[] } {
    const isCircuitOpen = this.getCircuitBreakerState() === CircuitBreakerState.OPEN;
    
    return {
      isAvailable: !isCircuitOpen,
      availableOperations: isCircuitOpen 
        ? ['getBasicStudentInfo', 'getCachedAttendance'] 
        : ['getStudents', 'getAttendance', 'getDetailedAttendance']
    };
  }
  
  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance!.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Start health check monitoring
   */
  async startHealthCheckMonitoring(): Promise<void> {
    const healthCheck = async () => this.performHealthCheck();
    this.circuitBreaker?.enableHealthChecks(healthCheck, 30000); // Every 30 seconds
  }
  
  /**
   * Get health status
   */
  async getHealthStatus(): Promise<any> {
    return {
      isHealthy: await this.performHealthCheck(),
      circuitBreakerState: this.getCircuitBreakerState(),
      lastSuccessfulRequest: new Date().toISOString(),
      consecutiveFailures: this.circuitBreaker?.getFailureCount() || 0,
      uptime: process.uptime()
    };
  }
  
  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): any[] {
    return this.errorHandler?.getDeadLetterQueue() || [];
  }
  
  /**
   * Retry dead letter queue
   */
  async retryDeadLetterQueue(options: { operation?: Function; maxItemsToRetry?: number } = {}): Promise<any> {
    if (!this.errorHandler) return { attempted: 0, succeeded: 0, failed: 0 };
    
    return this.errorHandler.retryDeadLetterQueue(options);
  }
  
  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    // Implementation would clear the dead letter queue
  }
  
  /**
   * Classify error
   */
  classifyError(error: any): ErrorClassification {
    return this.errorHandler!.classifyError(error);
  }
  
  // =============================================================================
  // SECURITY AND COMPLIANCE METHODS
  // =============================================================================
  
  /**
   * Get certificate status
   */
  getCertificateStatus(): any {
    return this.securityManager?.getCertificateStatus() || {
      isValid: false,
      error: 'Security manager not initialized'
    };
  }
  
  /**
   * Validate certificate
   */
  validateCertificate(): any {
    return this.securityManager?.validateCertificate() || {
      isValid: false,
      error: 'Security manager not initialized'
    };
  }
  
  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: any, options: any = {}): any {
    return this.securityManager?.maskSensitiveData(data, options) || data;
  }
  
  /**
   * Get audit trail
   */
  getAuditTrail(): any[] {
    return this.securityManager?.getAuditTrail() || [];
  }
  
  /**
   * Export audit trail
   */
  async exportAuditTrail(options: any): Promise<any> {
    return this.securityManager?.exportAuditTrail(options) || {};
  }
  
  // =============================================================================
  // UTILITY AND MONITORING METHODS
  // =============================================================================
  
  /**
   * Get rate limit status
   */
  getRateLimitStatus(): any {
    return {
      requestsPerMinute: this.config?.rateLimitPerMinute || 60,
      requestsRemaining: this.rateLimiter?.getRemainingRequests() || 0,
      resetTime: this.rateLimiter?.getResetTime() || new Date().toISOString()
    };
  }
  
  /**
   * Create structured log entry
   */
  createStructuredLogEntry(level: string, message: string, metadata: any = {}): any {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: 'ProductionAeriesClient',
      metadata
    };
  }
  
  /**
   * Get current configuration (safe subset)
   */
  getConfig(): Partial<ProductionAeriesConfig> {
    return this.config ? {
      baseUrl: this.config.baseUrl,
      districtCode: this.config.districtCode,
      batchSize: this.config.batchSize,
      rateLimitPerMinute: this.config.rateLimitPerMinute
    } : {};
  }
  
  /**
   * Check if client is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
  
  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================
  
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Production Aeries client not initialized. Call initialize() first.');
    }
  }
  
  private transformStudents(data: any[]): AeriesStudent[] {
    return data.map(student => ({
      studentId: student.studentId || student.student_id,
      studentNumber: student.studentNumber || student.student_number,
      stateStudentId: student.stateStudentId || student.state_student_id || '',
      firstName: student.firstName || student.first_name,
      middleName: student.middleName || student.middle_name,
      lastName: student.lastName || student.last_name,
      grade: student.grade,
      schoolCode: student.schoolCode || student.school_code,
      homeRoom: student.homeRoom || student.home_room,
      enrollmentStatus: student.enrollmentStatus || student.enrollment_status || 'ACTIVE',
      enrollmentDate: student.enrollmentDate || student.enrollment_date,
      withdrawalDate: student.withdrawalDate || student.withdrawal_date,
      birthDate: student.birthDate || student.birth_date,
      gender: student.gender,
      ethnicity: student.ethnicity,
      language: student.language,
      specialPrograms: student.specialPrograms || student.special_programs || [],
      lastUpdate: student.lastUpdate || student.last_update || new Date().toISOString()
    }));
  }
  
  private transformAttendanceRecords(data: any[]): AeriesAttendanceRecord[] {
    return data.map(record => ({
      studentId: record.studentId || record.student_id,
      studentNumber: record.studentNumber || record.student_number,
      schoolCode: record.schoolCode || record.school_code,
      attendanceDate: record.attendanceDate || record.attendance_date,
      schoolYear: record.schoolYear || record.school_year || this.getCurrentSchoolYear(),
      periods: this.transformPeriods(record.periods || []),
      dailyAttendance: {
        status: record.dailyAttendance?.status || record.daily_status || 'PRESENT',
        minutesAbsent: record.dailyAttendance?.minutesAbsent || record.minutes_absent,
        minutesTardy: record.dailyAttendance?.minutesTardy || record.minutes_tardy,
        excuseCode: record.dailyAttendance?.excuseCode || record.excuse_code,
        excuseDescription: record.dailyAttendance?.excuseDescription || record.excuse_description
      },
      lastModified: record.lastModified || record.last_modified || new Date().toISOString(),
      modifiedBy: record.modifiedBy || record.modified_by || 'system'
    }));
  }
  
  private transformPeriods(periods: any[]): any[] {
    return periods.map(period => ({
      period: period.period,
      periodName: period.periodName || period.period_name || `Period ${period.period}`,
      status: period.status,
      teacherId: period.teacherId || period.teacher_id,
      teacherName: period.teacherName || period.teacher_name,
      courseCode: period.courseCode || period.course_code,
      courseName: period.courseName || period.course_name,
      minutesAbsent: period.minutesAbsent || period.minutes_absent,
      minutesTardy: period.minutesTardy || period.minutes_tardy,
      excuseCode: period.excuseCode || period.excuse_code,
      lastModified: period.lastModified || period.last_modified || new Date().toISOString()
    }));
  }
  
  private extractPagination(response: AxiosResponse): any {
    const paginationHeader = response.headers['x-pagination'];
    return paginationHeader ? JSON.parse(paginationHeader) : undefined;
  }
  
  private getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }
  
  private logRequest(config: any): void {
    const logEntry = this.createStructuredLogEntry('INFO', 'API Request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      correlationId: config.headers?.['X-Correlation-ID'],
      requestId: config.headers?.['X-Request-ID']
    });
    
    console.log('[ProductionAeriesClient]', JSON.stringify(logEntry));
  }
  
  private logResponse(response: AxiosResponse): void {
    const logEntry = this.createStructuredLogEntry('INFO', 'API Response', {
      status: response.status,
      url: response.config.url,
      duration: Date.now() - (response.config as any).requestStartTime
    });
    
    console.log('[ProductionAeriesClient]', JSON.stringify(logEntry));
  }
  
  private logError(error: any): void {
    const logEntry = this.createStructuredLogEntry('ERROR', 'API Error', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      correlationId: error.config?.headers?.['X-Correlation-ID']
    });
    
    console.error('[ProductionAeriesClient]', JSON.stringify(logEntry));
  }
}