/**
 * @fileoverview Aeries SIS API Client
 * 
 * Secure HTTP client for Aeries SIS integration with comprehensive features:
 * - SSL certificate-based authentication
 * - Rate limiting and retry logic
 * - Request/response logging for FERPA compliance
 * - Error handling with security event logging
 * - Connection pooling and timeout management
 * 
 * SECURITY REQUIREMENTS:
 * - All API calls must be authenticated with client certificates
 * - Rate limiting must prevent API abuse
 * - All requests/responses must be audited for FERPA compliance
 * - Sensitive data must be encrypted in transit and at rest
 */

import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  AeriesConfig, 
  AeriesCertificateConfig,
  AeriesApiResponse, 
  AeriesErrorResponse,
  AeriesApiClientOptions,
  AeriesApiRequestOptions,
  AeriesRateLimit,
  AeriesIntegrationEvent
} from '@/types/aeries';
import { getAeriesConfig } from './aeries-config';
import { logSecurityEvent, ErrorSeverity } from '@/lib/security/error-handler';

// =====================================================
// Rate Limiting Implementation
// =====================================================

class AeriesRateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly windowMs = 60000; // 1 minute window

  async checkRateLimit(identifier: string, limit: number): Promise<AeriesRateLimit> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Clean old entries
    for (const [key, value] of this.requestCounts.entries()) {
      if (value.resetTime < windowStart) {
        this.requestCounts.delete(key);
      }
    }

    // Get current count
    const current = this.requestCounts.get(identifier) || { count: 0, resetTime: now + this.windowMs };
    
    // Check if limit exceeded
    if (current.count >= limit) {
      const rateLimitInfo: AeriesRateLimit = {
        requestsPerMinute: limit,
        requestsRemaining: 0,
        resetTime: new Date(current.resetTime).toISOString(),
        burstLimit: Math.floor(limit * 1.5),
        currentBurstUsage: current.count
      };

      throw new Error(`Rate limit exceeded: ${current.count}/${limit} requests per minute`);
    }

    // Increment count
    current.count++;
    this.requestCounts.set(identifier, current);

    return {
      requestsPerMinute: limit,
      requestsRemaining: limit - current.count,
      resetTime: new Date(current.resetTime).toISOString(),
      burstLimit: Math.floor(limit * 1.5),
      currentBurstUsage: current.count
    };
  }
}

// =====================================================
// Aeries API Client Implementation
// =====================================================

export class AeriesApiClient {
  private axiosInstance!: AxiosInstance;
  private config!: AeriesConfig;
  private certificateConfig!: AeriesCertificateConfig;
  private rateLimiter!: AeriesRateLimiter;
  private requestCounter = 0;
  private healthCheckStatus: { isHealthy: boolean; lastCheck: Date } = {
    isHealthy: false,
    lastCheck: new Date(0)
  };

  constructor(options?: Partial<AeriesApiClientOptions>) {
    this.rateLimiter = new AeriesRateLimiter();
    this.initializeClient(options);
  }

