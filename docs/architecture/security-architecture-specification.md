# Security Architecture Specification - AP Tool V1

## STRIDE Threat Model Analysis

### Spoofing (Authentication)
**Threats:**
- Unauthorized access to student data
- API endpoint spoofing
- Identity impersonation

**Mitigations:**
```typescript
export class AuthenticationService {
  private readonly jwtService: JWTService;
  private readonly sessionManager: SessionManager;

  async authenticateUser(credentials: UserCredentials): Promise<AuthenticationResult> {
    // Multi-factor authentication for administrative users
    const mfaResult = await this.verifyMFA(credentials);
    if (!mfaResult.success) {
      throw new AuthenticationError('MFA verification failed');
    }

    // Certificate-based authentication for Aeries API
    const certValidation = await this.validateCertificate(credentials.certificate);
    if (!certValidation.isValid) {
      throw new AuthenticationError('Invalid certificate');
    }

    const user = await this.validateCredentials(credentials);
    const session = await this.sessionManager.createSession(user);
    
    return new AuthenticationResult(user, session);
  }

  async validateAPIAccess(apiKey: string, endpoint: string): Promise<boolean> {
    const keyValidation = await this.validateAPIKey(apiKey);
    if (!keyValidation.isValid) return false;

    const permissions = await this.getPermissions(keyValidation.userId);
    return permissions.canAccess(endpoint);
  }
}
```

### Tampering (Data Integrity)
**Threats:**
- Unauthorized modification of attendance records
- Data corruption during sync
- Malicious data injection

**Mitigations:**
```typescript
export class DataIntegrityService {
  private readonly hashService: HashService;
  private readonly signatureService: DigitalSignatureService;

  async protectRecord<T>(record: T, userId: UserId): Promise<ProtectedRecord<T>> {
    const recordHash = this.hashService.calculateHash(record);
    const signature = await this.signatureService.sign(recordHash, userId);
    
    return new ProtectedRecord(record, recordHash, signature, new Date());
  }

  async verifyRecordIntegrity<T>(protectedRecord: ProtectedRecord<T>): Promise<boolean> {
    const currentHash = this.hashService.calculateHash(protectedRecord.data);
    if (currentHash !== protectedRecord.hash) {
      return false;
    }

    return await this.signatureService.verify(
      protectedRecord.hash,
      protectedRecord.signature
    );
  }

  async createAuditTrail(
    action: AuditAction,
    recordId: string,
    userId: UserId,
    beforeState?: any,
    afterState?: any
  ): Promise<void> {
    const auditRecord = new AuditRecord({
      id: crypto.randomUUID(),
      action,
      recordId,
      userId,
      beforeState: beforeState ? this.hashService.calculateHash(beforeState) : null,
      afterState: afterState ? this.hashService.calculateHash(afterState) : null,
      timestamp: new Date(),
      ipAddress: this.getCurrentIPAddress(),
      userAgent: this.getCurrentUserAgent()
    });

    await this.auditRepository.save(auditRecord);
  }
}
```

### Repudiation (Audit Logging)
**Threats:**
- Denial of actions performed
- Missing audit trails
- Log tampering

**Mitigations:**
```typescript
export class AuditLoggingService {
  private readonly immutableLogger: ImmutableLogger;
  private readonly logEncryption: LogEncryptionService;

  async logStudentDataAccess(
    userId: UserId,
    studentId: StudentId,
    accessType: DataAccessType,
    justification: string
  ): Promise<void> {
    const logEntry = new StudentDataAccessLog({
      id: crypto.randomUUID(),
      userId,
      studentId,
      accessType,
      justification,
      timestamp: new Date(),
      sessionId: this.getCurrentSessionId(),
      ipAddress: this.getCurrentIPAddress()
    });

    // Encrypt sensitive log data
    const encryptedLog = await this.logEncryption.encrypt(logEntry);
    
    // Store in immutable log store (blockchain or append-only storage)
    await this.immutableLogger.append(encryptedLog);
    
    // Also store in searchable format for compliance reports
    await this.auditRepository.save(logEntry);
  }

  async generateComplianceReport(
    dateRange: DateRange,
    reportType: ComplianceReportType
  ): Promise<ComplianceReport> {
    const auditLogs = await this.auditRepository.findByDateRange(dateRange);
    
    return new ComplianceReport({
      reportId: crypto.randomUUID(),
      dateRange,
      reportType,
      totalAccesses: auditLogs.length,
      uniqueUsers: new Set(auditLogs.map(log => log.userId)).size,
      unauthorizedAttempts: auditLogs.filter(log => log.wasUnauthorized).length,
      dataModifications: auditLogs.filter(log => log.action === 'MODIFY').length,
      complianceScore: this.calculateComplianceScore(auditLogs)
    });
  }
}
```

