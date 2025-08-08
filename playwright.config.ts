import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for AP Tool V1
 * 
 * Comprehensive end-to-end testing configuration for educational data workflows
 * including attendance tracking, i-Ready assessments, and AP dashboard functionality.
 * 
 * Features:
 * - Multi-browser testing (Chrome, Firefox, Safari)
 * - Mobile device simulation for responsive design
 * - Performance testing with Web Vitals
 * - Accessibility testing integration
 * - Realistic test data with anonymized student information
 * - FERPA compliance validation
 */

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src/tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Global timeout for actions */
    actionTimeout: 10_000,

    /* Navigation timeout */
    navigationTimeout: 30_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Simulate Romoland district IT environment
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports for responsive design */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers for district compatibility */
    {
      name: 'Microsoft Edge',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge' 
      },
    },

    /* Performance testing project */
    {
      name: 'performance',
      testMatch: /.*\.perf\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        // Throttle network for realistic school network conditions
        // Many schools have limited bandwidth
        launchOptions: {
          args: [
            '--enable-features=NetworkServiceLogging',
            '--log-level=0'
          ]
        }
      },
    },

    /* Accessibility testing project */
    {
      name: 'accessibility',
      testMatch: /.*\.a11y\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    /* Security testing project for FERPA compliance */
    {
      name: 'security',
      testMatch: /.*\.security\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        // Disable web security for penetration testing
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        }
      },
    }
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve('./src/tests/setup/global-setup.ts'),
  globalTeardown: require.resolve('./src/tests/setup/global-teardown.ts'),

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // 2 minutes for Next.js to start
    stdout: 'ignore',
    stderr: 'pipe',
  },

  /* Test timeout configurations */
  timeout: 30_000, // 30 seconds per test
  expect: {
    timeout: 5_000, // 5 seconds for assertions
    // Performance thresholds for AP dashboard
    toHaveScreenshot: { 
      threshold: 0.1, 
      maxDiffPixels: 1000 
    },
    toMatchSnapshot: { 
      threshold: 0.1 
    }
  },

  /* Output directory for test artifacts */
  outputDir: 'test-results/playwright',

  /* Maximum number of test failures before stopping */
  maxFailures: process.env.CI ? 10 : undefined,
});