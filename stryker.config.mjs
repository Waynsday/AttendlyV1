/**
 * Stryker Mutation Testing Configuration for AP Tool V1
 * 
 * Validates test quality by introducing mutations (bugs) into the code
 * and ensuring tests catch them. This helps identify weak test coverage
 * and ensures tests validate behavior, not just pass assertions.
 * 
 * Educational Domain Focus:
 * - Critical attendance calculation logic
 * - Student data validation
 * - Grade-level business rules (6-8 middle school)
 * - Period-based attendance (7 periods)
 * - California truancy law compliance (SB 153/176)
 * 
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    enableFindRelatedTests: true,
  },
  
  // Files to mutate - focus on critical business logic
  mutate: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/infrastructure/**/*.ts',
    'src/lib/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**',
    '!src/tests/**',
    '!src/**/*.d.ts',
    '!src/**/types/**',
  ],
  
  // Test files pattern
  testPattern: [
    'src/**/*.test.ts',
    'src/**/*.test.tsx',
    'src/**/*.spec.ts',
    'src/**/*.spec.tsx',
    'src/tests/unit/**/*.ts',
    'src/tests/integration/**/*.ts'
  ],
  
  // Coverage analysis
  coverageAnalysis: 'perTest',
  
  // Mutation score thresholds
  thresholds: {
    high: 85,    // Excellent test quality
    low: 70,     // Minimum acceptable
    break: 60    // Build-breaking threshold
  },
  
  // Reporters for different audiences
  reporters: [
    'html',           // Detailed HTML report for developers
    'clear-text',     // Console output
    'progress',       // Progress during execution
    'json',           // Machine-readable results
    'dashboard'       // Stryker dashboard integration
  ],
  
  // HTML report configuration
  htmlReporter: {
    baseDir: 'reports/mutation-testing'
  },
  
  // JSON report for CI/CD integration
  jsonReporter: {
    fileName: 'reports/mutation-testing/mutation-report.json'
  },
  
  // Dashboard reporter for team visibility
  dashboard: {
    project: 'github.com/romoland-school-district/ap-tool-v1',
    version: process.env.GITHUB_SHA || 'local',
    module: 'ap-tool-v1'
  },
  
  // Mutation types to enable
  mutator: {
    plugins: [
      '@stryker-mutator/javascript-mutator'
    ],
    excludedMutations: [
      // Exclude mutations that don't add value for educational domain
      'StringLiteral',  // Avoid mutating error messages
      'RegexLiteral',   // Keep validation regexes intact
    ]
  },
  
  // Performance configuration
  maxConcurrentTestRunners: 4,
  timeoutMS: 60000,
  timeoutFactor: 1.5,
  
  // File system configuration
  tempDirName: 'stryker-tmp',
  cleanTempDir: true,
  
  // Advanced mutation settings for educational domain
  mutator: {
    // Focus on critical business logic mutations
    plugins: ['@stryker-mutator/typescript-mutator'],
    // Custom mutations for educational data validation
    excludedMutations: [
      // Don't mutate logging statements
      'StringLiteral',
      // Keep validation messages intact for debugging
      'TemplateStringLiteral'
    ]
  },
  
  // Educational-specific ignore patterns
  ignorePatterns: [
    // Don't mutate configuration files
    '**/*.config.*',
    // Skip type definitions
    '**/*.d.ts',
    // Skip test utilities that don't contain business logic
    '**/test-utils/**',
    '**/mocks/**',
    // Skip database migrations (structural, not logic)
    '**/migrations/**',
    // Skip static content
    '**/public/**'
  ],
  
  // Plugin configuration
  plugins: [
    '@stryker-mutator/core',
    '@stryker-mutator/jest-runner',
    '@stryker-mutator/typescript-checker'
  ],
  
  // TypeScript configuration
  tsconfigFile: 'tsconfig.json',
  typescriptChecker: {
    enabled: true,
    prioritizePerformanceOverAccuracy: false
  },
  
  // Build command if needed
  buildCommand: 'npm run build',
  
  // Custom logging for educational domain testing
  logLevel: 'info',
  fileLogLevel: 'debug',
  allowConsoleColors: true,
  
  // Specific focus areas for AP Tool mutations
  // These comments help QA understand what we're testing
  comments: {
    excludedCode: [
      // Educational business rules that should not be mutated
      'MIDDLE_SCHOOL_PERIODS = 7',
      'TRUANCY_THRESHOLD',
      'CALIFORNIA_ATTENDANCE_LAW',
      // Database connection strings and security
      'process.env',
      'DATABASE_URL',
      'SUPABASE_',
      'AERIES_'
    ]
  }
};