### Information Disclosure (Data Protection)
**Threats:**
- Unauthorized access to student PII
- Data leakage through logs
- Insecure data transmission

**Mitigations:**
```typescript
export class DataProtectionService {
  private readonly encryptionService: EncryptionService;
  private readonly dataClassifier: DataClassificationService;
  private readonly accessController: AccessControlService;

  async protectStudentData(data: StudentData, context: AccessContext): Promise<ProtectedStudentData> {
    // Classify data sensitivity
    const classification = this.dataClassifier.classify(data);
    
    // Apply appropriate protection based on classification
    switch (classification.level) {
      case DataSensitivityLevel.HIGH:
        return await this.applyHighSecurityProtection(data, context);
      case DataSensitivityLevel.MEDIUM:
        return await this.applyMediumSecurityProtection(data, context);
      case DataSensitivityLevel.LOW:
        return await this.applyLowSecurityProtection(data, context);
    }
  }

  private async applyHighSecurityProtection(
    data: StudentData,
    context: AccessContext
  ): Promise<ProtectedStudentData> {
    // Field-level encryption for PII
    const encryptedData = await this.encryptionService.encryptFields(data, [
      'firstName',
      'lastName',
      'email',
      'address',
      'phoneNumber'
    ]);

    // Row-level security token
    const accessToken = await this.accessController.generateAccessToken(
      context.userId,
      data.studentId,
      AccessLevel.READ_WRITE,
      Duration.hours(1) // Short-lived token
    );

    return new ProtectedStudentData(encryptedData, accessToken, classification);
  }

  async maskSensitiveData(data: any, userRole: UserRole): Promise<any> {
    const maskingRules = this.getMaskingRules(userRole);
    
    return Object.keys(data).reduce((masked, key) => {
      const rule = maskingRules.get(key);
      if (rule) {
        masked[key] = rule.apply(data[key]);
      } else {
        masked[key] = data[key];
      }
      return masked;
    }, {});
  }
}
```

### Denial of Service (Availability)
**Threats:**
- API rate limiting bypass
- Resource exhaustion attacks
- Database connection pool exhaustion

**Mitigations:**
```typescript
export class AvailabilityProtectionService {
  private readonly rateLimiter: DistributedRateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly resourceMonitor: ResourceMonitor;

  async protectEndpoint(
    request: Request,
    endpoint: string,
    userId: UserId
  ): Promise<ProtectionResult> {
    // Apply rate limiting per user and per endpoint
    const rateLimitResult = await this.rateLimiter.checkLimit(
      `${userId.value}:${endpoint}`,
      this.getRateLimitConfig(endpoint)
    );

    if (!rateLimitResult.allowed) {
      throw new RateLimitExceededError(
        `Rate limit exceeded for ${endpoint}`,
        rateLimitResult.resetTime
      );
    }

    // Check system resource availability
    const resourceStatus = await this.resourceMonitor.checkAvailability();
    if (resourceStatus.isOverloaded) {
      throw new ServiceUnavailableError('System temporarily overloaded');
    }

    // Apply circuit breaker for external dependencies
    return await this.circuitBreaker.execute(async () => {
      return new ProtectionResult(true, rateLimitResult.remaining);
    });
  }

  private getRateLimitConfig(endpoint: string): RateLimitConfig {
    const configs: Record<string, RateLimitConfig> = {
      '/api/students': new RateLimitConfig(100, Duration.minutes(1)),
      '/api/attendance': new RateLimitConfig(200, Duration.minutes(1)),
      '/api/reports': new RateLimitConfig(10, Duration.minutes(1)), // More restrictive for reports
      '/api/bulk-operations': new RateLimitConfig(5, Duration.minutes(1))
    };

    return configs[endpoint] || new RateLimitConfig(50, Duration.minutes(1));
  }
}
```

### Elevation of Privilege (Authorization)
**Threats:**
- Unauthorized access to administrative functions
- Privilege escalation attacks
- Cross-school data access

