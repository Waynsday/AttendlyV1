#!/usr/bin/env node

/**
 * Test Script for Devtools Fix Verification
 * 
 * This script tests that our devtools blocking solution works correctly
 * by checking for the absence of devtools chunks and errors
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_PORT = 3003;
const TEST_TIMEOUT = 30000; // 30 seconds

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
};

async function checkBuildArtifacts() {
  log.section('🔍 Checking Build Artifacts');
  
  // Clean and build the project
  log.info('Cleaning and building project...');
  try {
    execSync('rm -rf .next', { stdio: 'ignore' });
    execSync('npm run build', { stdio: 'pipe' });
    log.success('Build completed successfully');
  } catch (error) {
    log.error('Build failed');
    throw error;
  }
  
  // Check for devtools chunks in build output
  const nextStaticPath = path.join('.next', 'static', 'chunks');
  if (fs.existsSync(nextStaticPath)) {
    const chunks = fs.readdirSync(nextStaticPath);
    const devtoolsChunks = chunks.filter(chunk => 
      chunk.includes('devtools') || chunk.includes('next-devtools')
    );
    
    if (devtoolsChunks.length === 0) {
      log.success('No devtools chunks found in build artifacts');
      return true;
    } else {
      log.error(`Found devtools chunks: ${devtoolsChunks.join(', ')}`);
      return false;
    }
  } else {
    log.warning('Static chunks directory not found');
    return false;
  }
}

async function testDevServer() {
  log.section('🚀 Testing Development Server');
  
  return new Promise((resolve) => {
    let serverStarted = false;
    let devtoolsErrors = [];
    let serverProcess;
    
    const timeout = setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill('SIGINT');
      }
      if (!serverStarted) {
        log.error('Server failed to start within timeout');
        resolve(false);
      } else {
        log.success(`Server ran for ${TEST_TIMEOUT / 1000} seconds without devtools errors`);
        resolve(devtoolsErrors.length === 0);
      }
    }, TEST_TIMEOUT);
    
    // Start development server
    const env = {
      ...process.env,
      PORT: TEST_PORT.toString(),
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_ENV: 'development',
    };
    
    serverProcess = spawn('next', ['dev', '-p', TEST_PORT.toString()], {
      env,
      stdio: 'pipe',
    });
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      if (output.includes('ready') || output.includes('Local:')) {
        serverStarted = true;
        log.success(`Development server started on port ${TEST_PORT}`);
      }
      
      // Check for devtools-related errors
      if (output.includes('next-devtools') || output.includes('devtools_index')) {
        devtoolsErrors.push(output.trim());
        log.error(`Devtools error detected: ${output.trim()}`);
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Check for devtools-related errors in stderr
      if (output.includes('next-devtools') || output.includes('devtools_index')) {
        devtoolsErrors.push(output.trim());
        log.error(`Devtools error detected: ${output.trim()}`);
      }
    });
    
    serverProcess.on('error', (error) => {
      log.error(`Server error: ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
    
    serverProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0 || code === null) {
        log.success('Server exited cleanly');
        resolve(devtoolsErrors.length === 0);
      } else {
        log.error(`Server exited with code ${code}`);
        resolve(false);
      }
    });
  });
}

async function testWebpackConfig() {
  log.section('⚙️  Testing Webpack Configuration');
  
  try {
    // Check if our custom webpack plugin exists
    const pluginPath = path.join(__dirname, '..', 'webpack.devtools-blocker.js');
    if (fs.existsSync(pluginPath)) {
      log.success('Custom devtools blocker plugin found');
    } else {
      log.error('Custom devtools blocker plugin not found');
      return false;
    }
    
    // Check if devtools blocker script exists
    const scriptPath = path.join(__dirname, '..', 'public', 'devtools-blocker.js');
    if (fs.existsSync(scriptPath)) {
      log.success('Runtime devtools blocker script found');
    } else {
      log.error('Runtime devtools blocker script not found');
      return false;
    }
    
    // Verify Next.js config has the necessary modifications
    const configPath = path.join(__dirname, '..', 'next.config.ts');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      if (configContent.includes('DevtoolsBlockerPlugin') && 
          configContent.includes('devtools: false')) {
        log.success('Next.js configuration properly modified');
        return true;
      } else {
        log.error('Next.js configuration missing required modifications');
        return false;
      }
    } else {
      log.error('Next.js configuration file not found');
      return false;
    }
  } catch (error) {
    log.error(`Webpack config test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.clear();
  log.section('🧪 DevTools Fix Verification Test');
  log.info(`Testing at ${new Date().toLocaleString()}`);
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Webpack configuration
    const webpackTest = await testWebpackConfig();
    if (!webpackTest) {
      allTestsPassed = false;
    }
    
    // Test 2: Build artifacts
    const buildTest = await checkBuildArtifacts();
    if (!buildTest) {
      allTestsPassed = false;
    }
    
    // Test 3: Development server
    const serverTest = await testDevServer();
    if (!serverTest) {
      allTestsPassed = false;
    }
    
    // Final results
    log.section('📊 Test Results');
    if (allTestsPassed) {
      log.success('All tests passed! Devtools fix is working correctly.');
      log.info('The Next.js devtools error should no longer occur.');
      process.exit(0);
    } else {
      log.error('Some tests failed. Please review the errors above.');
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the test
main();