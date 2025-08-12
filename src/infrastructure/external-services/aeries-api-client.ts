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
   * Enhanced with date range processing for Aug 15, 2024 - Jun 12, 2025
   */
  async processAttendanceBatches(
    callback: (batch: any[], batchNumber: number) => Promise<void>,
    options?: {
      startDate?: string;
      endDate?: string;
      schoolCode?: string;
      batchSize?: number;
      resumeFromBatch?: number;
      dateChunkSizeDays?: number;
    }
  ): Promise<{ totalProcessed: number; totalBatches: number; errors: any[] }> {
    const startDate = options?.startDate || '2024-08-15';
    const endDate = options?.endDate || '2025-06-12';
    const batchSize = options?.batchSize || 500;
    const dateChunkSizeDays = options?.dateChunkSizeDays || 30;
    
    let totalProcessed = 0;
    let totalBatches = 0;
    const errors: any[] = [];
    let currentBatch = options?.resumeFromBatch || 0;

    logSecurityEvent({
      type: 'AERIES_BATCH_PROCESSING_STARTED',
      severity: ErrorSeverity.LOW,
      userId: 'system',
      correlationId: 'batch-process',
      details: `Enhanced batch processing: ${startDate} to ${endDate}, batch size: ${batchSize}, date chunks: ${dateChunkSizeDays} days`,
      timestamp: new Date()
    });

    try {
      // Break the full date range into smaller chunks for better processing
      const dateChunks = this.createDateChunks(startDate, endDate, dateChunkSizeDays);
      
      for (const chunk of dateChunks) {
        logSecurityEvent({
          type: 'AERIES_DATE_CHUNK_PROCESSING',
          severity: ErrorSeverity.LOW,
          userId: 'system',
          correlationId: 'batch-process',
          details: `Processing date chunk: ${chunk.start} to ${chunk.end}`,
          timestamp: new Date()
        });

        let offset = 0;
        let chunkBatchNumber = 0;

        while (true) {
          // Skip batches if resuming from a specific batch
          if (currentBatch > 0 && totalBatches < currentBatch) {
            totalBatches++;
            offset += batchSize;
            continue;
          }

          try {
            const response = await this.getAttendanceByDateRange(
              chunk.start,
              chunk.end,
              options?.schoolCode,
              { batchSize, offset }
            );

            if (!response.success || !response.data || response.data.length === 0) {
              break;
            }

            chunkBatchNumber++;
            totalBatches++;
            
            // Add enhanced batch metadata
            const enhancedBatch = response.data.map((record: any) => ({
              ...record,
              _batchMetadata: {
                batchNumber: totalBatches,
                chunkStart: chunk.start,
                chunkEnd: chunk.end,
                processedAt: new Date().toISOString(),
                schoolCode: options?.schoolCode
              }
            }));

            try {
              await callback(enhancedBatch, totalBatches);
              totalProcessed += response.data.length;

              this.logApiEvent('BATCH_PROCESSED', 'LOW', {
                batchNumber: totalBatches,
                chunkBatch: chunkBatchNumber,
                recordCount: response.data.length,
                dateRange: `${chunk.start} to ${chunk.end}`
              });

            } catch (batchError) {
              const error = {
                batchNumber: totalBatches,
                chunkBatch: chunkBatchNumber,
                dateRange: `${chunk.start} to ${chunk.end}`,
                error: batchError instanceof Error ? batchError.message : String(batchError),
                recordCount: response.data.length,
                timestamp: new Date().toISOString()
              };

              errors.push(error);

              this.logApiEvent('BATCH_ERROR', 'MEDIUM', {
                batchNumber: totalBatches,
                chunkBatch: chunkBatchNumber,
                recordCount: response.data.length,
                dateRange: `${chunk.start} to ${chunk.end}`,
                errorMessage: error.error
              });

              // Decide whether to continue or abort based on error type
              if (this.isCriticalError(batchError)) {
                throw batchError;
              }
            }

            // Check if we've received fewer records than requested (end of chunk data)
            if (response.data.length < batchSize) {
              break;
            }

            offset += batchSize;

            // Enhanced rate limiting with exponential backoff on errors
            const delayMs = errors.length > 0 ? 
              Math.min(5000, 1000 * Math.pow(2, Math.min(errors.length, 3))) : 
              1000;
            await this.delay(delayMs);

          } catch (chunkError) {
            const error = {
              batchNumber: totalBatches + 1,
              chunkBatch: chunkBatchNumber + 1,
              dateRange: `${chunk.start} to ${chunk.end}`,
              error: chunkError instanceof Error ? chunkError.message : String(chunkError),
              recordCount: 0,
              timestamp: new Date().toISOString()
            };

            errors.push(error);

            logSecurityEvent({
              type: 'AERIES_CHUNK_ERROR',
              severity: ErrorSeverity.MEDIUM,
              userId: 'system',
              correlationId: 'batch-process',
              details: `Date chunk processing failed: ${chunk.start} to ${chunk.end}, error: ${error.error}`,
              timestamp: new Date()
            });

            // Skip to next chunk if this chunk fails repeatedly
            if (this.isCriticalError(chunkError)) {
              break;
            }
          }
        }
      }

      logSecurityEvent({
        type: 'AERIES_BATCH_PROCESSING_COMPLETED',
        severity: ErrorSeverity.LOW,
        userId: 'system',
        correlationId: 'batch-process',
        details: `Enhanced batch processing completed: ${totalProcessed} records processed in ${totalBatches} batches across ${dateChunks.length} date chunks`,
        timestamp: new Date()
      });

      return {
        totalProcessed,
        totalBatches,
        errors
      };

    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_BATCH_PROCESSING_FAILED',
        severity: ErrorSeverity.HIGH,
        userId: 'system',
        correlationId: 'batch-process',
        details: `Enhanced batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Create date chunks for processing large date ranges
   */
  private createDateChunks(startDate: string, endDate: string, chunkSizeDays: number): Array<{start: string, end: string}> {
    const chunks: Array<{start: string, end: string}> = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let currentStart = new Date(start);
    
    while (currentStart < end) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + chunkSizeDays - 1);
      
      // Don't exceed the overall end date
      if (currentEnd > end) {
        currentEnd.setTime(end.getTime());
      }
      
      chunks.push({
        start: currentStart.toISOString().split('T')[0],
        end: currentEnd.toISOString().split('T')[0]
      });
      
      // Move to next chunk
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }
    
    return chunks;
  }

  /**
   * Determine if an error is critical enough to stop processing
   */
  private isCriticalError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Critical errors that should stop processing
    const criticalPatterns = [
      'authentication failed',
      'unauthorized',
      'forbidden',
      'certificate',
      'ssl',
      'connection refused',
      'network unreachable',
      'dns'
    ];
    
    return criticalPatterns.some(pattern => errorMessage.includes(pattern));
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
      if (options.retryOnFailure && this.isRetryableError(error)) {
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
    // For now, return 0 since we don't have request timing implemented
    // TODO: Implement proper request timing
    return 0;
  }

  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // Retry on 5xx server errors and certain 4xx errors
      return status ? (status >= 500 || status === 408 || status === 429) : true;
    }
    return false;
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