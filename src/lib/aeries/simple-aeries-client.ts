/**
 * @fileoverview Simplified Aeries Client
 * 
 * MINIMAL SETUP - Only needs district, base URL, and certificate!
 * Perfect for quick deployment with basic certificate authentication.
 */

import https from 'https';
import axios, { AxiosInstance } from 'axios';
import fs from 'fs/promises';

interface SimpleAeriesConfig {
  baseUrl: string;
  districtCode: string;
  certificatePath: string;
  // Optional - have smart defaults
  batchSize?: number;
  rateLimitPerMinute?: number;
}

interface AttendanceRecord {
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

export class SimpleAeriesClient {
  private axiosInstance: AxiosInstance | null = null;
  private config: SimpleAeriesConfig;
  private isInitialized = false;

  constructor(config?: Partial<SimpleAeriesConfig>) {
    // Smart defaults - only require the essentials
    this.config = {
      baseUrl: config?.baseUrl || process.env.AERIES_API_BASE_URL || '',
      districtCode: config?.districtCode || process.env.AERIES_DISTRICT_CODE || 'romoland',
      certificatePath: config?.certificatePath || process.env.AERIES_CERTIFICATE_PATH || '/certs/aeries-client.crt',
      batchSize: config?.batchSize || parseInt(process.env.AERIES_BATCH_SIZE || '100'),
      rateLimitPerMinute: config?.rateLimitPerMinute || parseInt(process.env.AERIES_RATE_LIMIT_PER_MINUTE || '60')
    };
  }

