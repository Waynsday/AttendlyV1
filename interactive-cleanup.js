#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Cleanup categories with risk levels
const cleanupCategories = {
  BUILD_ARTIFACTS: {
    name: 'Build Artifacts (Safe to Delete)',
    riskLevel: 'SAFE',
    color: colors.green,
    files: [
      { path: 'ap-tool-v1/.next', type: 'directory', size: '245MB', description: 'Next.js build artifacts' },
      { path: 'ap-tool-v1/node_modules', type: 'directory', size: '796MB', description: 'Node.js dependencies' },
      { path: 'scripts/node_modules', type: 'directory', size: '7.5MB', description: 'Script dependencies' }
    ]
  },
  LEGACY_SYNC_SCRIPTS: {
    name: 'Legacy Sync Scripts (Review Required)',
    riskLevel: 'MEDIUM',
    color: colors.yellow,
    files: [
      { path: 'ap-tool-v1/final-attendance-sync.js', type: 'file', size: '14KB', description: 'Legacy sync script' },
      { path: 'ap-tool-v1/full-population-sync.js', type: 'file', size: '9.4KB', description: 'Legacy sync script' },
      { path: 'ap-tool-v1/full-school-year-sync.js', type: 'file', size: '11KB', description: 'Legacy sync script' },
      { path: 'ap-tool-v1/quick-attendance-sync.js', type: 'file', size: '7.7KB', description: 'Legacy sync script' },
      { path: 'ap-tool-v1/working-attendance-sync.js', type: 'file', size: '10KB', description: 'Legacy sync script' },
      { path: 'scripts/aeries-full-sync.js', type: 'file', size: '12KB', description: 'Duplicate of enhanced sync' },
      { path: 'scripts/aeries-sync.js', type: 'file', size: '18KB', description: 'Duplicate of enhanced sync' },
      { path: 'scripts/complete-remaining-sync.js', type: 'file', size: '10KB', description: 'One-time migration script' },
      { path: 'scripts/fix-and-complete-sync.js', type: 'file', size: '17KB', description: 'One-time fix script' },
      { path: 'scripts/optimized-aeries-sync.js', type: 'file', size: '15KB', description: 'Superseded by enhanced version' }
    ]
  },
  DEBUG_TEST_FILES: {
    name: 'Debug/Test Files (Likely Unused)',
    riskLevel: 'LOW',
    color: colors.cyan,
    files: [
      { path: 'ap-tool-v1/analyze-records.js', type: 'file', size: '2.6KB', description: 'Debug analysis script' },
      { path: 'ap-tool-v1/final-count-check.js', type: 'file', size: '2.7KB', description: 'Debug count verification' },
      { path: 'ap-tool-v1/verify-results.js', type: 'file', size: '2.3KB', description: 'Debug verification script' },
      { path: 'ap-tool-v1/test-attendance-insert.js', type: 'file', size: '1.9KB', description: 'Test insertion script' },
      { path: 'ap-tool-v1/test-constraint.js', type: 'file', size: '2.2KB', description: 'Constraint test script' },
      { path: 'ap-tool-v1/debug-aeries-api.js', type: 'file', size: '5.9KB', description: 'API debug script' },
      { path: 'scripts/debug-aeries-api.js', type: 'file', size: '5.2KB', description: 'Duplicate API debug script' },
      { path: 'scripts/test-query.js', type: 'file', size: '1.9KB', description: 'Database query test' }
    ]
  },
  ONE_TIME_MIGRATIONS: {
    name: 'One-Time Migration Scripts (Historical)',
    riskLevel: 'LOW',
    color: colors.magenta,
    files: [
      { path: 'scripts/clean-student-table.sql', type: 'file', size: '~2KB', description: 'One-time student table cleanup' },
      { path: 'scripts/clean-student-table-simple.sql', type: 'file', size: '~1KB', description: 'Simple cleanup variant' },
      { path: 'scripts/database-corrections.sql', type: 'file', size: '~3KB', description: 'Historical corrections' },
      { path: 'scripts/fix-iready-constraints.sql', type: 'file', size: '~2KB', description: 'One-time constraint fix' },
      { path: 'scripts/fix-student-ids-migration.sql', type: 'file', size: '~2KB', description: 'ID migration fix' },
      { path: 'scripts/apply-database-corrections.js', type: 'file', size: '8.3KB', description: 'Apply corrections script' },
      { path: 'scripts/fix-student-ids-migration.js', type: 'file', size: '5.8KB', description: 'ID migration JavaScript' }
    ]
  }
};

// Backup directory
const BACKUP_DIR = 'cleanup-backup-' + new Date().toISOString().slice(0, 10);

async function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function printHeader() {
  console.log(colors.bright + colors.blue + '\n╔════════════════════════════════════════════╗');
  console.log('║     AP_Tool_V1 Interactive Cleanup Tool    ║');
  console.log('╚════════════════════════════════════════════╝' + colors.reset);
  console.log('\nThis tool will help you safely clean up unused files.');
  console.log('All deletions require explicit approval.\n');
}

