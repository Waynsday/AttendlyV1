import * as fs from 'fs';
import * as path from 'path';

/**
 * FERPA Compliance Validator for AP Tool V1
 * 
 * Ensures all test data and artifacts comply with FERPA regulations
 * by validating that no real student PII exists in test environments.
 * 
 * FERPA Requirements:
 * - No real student names
 * - No actual student IDs
 * - No real email addresses
 * - No sensitive demographic information
 * - Proper anonymization of all educational records
 */

interface FERPAViolation {
  type: 'PII_DETECTED' | 'REAL_EMAIL' | 'ACTUAL_STUDENT_ID' | 'SENSITIVE_DATA';
  description: string;
  location: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  remediation: string;
}

export class FERPAValidator {
  private violations: FERPAViolation[] = [];
  
  // Known test-safe patterns
  private readonly SAFE_EMAIL_DOMAINS = [
    '@student.romoland.k12.ca.us',
    '@romoland.k12.ca.us',
    '@test.edu',
    '@example.com'
  ];
  
  private readonly SAFE_NAME_PATTERNS = [
    // Common test names that don't represent real students
    /^(John|Jane|Test|Demo|Sample|Example)/i,
    /^(Student|User|Person)\d+$/i,
    // Fictional names commonly used in testing
    /^(Emma|Liam|Olivia|Noah|Ava|Ethan|Sophia|Mason|Isabella|William)$/i
  ];
  
