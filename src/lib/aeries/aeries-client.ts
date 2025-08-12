/**
 * @fileoverview Production-Ready Aeries API Client
 * 
 * Complete implementation for Romoland School District Aeries SIS integration.
 * Ready for copy-paste deployment with all error handling and security features.
 * 
 * USAGE:
 * const client = new AeriesClient();
 * await client.initialize();
 * const attendance = await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');
 */

import https from 'https';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import fs from 'fs/promises';
import { z } from 'zod';

// =====================================================
// Configuration Schema and Types
// =====================================================

const AeriesConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(32),
  clientId: z.string().min(1),
  clientSecret: z.string().min(16),
  districtCode: z.string().min(1),
  certificatePath: z.string().min(1),
  privateKeyPath: z.string().min(1),
  caCertPath: z.string().min(1),
  rateLimitPerMinute: z.number().min(1).max(300),
  batchSize: z.number().min(1).max(1000)
});

interface AeriesConfig extends z.infer<typeof AeriesConfigSchema> {}

interface AeriesStudent {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  grade: string;
  schoolCode: string;
  enrollmentStatus: 'ACTIVE' | 'INACTIVE';
  lastUpdate: string;
}

interface AeriesAttendanceRecord {
  studentId: string;
  studentNumber: string;
  schoolCode: string;
  attendanceDate: string;
  schoolYear: string;
  dailyStatus: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT';
  periods: Array<{
    period: number;
    status: string;
    minutesAbsent?: number;
    minutesTardy?: number;
  }>;
  lastModified: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

// =====================================================
// Rate Limiting Class
// =====================================================

class RateLimiter {
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly windowMs = 60000; // 1 minute

  async checkLimit(key: string, limit: number): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Clean old entries
    for (const [mapKey, value] of this.requestCounts.entries()) {
      if (value.resetTime < windowStart) {
        this.requestCounts.delete(mapKey);
      }
    }

    const current = this.requestCounts.get(key) || { count: 0, resetTime: now + this.windowMs };

    if (current.count >= limit) {
      const waitTime = current.resetTime - now;
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    current.count++;
    this.requestCounts.set(key, current);
  }
}

// =====================================================
// Main Aeries Client Class
// =====================================================

export class AeriesClient {
  private config: AeriesConfig | null = null;
  private axiosInstance: AxiosInstance | null = null;
  private rateLimiter = new RateLimiter();
  private requestCounter = 0;
  private isInitialized = false;