function formatFileSize(bytes) {
  if (typeof bytes === 'string') return bytes;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

async function createBackup(filePath) {
  const backupPath = path.join(BACKUP_DIR, filePath);
  const backupDir = path.dirname(backupPath);
  
  try {
    // Create backup directory structure
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Copy file or directory
    if (fs.statSync(filePath).isDirectory()) {
      execSync(`cp -r "${filePath}" "${backupPath}"`);
    } else {
      fs.copyFileSync(filePath, backupPath);
    }
    
    console.log(colors.green + `✓ Backed up to: ${backupPath}` + colors.reset);
    return true;
  } catch (error) {
    console.log(colors.red + `✗ Backup failed: ${error.message}` + colors.reset);
    return false;
  }
}

async function deleteFile(filePath, fileType) {
  try {
    if (fileType === 'directory') {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    console.log(colors.green + `✓ Deleted: ${filePath}` + colors.reset);
    return true;
  } catch (error) {
    console.log(colors.red + `✗ Delete failed: ${error.message}` + colors.reset);
    return false;
  }
}

async function processCategory(category, categoryData) {
  console.log(`\n${categoryData.color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${categoryData.color}${colors.bright}${categoryData.name}${colors.reset}`);
  console.log(`Risk Level: ${categoryData.color}${categoryData.riskLevel}${colors.reset}`);
  console.log(`${categoryData.color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const deletionList = [];
  let totalSize = 0;

  // Show all files in category
  console.log('Files in this category:');
  categoryData.files.forEach((file, index) => {
    const exists = fs.existsSync(file.path);
    const status = exists ? colors.green + '[EXISTS]' : colors.red + '[NOT FOUND]';
    console.log(`${index + 1}. ${status} ${file.path} (${file.size})${colors.reset}`);
    console.log(`   └─ ${file.description}`);
    
    if (exists) {
      deletionList.push(file);
    }
  });

  if (deletionList.length === 0) {
    console.log(colors.yellow + '\nNo files found to delete in this category.' + colors.reset);
    return;
  }

  // Ask for action
  console.log(`\n${colors.bright}What would you like to do?${colors.reset}`);
  console.log('1. Delete ALL files in this category');
  console.log('2. Review and delete files individually');
  console.log('3. Skip this category');
  
  const choice = await prompt('Enter your choice (1-3): ');

  switch (choice.trim()) {
    case '1':
      // Delete all with confirmation
      const confirmAll = await prompt(colors.yellow + `Are you sure you want to delete ALL ${deletionList.length} files? (yes/no): ` + colors.reset);
      if (confirmAll.toLowerCase() === 'yes') {
        for (const file of deletionList) {
          if (await createBackup(file.path)) {
            await deleteFile(file.path, file.type);
          }
        }
      }
      break;

    case '2':
      // Individual review
      for (const file of deletionList) {
        console.log(`\n${colors.cyan}File: ${file.path}${colors.reset}`);
        console.log(`Size: ${file.size}`);
        console.log(`Description: ${file.description}`);
        
        const action = await prompt('Delete this file? (y/n/skip remaining): ');
        
        if (action.toLowerCase() === 'y') {
          if (await createBackup(file.path)) {
            await deleteFile(file.path, file.type);
          }
        } else if (action.toLowerCase() === 'skip remaining') {
          break;
        }
      }
      break;

    case '3':
      console.log('Skipping category...');
      break;

    default:
      console.log('Invalid choice. Skipping category...');
  }
}

async function main() {
  printHeader();

  // Create backup directory
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(colors.green + `✓ Created backup directory: ${BACKUP_DIR}` + colors.reset);
  } catch (error) {
    console.log(colors.red + `✗ Failed to create backup directory: ${error.message}` + colors.reset);
    rl.close();
    return;
  }

  // Show summary
  console.log('\n' + colors.bright + 'CLEANUP SUMMARY:' + colors.reset);
  console.log(`• Build artifacts: ${colors.green}1.05GB potential savings${colors.reset}`);
  console.log(`• Legacy scripts: ${colors.yellow}~120KB (10+ files)${colors.reset}`);
  console.log(`• Debug/test files: ${colors.cyan}~30KB (8 files)${colors.reset}`);
  console.log(`• Migration scripts: ${colors.magenta}~40KB (7 files)${colors.reset}`);

  const proceed = await prompt('\nProceed with cleanup review? (yes/no): ');
  if (proceed.toLowerCase() !== 'yes') {
    console.log('Cleanup cancelled.');
    rl.close();
    return;
  }

  // Process each category
  for (const [key, categoryData] of Object.entries(cleanupCategories)) {
    await processCategory(key, categoryData);
  }

  // Final summary
  console.log('\n' + colors.bright + colors.green + '═══════════════════════════════════════════════' + colors.reset);
  console.log(colors.bright + 'CLEANUP COMPLETE!' + colors.reset);
  console.log(`Backup location: ${colors.cyan}${BACKUP_DIR}${colors.reset}`);
  console.log('\nTo restore any deleted files, copy them back from the backup directory.');
  
  // Suggest next steps
  console.log('\n' + colors.bright + 'RECOMMENDED NEXT STEPS:' + colors.reset);
  console.log('1. If you deleted node_modules, run: ' + colors.cyan + 'cd ap-tool-v1 && pnpm install' + colors.reset);
  console.log('2. If you deleted .next, rebuild with: ' + colors.cyan + 'cd ap-tool-v1 && pnpm build' + colors.reset);
  console.log('3. Test the application: ' + colors.cyan + 'cd ap-tool-v1 && pnpm dev' + colors.reset);
  console.log('4. Once verified, you can remove the backup: ' + colors.cyan + `rm -rf ${BACKUP_DIR}` + colors.reset);

  rl.close();
}

// Run the cleanup tool
main().catch(error => {
  console.error(colors.red + 'Error:', error.message + colors.reset);
  rl.close();
});