**Mitigations:**
```typescript
export class AuthorizationService {
  private readonly roleManager: RoleManager;
  private readonly permissionEngine: PermissionEngine;
  private readonly contextEvaluator: SecurityContextEvaluator;

  async authorizeDataAccess(
    userId: UserId,
    dataType: DataType,
    action: DataAction,
    resourceId: string
  ): Promise<AuthorizationResult> {
    // Get user roles and permissions
    const userContext = await this.buildUserContext(userId);
    
    // Evaluate permission based on role-based access control
    const rbacResult = await this.evaluateRBAC(userContext, dataType, action);
    
    // Evaluate attribute-based access control
    const abacResult = await this.evaluateABAC(userContext, dataType, action, resourceId);
    
    // Combine results (both must pass)
    const isAuthorized = rbacResult.granted && abacResult.granted;
    
    if (!isAuthorized) {
      await this.logUnauthorizedAccess(userId, dataType, action, resourceId);
      return AuthorizationResult.denied(rbacResult.reason || abacResult.reason);
    }
    
    return AuthorizationResult.granted();
  }

  private async evaluateRBAC(
    userContext: UserSecurityContext,
    dataType: DataType,
    action: DataAction
  ): Promise<PermissionResult> {
    const requiredPermission = `${dataType.toLowerCase()}:${action.toLowerCase()}`;
    
    for (const role of userContext.roles) {
      const permissions = await this.roleManager.getPermissions(role);
      if (permissions.includes(requiredPermission)) {
        return PermissionResult.granted();
      }
    }
    
    return PermissionResult.denied(`Missing permission: ${requiredPermission}`);
  }

  private async evaluateABAC(
    userContext: UserSecurityContext,
    dataType: DataType,
    action: DataAction,
    resourceId: string
  ): Promise<PermissionResult> {
    const policy = await this.getDataAccessPolicy(dataType);
    const context = new AttributeContext({
      user: userContext,
      resource: { id: resourceId, type: dataType },
      action,
      environment: {
        time: new Date(),
        ipAddress: this.getCurrentIPAddress(),
        isSchoolHours: this.isSchoolHours()
      }
    });

    return await this.permissionEngine.evaluate(policy, context);
  }
}
```

## FERPA Compliance Framework

### Educational Record Protection
```typescript
export class FERPAComplianceService {
  private readonly encryptionService: EncryptionService;
  private readonly auditService: AuditLoggingService;
  private readonly consentManager: ConsentManager;

  async protectEducationalRecord(
    record: EducationalRecord,
    accessContext: AccessContext
  ): Promise<ProtectedEducationalRecord> {
    // Verify legitimate educational interest
    const interestValidation = await this.validateEducationalInterest(
      accessContext.userId,
      record.studentId,
      accessContext.purpose
    );

    if (!interestValidation.isValid) {
      throw new FERPAViolationError('No legitimate educational interest');
    }

    // Check parent/student consent for disclosure
    if (this.requiresConsent(accessContext)) {
      const consent = await this.consentManager.getConsent(
        record.studentId,
        accessContext.disclosureType
      );

      if (!consent || consent.isExpired()) {
        throw new FERPAViolationError('Required consent not obtained');
      }
    }

    // Apply minimum necessary principle
    const minimizedRecord = this.applyMinimumNecessary(record, accessContext.purpose);

    // Log access for FERPA audit trail
    await this.auditService.logEducationalRecordAccess(
      accessContext.userId,
      record.studentId,
      accessContext.purpose,
      minimizedRecord.fieldsAccessed
    );

    return new ProtectedEducationalRecord(minimizedRecord, interestValidation.token);
  }

  private async validateEducationalInterest(
    userId: UserId,
    studentId: StudentId,
    purpose: AccessPurpose
  ): Promise<EducationalInterestValidation> {
    const user = await this.userRepository.findById(userId);
    const validPurposes = await this.getValidPurposes(user.role);

    if (!validPurposes.includes(purpose)) {
      return EducationalInterestValidation.invalid('Purpose not authorized for role');
    }

    // Check if user has direct educational relationship with student
    const relationship = await this.checkEducationalRelationship(userId, studentId);
    if (!relationship.exists) {
      return EducationalInterestValidation.invalid('No direct educational relationship');
    }

    return EducationalInterestValidation.valid(
      crypto.randomUUID(), // Access token
      Duration.hours(1) // Token expiry
    );
  }
}
```

## Row-Level Security Implementation

