/**
 * @fileoverview Security & Compliance Test Suite
 * 
 * Comprehensive tests for security features including:
 * - Certificate-based authentication
 * - PII data masking in logs
 * - FERPA-compliant error handling
 * - Audit trails and compliance reporting
 * - Data encryption and access controls
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  AeriesSecurityManager,
  PiiMaskingService,
  FerpaComplianceValidator,
  AuditTrailService,
  CertificateManager
} from '../../../../lib/aeries/security-compliance';

describe('Security & Compliance', () => {
  describe('CertificateManager', () => {
    let certificateManager: CertificateManager;

    beforeEach(() => {
      certificateManager = new CertificateManager({
        certificatePath: '/path/to/cert.pem',
        privateKeyPath: '/path/to/key.pem',
        caCertPath: '/path/to/ca.pem',
        passphrase: 'test-passphrase'
      });
    });

    describe('certificate validation and management', () => {
      it('should validate certificate authenticity and expiration', async () => {
        // Mock certificate content
        const mockCertificate = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHtSj5uG5OMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCUxv
Y2FsaG9zdDAeFw0yNDA4MTUwMDAwMDBaFw0yNTA4MTUwMDAwMDBaMBQxEjAQBgNV
BAMMCUxvY2FsaG9zdDCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEA2...
-----END CERTIFICATE-----`;

        jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(mockCertificate);

        const validation = await certificateManager.validateCertificate();

        expect(validation).toMatchObject({
          isValid: true,
          expirationDate: expect.any(String),
          daysUntilExpiration: expect.any(Number),
          issuer: expect.any(String),
          subject: expect.any(String),
          serialNumber: expect.any(String),
          renewalRequired: expect.any(Boolean)
        });
      });

      it('should detect expired certificates', async () => {
        const expiredCertificate = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHtSj5uG5OMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCUxv
Y2FsaG9zdDAeFw0yMzA4MTUwMDAwMDBaFw0yMzA4MTYwMDAwMDBaMBQxEjAQBgNV
-----END CERTIFICATE-----`;

        jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(expiredCertificate);

        const validation = await certificateManager.validateCertificate();

        expect(validation).toMatchObject({
          isValid: false,
          error: 'Certificate has expired',
          renewalRequired: true
        });
      });

      it('should warn when certificate is approaching expiration', async () => {
        // Mock certificate expiring in 15 days
        const expiringCertificate = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHtSj5uG5OMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCUxv
Y2FsaG9zdDAeFw0yNDA4MTUwMDAwMDBaFw0yNDA4MzAwMDAwMDBaMBQxEjAQBgNV
-----END CERTIFICATE-----`;

        jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(expiringCertificate);

        const validation = await certificateManager.validateCertificate();

        expect(validation).toMatchObject({
          isValid: true,
          daysUntilExpiration: expect.any(Number),
          renewalRequired: true,
          warningLevel: 'HIGH'
        });
      });

      it('should handle certificate authority chain validation', async () => {
        const mockCaCert = 'mock-ca-certificate';
        const mockClientCert = 'mock-client-certificate';

        jest.spyOn(require('fs/promises'), 'readFile')
          .mockResolvedValueOnce(mockClientCert)
          .mockResolvedValueOnce(mockCaCert);

        const chainValidation = await certificateManager.validateCertificateChain();

        expect(chainValidation).toMatchObject({
          chainValid: true,
          trustedRoot: true,
          certificateAuthority: expect.any(String),
          intermediateCerts: expect.any(Array)
        });
      });

      it('should generate AERIES-CERT header for authentication', async () => {
        const mockCertificate = 'mock-certificate-content';
        jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(mockCertificate);

        const aeriesCertHeader = await certificateManager.generateAeriesCertHeader();

        expect(aeriesCertHeader).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
        expect(aeriesCertHeader.length).toBeGreaterThan(20);
      });

      it('should provide certificate renewal notifications', async () => {
        const notificationService = jest.fn();
        certificateManager.setRenewalNotificationHandler(notificationService);

        // Mock certificate expiring in 29 days (30-day warning threshold)
        const expiringCertificate = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHtSj5uG5OMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCUxv
Y2FsaG9zdDAeFw0yNDA4MTUwMDAwMDBaFw0yNDA5MTMwMDAwMDBaMBQxEjAQBgNV
-----END CERTIFICATE-----`;

        jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(expiringCertificate);

        await certificateManager.checkRenewalRequired();

        expect(notificationService).toHaveBeenCalledWith({
          type: 'CERTIFICATE_RENEWAL_WARNING',
          daysUntilExpiration: expect.any(Number),
          severity: 'HIGH',
          message: expect.stringContaining('certificate will expire')
        });
      });
    });
  });

  describe('PiiMaskingService', () => {
    let maskingService: PiiMaskingService;

    beforeEach(() => {
      maskingService = new PiiMaskingService({
        maskingLevel: 'STRICT',
        preserveFormat: true,
        customPatterns: [
          { name: 'STUDENT_ID', pattern: /STU\d{3}/, replacement: 'STU***' }
        ]
      });
    });

    describe('data masking capabilities', () => {
      it('should mask student names in log outputs', () => {
        const sensitiveData = {
          studentId: 'STU123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@student.romoland.org',
          phone: '951-555-0123'
        };

        const maskedData = maskingService.maskStudentData(sensitiveData);

        expect(maskedData).toMatchObject({
          studentId: 'STU***', // Custom pattern applied
          firstName: '****',
          lastName: '***',
          email: 'j***.d**@student.romoland.org',
          phone: '951-***-****'
        });
      });

      it('should mask SSN and sensitive identifiers', () => {
        const sensitiveData = {
          ssn: '123-45-6789',
          birthDate: '2010-05-15',
          address: '123 Main Street, Romoland, CA 92570',
          parentSSN: '987-65-4321'
        };

        const maskedData = maskingService.maskPersonalIdentifiers(sensitiveData);

        expect(maskedData).toMatchObject({
          ssn: '***-**-****',
          birthDate: '****-**-**',
          address: '*** Main Street, ********, ** *****',
          parentSSN: '***-**-****'
        });
      });

      it('should provide configurable masking levels', () => {
        const data = { firstName: 'John', lastName: 'Doe' };

        const partialMask = maskingService.maskData(data, { level: 'PARTIAL' });
        const fullMask = maskingService.maskData(data, { level: 'FULL' });
        const minimalMask = maskingService.maskData(data, { level: 'MINIMAL' });

        expect(partialMask.firstName).toBe('J***');
        expect(fullMask.firstName).toBe('****');
        expect(minimalMask.firstName).toBe('Jo**');
      });

      it('should preserve data format while masking', () => {
        const formattedData = {
          phone: '(951) 555-0123',
          ssn: '123-45-6789',
          zipCode: '92570-1234'
        };

        const maskedData = maskingService.maskData(formattedData, { preserveFormat: true });

        expect(maskedData.phone).toMatch(/\(\d{3}\) \*{3}-\*{4}/);
        expect(maskedData.ssn).toMatch(/\*{3}-\*{2}-\*{4}/);
        expect(maskedData.zipCode).toMatch(/\*{5}-\*{4}/);
      });

      it('should handle nested objects and arrays', () => {
        const nestedData = {
          student: {
            name: 'John Doe',
            contacts: [
              { type: 'parent', name: 'Jane Doe', phone: '951-555-0123' },
              { type: 'emergency', name: 'Bob Smith', phone: '951-555-0456' }
            ]
          },
          grades: [85, 92, 78]
        };

        const maskedData = maskingService.maskData(nestedData);

        expect(maskedData.student.name).toBe('**** ***');
        expect(maskedData.student.contacts[0].name).toBe('**** ***');
        expect(maskedData.student.contacts[0].phone).toBe('951-***-****');
        expect(maskedData.grades).toEqual([85, 92, 78]); // Non-PII data preserved
      });

      it('should detect and mask common PII patterns automatically', () => {
        const textWithPii = `Student John Doe (SSN: 123-45-6789) called from phone 951-555-0123 
                           regarding email john.doe@student.romoland.org`;

        const maskedText = maskingService.maskTextContent(textWithPii);

        expect(maskedText).not.toContain('John Doe');
        expect(maskedText).not.toContain('123-45-6789');
        expect(maskedText).not.toContain('951-555-0123');
        expect(maskedText).not.toContain('john.doe@student.romoland.org');
        expect(maskedText).toContain('Student **** ***');
      });

      it('should provide audit trail for masking operations', () => {
        const sensitiveData = { studentName: 'John Doe', ssn: '123-45-6789' };
        
        const maskedData = maskingService.maskDataWithAudit(sensitiveData, {
          operationId: 'test-operation-123',
          userId: 'system-user',
          purpose: 'LOG_SANITIZATION'
        });

        expect(maskedData.auditInfo).toMatchObject({
          operationId: 'test-operation-123',
          maskedFields: ['studentName', 'ssn'],
          maskingLevel: 'STRICT',
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('FerpaComplianceValidator', () => {
    let ferpaValidator: FerpaComplianceValidator;

    beforeEach(() => {
      ferpaValidator = new FerpaComplianceValidator({
        strictMode: true,
        auditingEnabled: true,
        encryptionRequired: true
      });
    });

    describe('FERPA compliance validation', () => {
      it('should validate data access permissions', () => {
        const accessRequest = {
          userId: 'teacher@romoland.k12.ca.us',
          userRole: 'TEACHER',
          requestedData: ['STUDENT_GRADES', 'ATTENDANCE_RECORD'],
          studentId: 'STU123',
          purpose: 'EDUCATIONAL_PROGRESS_REVIEW',
          accessLevel: 'READ_ONLY'
        };

        const validation = ferpaValidator.validateDataAccess(accessRequest);

        expect(validation).toMatchObject({
          accessGranted: true,
          ferpaCompliant: true,
          legitimateEducationalInterest: true,
          restrictedFields: [],
          auditRequired: true,
          expiration: expect.any(String)
        });
      });

      it('should deny access to unauthorized data types', () => {
        const unauthorizedRequest = {
          userId: 'volunteer@romoland.k12.ca.us',
          userRole: 'VOLUNTEER',
          requestedData: ['STUDENT_SSN', 'PARENT_INCOME'],
          studentId: 'STU123',
          purpose: 'TUTORING_SUPPORT'
        };

        const validation = ferpaValidator.validateDataAccess(unauthorizedRequest);

        expect(validation).toMatchObject({
          accessGranted: false,
          ferpaCompliant: false,
          violationReason: 'INSUFFICIENT_LEGITIMATE_INTEREST',
          deniedFields: ['STUDENT_SSN', 'PARENT_INCOME'],
          recommendedAction: 'REQUEST_MINIMAL_NECESSARY_DATA'
        });
      });

      it('should validate parent consent requirements', () => {
        const disclosureRequest = {
          studentId: 'STU123',
          requestingParty: 'EXTERNAL_RESEARCHER',
          dataTypes: ['ATTENDANCE_RECORD', 'ACADEMIC_PERFORMANCE'],
          purpose: 'EDUCATIONAL_RESEARCH',
          consentProvided: false,
          directoryInformation: false
        };

        const validation = ferpaValidator.validateDisclosure(disclosureRequest);

        expect(validation).toMatchObject({
          disclosureAllowed: false,
          consentRequired: true,
          ferpaException: null,
          requiredConsent: 'WRITTEN_PARENT_CONSENT',
          complianceViolation: 'MISSING_CONSENT'
        });
      });

      it('should identify valid FERPA exceptions', () => {
        const emergencyRequest = {
          studentId: 'STU123',
          requestingParty: 'LOCAL_POLICE',
          dataTypes: ['STUDENT_CONTACT_INFO'],
          purpose: 'HEALTH_SAFETY_EMERGENCY',
          emergencyJustification: 'Missing student welfare check',
          timeframe: 'IMMEDIATE'
        };

        const validation = ferpaValidator.validateEmergencyDisclosure(emergencyRequest);

        expect(validation).toMatchObject({
          disclosureAllowed: true,
          ferpaException: 'HEALTH_SAFETY_EMERGENCY',
          consentRequired: false,
          documentationRequired: true,
          timeLimit: expect.any(String),
          followUpRequired: true
        });
      });

      it('should validate data retention compliance', () => {
        const retentionData = {
          recordType: 'ATTENDANCE_RECORD',
          creationDate: '2019-08-15',
          studentGraduationDate: '2023-06-15',
          currentDate: '2024-08-15',
          retentionPolicy: 'CALIFORNIA_7_YEAR_RULE'
        };

        const validation = ferpaValidator.validateRetentionCompliance(retentionData);

        expect(validation).toMatchObject({
          retentionCompliant: true,
          yearsRetained: 5,
          maxRetentionPeriod: 7,
          destructionRequired: false,
          destructionDate: '2030-06-15'
        });
      });

      it('should generate FERPA compliance reports', () => {
        const complianceData = {
          reportingPeriod: '2024-Q1',
          dataAccesses: 125,
          disclosures: 8,
          consentRequests: 15,
          violations: 0,
          auditFindings: 0
        };

        const report = ferpaValidator.generateComplianceReport(complianceData);

        expect(report).toMatchObject({
          period: '2024-Q1',
          overallCompliance: 100,
          dataAccessCompliance: 100,
          disclosureCompliance: 100,
          consentCompliance: 100,
          violations: [],
          recommendations: expect.any(Array),
          certificationRequired: true
        });
      });
    });
  });

  describe('AuditTrailService', () => {
    let auditService: AuditTrailService;

    beforeEach(() => {
      auditService = new AuditTrailService({
        encryptionEnabled: true,
        retentionPeriodDays: 2555, // 7 years
        compressionEnabled: true,
        realTimeAlerting: true
      });
    });

    describe('audit trail management', () => {
      it('should create audit entries for all API operations', async () => {
        const apiOperation = {
          operation: 'GET_STUDENT_ATTENDANCE',
          userId: 'teacher@romoland.k12.ca.us',
          studentId: 'STU123',
          endpoint: '/api/students/STU123/attendance',
          httpMethod: 'GET',
          requestParams: { startDate: '2024-08-01', endDate: '2024-08-31' },
          responseCode: 200,
          duration: 150,
          ipAddress: '192.168.1.100',
          userAgent: 'AP-Tool/1.0'
        };

        const auditEntry = await auditService.logApiOperation(apiOperation);

        expect(auditEntry).toMatchObject({
          id: expect.any(String),
          timestamp: expect.any(String),
          operation: 'GET_STUDENT_ATTENDANCE',
          userId: 'teacher@romoland.k12.ca.us',
          success: true,
          ferpaCompliant: true,
          encrypted: true,
          retentionDate: expect.any(String)
        });
      });

      it('should log data access with PII protection', async () => {
        const dataAccess = {
          userId: 'counselor@romoland.k12.ca.us',
          accessType: 'STUDENT_RECORD_VIEW',
          studentData: {
            studentId: 'STU123',
            firstName: 'John',
            lastName: 'Doe',
            grades: [85, 92, 78]
          },
          purpose: 'COUNSELING_SESSION',
          ferpaException: null
        };

        const auditEntry = await auditService.logDataAccess(dataAccess);

        // Verify PII is not stored in audit log
        expect(auditEntry.maskedData.firstName).toBe('****');
        expect(auditEntry.maskedData.lastName).toBe('***');
        expect(auditEntry.originalDataHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
        expect(auditEntry.ferpaCompliant).toBe(true);
      });

      it('should create alerts for suspicious access patterns', async () => {
        const alertHandler = jest.fn();
        auditService.setAlertHandler(alertHandler);

        // Simulate rapid successive access (potential data scraping)
        for (let i = 0; i < 10; i++) {
          await auditService.logApiOperation({
            operation: 'GET_STUDENT_LIST',
            userId: 'user@romoland.k12.ca.us',
            endpoint: '/api/students',
            httpMethod: 'GET',
            duration: 50,
            ipAddress: '192.168.1.100'
          });
        }

        expect(alertHandler).toHaveBeenCalledWith({
          type: 'RAPID_ACCESS_PATTERN',
          severity: 'HIGH',
          userId: 'user@romoland.k12.ca.us',
          details: expect.objectContaining({
            requestCount: 10,
            timeWindow: expect.any(Number),
            suspiciousActivity: true
          })
        });
      });

      it('should detect and log unauthorized access attempts', async () => {
        const unauthorizedAccess = {
          userId: 'unknown@external.com',
          operation: 'GET_STUDENT_ATTENDANCE',
          studentId: 'STU123',
          authenticationFailed: true,
          ipAddress: '203.0.113.1', // External IP
          userAgent: 'curl/7.68.0'
        };

        const auditEntry = await auditService.logSecurityEvent(unauthorizedAccess);

        expect(auditEntry).toMatchObject({
          eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          severity: 'CRITICAL',
          blocked: true,
          ferpaViolationPrevented: true,
          alertTriggered: true,
          requiresInvestigation: true
        });
      });

      it('should provide audit trail search and filtering', async () => {
        // Create sample audit entries
        await auditService.logApiOperation({
          operation: 'GET_STUDENT_ATTENDANCE',
          userId: 'teacher1@romoland.k12.ca.us',
          studentId: 'STU123'
        });

        await auditService.logApiOperation({
          operation: 'UPDATE_ATTENDANCE',
          userId: 'clerk@romoland.k12.ca.us',
          studentId: 'STU123'
        });

        const searchResults = await auditService.searchAuditTrail({
          studentId: 'STU123',
          dateRange: {
            start: '2024-08-01',
            end: '2024-08-31'
          },
          operations: ['GET_STUDENT_ATTENDANCE', 'UPDATE_ATTENDANCE'],
          includeMaskedData: false
        });

        expect(searchResults).toMatchObject({
          totalResults: 2,
          entries: expect.arrayContaining([
            expect.objectContaining({
              operation: 'GET_STUDENT_ATTENDANCE',
              studentId: 'STU123'
            }),
            expect.objectContaining({
              operation: 'UPDATE_ATTENDANCE',
              studentId: 'STU123'
            })
          ])
        });
      });

      it('should export audit trails for compliance reviews', async () => {
        const exportRequest = {
          format: 'JSON',
          dateRange: {
            start: '2024-08-01',
            end: '2024-08-31'
          },
          includeEncryptedData: false,
          certifyCompliance: true,
          requestedBy: 'compliance.officer@romoland.k12.ca.us'
        };

        const exportResult = await auditService.exportAuditTrail(exportRequest);

        expect(exportResult).toMatchObject({
          exportId: expect.any(String),
          format: 'JSON',
          totalEntries: expect.any(Number),
          filePath: expect.any(String),
          checksumSHA256: expect.any(String),
          complianceCertification: {
            officer: 'compliance.officer@romoland.k12.ca.us',
            timestamp: expect.any(String),
            ferpaCompliant: true
          }
        });
      });

      it('should implement secure audit log storage', async () => {
        const sensitiveOperation = {
          operation: 'ACCESS_DISCIPLINARY_RECORD',
          userId: 'principal@romoland.k12.ca.us',
          studentId: 'STU123',
          highSensitivity: true
        };

        const auditEntry = await auditService.logHighSensitivityOperation(sensitiveOperation);

        expect(auditEntry.encryption).toMatchObject({
          algorithm: 'AES-256-GCM',
          keyId: expect.any(String),
          encrypted: true,
          additionalAuth: true
        });

        expect(auditEntry.integrity).toMatchObject({
          hash: expect.any(String),
          signature: expect.any(String),
          tamperEvident: true
        });
      });

      it('should provide real-time audit monitoring', async () => {
        const monitoringCallback = jest.fn();
        auditService.enableRealTimeMonitoring(monitoringCallback);

        await auditService.logApiOperation({
          operation: 'BULK_DATA_EXPORT',
          userId: 'admin@romoland.k12.ca.us',
          recordCount: 500
        });

        expect(monitoringCallback).toHaveBeenCalledWith({
          alertType: 'BULK_DATA_ACCESS',
          severity: 'MEDIUM',
          requiresReview: true,
          automaticFlags: ['LARGE_DATA_SET']
        });
      });
    });
  });

  describe('AeriesSecurityManager', () => {
    let securityManager: AeriesSecurityManager;

    beforeEach(() => {
      securityManager = new AeriesSecurityManager({
        encryptionEnabled: true,
        auditingEnabled: true,
        realTimeMonitoring: true,
        complianceLevel: 'FERPA_STRICT'
      });
    });

    describe('integrated security management', () => {
      it('should coordinate all security components', async () => {
        const secureRequest = {
          operation: 'GET_STUDENT_DATA',
          userId: 'teacher@romoland.k12.ca.us',
          studentId: 'STU123',
          certificate: 'mock-certificate',
          requestData: {
            fields: ['attendance', 'grades'],
            dateRange: '2024-08-01:2024-08-31'
          }
        };

        const securityResult = await securityManager.validateAndExecute(secureRequest);

        expect(securityResult).toMatchObject({
          certificateValid: true,
          ferpaCompliant: true,
          auditLogged: true,
          dataEncrypted: true,
          accessGranted: true,
          maskedResponse: expect.any(Object)
        });
      });

      it('should provide comprehensive security health checks', async () => {
        const healthCheck = await securityManager.performSecurityHealthCheck();

        expect(healthCheck).toMatchObject({
          certificateStatus: expect.objectContaining({
            valid: expect.any(Boolean),
            daysUntilExpiration: expect.any(Number)
          }),
          encryptionStatus: expect.objectContaining({
            enabled: true,
            algorithmsSupported: expect.any(Array)
          }),
          auditingStatus: expect.objectContaining({
            enabled: true,
            storageSecure: true,
            retentionCompliant: true
          }),
          complianceStatus: expect.objectContaining({
            ferpaCompliant: true,
            lastAuditDate: expect.any(String)
          })
        });
      });

      it('should generate security incident reports', async () => {
        const incident = {
          type: 'UNAUTHORIZED_DATA_ACCESS',
          severity: 'HIGH',
          details: {
            userId: 'unknown@external.com',
            attemptedAccess: 'STUDENT_SSN_LIST',
            ipAddress: '203.0.113.1',
            timestamp: new Date().toISOString()
          }
        };

        const incidentReport = await securityManager.handleSecurityIncident(incident);

        expect(incidentReport).toMatchObject({
          incidentId: expect.any(String),
          classification: 'FERPA_VIOLATION_ATTEMPT',
          immediateActions: expect.arrayContaining([
            'BLOCK_IP_ADDRESS',
            'NOTIFY_COMPLIANCE_OFFICER',
            'ENHANCE_MONITORING'
          ]),
          reportFiled: true,
          lawEnforcementNotified: false, // Not required for this incident type
          remediationRequired: true
        });
      });
    });
  });
});