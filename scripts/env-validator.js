#!/usr/bin/env node

/**
 * Environment Variable Validator
 * 
 * Validates that all required environment variables are set
 * and provides helpful error messages for missing values
 */

const fs = require('fs');
const path = require('path');

// Define required and optional environment variables
const ENV_CONFIG = {
  required: {
    // Database
    DATABASE_URL: {
      description: 'PostgreSQL connection string',
      example: 'postgresql://user:pass@localhost:5432/dbname',
      validate: (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    },
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: {
      description: 'Supabase project URL',
      example: 'https://your-project.supabase.co',
      validate: (value) => value.startsWith('https://') && value.includes('supabase'),
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      description: 'Supabase anonymous key for client-side access',
      example: 'eyJ...',
      validate: (value) => value.length > 20,
    },
  },
  optional: {
    // Security
    SESSION_SECRET: {
      description: 'Secret for session encryption',
      example: 'random-32-character-string',
      validate: (value) => value.length >= 32,
    },
    JWT_SECRET: {
      description: 'Secret for JWT signing',
      example: 'random-32-character-string',
      validate: (value) => value.length >= 32,
    },
    // Features
    FEATURE_STUDENT_PORTAL: {
      description: 'Enable student portal feature',
      example: 'true',
      validate: (value) => ['true', 'false'].includes(value),
    },
    // Email
    SMTP_HOST: {
      description: 'SMTP server hostname',
      example: 'smtp.gmail.com',
    },
    // Monitoring
    SENTRY_DSN: {
      description: 'Sentry error tracking DSN',
      example: 'https://...@sentry.io/...',
      validate: (value) => value.startsWith('https://') && value.includes('sentry.io'),
    },
  },
};

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

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
};

// Load environment variables from file
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

// Validate environment variables
function validateEnvironment() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  log.section('Environment Variable Validation');
  
  // Check if .env.local exists
  if (!fs.existsSync(envPath)) {
    log.error('.env.local file not found!');
    log.info(`Create it by copying ${colors.bright}.env.example${colors.reset}:`);
    log.info(`  cp .env.example .env.local`);
    return false;
  }
  
  // Load environment variables
  const currentEnv = { ...process.env, ...loadEnvFile(envPath) };
  const errors = [];
  const warnings = [];
  
  // Check required variables
  log.info('Checking required environment variables...');
  for (const [key, config] of Object.entries(ENV_CONFIG.required)) {
    const value = currentEnv[key];
    
    if (!value || value === '') {
      errors.push({
        key,
        message: `Missing required variable: ${key}`,
        description: config.description,
        example: config.example,
      });
    } else if (config.validate && !config.validate(value)) {
      errors.push({
        key,
        message: `Invalid value for ${key}`,
        description: config.description,
        example: config.example,
        current: value.substring(0, 20) + '...',
      });
    } else {
      log.success(`${key} ✓`);
    }
  }
  
  // Check optional variables
  log.info('\nChecking optional environment variables...');
  for (const [key, config] of Object.entries(ENV_CONFIG.optional)) {
    const value = currentEnv[key];
    
    if (!value || value === '') {
      warnings.push({
        key,
        message: `Optional variable not set: ${key}`,
        description: config.description,
        example: config.example,
      });
    } else if (config.validate && !config.validate(value)) {
      warnings.push({
        key,
        message: `Invalid value for ${key}`,
        description: config.description,
        example: config.example,
      });
    } else {
      log.success(`${key} ✓`);
    }
  }
  
  // Report results
  if (errors.length > 0) {
    log.section('❌ Validation Errors');
    errors.forEach(error => {
      log.error(error.message);
      log.info(`  Description: ${error.description}`);
      log.info(`  Example: ${colors.bright}${error.example}${colors.reset}`);
      if (error.current) {
        log.info(`  Current: ${error.current}`);
      }
      console.log();
    });
  }
  
  if (warnings.length > 0) {
    log.section('⚠️  Warnings');
    warnings.forEach(warning => {
      log.warning(warning.message);
      log.info(`  Description: ${warning.description}`);
      log.info(`  Example: ${colors.bright}${warning.example}${colors.reset}`);
      console.log();
    });
  }
  
  if (errors.length === 0) {
    log.section('✅ Environment Validation Passed');
    log.success('All required environment variables are properly configured');
    return true;
  }
  
  return false;
}

// Generate environment report
function generateReport() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const currentEnv = { ...process.env, ...loadEnvFile(envPath) };
  
  log.section('Environment Report');
  
  // Application info
  log.info('Application:');
  log.info(`  Node.js: ${process.version}`);
  log.info(`  Environment: ${currentEnv.NODE_ENV || 'development'}`);
  log.info(`  Port: ${currentEnv.PORT || '3000'}`);
  
  // Database info
  if (currentEnv.DATABASE_URL) {
    const dbUrl = new URL(currentEnv.DATABASE_URL);
    log.info('\nDatabase:');
    log.info(`  Host: ${dbUrl.hostname}`);
    log.info(`  Port: ${dbUrl.port || '5432'}`);
    log.info(`  Database: ${dbUrl.pathname.substring(1)}`);
  }
  
  // Supabase info
  if (currentEnv.NEXT_PUBLIC_SUPABASE_URL) {
    log.info('\nSupabase:');
    log.info(`  URL: ${currentEnv.NEXT_PUBLIC_SUPABASE_URL}`);
    log.info(`  Anon Key: ${currentEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Not set'}`);
  }
  
  // Feature flags
  log.info('\nFeature Flags:');
  Object.keys(currentEnv).filter(key => key.startsWith('FEATURE_')).forEach(key => {
    log.info(`  ${key}: ${currentEnv[key] || 'false'}`);
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--report')) {
    generateReport();
  } else {
    const isValid = validateEnvironment();
    process.exit(isValid ? 0 : 1);
  }
}

// Run the validator
main();