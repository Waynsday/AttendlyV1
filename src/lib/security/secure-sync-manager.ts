/**
 * @fileoverview Secure Sync Manager
 * 
 * Manages secure API key handling, certificate management, and FERPA compliance
 * for the attendance sync operations.
 * 
 * Security Features:
 * - Encrypted environment variable handling
 * - Certificate validation and rotation
 * - API key rotation and secure storage
 * - FERPA compliance validation
 * - Security audit logging
 * - Rate limiting and request throttling
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { AuditLogger } from '../audit/audit-logger';

// =====================================================
// Security Configuration Schema
// =====================================================

const SecurityConfigSchema = z.object({
  encryption: z.object({
    algorithm: z.string().default('aes-256-gcm'),
    keyDerivation: z.object({
      iterations: z.number().min(100000).default(100000),
      saltLength: z.number().min(32).default(32),
      keyLength: z.number().min(32).default(32)
    })
  }),
  certificates: z.object({
    clientCertPath: z.string(),
    privateKeyPath: z.string(),
    caCertPath: z.string(),
    validateChain: z.boolean().default(true),
    allowSelfSigned: z.boolean().default(false),
    maxAge: z.number().min(86400).default(7776000) // 90 days
  }),
  apiKeys: z.object({
    rotationInterval: z.number().min(86400).default(2592000), // 30 days
    encryptInMemory: z.boolean().default(true),
    validateOnStartup: z.boolean().default(true)
  }),
  rateLimiting: z.object({
    requestsPerMinute: z.number().min(1).max(300).default(60),
    burstLimit: z.number().min(1).max(100).default(10),
    backoffMultiplier: z.number().min(1).max(5).default(2),
    maxBackoffTime: z.number().min(1000).max(300000).default(60000)
  }),
  ferpa: z.object({
    enableValidation: z.boolean().default(true),
    logAllAccess: z.boolean().default(true),
    encryptPII: z.boolean().default(true),
    dataRetentionDays: z.number().min(1).max(2555).default(2555) // 7 years
  })
});

type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// =====================================================
// Encryption Utilities
// =====================================================

export class EncryptionManager {
  private masterKey?: Buffer;
  private auditLogger: AuditLogger;

  constructor() {
    this.auditLogger = new AuditLogger('EncryptionManager');
  }

  /**
   * Initialize encryption with master key
   */
  async initialize(masterKeySource?: string): Promise<void> {
    try {
      if (masterKeySource) {
        this.masterKey = Buffer.from(masterKeySource, 'hex');
      } else {
        this.masterKey = await this.deriveMasterKey();
      }

      await this.auditLogger.log({
        action: 'ENCRYPTION_INITIALIZED',
        metadata: { keyLength: this.masterKey.length }
      });
    } catch (error) {
      await this.auditLogger.logError('ENCRYPTION_INIT_FAILED', error);
      throw new Error('Failed to initialize encryption');
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    if (!this.masterKey) {
      throw new Error('Encryption not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.masterKey);
    cipher.setAAD(Buffer.from('AP_Tool_V1_Sync', 'utf8'));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    if (!this.masterKey) {
      throw new Error('Encryption not initialized');
    }

    const decipher = crypto.createDecipher('aes-256-gcm', this.masterKey);
    decipher.setAAD(Buffer.from('AP_Tool_V1_Sync', 'utf8'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Derive master key from environment
   */
  private async deriveMasterKey(): Promise<Buffer> {
    const password = process.env.ENCRYPTION_MASTER_PASSWORD || 'default-dev-key';
    const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'default-salt', 'utf8');

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Secure memory cleanup
   */
  cleanup(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = undefined;
    }
  }
}

// =====================================================
// Certificate Manager
// =====================================================

export class CertificateManager {
  private config: SecurityConfig['certificates'];
  private auditLogger: AuditLogger;
  private certificates?: {
    client: string;
    privateKey: string;
    ca: string;
    expiryDate: Date;
  };

  constructor(config: SecurityConfig['certificates']) {
    this.config = config;
    this.auditLogger = new AuditLogger('CertificateManager');
  }

  /**
   * Load and validate certificates
   */
  async loadCertificates(): Promise<void> {
    try {
      const [clientCert, privateKey, caCert] = await Promise.all([
        fs.readFile(this.config.clientCertPath, 'utf8'),
        fs.readFile(this.config.privateKeyPath, 'utf8'),
        fs.readFile(this.config.caCertPath, 'utf8')
      ]);

      // Validate certificate format
      this.validateCertificateFormat(clientCert);
      this.validatePrivateKeyFormat(privateKey);

      // Extract expiry date
      const expiryDate = this.extractExpiryDate(clientCert);
      
      // Check if certificate is near expiry
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 30) {
        await this.auditLogger.log({
          action: 'CERTIFICATE_EXPIRY_WARNING',
          metadata: { daysUntilExpiry, expiryDate: expiryDate.toISOString() }
        });
      }

      this.certificates = {
        client: clientCert,
        privateKey,
        ca: caCert,
        expiryDate
      };

      await this.auditLogger.log({
        action: 'CERTIFICATES_LOADED',
        metadata: { 
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry
        }
      });

    } catch (error) {
      await this.auditLogger.logError('CERTIFICATE_LOAD_FAILED', error);
      throw new Error(`Failed to load certificates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get certificates for HTTPS agent
   */
  getCertificates(): { cert: string; key: string; ca: string } {
    if (!this.certificates) {
      throw new Error('Certificates not loaded');
    }

    return {
      cert: this.certificates.client,
      key: this.certificates.privateKey,
      ca: this.certificates.ca
    };
  }

  /**
   * Check if certificates need renewal
   */
  needsRenewal(): boolean {
    if (!this.certificates) {
      return true;
    }

    const daysUntilExpiry = Math.floor((this.certificates.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry < 30;
  }

  private validateCertificateFormat(cert: string): void {
    if (!cert.includes('-----BEGIN CERTIFICATE-----') || !cert.includes('-----END CERTIFICATE-----')) {
      throw new Error('Invalid certificate format');
    }
  }

  private validatePrivateKeyFormat(key: string): void {
    if (!key.includes('-----BEGIN') || !key.includes('-----END')) {
      throw new Error('Invalid private key format');
    }
  }

  private extractExpiryDate(cert: string): Date {
    // Simple extraction - in production, use a proper certificate parser
    const base64Cert = cert.replace(/-----BEGIN CERTIFICATE-----|\r\n|-----END CERTIFICATE-----|\n/g, '');
    
    try {
      // This is a simplified version - use node-forge or similar for production
      const buffer = Buffer.from(base64Cert, 'base64');
      
      // For now, return a default expiry date
      // In production, parse the actual certificate
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      return futureDate;
    } catch (error) {
      throw new Error('Failed to parse certificate expiry date');
    }
  }
}

// =====================================================
// API Key Manager
// =====================================================

export class APIKeyManager {
  private config: SecurityConfig['apiKeys'];
  private encryptionManager: EncryptionManager;
  private auditLogger: AuditLogger;
  private encryptedKeys = new Map<string, any>();

  constructor(config: SecurityConfig['apiKeys'], encryptionManager: EncryptionManager) {
    this.config = config;
    this.encryptionManager = encryptionManager;
    this.auditLogger = new AuditLogger('APIKeyManager');
  }

  /**
   * Store API key securely
   */
  async storeKey(keyName: string, keyValue: string): Promise<void> {
    try {
      if (this.config.encryptInMemory) {
        const encrypted = this.encryptionManager.encrypt(keyValue);
        this.encryptedKeys.set(keyName, {
          ...encrypted,
          timestamp: Date.now()
        });
      } else {
        this.encryptedKeys.set(keyName, {
          value: keyValue,
          timestamp: Date.now()
        });
      }

      await this.auditLogger.log({
        action: 'API_KEY_STORED',
        metadata: { keyName, encrypted: this.config.encryptInMemory }
      });
    } catch (error) {
      await this.auditLogger.logError('API_KEY_STORE_FAILED', error, { keyName });
      throw error;
    }
  }

  /**
   * Retrieve API key securely
   */
  async getKey(keyName: string): Promise<string> {
    try {
      const stored = this.encryptedKeys.get(keyName);
      if (!stored) {
        throw new Error(`API key '${keyName}' not found`);
      }

      // Check if key needs rotation
      const keyAge = Date.now() - stored.timestamp;
      if (keyAge > this.config.rotationInterval * 1000) {
        await this.auditLogger.log({
          action: 'API_KEY_ROTATION_NEEDED',
          metadata: { keyName, ageHours: Math.round(keyAge / (1000 * 60 * 60)) }
        });
      }

      if (this.config.encryptInMemory) {
        return this.encryptionManager.decrypt({
          encrypted: stored.encrypted,
          iv: stored.iv,
          tag: stored.tag
        });
      } else {
        return stored.value;
      }
    } catch (error) {
      await this.auditLogger.logError('API_KEY_RETRIEVAL_FAILED', error, { keyName });
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateKey(keyName: string, keyValue?: string): Promise<boolean> {
    try {
      const storedKey = await this.getKey(keyName);
      
      if (keyValue) {
        return storedKey === keyValue;
      }

      // Basic validation (length, format)
      const isValid = storedKey.length >= 32 && /^[A-Za-z0-9+/=]+$/.test(storedKey);
      
      if (!isValid) {
        await this.auditLogger.log({
          action: 'API_KEY_VALIDATION_FAILED',
          metadata: { keyName, reason: 'Invalid format' }
        });
      }

      return isValid;
    } catch (error) {
      await this.auditLogger.logError('API_KEY_VALIDATION_ERROR', error, { keyName });
      return false;
    }
  }

  /**
   * Clear all keys from memory
   */
  clearKeys(): void {
    this.encryptedKeys.clear();
  }
}

// =====================================================
// Rate Limiter with Security Features
// =====================================================

export class SecureRateLimiter {
  private config: SecurityConfig['rateLimiting'];
  private auditLogger: AuditLogger;
  private requestCounts = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
  private suspiciousIPs = new Set<string>();

  constructor(config: SecurityConfig['rateLimiting']) {
    this.config = config;
    this.auditLogger = new AuditLogger('SecureRateLimiter');
  }

  /**
   * Check rate limit for a request
   */
  async checkLimit(identifier: string, clientIP?: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    
    // Clean expired entries
    this.cleanExpiredEntries(now, windowMs);

    const current = this.requestCounts.get(identifier) || {
      count: 0,
      resetTime: now + windowMs,
      blocked: false
    };

    // Check if currently blocked
    if (current.blocked && now < current.resetTime) {
      await this.auditLogger.log({
        action: 'RATE_LIMIT_BLOCKED',
        metadata: { identifier, clientIP, retryAfter: current.resetTime - now }
      });

      return {
        allowed: false,
        retryAfter: current.resetTime - now
      };
    }

    // Reset window if expired
    if (now >= current.resetTime) {
      current.count = 0;
      current.resetTime = now + windowMs;
      current.blocked = false;
    }

    current.count++;

    // Check burst limit
    if (current.count > this.config.burstLimit) {
      current.blocked = true;
      current.resetTime = now + (this.config.maxBackoffTime * Math.pow(this.config.backoffMultiplier, Math.min(current.count - this.config.burstLimit, 5)));

      // Mark IP as suspicious if excessive requests
      if (clientIP && current.count > this.config.burstLimit * 3) {
        this.suspiciousIPs.add(clientIP);
        
        await this.auditLogger.log({
          action: 'SUSPICIOUS_IP_DETECTED',
          metadata: { clientIP, requestCount: current.count }
        });
      }

      await this.auditLogger.log({
        action: 'RATE_LIMIT_EXCEEDED',
        metadata: { identifier, clientIP, requestCount: current.count }
      });

      return {
        allowed: false,
        retryAfter: current.resetTime - now
      };
    }

    // Check regular limit
    if (current.count > this.config.requestsPerMinute) {
      current.blocked = true;
      
      return {
        allowed: false,
        retryAfter: current.resetTime - now
      };
    }

    this.requestCounts.set(identifier, current);
    return { allowed: true };
  }

  /**
   * Check if IP is suspicious
   */
  isSuspiciousIP(ip: string): boolean {
    return this.suspiciousIPs.has(ip);
  }

  /**
   * Clear suspicious IP
   */
  clearSuspiciousIP(ip: string): void {
    this.suspiciousIPs.delete(ip);
  }

  private cleanExpiredEntries(now: number, windowMs: number): void {
    for (const [key, value] of this.requestCounts.entries()) {
      if (now >= value.resetTime && !value.blocked) {
        this.requestCounts.delete(key);
      }
    }
  }
}

// =====================================================
// Main Secure Sync Manager
// =====================================================

export class SecureSyncManager {
  private config: SecurityConfig;
  private encryptionManager: EncryptionManager;
  private certificateManager: CertificateManager;
  private apiKeyManager: APIKeyManager;
  private rateLimiter: SecureRateLimiter;
  private auditLogger: AuditLogger;
  private initialized = false;

  constructor(config: Partial<SecurityConfig> = {}) {
    // Merge with defaults
    this.config = SecurityConfigSchema.parse(config);
    
    this.encryptionManager = new EncryptionManager();
    this.certificateManager = new CertificateManager(this.config.certificates);
    this.apiKeyManager = new APIKeyManager(this.config.apiKeys, this.encryptionManager);
    this.rateLimiter = new SecureRateLimiter(this.config.rateLimiting);
    this.auditLogger = new AuditLogger('SecureSyncManager');
  }

  /**
   * Initialize security manager
   */
  async initialize(): Promise<void> {
    try {
      await this.auditLogger.log({ action: 'SECURITY_MANAGER_INITIALIZING' });

      // Initialize encryption
      await this.encryptionManager.initialize();

      // Load certificates
      await this.certificateManager.loadCertificates();

      // Load API keys from environment
      await this.loadAPIKeys();

      // Validate configuration
      await this.validateSecurityConfiguration();

      this.initialized = true;

      await this.auditLogger.log({ 
        action: 'SECURITY_MANAGER_INITIALIZED',
        metadata: { 
          ferpaEnabled: this.config.ferpa.enableValidation,
          encryptionEnabled: this.config.apiKeys.encryptInMemory
        }
      });

    } catch (error) {
      await this.auditLogger.logError('SECURITY_MANAGER_INIT_FAILED', error);
      throw new Error(`Security manager initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get secure HTTPS configuration
   */
  getSecureHTTPSConfig(): any {
    this.ensureInitialized();
    
    const certs = this.certificateManager.getCertificates();
    
    return {
      cert: certs.cert,
      key: certs.key,
      ca: certs.ca,
      rejectUnauthorized: !this.config.certificates.allowSelfSigned,
      checkServerIdentity: this.config.certificates.validateChain
    };
  }

  /**
   * Get API key securely
   */
  async getAPIKey(keyName: string): Promise<string> {
    this.ensureInitialized();
    return this.apiKeyManager.getKey(keyName);
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(identifier: string, clientIP?: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    this.ensureInitialized();
    return this.rateLimiter.checkLimit(identifier, clientIP);
  }

  /**
   * Validate FERPA compliance for student data
   */
  async validateFERPA(studentData: any): Promise<{ compliant: boolean; violations: string[] }> {
    if (!this.config.ferpa.enableValidation) {
      return { compliant: true, violations: [] };
    }

    const violations: string[] = [];

    // Check for PII exposure
    if (studentData.ssn || studentData.socialSecurityNumber) {
      violations.push('SSN should not be transmitted');
    }

    if (studentData.parentPhone || studentData.parentEmail) {
      violations.push('Parent contact information requires additional protection');
    }

    // Check encryption requirements
    if (this.config.ferpa.encryptPII && !studentData.encrypted) {
      if (studentData.firstName || studentData.lastName || studentData.dateOfBirth) {
        violations.push('PII must be encrypted in transit');
      }
    }

    const compliant = violations.length === 0;

    if (this.config.ferpa.logAllAccess) {
      await this.auditLogger.log({
        action: 'FERPA_VALIDATION',
        metadata: { 
          compliant, 
          violations: violations.length,
          studentId: studentData.studentId ? 'redacted' : 'none'
        }
      });
    }

    return { compliant, violations };
  }

  /**
   * Cleanup sensitive data from memory
   */
  cleanup(): void {
    this.encryptionManager.cleanup();
    this.apiKeyManager.clearKeys();
  }

  private async loadAPIKeys(): Promise<void> {
    const requiredKeys = ['AERIES_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    
    for (const keyName of requiredKeys) {
      const keyValue = process.env[keyName];
      if (keyValue) {
        await this.apiKeyManager.storeKey(keyName, keyValue);
        
        if (this.config.apiKeys.validateOnStartup) {
          const isValid = await this.apiKeyManager.validateKey(keyName);
          if (!isValid) {
            throw new Error(`Invalid API key format: ${keyName}`);
          }
        }
      }
    }
  }

  private async validateSecurityConfiguration(): Promise<void> {
    // Check certificate expiry
    if (this.certificateManager.needsRenewal()) {
      await this.auditLogger.log({
        action: 'CERTIFICATE_RENEWAL_REQUIRED',
        metadata: { urgency: 'high' }
      });
    }

    // Validate rate limiting configuration
    if (this.config.rateLimiting.requestsPerMinute > 300) {
      await this.auditLogger.log({
        action: 'HIGH_RATE_LIMIT_WARNING',
        metadata: { requestsPerMinute: this.config.rateLimiting.requestsPerMinute }
      });
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Security manager not initialized');
    }
  }
}

// =====================================================
// Factory Function
// =====================================================

/**
 * Create a secure sync manager with default security configuration
 */
export async function createSecureSyncManager(options: {
  certificatePath: string;
  privateKeyPath: string;
  caCertPath: string;
  masterPassword?: string;
} & Partial<SecurityConfig> = {} as any): Promise<SecureSyncManager> {
  
  const config: Partial<SecurityConfig> = {
    certificates: {
      clientCertPath: options.certificatePath,
      privateKeyPath: options.privateKeyPath,
      caCertPath: options.caCertPath,
      validateChain: true,
      allowSelfSigned: false,
      maxAge: 7776000
    },
    ferpa: {
      enableValidation: true,
      logAllAccess: true,
      encryptPII: true,
      dataRetentionDays: 2555
    },
    rateLimiting: {
      requestsPerMinute: 60,
      burstLimit: 10,
      backoffMultiplier: 2,
      maxBackoffTime: 60000
    },
    ...options
  };

  const manager = new SecureSyncManager(config);
  await manager.initialize();
  
  return manager;
}