  /**
   * Initialize the Aeries client with configuration and certificates
   */
  async initialize(): Promise<void> {
    try {
      // Load configuration from environment
      this.config = await this.loadConfiguration();
      
      // Load SSL certificates
      const certificates = await this.loadCertificates();
      
      // Create HTTPS agent with certificates
      const httpsAgent = new https.Agent({
        cert: certificates.clientCert,
        key: certificates.privateKey,
        ca: certificates.caCert,
        rejectUnauthorized: true,
        keepAlive: true,
        maxSockets: 10,
        timeout: 30000
      });

      // Initialize Axios instance
      this.axiosInstance = axios.create({
        baseURL: this.config.baseUrl,
        timeout: 30000,
        httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Romoland-AP-Tool/1.0',
          'X-Client-Id': this.config.clientId,
          'X-District-Code': this.config.districtCode
        }
      });

      // Add request interceptor
      this.axiosInstance.interceptors.request.use(async (config) => {
        // Rate limiting
        await this.rateLimiter.checkLimit('aeries-api', this.config!.rateLimitPerMinute);
        
        // Add authentication
        config.headers['Authorization'] = `Bearer ${this.config!.apiKey}`;
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        console.log(`[Aeries API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      });

      // Add response interceptor
      this.axiosInstance.interceptors.response.use(
        (response) => {
          console.log(`[Aeries API] Response: ${response.status} ${response.config.url}`);
          return response;
        },
        (error) => {
          const status = error.response?.status || 'unknown';
          const url = error.config?.url || 'unknown';
          console.error(`[Aeries API] Error: ${status} ${url} - ${error.message}`);
          
          // Transform error for better handling
          if (error.response?.status === 401) {
            throw new Error('Aeries API authentication failed. Check API key and certificates.');
          } else if (error.response?.status === 403) {
            throw new Error('Aeries API access forbidden. Check permissions.');
          } else if (error.response?.status === 429) {
            throw new Error('Aeries API rate limit exceeded. Please wait and try again.');
          }
          
          throw error;
        }
      );

      this.isInitialized = true;
      console.log('[Aeries API] Client initialized successfully');

    } catch (error) {
      console.error('[Aeries API] Initialization failed:', error);
      throw new Error(`Aeries client initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Health check to verify API connectivity
   */
  async healthCheck(): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const response = await this.axiosInstance!.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('[Aeries API] Health check failed:', error);
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
    options: { batchSize?: number; offset?: number } = {}
  ): Promise<ApiResponse<AeriesAttendanceRecord[]>> {
    this.ensureInitialized();
    
    const params: Record<string, any> = {
      startDate,
      endDate,
      limit: options.batchSize || this.config!.batchSize,
      offset: options.offset || 0
    };

    if (schoolCode) {
      params.schoolCode = schoolCode;
    }

    try {
      const response = await this.axiosInstance!.get('/attendance/daterange', { params });
      
      return {
        success: true,
        data: this.transformAttendanceRecords(response.data),
        pagination: response.headers['x-pagination'] ? JSON.parse(response.headers['x-pagination']) : undefined
      };
    } catch (error) {
      console.error('[Aeries API] Get attendance failed:', error);
      throw new Error(`Failed to get attendance data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get student information by ID
   */
  async getStudent(studentId: string): Promise<ApiResponse<AeriesStudent>> {
    this.ensureInitialized();
    
    try {
      const response = await this.axiosInstance!.get(`/students/${studentId}`);
      
      return {
        success: true,
        data: this.transformStudentRecord(response.data)
      };
    } catch (error) {
      console.error('[Aeries API] Get student failed:', error);
      throw new Error(`Failed to get student data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get students by school
   */
  async getStudentsBySchool(
    schoolCode: string,
    options: { active?: boolean; grade?: string; limit?: number; offset?: number } = {}
  ): Promise<ApiResponse<AeriesStudent[]>> {
    this.ensureInitialized();
    
    const params: Record<string, any> = {
      limit: options.limit || this.config!.batchSize,
      offset: options.offset || 0
    };

    if (options.active !== undefined) {
      params.active = options.active;
    }

    if (options.grade) {
      params.grade = options.grade;
    }

    try {
      const response = await this.axiosInstance!.get(`/schools/${schoolCode}/students`, { params });
      
      return {
        success: true,
        data: response.data.map((student: any) => this.transformStudentRecord(student)),
        pagination: response.headers['x-pagination'] ? JSON.parse(response.headers['x-pagination']) : undefined
      };
    } catch (error) {
      console.error('[Aeries API] Get students by school failed:', error);
      throw new Error(`Failed to get students by school: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all schools in the district
   */
  async getSchools(): Promise<ApiResponse<Array<{ schoolCode: string; schoolName: string; active: boolean }>>> {
    this.ensureInitialized();
    
    try {
      const response = await this.axiosInstance!.get('/schools');
      
      return {
        success: true,
        data: response.data.map((school: any) => ({
          schoolCode: school.schoolCode || school.code,
          schoolName: school.schoolName || school.name,
          active: school.active !== false
        }))
      };
    } catch (error) {
      console.error('[Aeries API] Get schools failed:', error);
      throw new Error(`Failed to get schools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process attendance data in batches
   */
  async processAttendanceBatches(
    startDate: string,
    endDate: string,
    callback: (batch: AeriesAttendanceRecord[], batchNumber: number) => Promise<void>,
    options: { schoolCode?: string; batchSize?: number } = {}
  ): Promise<{ totalProcessed: number; totalBatches: number; errors: any[] }> {
    this.ensureInitialized();
    
    const batchSize = options.batchSize || this.config!.batchSize;
    let totalProcessed = 0;
    let batchNumber = 0;
    let offset = 0;
    const errors: any[] = [];

    console.log(`[Aeries API] Starting batch processing: ${startDate} to ${endDate}`);

    try {
      while (true) {
        const response = await this.getAttendanceByDateRange(
          startDate,
          endDate,
          options.schoolCode,
          { batchSize, offset }
        );

        if (!response.success || !response.data || response.data.length === 0) {
          break;
        }

        batchNumber++;
        console.log(`[Aeries API] Processing batch ${batchNumber} (${response.data.length} records)`);
        
        try {
          await callback(response.data, batchNumber);
          totalProcessed += response.data.length;
        } catch (batchError) {
          const error = {
            batchNumber,
            error: batchError instanceof Error ? batchError.message : String(batchError),
            recordCount: response.data.length
          };
          errors.push(error);
          console.error(`[Aeries API] Batch ${batchNumber} failed:`, error);
        }

        // Check if we've received fewer records than requested (end of data)
        if (response.data.length < batchSize) {
          break;
        }

        offset += batchSize;

        // Add delay between batches to respect rate limits
        await this.delay(1000);
      }

      console.log(`[Aeries API] Batch processing completed: ${totalProcessed} records in ${batchNumber} batches`);

      return {
        totalProcessed,
        totalBatches: batchNumber,
        errors
      };

    } catch (error) {
      console.error('[Aeries API] Batch processing failed:', error);
      throw error;
    }
  }

  // =====================================================
  // Private Helper Methods
  // =====================================================

  private async loadConfiguration(): Promise<AeriesConfig> {
    const config = {
      baseUrl: process.env.AERIES_API_BASE_URL || '',
      apiKey: process.env.AERIES_API_KEY || '',
      clientId: process.env.AERIES_CLIENT_ID || '',
      clientSecret: process.env.AERIES_CLIENT_SECRET || '',
      districtCode: process.env.AERIES_DISTRICT_CODE || '',
      certificatePath: process.env.AERIES_CERTIFICATE_PATH || '',
      privateKeyPath: process.env.AERIES_PRIVATE_KEY_PATH || '',
      caCertPath: process.env.AERIES_CA_CERT_PATH || '',
      rateLimitPerMinute: parseInt(process.env.AERIES_RATE_LIMIT_PER_MINUTE || '60'),
      batchSize: parseInt(process.env.AERIES_BATCH_SIZE || '100')
    };

    try {
      return AeriesConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Invalid Aeries configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

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

      return { clientCert, privateKey, caCert };
    } catch (error) {
      throw new Error(`Failed to load certificates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private transformAttendanceRecords(data: any[]): AeriesAttendanceRecord[] {
    return data.map(record => ({
      studentId: record.studentId || record.student_id,
      studentNumber: record.studentNumber || record.student_number,
      schoolCode: record.schoolCode || record.school_code,
      attendanceDate: record.attendanceDate || record.attendance_date,
      schoolYear: record.schoolYear || record.school_year || this.getCurrentSchoolYear(),
      dailyStatus: this.mapAttendanceStatus(record.dailyAttendance?.status || record.daily_status),
      periods: (record.periods || []).map((period: any) => ({
        period: period.period,
        status: this.mapAttendanceStatus(period.status),
        minutesAbsent: period.minutesAbsent || period.minutes_absent,
        minutesTardy: period.minutesTardy || period.minutes_tardy
      })),
      lastModified: record.lastModified || record.last_modified || new Date().toISOString()
    }));
  }

  private transformStudentRecord(data: any): AeriesStudent {
    return {
      studentId: data.studentId || data.student_id,
      studentNumber: data.studentNumber || data.student_number,
      firstName: data.firstName || data.first_name,
      lastName: data.lastName || data.last_name,
      grade: data.grade,
      schoolCode: data.schoolCode || data.school_code,
      enrollmentStatus: data.enrollmentStatus || data.enrollment_status || 'ACTIVE',
      lastUpdate: data.lastUpdate || data.last_update || new Date().toISOString()
    };
  }

  private mapAttendanceStatus(status: string): AeriesAttendanceRecord['dailyStatus'] {
    const statusMap: Record<string, AeriesAttendanceRecord['dailyStatus']> = {
      'P': 'PRESENT',
      'A': 'ABSENT',
      'T': 'TARDY',
      'E': 'EXCUSED_ABSENT',
      'U': 'UNEXCUSED_ABSENT',
      'PRESENT': 'PRESENT',
      'ABSENT': 'ABSENT',
      'TARDY': 'TARDY',
      'EXCUSED_ABSENT': 'EXCUSED_ABSENT',
      'UNEXCUSED_ABSENT': 'UNEXCUSED_ABSENT'
    };

    return statusMap[status?.toUpperCase()] || 'ABSENT';
  }

  private getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (month >= 7) { // August or later
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  private generateRequestId(): string {
    return `aeries-${Date.now()}-${++this.requestCounter}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.axiosInstance || !this.config) {
      throw new Error('Aeries client not initialized. Call initialize() first.');
    }
  }

  // =====================================================
  // Public Utility Methods
  // =====================================================

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): Partial<AeriesConfig> {
    return this.config ? {
      baseUrl: this.config.baseUrl,
      districtCode: this.config.districtCode,
      rateLimitPerMinute: this.config.rateLimitPerMinute,
      batchSize: this.config.batchSize
    } : {};
  }

  /**
   * Check if client is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// =====================================================
// Singleton Instance Export
// =====================================================

let aeriesClientInstance: AeriesClient | null = null;

/**
 * Get singleton Aeries client instance
 */
export async function getAeriesClient(): Promise<AeriesClient> {
  if (!aeriesClientInstance) {
    aeriesClientInstance = new AeriesClient();
    await aeriesClientInstance.initialize();
  }
  
  return aeriesClientInstance;
}

/**
 * Quick health check function
 */
export async function checkAeriesConnection(): Promise<boolean> {
  try {
    const client = await getAeriesClient();
    return await client.healthCheck();
  } catch (error) {
    console.error('[Aeries API] Connection check failed:', error);
    return false;
  }
}