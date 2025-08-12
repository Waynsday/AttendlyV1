import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global Test Setup for AP Tool V1
 * 
 * Prepares the testing environment with:
 * - Test database with anonymized student data
 * - Mock Aeries API server
 * - Authentication tokens for different user roles
 * - Performance monitoring setup
 * - FERPA compliance validation
 */

const GLOBAL_SETUP_TIMEOUT = 300_000; // 5 minutes

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup for AP Tool V1...');
  
  const startTime = Date.now();
  
  try {
    // 1. Setup test database with clean state
    await setupTestDatabase();
    
    // 2. Seed with anonymized educational data
    await seedTestData();
    
    // 3. Start mock Aeries API server
    await startMockAeriesServer();
    
    // 4. Setup authentication tokens
    await setupAuthTokens();
    
    // 5. Validate FERPA compliance setup
    await validateFERPACompliance();
    
    // 6. Create test reports directory
    ensureTestDirectories();
    
    // 7. Initialize performance monitoring
    await initializePerformanceMonitoring();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Global setup completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * Setup test database with clean state
 */
async function setupTestDatabase(): Promise<void> {
  console.log('  📊 Setting up test database...');
  
  // Reset test database to clean state
  try {
    // Use test-specific database URL
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for testing');
    }
    
    // Run database migrations for test environment
    execSync('npx prisma db push --force-reset', {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'inherit'
    });
    
    console.log('    ✅ Test database initialized');
  } catch (error) {
    console.error('    ❌ Database setup failed:', error);
    throw error;
  }
}

/**
 * Seed test database with anonymized educational data
 */
async function seedTestData(): Promise<void> {
  console.log('  🌱 Seeding test data...');
  
  try {
    const { seedAnonymizedData } = await import('../fixtures/seed-test-data');
    await seedAnonymizedData();
    console.log('    ✅ Test data seeded successfully');
  } catch (error) {
    console.error('    ❌ Test data seeding failed:', error);
    throw error;
  }
}

/**
 * Start mock Aeries API server for integration testing
 */
async function startMockAeriesServer(): Promise<void> {
  console.log('  🔧 Starting mock Aeries API server...');
  
  try {
    const { startMockServer } = await import('../mocks/aeries-mock-server');
    await startMockServer();
    console.log('    ✅ Mock Aeries API server started');
  } catch (error) {
    console.error('    ❌ Mock server startup failed:', error);
    throw error;
  }
}

/**
 * Setup authentication tokens for different user roles
 */
async function setupAuthTokens(): Promise<void> {
  console.log('  🔐 Setting up authentication tokens...');
  
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Create auth tokens for different roles
    const roles = ['ap_administrator', 'teacher', 'counselor', 'district_admin'];
    const tokens: Record<string, string> = {};
    
    for (const role of roles) {
      // Simulate login for each role
      const token = await createTestAuthToken(role);
      tokens[role] = token;
    }
    
    // Store tokens for test use
    const tokensPath = path.join(process.cwd(), 'test-results', 'auth-tokens.json');
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
    
    await browser.close();
    console.log('    ✅ Authentication tokens created');
  } catch (error) {
    console.error('    ❌ Auth setup failed:', error);
    throw error;
  }
}

/**
 * Create test authentication token for a specific role
 */
async function createTestAuthToken(role: string): Promise<string> {
  // This would integrate with your actual auth system
  // For now, return a mock JWT token with appropriate claims
  const jwt = await import('jsonwebtoken');
  
  const payload = {
    sub: `test-user-${role}`,
    role: role,
    permissions: getRolePermissions(role),
    school_id: 'test-romoland-middle',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    iss: 'ap-tool-test',
    aud: 'ap-tool-frontend'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
}

/**
 * Get permissions for a specific role
 */
function getRolePermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    'ap_administrator': [
      'view_all_students',
      'modify_attendance',
      'generate_reports',
      'manage_interventions',
      'view_iready_scores',
      'manage_users'
    ],
    'teacher': [
      'view_assigned_students',
      'view_attendance',
      'view_iready_scores'
    ],
    'counselor': [
      'view_assigned_students',
      'view_attendance',
      'manage_interventions',
      'view_iready_scores'
    ],
    'district_admin': [
      'view_all_students',
      'view_all_schools',
      'generate_district_reports',
      'manage_users'
    ]
  };
  
  return permissions[role] || [];
}

/**
 * Validate FERPA compliance setup
 */
async function validateFERPACompliance(): Promise<void> {
  console.log('  🛡️  Validating FERPA compliance...');
  
  try {
    // Check that test data is properly anonymized
    const { validateTestDataCompliance } = await import('../fixtures/ferpa-validator');
    await validateTestDataCompliance();
    
    // Verify encryption setup
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY must be set for FERPA compliance testing');
    }
    
    console.log('    ✅ FERPA compliance validated');
  } catch (error) {
    console.error('    ❌ FERPA validation failed:', error);
    throw error;
  }
}

/**
 * Ensure test directories exist
 */
function ensureTestDirectories(): void {
  console.log('  📁 Creating test directories...');
  
  const directories = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'test-results/performance',
    'test-results/accessibility',
    'reports',
    'reports/mutation-testing',
    'reports/coverage'
  ];
  
  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
  
  console.log('    ✅ Test directories created');
}

/**
 * Initialize performance monitoring for tests
 */
async function initializePerformanceMonitoring(): Promise<void> {
  console.log('  📈 Initializing performance monitoring...');
  
  try {
    // Setup Web Vitals collection
    const perfConfig = {
      collectWebVitals: true,
      performanceThresholds: {
        // AP dashboard must load within 2 seconds
        dashboardLoadTime: 2000,
        // Student search should respond within 500ms
        searchResponseTime: 500,
        // Attendance updates should process within 1 second
        attendanceUpdateTime: 1000,
        // Large dataset imports should complete within 30 seconds
        importProcessingTime: 30000
      }
    };
    
    const configPath = path.join(process.cwd(), 'test-results', 'performance-config.json');
    fs.writeFileSync(configPath, JSON.stringify(perfConfig, null, 2));
    
    console.log('    ✅ Performance monitoring initialized');
  } catch (error) {
    console.error('    ❌ Performance monitoring setup failed:', error);
    throw error;
  }
}

export default globalSetup;