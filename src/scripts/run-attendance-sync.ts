#!/usr/bin/env node

/**
 * @fileoverview Attendance Sync Orchestrator Script
 * 
 * Command-line interface for running Aeries attendance sync operations.
 * Supports full sync, partial sync, and resume from checkpoint.
 * 
 * Usage:
 *   npm run sync:attendance -- --full
 *   npm run sync:attendance -- --start 2024-08-15 --end 2024-12-31
 *   npm run sync:attendance -- --school RMS --school RHS
 *   npm run sync:attendance -- --resume checkpoint-123456
 * 
 * @author AP_Tool_V1 Team
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createAttendanceSyncService, syncFullSchoolYear } from '../lib/sync/enhanced-attendance-sync';
import type { SyncResult, ProgressUpdate } from '@/types/sync';

// =====================================================
// Command Line Interface
// =====================================================

const program = new Command();

program
  .name('attendance-sync')
  .description('Sync attendance data from Aeries SIS to Supabase')
  .version('1.0.0');

program
  .option('-f, --full', 'Sync full school year (Aug 15, 2024 - Jun 12, 2025)')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
  .option('-S, --school <code...>', 'Specific school codes to sync')
  .option('-b, --batch-size <size>', 'Batch size for processing', '500')
  .option('-c, --chunk-days <days>', 'Days per chunk', '30')
  .option('-r, --resume <checkpoint>', 'Resume from checkpoint ID')
  .option('-d, --dry-run', 'Perform validation without saving data')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-progress', 'Disable progress tracking')
  .option('--save-checkpoint', 'Save checkpoint on completion');

program.parse();

const options = program.opts();

// =====================================================
// Progress Display
// =====================================================

class ProgressDisplay {
  private spinner: any;
  private startTime: number;
  private lastUpdate?: ProgressUpdate;

  constructor() {
    this.spinner = ora('Initializing sync service...').start();
    this.startTime = Date.now();
  }

  update(progress: ProgressUpdate): void {
    this.lastUpdate = progress;
    
    const elapsed = this.formatDuration(Date.now() - this.startTime);
    const throughput = progress.throughput?.toFixed(1) || '0';
    const eta = progress.estimatedTimeRemaining 
      ? this.formatDuration(progress.estimatedTimeRemaining)
      : 'calculating...';

    this.spinner.text = chalk.cyan(
      `Progress: ${progress.percentage}% | ` +
      `Records: ${progress.recordsProcessed}/${progress.totalRecords} | ` +
      `Speed: ${throughput} rec/s | ` +
      `Elapsed: ${elapsed} | ` +
      `ETA: ${eta}`
    );
  }

  success(message: string): void {
    this.spinner.succeed(chalk.green(message));
  }

  error(message: string): void {
    this.spinner.fail(chalk.red(message));
  }

  info(message: string): void {
    this.spinner.info(chalk.blue(message));
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// =====================================================
// Sync Execution
// =====================================================

async function executeSyncOperation(): Promise<void> {
  const progress = new ProgressDisplay();
  
  try {
    // Validate options
    if (!options.full && !options.start && !options.resume) {
      throw new Error('Please specify --full, --start/--end, or --resume');
    }

    if (options.start && !options.end) {
      throw new Error('Both --start and --end dates are required');
    }

    // Resume from checkpoint
    if (options.resume) {
      progress.info(`Resuming from checkpoint: ${options.resume}`);
      const result = await resumeSync(options.resume, progress);
      displayResults(result, progress);
      return;
    }

    // Full school year sync
    if (options.full) {
      progress.info('Starting full school year sync (2024-08-15 to 2025-06-12)');
      const result = await syncFullSchoolYear({
        schools: options.school,
        batchSize: parseInt(options.batchSize)
      });
      displayResults(result, progress);
      return;
    }

    // Custom date range sync
    if (options.start && options.end) {
      progress.info(`Starting sync from ${options.start} to ${options.end}`);
      const result = await customSync(progress);
      displayResults(result, progress);
      return;
    }

  } catch (error) {
    progress.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

/**
 * Execute custom date range sync
 */
