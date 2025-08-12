#!/usr/bin/env node

/**
 * Enhanced Development Startup Script
 * 
 * Features:
 * - Port conflict detection and resolution
 * - Environment validation
 * - Dependency checking
 * - Clean startup with proper error handling
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

// Configuration
const DEFAULT_PORT = 3000;
const MAX_PORT_ATTEMPTS = 10;

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
};

// Check if a port is available
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Find an available port
async function findAvailablePort(startPort = DEFAULT_PORT) {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error('No available ports found');
}

// Kill process using a specific port
function killProcessOnPort(port) {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    } else if (process.platform === 'win32') {
      execSync(`netstat -ano | findstr :${port} | findstr LISTENING | awk '{print $5}' | xargs kill -f`, { stdio: 'ignore' });
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Check Node.js version
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  
  if (majorVersion < 18) {
    throw new Error(`Node.js version 18 or higher is required. Current version: ${nodeVersion}`);
  }
  
  log.success(`Node.js version ${nodeVersion} ✓`);
}

// Check if dependencies are installed
function checkDependencies() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    log.warning('Dependencies not installed. Installing now...');
    execSync('npm install', { stdio: 'inherit' });
  } else {
    log.success('Dependencies installed ✓');
  }
}

// Clean development environment
function cleanEnvironment() {
  log.section('Cleaning Development Environment');
  
  const pathsToClean = [
    { path: '.next', name: 'Next.js cache' },
    { path: 'node_modules/.cache', name: 'Node modules cache' },
    { path: '.turbo', name: 'Turbo cache' },
  ];
  
  pathsToClean.forEach(({ path: cleanPath, name }) => {
    const fullPath = path.join(__dirname, '..', cleanPath);
    if (fs.existsSync(fullPath)) {
      try {
        execSync(`rm -rf ${cleanPath}`, { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
        log.success(`Cleaned ${name}`);
      } catch (error) {
        log.warning(`Could not clean ${name}`);
      }
    }
  });
}

// Validate environment files
function validateEnvironment() {
  log.section('Validating Environment');
  
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envLocalPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envLocalPath);
      log.warning('.env.local created from .env.example - please update with your values');
    } else {
      log.warning('.env.local not found - creating default configuration');
      const defaultEnv = `# Development Environment Configuration
# This file helps prevent devtools conflicts

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1

# Set explicit port to avoid conflicts
PORT=3000

# Disable experimental features that might cause issues
NEXT_DISABLE_EXPERIMENTAL_FEATURES=1

# Node environment
NODE_ENV=development

# Disable source maps in development if causing issues
GENERATE_SOURCEMAP=false

# Database URL (update with your actual database)
DATABASE_URL=postgresql://localhost:5432/attendly_dev

# Supabase Configuration (update with your project details)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
`;
      fs.writeFileSync(envLocalPath, defaultEnv);
    }
  } else {
    log.success('Environment configuration found ✓');
  }
}

// Start the development server
async function startDevServer(port) {
  log.section('Starting Development Server');
  
  // Set environment variables
  const env = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'development',
    PORT: port.toString(),
    FORCE_COLOR: '1',
    // Completely disable Next.js devtools
    NEXT_DISABLE_DEVTOOLS: '1',
    DISABLE_DEVTOOLS: 'true',
    NEXT_DISABLE_OVERLAY: '1',
    // Prevent devtools chunk loading
    NEXT_EXPERIMENTAL_DEVTOOLS: 'false',
    __NEXT_DISABLE_DEVTOOLS: '1',
  };
  
  log.info(`Starting Next.js on port ${port}...`);
  log.info(`URL: ${colors.bright}http://localhost:${port}${colors.reset}`);
  
  // Start Next.js development server
  const child = spawn('next', ['dev', '-p', port.toString()], {
    env,
    stdio: 'inherit',
    shell: true,
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    log.info('\nShutting down development server...');
    child.kill('SIGINT');
    process.exit(0);
  });
  
  child.on('error', (error) => {
    log.error(`Failed to start development server: ${error.message}`);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    if (code !== 0) {
      log.error(`Development server exited with code ${code}`);
      process.exit(code);
    }
  });
}

// Main execution
async function main() {
  console.clear();
  log.section(`🚀 AttendlyV1 Development Environment`);
  log.info(`Starting at ${new Date().toLocaleString()}`);
  
  try {
    // Pre-flight checks
    checkNodeVersion();
    checkDependencies();
    validateEnvironment();
    
    // Clean environment if requested
    if (process.argv.includes('--clean')) {
      cleanEnvironment();
    }
    
    // Find available port
    let port = DEFAULT_PORT;
    const portArg = process.argv.find(arg => arg.startsWith('--port='));
    if (portArg) {
      port = parseInt(portArg.split('=')[1]);
    }
    
    if (!(await isPortAvailable(port))) {
      log.warning(`Port ${port} is already in use`);
      
      if (process.argv.includes('--force')) {
        log.info('Attempting to kill process on port...');
        if (killProcessOnPort(port)) {
          log.success('Process killed successfully');
        }
      } else {
        log.info('Finding alternative port...');
        port = await findAvailablePort(port);
        log.success(`Using port ${port}`);
      }
    }
    
    // Start the server
    await startDevServer(port);
    
  } catch (error) {
    log.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();