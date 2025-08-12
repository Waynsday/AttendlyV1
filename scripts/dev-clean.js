#!/usr/bin/env node

/**
 * Clean Development Script
 * 
 * This script ensures a clean development environment by:
 * 1. Clearing Next.js cache
 * 2. Removing problematic node_modules if needed
 * 3. Starting the development server with proper configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning development environment...');

// Clear Next.js cache
const nextCachePath = path.join(__dirname, '..', '.next');
if (fs.existsSync(nextCachePath)) {
  console.log('📦 Removing .next cache...');
  execSync('rm -rf .next', { stdio: 'inherit' });
}

// Clear node_modules/.cache if it exists
const nodeModulesCachePath = path.join(__dirname, '..', 'node_modules', '.cache');
if (fs.existsSync(nodeModulesCachePath)) {
  console.log('🗑️  Clearing node_modules cache...');
  execSync('rm -rf node_modules/.cache', { stdio: 'inherit' });
}

// Set environment variables
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';

console.log('🚀 Starting clean development server on port 3000...');
console.log('');

// Start Next.js development server
try {
  execSync('next dev -p 3000', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Error starting development server:', error.message);
  process.exit(1);
}