  /**
   * Initialize the Axios client with SSL certificates and authentication
   */
  private async initializeClient(options?: Partial<AeriesApiClientOptions>): Promise<void> {
    try {
      const configService = getAeriesConfig();
      this.config = await configService.getConfiguration();
      this.certificateConfig = configService.getCertificateConfiguration()!;

      // Create HTTPS agent with client certificates
      const httpsAgent = new https.Agent({
        cert: this.certificateConfig.clientCert,
        key: this.certificateConfig.privateKey,
        ca: this.certificateConfig.caCert,
        rejectUnauthorized: true,
        keepAlive: true,
        maxSockets: 10,
        timeout: 30000
      });

      // Configure Axios instance
      this.axiosInstance = axios.create({
        baseURL: this.config.baseUrl,
        timeout: options?.timeout || 30000,
        httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AttendlyV1-AeriesClient/1.0',
          'X-Client-Id': this.config.clientId,
          'X-District-Code': this.config.districtCode
        }
      });

      // Add request interceptor for authentication and logging
      this.axiosInstance.interceptors.request.use(
        async (config) => {
          // Add API key authentication
          config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          config.headers['X-Request-ID'] = this.generateRequestId();

          // Rate limiting check
          await this.rateLimiter.checkRateLimit(
            'aeries-api',
            this.config.rateLimitPerMinute
          );

          // Log API request
          this.logApiEvent('API_CALL', 'LOW', {
            endpoint: config.url,
            method: config.method?.toUpperCase(),
          });

          return config;
        },
        (error) => {
          this.logApiEvent('ERROR', 'HIGH', {
            errorMessage: error.message
          });
          return Promise.reject(error);
        }
      );

      // Add response interceptor for logging and error handling
      this.axiosInstance.interceptors.response.use(
        (response) => {
          // Log successful response
          this.logApiEvent('API_CALL', 'LOW', {
            endpoint: response.config.url,
            method: response.config.method?.toUpperCase(),
            statusCode: response.status,
            responseTime: this.calculateResponseTime(response)
          });

          return response;
        },
        (error) => {
          // Log API error
          this.logApiEvent('ERROR', 'MEDIUM', {
            endpoint: error.config?.url,
            method: error.config?.method?.toUpperCase(),
            statusCode: error.response?.status,
            errorMessage: error.message
          });

          return Promise.reject(this.handleApiError(error));
        }
      );

      logSecurityEvent({
        type: 'AERIES_API_CLIENT_INITIALIZED',
        severity: ErrorSeverity.LOW,
        userId: 'system',
        correlationId: 'client-init',
        details: 'Aeries API client initialized successfully',
        timestamp: new Date()
      });

    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_API_CLIENT_INIT_FAILED',
        severity: ErrorSeverity.CRITICAL,
        userId: 'system',
        correlationId: 'client-init',
        details: `Failed to initialize Aeries API client: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      throw new Error(`Aeries API client initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // =====================================================
  // Public API Methods
  // =====================================================

  /**
   * Health check endpoint to verify API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request({
        method: 'GET',
        endpoint: '/health',
        timeout: 10000
      });

      this.healthCheckStatus = {
        isHealthy: response.success,
        lastCheck: new Date()
      };

      return response.success;
    } catch (error) {
      this.healthCheckStatus = {
        isHealthy: false,
        lastCheck: new Date()
      };

      logSecurityEvent({
        type: 'AERIES_HEALTH_CHECK_FAILED',
        severity: ErrorSeverity.MEDIUM,
        userId: 'system',
        correlationId: 'health-check',
        details: `Aeries health check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      return false;
    }
  }

  /**
   * Get attendance data for a specific date range
   */
  async getAttendanceByDateRange(
    startDate: string,
    endDate: string,
    schoolCode?: string,
    options?: { batchSize?: number; offset?: number }
  ): Promise<AeriesApiResponse<any[]>> {
    const params: Record<string, any> = {
      startDate,
      endDate,
      limit: options?.batchSize || this.config.batchSize,
      offset: options?.offset || 0
    };

    if (schoolCode) {
      params.schoolCode = schoolCode;
    }

    return this.request({
      method: 'GET',
      endpoint: '/attendance/daterange',
      params
    });
  }

  /**
   * Get attendance data for a specific student
   */
  async getStudentAttendance(
    studentId: string,
    startDate: string,
    endDate: string
  ): Promise<AeriesApiResponse<any[]>> {
    return this.request({
      method: 'GET',
      endpoint: `/students/${studentId}/attendance`,
      params: {
        startDate,
        endDate
      }
    });
  }

  /**
   * Get student information
   */
  async getStudent(studentId: string): Promise<AeriesApiResponse<any>> {
    return this.request({
      method: 'GET',
      endpoint: `/students/${studentId}`
    });
  }

  /**
   * Get students by school
   */
  async getStudentsBySchool(
    schoolCode: string,
    options?: { active?: boolean; grade?: string; limit?: number; offset?: number }
  ): Promise<AeriesApiResponse<any[]>> {
    const params: Record<string, any> = {
      limit: options?.limit || this.config.batchSize,
      offset: options?.offset || 0
    };

    if (options?.active !== undefined) {
      params.active = options.active;
    }

    if (options?.grade) {
      params.grade = options.grade;
    }

    return this.request({
      method: 'GET',
      endpoint: `/schools/${schoolCode}/students`,
      params
    });
  }

  /**
   * Get school information
   */
  async getSchools(): Promise<AeriesApiResponse<any[]>> {
    return this.request({
      method: 'GET',
      endpoint: '/schools'
    });
  }

  // =====================================================
  // Batch Processing Methods
  // =====================================================

  /**
   * Process attendance data in batches for the configured date range
   */
  async processAttendanceBatches(
    callback: (batch: any[], batchNumber: number) => Promise<void>,
    options?: {
      startDate?: string;
      endDate?: string;
      schoolCode?: string;
      batchSize?: number;
    }
  ): Promise<{ totalProcessed: number; totalBatches: number; errors: any[] }> {
    const startDate = options?.startDate || this.config.attendanceStartDate;
    const endDate = options?.endDate || this.config.attendanceEndDate;
    const batchSize = options?.batchSize || this.config.batchSize;
    
    let totalProcessed = 0;
    let batchNumber = 0;
    let offset = 0;
    const errors: any[] = [];

    logSecurityEvent({
      type: 'AERIES_BATCH_PROCESSING_STARTED',
      severity: ErrorSeverity.LOW,
      userId: 'system',
      correlationId: 'batch-process',
      details: `Starting batch processing: ${startDate} to ${endDate}, batch size: ${batchSize}`,
      timestamp: new Date()
    });

    try {
      while (true) {
        const response = await this.getAttendanceByDateRange(
          startDate,
          endDate,
          options?.schoolCode,
          { batchSize, offset }
        );

        if (!response.success || !response.data || response.data.length === 0) {
          break;
        }

        batchNumber++;
        
        try {
          await callback(response.data, batchNumber);
          totalProcessed += response.data.length;

          this.logApiEvent('BATCH_PROCESSED', 'LOW', {
            batchNumber,
            recordCount: response.data.length
          });

        } catch (batchError) {
          errors.push({
            batchNumber,
            error: batchError instanceof Error ? batchError.message : String(batchError),
            recordCount: response.data.length
          });

          this.logApiEvent('BATCH_ERROR', 'MEDIUM', {
            batchNumber,
            recordCount: response.data.length,
            errorMessage: batchError instanceof Error ? batchError.message : String(batchError)
          });
        }

        // Check if we've received fewer records than requested (end of data)
        if (response.data.length < batchSize) {
          break;
        }

        offset += batchSize;

        // Add delay between batches to respect rate limits
        await this.delay(1000);
      }

      logSecurityEvent({
        type: 'AERIES_BATCH_PROCESSING_COMPLETED',
        severity: ErrorSeverity.LOW,
        userId: 'system',
        correlationId: 'batch-process',
        details: `Batch processing completed: ${totalProcessed} records processed in ${batchNumber} batches`,
        timestamp: new Date()
      });

      return {
        totalProcessed,
        totalBatches: batchNumber,
        errors
      };

    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_BATCH_PROCESSING_FAILED',
        severity: ErrorSeverity.HIGH,
        userId: 'system',
        correlationId: 'batch-process',
        details: `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      throw error;
    }
  }

  // =====================================================
  // Private Helper Methods
  // =====================================================

  private async request<T = any>(options: AeriesApiRequestOptions): Promise<AeriesApiResponse<T>> {
    try {
      const axiosConfig: AxiosRequestConfig = {
        method: options.method,
        url: options.endpoint,
        params: options.params,
        data: options.body,
        timeout: options.timeout || 30000,
        headers: {
          ...options.headers,
          'X-Request-ID': this.generateRequestId()
        }
      };

      const response: AxiosResponse = await this.axiosInstance.request(axiosConfig);

      return {
        success: true,
        data: response.data,
        pagination: response.headers['x-pagination'] ? JSON.parse(response.headers['x-pagination']) : undefined
      };

    } catch (error) {
      if (options.retryOnFailure && axios.isRetryableError && axios.isRetryableError(error)) {
        // Implement retry logic here
        await this.delay(1000);
        return this.request({ ...options, retryOnFailure: false });
      }

      throw this.handleApiError(error);
    }
  }

  private handleApiError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      
      return new Error(`Aeries API Error (${statusCode}): ${message}`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  private generateRequestId(): string {
    return `aeries-${Date.now()}-${++this.requestCounter}`;
  }

  private calculateResponseTime(response: AxiosResponse): number {
    const requestStartTime = response.config.metadata?.startTime;
    if (!requestStartTime) return 0;
    return Date.now() - requestStartTime;
  }

  private logApiEvent(
    type: AeriesIntegrationEvent['type'],
    severity: AeriesIntegrationEvent['severity'],
    details: AeriesIntegrationEvent['details']
  ): void {
    const event: AeriesIntegrationEvent = {
      eventId: this.generateRequestId(),
      type,
      severity,
      timestamp: new Date().toISOString(),
      details,
      metadata: {
        correlationId: details.endpoint || 'unknown'
      }
    };

    logSecurityEvent({
      type: `AERIES_${type}`,
      severity: severity === 'LOW' ? ErrorSeverity.LOW :
                severity === 'MEDIUM' ? ErrorSeverity.MEDIUM :
                severity === 'HIGH' ? ErrorSeverity.HIGH : ErrorSeverity.CRITICAL,
      userId: 'system',
      correlationId: event.metadata.correlationId,
      details: JSON.stringify(details),
      timestamp: new Date()
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =====================================================
  // Public Utility Methods
  // =====================================================

  /**
   * Get current health status
   */
  public getHealthStatus(): { isHealthy: boolean; lastCheck: Date } {
    return { ...this.healthCheckStatus };
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): AeriesConfig {
    return { ...this.config };
  }
}