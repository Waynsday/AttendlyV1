import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global Test Teardown for AP Tool V1
 * 
 * Cleans up after test execution:
 * - Stops mock servers
 * - Cleans test database
 * - Generates final test reports
 * - Archives test artifacts
 * - Validates FERPA compliance cleanup
 */

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');
  
  const startTime = Date.now();
  
  try {
    // 1. Stop mock servers
    await stopMockServers();
    
    // 2. Clean test database
    await cleanTestDatabase();
    
    // 3. Generate final test reports
    await generateTestReports();
    
    // 4. Validate FERPA compliance cleanup
    await validateFERPACleanup();
    
    // 5. Archive test artifacts
    await archiveTestArtifacts();
    
    // 6. Cleanup temporary files
    await cleanupTempFiles();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Global teardown completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw - we want CI to continue even if cleanup fails
  }
}

/**
 * Stop all mock servers
 */
async function stopMockServers(): Promise<void> {
  console.log('  🔌 Stopping mock servers...');
  
  try {
    const { stopMockServer } = await import('../mocks/aeries-mock-server');
    await stopMockServer();
    console.log('    ✅ Mock servers stopped');
  } catch (error) {
    console.error('    ⚠️  Mock server cleanup failed:', error);
  }
}

/**
 * Clean test database
 */
async function cleanTestDatabase(): Promise<void> {
  console.log('  🗄️  Cleaning test database...');
  
  try {
    // Only clean if we're in test environment
    if (process.env.NODE_ENV === 'test' || process.env.TEST_DATABASE_URL) {
      const { cleanupTestData } = await import('../fixtures/cleanup-test-data');
      await cleanupTestData();
      console.log('    ✅ Test database cleaned');
    } else {
      console.log('    ⏭️  Skipping database cleanup (not in test environment)');
    }
  } catch (error) {
    console.error('    ⚠️  Database cleanup failed:', error);
  }
}

/**
 * Generate comprehensive test reports
 */
async function generateTestReports(): Promise<void> {
  console.log('  📊 Generating test reports...');
  
  try {
    await generateCoverageReport();
    await generatePerformanceReport();
    await generateAccessibilityReport();
    await generateSecurityReport();
    console.log('    ✅ Test reports generated');
  } catch (error) {
    console.error('    ⚠️  Report generation failed:', error);
  }
}

/**
 * Generate coverage report summary
 */
async function generateCoverageReport(): Promise<void> {
  const coverageDir = path.join(process.cwd(), 'coverage');
  const reportsDir = path.join(process.cwd(), 'reports');
  
  if (fs.existsSync(coverageDir)) {
    // Read coverage summary
    const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
    if (fs.existsSync(coverageSummaryPath)) {
      const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
      
      const report = {
        timestamp: new Date().toISOString(),
        coverage: coverageSummary.total,
        thresholds: {
          lines: 85,
          branches: 80,
          functions: 85,
          statements: 85
        },
        passed: coverageSummary.total.lines.pct >= 85 &&
                coverageSummary.total.branches.pct >= 80 &&
                coverageSummary.total.functions.pct >= 85 &&
                coverageSummary.total.statements.pct >= 85
      };
      
      fs.writeFileSync(
        path.join(reportsDir, 'coverage-report.json'),
        JSON.stringify(report, null, 2)
      );
    }
  }
}

/**
 * Generate performance report summary
 */