async function customSync(progress: ProgressDisplay): Promise<SyncResult> {
  const config = {
    dateRange: {
      startDate: options.start,
      endDate: options.end
    },
    schools: options.school,
    batchSize: parseInt(options.batchSize),
    chunkDays: parseInt(options.chunkDays),
    parallelBatches: 3,
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    },
    monitoring: {
      enableProgressTracking: !options.noProgress,
      progressUpdateInterval: 5000,
      enableMetrics: true
    }
  };

  const service = await createAttendanceSyncService(config);

  // Set up progress listener
  if (!options.noProgress) {
    service.on('progress', (update: ProgressUpdate) => {
      progress.update(update);
    });
  }

  // Set up event listeners for verbose mode
  if (options.verbose) {
    service.on('initialized', () => {
      console.log(chalk.gray('✓ Service initialized'));
    });

    service.on('chunkStarted', (chunk: any) => {
      console.log(chalk.gray(`  → Processing chunk: ${chunk.start} to ${chunk.end}`));
    });

    service.on('batchProcessed', (info: any) => {
      console.log(chalk.gray(`    ✓ Batch ${info.batchNumber}: ${info.recordsProcessed} records`));
    });
  }

  const result = await service.executeSync();

  // Save checkpoint if requested
  if (options.saveCheckpoint) {
    const checkpointId = await service.saveCheckpoint();
    progress.info(`Checkpoint saved: ${checkpointId}`);
  }

  return result;
}

/**
 * Resume sync from checkpoint
 */
async function resumeSync(checkpointId: string, progress: ProgressDisplay): Promise<SyncResult> {
  // Create service with minimal config (will be loaded from checkpoint)
  const service = await createAttendanceSyncService({
    dateRange: { startDate: '2024-01-01', endDate: '2024-01-01' }, // Dummy values
    batchSize: 500
  });

  // Set up progress listener
  if (!options.noProgress) {
    service.on('progress', (update: ProgressUpdate) => {
      progress.update(update);
    });
  }

  return service.resumeFromCheckpoint(checkpointId);
}

/**
 * Display sync results
 */
function displayResults(result: SyncResult, progress: ProgressDisplay): void {
  const duration = result.executionTime / 1000;
  const throughput = result.recordsProcessed / duration;

  progress.success('Sync completed successfully!');

  console.log('\n' + chalk.bold('📊 Sync Results:'));
  console.log(chalk.white('─'.repeat(50)));
  
  console.log(chalk.cyan('Operation ID:'), result.operationId);
  console.log(chalk.cyan('Duration:'), `${duration.toFixed(1)}s`);
  console.log(chalk.cyan('Throughput:'), `${throughput.toFixed(1)} records/second`);
  
  console.log('\n' + chalk.bold('📈 Record Statistics:'));
  console.log(chalk.green('✓ Processed:'), result.recordsProcessed.toLocaleString());
  console.log(chalk.green('✓ Successful:'), result.recordsSuccessful.toLocaleString());
  
  if (result.recordsFailed > 0) {
    console.log(chalk.red('✗ Failed:'), result.recordsFailed.toLocaleString());
  }
  
  if (result.recordsSkipped > 0) {
    console.log(chalk.yellow('⚠ Skipped:'), result.recordsSkipped.toLocaleString());
  }

  if (result.retryAttempts && result.retryAttempts > 0) {
    console.log(chalk.yellow('↻ Retries:'), result.retryAttempts);
  }

  if (result.metadata) {
    console.log('\n' + chalk.bold('📋 Metadata:'));
    Object.entries(result.metadata).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}:`), value);
    });
  }

  console.log(chalk.white('─'.repeat(50)));

  // Success rate
  const successRate = result.recordsProcessed > 0
    ? (result.recordsSuccessful / result.recordsProcessed * 100).toFixed(1)
    : '0';
  
  console.log(chalk.bold.green(`\n✨ Success Rate: ${successRate}%`));
}

// =====================================================
// Error Handling
// =====================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nSync interrupted by user'));
  process.exit(0);
});

// =====================================================
// Main Execution
// =====================================================

console.log(chalk.bold.blue('\n🚀 AP Tool V1 - Attendance Sync Service\n'));

executeSyncOperation().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});