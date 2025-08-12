/**
 * @fileoverview Aeries SIS Configuration Service
 * 
 * Handles secure configuration management for Aeries API integration including:
 * - Environment variable validation
 * - SSL certificate loading and validation
 * - Configuration validation with security checks
 * - Runtime configuration updates
 * 
 * SECURITY REQUIREMENTS:
 * - Certificate files must be stored outside of version control
 * - API keys must be validated and rotated regularly
 * - All configuration access must be audited
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { 
  AeriesConfig, 
  AeriesCertificateConfig, 
  AeriesCertificateStatus,
  AeriesSecurityContext 
} from '@/types/aeries';
import { logSecurityEvent, ErrorSeverity } from '@/lib/security/error-handler';

// =====================================================
// Configuration Validation Schemas
// =====================================================

const AeriesConfigSchema = z.object({
  baseUrl: z.string().url('Aeries base URL must be a valid URL'),
  apiKey: z.string().min(32, 'Aeries API key must be at least 32 characters'),
  clientId: z.string().min(1, 'Aeries client ID is required'),
  clientSecret: z.string().min(16, 'Aeries client secret must be at least 16 characters'),
  districtCode: z.string().min(1, 'District code is required'),
  certificatePath: z.string().min(1, 'Certificate path is required'),
  privateKeyPath: z.string().min(1, 'Private key path is required'),
  caCertPath: z.string().min(1, 'CA certificate path is required'),
  syncEnabled: z.boolean(),
  syncSchedule: z.string().regex(/^[\d\s\*\/\-\,]+$/, 'Invalid cron schedule format'),
  attendanceStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  attendanceEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  batchSize: z.number().min(1).max(1000, 'Batch size must be between 1 and 1000'),
  rateLimitPerMinute: z.number().min(1).max(300, 'Rate limit must be between 1 and 300 per minute')
});

// =====================================================
// Aeries Configuration Service
// =====================================================

export class AeriesConfigService {
  private static instance: AeriesConfigService;
  private config: AeriesConfig | null = null;
  private certificateConfig: AeriesCertificateConfig | null = null;
  private lastConfigLoad: Date | null = null;
  private configValidationCache: Map<string, boolean> = new Map();

  private constructor() {}

  /**
   * Get singleton instance of configuration service
   */
  public static getInstance(): AeriesConfigService {
    if (!AeriesConfigService.instance) {
      AeriesConfigService.instance = new AeriesConfigService();
    }
    return AeriesConfigService.instance;
  }

  /**
   * Load and validate Aeries configuration from environment variables
   */
  public async loadConfiguration(): Promise<AeriesConfig> {
    try {
      const rawConfig = {
        baseUrl: process.env.AERIES_API_BASE_URL || '',
        apiKey: process.env.AERIES_API_KEY || '',
        clientId: process.env.AERIES_CLIENT_ID || '',
        clientSecret: process.env.AERIES_CLIENT_SECRET || '',
        districtCode: process.env.AERIES_DISTRICT_CODE || '',
        certificatePath: process.env.AERIES_CERTIFICATE_PATH || '',
        privateKeyPath: process.env.AERIES_PRIVATE_KEY_PATH || '',
        caCertPath: process.env.AERIES_CA_CERT_PATH || '',
        syncEnabled: process.env.AERIES_SYNC_ENABLED === 'true',
        syncSchedule: process.env.AERIES_SYNC_SCHEDULE || '0 1 * * *',
        attendanceStartDate: process.env.AERIES_ATTENDANCE_START_DATE || '2024-08-15',
        attendanceEndDate: process.env.AERIES_ATTENDANCE_END_DATE || '2025-06-12',
        batchSize: parseInt(process.env.AERIES_BATCH_SIZE || '100'),
        rateLimitPerMinute: parseInt(process.env.AERIES_RATE_LIMIT_PER_MINUTE || '60')
      };

      // Validate configuration schema
      const validatedConfig = AeriesConfigSchema.parse(rawConfig);

      // Additional security validations
      await this.validateSecurityRequirements(validatedConfig);

      // Load and validate certificates
      await this.loadCertificates(validatedConfig);

      // Cache the configuration
      this.config = validatedConfig;
      this.lastConfigLoad = new Date();

      // Log successful configuration load
      logSecurityEvent({
        type: 'AERIES_CONFIG_LOADED',
        severity: ErrorSeverity.LOW,
        userId: 'system',
        correlationId: 'config-load',
        details: 'Aeries configuration loaded successfully',
        timestamp: new Date()
      });

      return validatedConfig;

    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_CONFIG_LOAD_FAILED',
        severity: ErrorSeverity.HIGH,
        userId: 'system',
        correlationId: 'config-load',
        details: `Failed to load Aeries configuration: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      throw new Error(`Aeries configuration load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current configuration (load if not cached)
   */
  public async getConfiguration(): Promise<AeriesConfig> {
    if (!this.config || this.isConfigurationStale()) {
      return await this.loadConfiguration();
    }
    return this.config;
  }

  /**
   * Get certificate configuration
   */
  public getCertificateConfiguration(): AeriesCertificateConfig | null {
    return this.certificateConfig;
  }

  /**
   * Validate that date range is within school year bounds
   */
  public validateDateRange(startDate: string, endDate: string): boolean {
    const config = this.config;
    if (!config) return false;

    const configStart = new Date(config.attendanceStartDate);
    const configEnd = new Date(config.attendanceEndDate);
    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);

    return requestStart >= configStart && requestEnd <= configEnd;
  }

  /**
   * Get Romoland-specific Aeries endpoint URLs
   */
  public getEndpointUrls(): Record<string, string> {
    const baseUrl = this.config?.baseUrl || '';
    
    return {
      // Student Information Endpoints
      students: `${baseUrl}/students`,
      studentById: `${baseUrl}/students/{studentId}`,
      studentsBySchool: `${baseUrl}/schools/{schoolCode}/students`,
      
      // Attendance Endpoints
      attendance: `${baseUrl}/attendance`,
      attendanceByStudent: `${baseUrl}/students/{studentId}/attendance`,
      attendanceByDate: `${baseUrl}/attendance/date/{date}`,
      attendanceByDateRange: `${baseUrl}/attendance/daterange`,
      
      // School Information
      schools: `${baseUrl}/schools`,
      schoolById: `${baseUrl}/schools/{schoolCode}`,
      
      // Periods and Schedules
      periods: `${baseUrl}/schools/{schoolCode}/periods`,
      schedules: `${baseUrl}/students/{studentId}/schedules`,
      
      // Health Check and Authentication
      healthCheck: `${baseUrl}/health`,
      authenticate: `${baseUrl}/auth/token`,
      refreshToken: `${baseUrl}/auth/refresh`
    };
  }

  /**
   * Get security context for current configuration
   */
  public async getSecurityContext(): Promise<AeriesSecurityContext> {
    const certificateStatus = await this.validateCertificates();
    
    return {
      certificateValid: certificateStatus.isValid,
      apiKeyValid: await this.validateApiKey(),
      rateLimitRemaining: await this.getRateLimitRemaining(),
      lastHealthCheck: await this.getLastHealthCheck(),
      encryptionEnabled: true, // Always true for Aeries
      auditingEnabled: true    // Always true for FERPA compliance
    };
  }

  /**
   * Validate certificate status and expiration
   */
  public async validateCertificates(): Promise<AeriesCertificateStatus> {
    if (!this.certificateConfig) {
      throw new Error('Certificates not loaded');
    }

    try {
      // Use Node.js crypto to parse certificate
      const crypto = require('crypto');
      const cert = crypto.createCertificate();
      const x509 = new crypto.X509Certificate(this.certificateConfig.clientCert);
      
      const now = new Date();
      const validFrom = new Date(x509.validFrom);
      const validTo = new Date(x509.validTo);
      const daysUntilExpiration = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const status: AeriesCertificateStatus = {
        isValid: now >= validFrom && now <= validTo,
        expirationDate: validTo.toISOString(),
        daysUntilExpiration,
        issuer: x509.issuer,
        subject: x509.subject,
        serialNumber: x509.serialNumber,
        renewalRequired: daysUntilExpiration <= 30,
        lastValidated: new Date().toISOString()
      };

      // Log certificate validation
      logSecurityEvent({
        type: 'AERIES_CERTIFICATE_VALIDATED',
        severity: status.renewalRequired ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
        userId: 'system',
        correlationId: 'cert-validation',
        details: `Certificate valid: ${status.isValid}, expires in ${daysUntilExpiration} days`,
        timestamp: new Date()
      });

      return status;

    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_CERTIFICATE_VALIDATION_FAILED',
        severity: ErrorSeverity.HIGH,
        userId: 'system',
        correlationId: 'cert-validation',
        details: `Certificate validation failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      throw new Error(`Certificate validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // =====================================================
  // Private Helper Methods
  // =====================================================

  private async validateSecurityRequirements(config: AeriesConfig): Promise<void> {
    // Validate URL is HTTPS
    if (!config.baseUrl.startsWith('https://')) {
      throw new Error('Aeries API base URL must use HTTPS protocol');
    }

    // Validate date range
    const startDate = new Date(config.attendanceStartDate);
    const endDate = new Date(config.attendanceEndDate);
    
    if (startDate >= endDate) {
      throw new Error('Attendance start date must be before end date');
    }

    // Validate date range is within reasonable bounds (not more than 2 years)
    const daysDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDifference > 730) { // 2 years
      throw new Error('Attendance date range cannot exceed 2 years');
    }

    // Validate certificate files exist
    const certPaths = [config.certificatePath, config.privateKeyPath, config.caCertPath];
    for (const certPath of certPaths) {
      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificate file not found: ${certPath}`);
      }

      // Check file permissions (should not be world-readable)
      const stats = fs.statSync(certPath);
      const mode = stats.mode & parseInt('777', 8);
      if (mode & parseInt('004', 8)) { // World readable
        throw new Error(`Certificate file has insecure permissions: ${certPath}`);
      }
    }
  }

  private async loadCertificates(config: AeriesConfig): Promise<void> {
    try {
      const clientCert = fs.readFileSync(config.certificatePath, 'utf8');
      const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
      const caCert = fs.readFileSync(config.caCertPath, 'utf8');

      this.certificateConfig = {
        clientCert,
        privateKey,
        caCert
      };

      logSecurityEvent({
        type: 'AERIES_CERTIFICATES_LOADED',
        severity: ErrorSeverity.LOW,
        userId: 'system',
        correlationId: 'cert-load',
        details: 'Aeries SSL certificates loaded successfully',
        timestamp: new Date()
      });

    } catch (error) {
      logSecurityEvent({
        type: 'AERIES_CERTIFICATE_LOAD_FAILED',
        severity: ErrorSeverity.CRITICAL,
        userId: 'system',
        correlationId: 'cert-load',
        details: `Failed to load Aeries certificates: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      });

      throw new Error(`Failed to load Aeries certificates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isConfigurationStale(): boolean {
    if (!this.lastConfigLoad) return true;
    
    // Configuration is stale after 1 hour
    const staleThreshold = 60 * 60 * 1000; // 1 hour in milliseconds
    return (Date.now() - this.lastConfigLoad.getTime()) > staleThreshold;
  }

  private async validateApiKey(): Promise<boolean> {
    // Implementation would make a test API call to validate the key
    // For now, return true if key exists and has minimum length
    return !!(this.config?.apiKey && this.config.apiKey.length >= 32);
  }

  private async getRateLimitRemaining(): Promise<number> {
    // Implementation would check current rate limit status
    // For now, return configured limit
    return this.config?.rateLimitPerMinute || 60;
  }

  private async getLastHealthCheck(): Promise<string> {
    // Implementation would return timestamp of last successful health check
    // For now, return current timestamp
    return new Date().toISOString();
  }
}

// =====================================================
// Configuration Utility Functions
// =====================================================

/**
 * Quick configuration validation for startup checks
 */
export async function validateAeriesConfiguration(): Promise<boolean> {
  try {
    const configService = AeriesConfigService.getInstance();
    await configService.loadConfiguration();
    return true;
  } catch (error) {
    console.error('Aeries configuration validation failed:', error);
    return false;
  }
}

/**
 * Get Aeries configuration instance
 */
export function getAeriesConfig(): AeriesConfigService {
  return AeriesConfigService.getInstance();
}

/**
 * Environment variables required for Aeries integration
 */
export const REQUIRED_AERIES_ENV_VARS = [
  'AERIES_API_BASE_URL',
  'AERIES_API_KEY',
  'AERIES_CLIENT_ID',
  'AERIES_CLIENT_SECRET',
  'AERIES_DISTRICT_CODE',
  'AERIES_CERTIFICATE_PATH',
  'AERIES_PRIVATE_KEY_PATH',
  'AERIES_CA_CERT_PATH'
] as const;

/**
 * Check if all required environment variables are set
 */
export function checkAeriesEnvironmentVariables(): { missing: string[]; isComplete: boolean } {
  const missing = REQUIRED_AERIES_ENV_VARS.filter(envVar => !process.env[envVar]);
  
  return {
    missing,
    isComplete: missing.length === 0
  };
}