  /**
   * Initialize with just certificate - no API key needed!
   */
  async initialize(): Promise<void> {
    try {
      // Validate required config
      if (!this.config.baseUrl) {
        throw new Error('AERIES_API_BASE_URL is required');
      }
      if (!this.config.districtCode) {
        throw new Error('AERIES_DISTRICT_CODE is required');
      }
      if (!this.config.certificatePath) {
        throw new Error('AERIES_CERTIFICATE_PATH is required');
      }

      // Load certificate
      const certificate = await fs.readFile(this.config.certificatePath, 'utf8');

      // Create HTTPS agent with certificate
      const httpsAgent = new https.Agent({
        cert: certificate,
        // If you have separate private key file:
        // key: await fs.readFile('/certs/aeries-private.key', 'utf8'),
        // If you have CA certificate:
        // ca: await fs.readFile('/certs/aeries-ca.crt', 'utf8'),
        rejectUnauthorized: true,
        keepAlive: true,
        timeout: 30000
      });

      // Initialize Axios with certificate authentication
      this.axiosInstance = axios.create({
        baseURL: this.config.baseUrl,
        timeout: 30000,
        httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Romoland-AP-Tool/1.0',
          'X-District-Code': this.config.districtCode
        }
      });

      // Simple request/response logging
      this.axiosInstance.interceptors.request.use(config => {
        console.log(`[Aeries] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      });

      this.axiosInstance.interceptors.response.use(
        response => {
          console.log(`[Aeries] ✅ ${response.status} ${response.config.url}`);
          return response;
        },
        error => {
          console.error(`[Aeries] ❌ ${error.response?.status || 'ERROR'} ${error.config?.url}`);
          throw error;
        }
      );

      this.isInitialized = true;
      console.log('[Aeries] ✅ Initialized with certificate authentication');

    } catch (error) {
      console.error('[Aeries] ❌ Initialization failed:', error);
      throw new Error(`Aeries client initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Health check - test connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized || !this.axiosInstance) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      // Try a simple endpoint
      const response = await this.axiosInstance.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('[Aeries] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get attendance data for date range
   */
  async getAttendanceByDateRange(
    startDate: string,
    endDate: string,
    options: { schoolCode?: string; batchSize?: number; offset?: number } = {}
  ): Promise<{ success: boolean; data: AttendanceRecord[]; total?: number }> {
    if (!this.isInitialized || !this.axiosInstance) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      const params: Record<string, any> = {
        startDate,
        endDate,
        limit: options.batchSize || this.config.batchSize,
        offset: options.offset || 0
      };

      if (options.schoolCode) {
        params.schoolCode = options.schoolCode;
      }

      const response = await this.axiosInstance.get('/attendance/daterange', { params });
      
      // Transform response data to our format
      const transformedData = this.transformAttendanceRecords(response.data);

      return {
        success: true,
        data: transformedData,
        total: response.headers['x-total-count'] ? parseInt(response.headers['x-total-count']) : transformedData.length
      };

    } catch (error) {
      console.error('[Aeries] Get attendance failed:', error);
      throw new Error(`Failed to get attendance data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all schools
   */
  async getSchools(): Promise<{ success: boolean; data: Array<{ schoolCode: string; schoolName: string; active: boolean }> }> {
    if (!this.isInitialized || !this.axiosInstance) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      const response = await this.axiosInstance.get('/schools');
      
      const schools = Array.isArray(response.data) ? response.data : [response.data];
      
      return {
        success: true,
        data: schools.map((school: any) => ({
          schoolCode: school.schoolCode || school.code || school.id,
          schoolName: school.schoolName || school.name || `School ${school.schoolCode}`,
          active: school.active !== false
        }))
      };

    } catch (error) {
      console.error('[Aeries] Get schools failed:', error);
      throw new Error(`Failed to get schools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process attendance in batches with callback
   */
  async processAttendanceBatches(
    startDate: string,
    endDate: string,
    callback: (batch: AttendanceRecord[], batchNumber: number) => Promise<void>,
    options: { schoolCode?: string; batchSize?: number } = {}
  ): Promise<{ totalProcessed: number; totalBatches: number; errors: any[] }> {
    const batchSize = options.batchSize || this.config.batchSize || 100;
    let totalProcessed = 0;
    let batchNumber = 0;
    let offset = 0;
    const errors: any[] = [];

    console.log(`[Aeries] 🚀 Starting batch processing: ${startDate} to ${endDate}`);

    try {
      while (true) {
        const response = await this.getAttendanceByDateRange(
          startDate,
          endDate,
          { ...options, batchSize, offset }
        );

        if (!response.success || !response.data || response.data.length === 0) {
          console.log('[Aeries] ✅ No more data to process');
          break;
        }

        batchNumber++;
        console.log(`[Aeries] 📦 Processing batch ${batchNumber} (${response.data.length} records)`);
        
        try {
          await callback(response.data, batchNumber);
          totalProcessed += response.data.length;
          console.log(`[Aeries] ✅ Batch ${batchNumber} completed`);
        } catch (batchError) {
          const error = {
            batchNumber,
            error: batchError instanceof Error ? batchError.message : String(batchError),
            recordCount: response.data.length
          };
          errors.push(error);
          console.error(`[Aeries] ❌ Batch ${batchNumber} failed:`, error);
        }

        // Check if we've received fewer records than requested (end of data)
        if (response.data.length < batchSize) {
          console.log('[Aeries] ✅ Reached end of data');
          break;
        }

        offset += batchSize;

        // Add delay between batches to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[Aeries] 🎉 Batch processing completed: ${totalProcessed} records in ${batchNumber} batches`);

      return {
        totalProcessed,
        totalBatches: batchNumber,
        errors
      };

    } catch (error) {
      console.error('[Aeries] ❌ Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Transform raw Aeries data to our standard format
   */
  private transformAttendanceRecords(data: any[]): AttendanceRecord[] {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data.map(record => ({
      studentId: record.studentId || record.student_id || record.StudentID,
      studentNumber: record.studentNumber || record.student_number || record.StudentNumber,
      schoolCode: record.schoolCode || record.school_code || record.SchoolCode,
      attendanceDate: record.attendanceDate || record.attendance_date || record.AttendanceDate,
      schoolYear: record.schoolYear || record.school_year || this.getCurrentSchoolYear(),
      dailyStatus: this.mapAttendanceStatus(record.dailyStatus || record.daily_status || record.DailyStatus),
      periods: this.extractPeriods(record),
      lastModified: record.lastModified || record.last_modified || new Date().toISOString()
    }));
  }

  private mapAttendanceStatus(status: string): AttendanceRecord['dailyStatus'] {
    if (!status) return 'ABSENT';
    
    const statusMap: Record<string, AttendanceRecord['dailyStatus']> = {
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

    return statusMap[status.toUpperCase()] || 'ABSENT';
  }

  private extractPeriods(record: any): AttendanceRecord['periods'] {
    const periods = record.periods || record.Periods || [];
    
    if (Array.isArray(periods)) {
      return periods.map((period: any) => ({
        period: period.period || period.Period || 1,
        status: this.mapAttendanceStatus(period.status || period.Status),
        minutesAbsent: period.minutesAbsent || period.MinutesAbsent,
        minutesTardy: period.minutesTardy || period.MinutesTardy
      }));
    }

    return [];
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

  /**
   * Get current configuration
   */
  getConfig(): SimpleAeriesConfig {
    return { ...this.config };
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.axiosInstance !== null;
  }
}

// =====================================================
// Easy-to-use singleton
// =====================================================

let simpleClientInstance: SimpleAeriesClient | null = null;

/**
 * Get simple Aeries client - auto-initializes from environment
 */
export async function getSimpleAeriesClient(): Promise<SimpleAeriesClient> {
  if (!simpleClientInstance) {
    simpleClientInstance = new SimpleAeriesClient();
    await simpleClientInstance.initialize();
  }
  
  return simpleClientInstance;
}

/**
 * Quick connection test
 */
export async function testAeriesConnection(): Promise<boolean> {
  try {
    const client = await getSimpleAeriesClient();
    return await client.healthCheck();
  } catch (error) {
    console.error('[Aeries] Connection test failed:', error);
    return false;
  }
}