async function generatePerformanceReport(): Promise<void> {
  const perfResultsDir = path.join(process.cwd(), 'test-results', 'performance');
  const reportsDir = path.join(process.cwd(), 'reports');
  
  if (fs.existsSync(perfResultsDir)) {
    const perfFiles = fs.readdirSync(perfResultsDir).filter(f => f.endsWith('.json'));
    const performanceData = perfFiles.map(file => {
      const filePath = path.join(perfResultsDir, file);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });
    
    const report = {
      timestamp: new Date().toISOString(),
      tests: performanceData.length,
      summary: {
        averageDashboardLoadTime: calculateAverage(performanceData, 'dashboardLoadTime'),
        averageSearchResponseTime: calculateAverage(performanceData, 'searchResponseTime'),
        averageAttendanceUpdateTime: calculateAverage(performanceData, 'attendanceUpdateTime')
      },
      thresholds: {
        dashboardLoadTime: 2000,
        searchResponseTime: 500,
        attendanceUpdateTime: 1000
      }
    };
    
    fs.writeFileSync(
      path.join(reportsDir, 'performance-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

/**
 * Generate accessibility report summary
 */
async function generateAccessibilityReport(): Promise<void> {
  const a11yResultsDir = path.join(process.cwd(), 'test-results', 'accessibility');
  const reportsDir = path.join(process.cwd(), 'reports');
  
  if (fs.existsSync(a11yResultsDir)) {
    const a11yFiles = fs.readdirSync(a11yResultsDir).filter(f => f.endsWith('.json'));
    const accessibilityData = a11yFiles.map(file => {
      const filePath = path.join(a11yResultsDir, file);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });
    
    const totalViolations = accessibilityData.reduce((sum, data) => 
      sum + (data.violations?.length || 0), 0
    );
    
    const report = {
      timestamp: new Date().toISOString(),
      tests: accessibilityData.length,
      totalViolations: totalViolations,
      wcagCompliant: totalViolations === 0,
      summary: {
        critical: accessibilityData.reduce((sum, data) => 
          sum + (data.violations?.filter((v: any) => v.impact === 'critical').length || 0), 0
        ),
        serious: accessibilityData.reduce((sum, data) => 
          sum + (data.violations?.filter((v: any) => v.impact === 'serious').length || 0), 0
        ),
        moderate: accessibilityData.reduce((sum, data) => 
          sum + (data.violations?.filter((v: any) => v.impact === 'moderate').length || 0), 0
        ),
        minor: accessibilityData.reduce((sum, data) => 
          sum + (data.violations?.filter((v: any) => v.impact === 'minor').length || 0), 0
        )
      }
    };
    
    fs.writeFileSync(
      path.join(reportsDir, 'accessibility-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

/**
 * Generate security report summary
 */
async function generateSecurityReport(): Promise<void> {
  const securityResultsDir = path.join(process.cwd(), 'test-results', 'security');
  const reportsDir = path.join(process.cwd(), 'reports');
  
  if (fs.existsSync(securityResultsDir)) {
    const securityFiles = fs.readdirSync(securityResultsDir).filter(f => f.endsWith('.json'));
    const securityData = securityFiles.map(file => {
      const filePath = path.join(securityResultsDir, file);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });
    
    const report = {
      timestamp: new Date().toISOString(),
      tests: securityData.length,
      ferpaCompliant: securityData.every(data => data.ferpaCompliant !== false),
      vulnerabilities: securityData.reduce((sum, data) => 
        sum + (data.vulnerabilities?.length || 0), 0
      ),
      summary: {
        authentication: securityData.filter(data => data.category === 'authentication').length,
        authorization: securityData.filter(data => data.category === 'authorization').length,
        dataProtection: securityData.filter(data => data.category === 'dataProtection').length,
        inputValidation: securityData.filter(data => data.category === 'inputValidation').length
      }
    };
    
    fs.writeFileSync(
      path.join(reportsDir, 'security-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

/**
 * Validate FERPA compliance cleanup
 */
async function validateFERPACleanup(): Promise<void> {
  console.log('  🛡️  Validating FERPA compliance cleanup...');
  
  try {
    // Check that no PII remains in test artifacts
    const testResultsDir = path.join(process.cwd(), 'test-results');
    if (fs.existsSync(testResultsDir)) {
      const { validateNoTestPII } = await import('../fixtures/ferpa-validator');
      await validateNoTestPII(testResultsDir);
    }
    
    console.log('    ✅ FERPA compliance cleanup validated');
  } catch (error) {
    console.error('    ⚠️  FERPA cleanup validation failed:', error);
  }
}

/**
 * Archive test artifacts for analysis
 */
async function archiveTestArtifacts(): Promise<void> {
  console.log('  📦 Archiving test artifacts...');
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(process.cwd(), 'test-archives', timestamp);
    
    // Only create archive in CI environment
    if (process.env.CI) {
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      
      // Copy important artifacts
      const artifactDirs = ['test-results', 'reports', 'coverage'];
      artifactDirs.forEach(dir => {
        const srcDir = path.join(process.cwd(), dir);
        const destDir = path.join(archiveDir, dir);
        if (fs.existsSync(srcDir)) {
          copyDirectory(srcDir, destDir);
        }
      });
      
      console.log(`    ✅ Test artifacts archived to ${archiveDir}`);
    } else {
      console.log('    ⏭️  Skipping archival (not in CI environment)');
    }
  } catch (error) {
    console.error('    ⚠️  Archival failed:', error);
  }
}

/**
 * Cleanup temporary files
 */
async function cleanupTempFiles(): Promise<void> {
  console.log('  🗑️  Cleaning up temporary files...');
  
  try {
    const tempDirs = [
      'stryker-tmp',
      '.nyc_output',
      'node_modules/.cache/jest'
    ];
    
    tempDirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    });
    
    console.log('    ✅ Temporary files cleaned');
  } catch (error) {
    console.error('    ⚠️  Temp file cleanup failed:', error);
  }
}

/**
 * Calculate average from performance data
 */
function calculateAverage(data: any[], field: string): number {
  const values = data.map(d => d[field]).filter(v => typeof v === 'number');
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Copy directory recursively
 */
function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default globalTeardown;