### Multi-School Access Control
```typescript
export class RowLevelSecurityService {
  async createSecurityPolicy(
    tableName: string,
    policy: SecurityPolicy
  ): Promise<void> {
    const policySQL = this.generatePolicySQL(tableName, policy);
    
    await this.supabase.rpc('create_rls_policy', {
      table_name: tableName,
      policy_name: policy.name,
      policy_sql: policySQL
    });
  }

  private generatePolicySQL(tableName: string, policy: SecurityPolicy): string {
    switch (policy.type) {
      case PolicyType.SCHOOL_ISOLATION:
        return `
          CREATE POLICY "${policy.name}" ON ${tableName}
          FOR ALL TO authenticated
          USING (
            school_id = ANY(
              SELECT school_id 
              FROM user_school_assignments 
              WHERE user_id = auth.uid()
            )
          );
        `;

      case PolicyType.STUDENT_PRIVACY:
        return `
          CREATE POLICY "${policy.name}" ON ${tableName}
          FOR ALL TO authenticated
          USING (
            -- Allow access only to students in user's assigned schools
            student_id IN (
              SELECT s.id 
              FROM students s
              JOIN user_school_assignments usa ON s.school_id = usa.school_id
              WHERE usa.user_id = auth.uid()
            )
            AND
            -- Require legitimate educational interest
            EXISTS (
              SELECT 1 FROM validate_educational_interest(
                auth.uid(), 
                student_id, 
                current_setting('app.access_purpose')
              )
            )
          );
        `;

      case PolicyType.ROLE_BASED:
        return `
          CREATE POLICY "${policy.name}" ON ${tableName}
          FOR ALL TO authenticated
          USING (
            -- Check role-based permissions
            auth.jwt() ->> 'role' = ANY(ARRAY[${policy.allowedRoles.map(r => `'${r}'`).join(',')}])
            AND
            -- Additional context-based checks
            check_context_permissions(auth.uid(), '${tableName}', TG_OP)
          );
        `;

      default:
        throw new Error(`Unsupported policy type: ${policy.type}`);
    }
  }
}
```

## Data Encryption Strategy

### Field-Level Encryption
```typescript
export class FieldLevelEncryptionService {
  private readonly keyManager: EncryptionKeyManager;
  private readonly encryptionAlgorithm = 'AES-256-GCM';

  async encryptSensitiveFields<T>(
    record: T,
    encryptionConfig: FieldEncryptionConfig
  ): Promise<EncryptedRecord<T>> {
    const encryptedFields: Record<string, string> = {};
    const plainFields: Record<string, any> = {};

    for (const [fieldName, value] of Object.entries(record as any)) {
      if (encryptionConfig.shouldEncrypt(fieldName)) {
        const key = await this.keyManager.getFieldKey(fieldName);
        encryptedFields[fieldName] = await this.encrypt(value, key);
      } else {
        plainFields[fieldName] = value;
      }
    }

    return new EncryptedRecord(plainFields, encryptedFields);
  }

  async decryptSensitiveFields<T>(
    encryptedRecord: EncryptedRecord<T>,
    encryptionConfig: FieldEncryptionConfig,
    userContext: UserSecurityContext
  ): Promise<T> {
    // Check if user has permission to decrypt each field
    const decryptedFields: Record<string, any> = { ...encryptedRecord.plainFields };

    for (const [fieldName, encryptedValue] of Object.entries(encryptedRecord.encryptedFields)) {
      if (userContext.canDecrypt(fieldName)) {
        const key = await this.keyManager.getFieldKey(fieldName);
        decryptedFields[fieldName] = await this.decrypt(encryptedValue, key);
      } else {
        // Return masked value for unauthorized users
        decryptedFields[fieldName] = this.maskValue(fieldName, encryptedValue);
      }
    }

    return decryptedFields as T;
  }

  private async encrypt(value: any, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(value));

    const encrypted = await crypto.subtle.encrypt(
      { name: this.encryptionAlgorithm, iv },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(encryptedValue: string, key: CryptoKey): Promise<any> {
    const combined = new Uint8Array(
      atob(encryptedValue).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: this.encryptionAlgorithm, iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
}
```

This comprehensive security architecture ensures:

1. **Multi-layered Security**: Defense in depth with authentication, authorization, encryption, and monitoring
2. **FERPA Compliance**: Specific controls for educational record protection
3. **Data Privacy**: Field-level encryption and row-level security
4. **Audit Trails**: Comprehensive logging for compliance and forensics
5. **Threat Mitigation**: Specific controls for each STRIDE threat category
6. **Access Control**: Fine-grained permissions based on roles and context
7. **Data Protection**: Encryption at rest and in transit with proper key management