  private readonly SENSITIVE_PATTERNS = [
    // SSN patterns
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b\d{9}\b/g,
    // Real phone numbers
    /\(\d{3}\)\s*\d{3}-\d{4}/g,
    // Real addresses (specific street numbers)
    /\b\d{1,5}\s+\w+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard)\b/gi,
    // Medical information indicators
    /\b(IEP|504|medical|disability|diagnosis)\b/gi
  ];

  /**
   * Validate test data compliance
   */
  async validateTestDataCompliance(): Promise<void> {
    console.log('🛡️  Validating FERPA compliance of test data...');
    
    this.violations = [];
    
    try {
      // Check environment variables
      await this.validateEnvironmentVariables();
      
      // Check test data files
      await this.validateTestDataFiles();
      
      // Check database would be done in actual implementation
      // For now, we'll simulate this check
      await this.validateDatabaseContent();
      
      if (this.violations.length > 0) {
        this.reportViolations();
        throw new Error(`FERPA compliance violations detected: ${this.violations.length}`);
      }
      
      console.log('    ✅ FERPA compliance validated - no violations detected');
      
    } catch (error) {
      console.error('    ❌ FERPA validation failed:', error);
      throw error;
    }
  }

  /**
   * Validate that no PII remains in test artifacts
   */
  async validateNoTestPII(testResultsDir: string): Promise<void> {
    console.log('🔍 Scanning test artifacts for PII...');
    
    this.violations = [];
    
    try {
      await this.scanDirectoryForPII(testResultsDir);
      
      if (this.violations.length > 0) {
        this.reportViolations();
        // Don't throw during cleanup - just report
        console.warn(`⚠️  PII detected in test artifacts: ${this.violations.length} violations`);
      } else {
        console.log('    ✅ No PII detected in test artifacts');
      }
      
    } catch (error) {
      console.error('    ❌ PII scanning failed:', error);
    }
  }

  /**
   * Validate environment variables don't contain production data
   */
  private async validateEnvironmentVariables(): Promise<void> {
    const sensitiveEnvVars = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'AERIES_API_URL'
    ];
    
    for (const envVar of sensitiveEnvVars) {
      const value = process.env[envVar];
      if (value) {
        // Check if it points to production systems
        if (value.includes('prod') || value.includes('production') || 
            value.includes('romoland') && !value.includes('test')) {
          this.violations.push({
            type: 'SENSITIVE_DATA',
            description: `Environment variable ${envVar} may point to production system`,
            location: `Environment variable: ${envVar}`,
            severity: 'CRITICAL',
            remediation: `Use test-specific ${envVar} that points to test database`
          });
        }
      }
    }
  }

  /**
   * Validate test data files for FERPA compliance
   */
  private async validateTestDataFiles(): Promise<void> {
    const testDataDirs = [
      'src/tests/fixtures',
      'src/tests/mocks',
      'References'
    ];
    
    for (const dir of testDataDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        await this.scanDirectoryForPII(fullPath);
      }
    }
  }

  /**
   * Validate database content (simulated)
   */
  private async validateDatabaseContent(): Promise<void> {
    // In a real implementation, this would query the test database
    // to check for any patterns that might indicate real student data
    
    // For now, we'll create a mock validation
    const mockStudentRecords = [
      { first_name: 'John', last_name: 'Doe', email: 'john.doe.123456@student.romoland.k12.ca.us' },
      { first_name: 'Jane', last_name: 'Smith', email: 'jane.smith.789012@student.romoland.k12.ca.us' }
    ];
    
    for (const record of mockStudentRecords) {
      this.validateStudentRecord(record);
    }
  }

  /**
   * Validate individual student record
   */
  private validateStudentRecord(record: any): void {
    // Check names against safe patterns
    const fullName = `${record.first_name} ${record.last_name}`;
    const isSafeName = this.SAFE_NAME_PATTERNS.some(pattern => 
      pattern.test(record.first_name) || pattern.test(record.last_name)
    );
    
    if (!isSafeName) {
      // Additional check - names that are too uncommon might be real
      if (this.isUncommonName(fullName)) {
        this.violations.push({
          type: 'PII_DETECTED',
          description: `Potentially real student name detected: ${fullName}`,
          location: 'Database student record',
          severity: 'HIGH',
          remediation: 'Replace with anonymized test name from approved list'
        });
      }
    }
    
    // Check email addresses
    const emailDomainValid = this.SAFE_EMAIL_DOMAINS.some(domain => 
      record.email.includes(domain)
    );
    
    if (!emailDomainValid) {
      this.violations.push({
        type: 'REAL_EMAIL',
        description: `Non-test email domain detected: ${record.email}`,
        location: 'Database student record',
        severity: 'CRITICAL',
        remediation: 'Use only test email domains for student records'
      });
    }
  }

  /**
   * Scan directory recursively for PII
   */
  private async scanDirectoryForPII(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) return;
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other non-relevant directories
        if (!['node_modules', '.git', '.next', 'coverage'].includes(entry.name)) {
          await this.scanDirectoryForPII(fullPath);
        }
      } else if (entry.isFile()) {
        await this.scanFileForPII(fullPath);
      }
    }
  }

  /**
   * Scan individual file for PII
   */
  private async scanFileForPII(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    
    // Only scan text-based files
    const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.csv', '.txt', '.md'];
    if (!textExtensions.includes(ext)) return;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for sensitive patterns
      for (const pattern of this.SENSITIVE_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          this.violations.push({
            type: 'SENSITIVE_DATA',
            description: `Sensitive data pattern detected: ${matches[0]}`,
            location: filePath,
            severity: 'HIGH',
            remediation: 'Remove or anonymize sensitive data in test files'
          });
        }
      }
      
      // Check for potential real names in CSV files
      if (ext === '.csv') {
        await this.validateCSVContent(filePath, content);
      }
      
    } catch (error) {
      // Ignore files that can't be read as text
    }
  }

  /**
   * Validate CSV content for student data patterns
   */
  private async validateCSVContent(filePath: string, content: string): Promise<void> {
    const lines = content.split('\n');
    const headers = lines[0]?.toLowerCase().split(',') || [];
    
    // Check if this looks like student data
    const studentDataIndicators = ['student_id', 'first_name', 'last_name', 'grade', 'email'];
    const hasStudentData = studentDataIndicators.some(indicator => 
      headers.some(header => header.includes(indicator))
    );
    
    if (hasStudentData) {
      // This file contains student data - ensure it's properly anonymized
      if (filePath.includes('References') && !filePath.includes('test')) {
        this.violations.push({
          type: 'PII_DETECTED',
          description: 'Potential real student data in References directory',
          location: filePath,
          severity: 'CRITICAL',
          remediation: 'Move real data out of repository or properly anonymize'
        });
      }
    }
  }

  /**
   * Check if a name appears to be uncommon/potentially real
   */
  private isUncommonName(name: string): boolean {
    // Simple heuristic - names with unusual character combinations
    // or very specific patterns might be real
    
    const uncommonPatterns = [
      // Names with unusual letter combinations
      /[xz]{2,}/i,
      // Names with apostrophes or hyphens (often real names)
      /['-]/,
      // Very long names (often real)
      /^.{15,}$/,
      // Names with repeated unusual letters
      /([qwxz])\1/i
    ];
    
    return uncommonPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Report all FERPA violations found
   */
  private reportViolations(): void {
    console.error('\n❌ FERPA COMPLIANCE VIOLATIONS DETECTED:\n');
    
    // Group by severity
    const critical = this.violations.filter(v => v.severity === 'CRITICAL');
    const high = this.violations.filter(v => v.severity === 'HIGH');
    const medium = this.violations.filter(v => v.severity === 'MEDIUM');
    const low = this.violations.filter(v => v.severity === 'LOW');
    
    if (critical.length > 0) {
      console.error('🚨 CRITICAL VIOLATIONS:');
      critical.forEach(v => this.logViolation(v));
    }
    
    if (high.length > 0) {
      console.error('\n⚠️  HIGH SEVERITY VIOLATIONS:');
      high.forEach(v => this.logViolation(v));
    }
    
    if (medium.length > 0) {
      console.error('\n📋 MEDIUM SEVERITY VIOLATIONS:');
      medium.forEach(v => this.logViolation(v));
    }
    
    if (low.length > 0) {
      console.error('\n📝 LOW SEVERITY VIOLATIONS:');
      low.forEach(v => this.logViolation(v));
    }
    
    console.error(`\nTotal violations: ${this.violations.length}`);
    console.error('Please remediate all violations before proceeding with testing.\n');
  }

  /**
   * Log individual violation
   */
  private logViolation(violation: FERPAViolation): void {
    console.error(`  ${violation.type}: ${violation.description}`);
    console.error(`    Location: ${violation.location}`);
    console.error(`    Remediation: ${violation.remediation}\n`);
  }
}

// Export convenience functions
export async function validateTestDataCompliance(): Promise<void> {
  const validator = new FERPAValidator();
  await validator.validateTestDataCompliance();
}

export async function validateNoTestPII(testResultsDir: string): Promise<void> {
  const validator = new FERPAValidator();
  await validator.validateNoTestPII(testResultsDir);
}