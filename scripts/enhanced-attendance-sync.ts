#!/usr/bin/env node

/**
 * Enhanced Aeries Attendance Sync Script
 * 
 * Comprehensive attendance data synchronization for the school year 2024-2025
 * Date Range: August 15, 2024 - June 12, 2025
 * 
 * Features:
 * - Date range chunking for large datasets
 * - Resume capability from specific batch
 * - Enhanced error handling and monitoring
 * - Progress checkpointing
 * - Rate limiting with exponential backoff
 * - Comprehensive audit logging
 * 
 * Usage:
 * - Full sync: npm run enhanced-attendance-sync
 * - Resume from batch: npm run enhanced-attendance-sync -- --resume-from-batch=150
 * - Specific date range: npm run enhanced-attendance-sync -- --start-date=2024-08-15 --end-date=2024-12-31
 * - Specific school: npm run enhanced-attendance-sync -- --school-code=001
 */

import { AeriesApiClient } from '../src/infrastructure/external-services/aeries-api-client';
import { getAeriesSyncService } from '../src/infrastructure/external-services/aeries-sync-service';
import { createClient } from '../src/lib/supabase/server';
import { logSecurityEvent, ErrorSeverity } from '../src/lib/security/error-handler';

// Command line argument parsing
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : undefined;
};

// Configuration
const SYNC_CONFIG = {
  startDate: getArg('start-date') || '2024-08-15',
  endDate: getArg('end-date') || '2025-06-12',
  schoolCode: getArg('school-code'),
  batchSize: parseInt(getArg('batch-size') || '500'),
  dateChunkSizeDays: parseInt(getArg('date-chunk-days') || '30'),
  resumeFromBatch: parseInt(getArg('resume-from-batch') || '0'),
  operationId: `enhanced-attendance-sync-${Date.now()}`
};

/**
 * Enhanced Attendance Sync Manager
 */
class EnhancedAttendanceSyncManager {
  private supabase = createClient();
  private apiClient!: AeriesApiClient;
  private syncService!: any;
  
  private stats = {
    totalProcessed: 0,
    totalBatches: 0,
    successfulRecords: 0,
    failedRecords: 0,
    errors: [] as any[],
    startTime: Date.now(),
    schoolsProcessed: 0,
    dateChunksProcessed: 0
  };

  async initialize(): Promise<void> {
    console.log('🚀 Enhanced Aeries Attendance Sync - Initializing...');
    console.log('='.repeat(60));
    console.log(`📅 Date Range: ${SYNC_CONFIG.startDate} to ${SYNC_CONFIG.endDate}`);
    console.log(`📊 Batch Size: ${SYNC_CONFIG.batchSize}`);
    console.log(`📦 Date Chunk Size: ${SYNC_CONFIG.dateChunkSizeDays} days`);
    if (SYNC_CONFIG.resumeFromBatch > 0) {
      console.log(`🔄 Resuming from batch: ${SYNC_CONFIG.resumeFromBatch}`);
    }
    if (SYNC_CONFIG.schoolCode) {
      console.log(`🏫 School Filter: ${SYNC_CONFIG.schoolCode}`);
    }
    console.log('='.repeat(60));

    try {
      this.syncService = await getAeriesSyncService();
      this.apiClient = new AeriesApiClient();
      
      // Verify API connectivity
      const isHealthy = await this.apiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('Aeries API health check failed');
      }

      console.log('✅ Initialization completed successfully');
      
      // Log sync initiation
      logSecurityEvent({
        type: 'ENHANCED_ATTENDANCE_SYNC_STARTED',
        severity: ErrorSeverity.LOW,
        userId: 'system',
        correlationId: SYNC_CONFIG.operationId,
        details: `Enhanced attendance sync started with config: ${JSON.stringify(SYNC_CONFIG)}`,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async executeSync(): Promise<void> {
    console.log('\n📡 Starting enhanced attendance synchronization...');
    
    try {
      // Get schools to process
      const schools = await this.getSchoolsToProcess();
      console.log(`🏫 Processing ${schools.length} schools`);

      for (const school of schools) {
        console.log(`\n📚 Processing school: ${school.school_code} (${school.aeries_school_code})`);
        this.stats.schoolsProcessed++;

        try {
          await this.syncSchoolAttendance(school);
          console.log(`✅ School ${school.school_code} completed successfully`);
        } catch (schoolError) {
          console.error(`❌ School ${school.school_code} failed:`, schoolError);
          this.stats.errors.push({
            type: 'SCHOOL_SYNC_ERROR',
            schoolCode: school.school_code,
            error: schoolError instanceof Error ? schoolError.message : String(schoolError),
            timestamp: new Date().toISOString()
          });
        }
      }

      console.log('\n✅ Enhanced attendance sync completed successfully');
      this.displayFinalStats();

    } catch (error) {
      console.error('❌ Enhanced attendance sync failed:', error);
      this.displayFinalStats();
      throw error;
    }
  }

  private async getSchoolsToProcess(): Promise<any[]> {
    try {
      let query = this.supabase
        .from('schools')
        .select('id, school_code, aeries_school_code, district_id')
        .eq('is_active', true);

      if (SYNC_CONFIG.schoolCode) {
        query = query.eq('school_code', SYNC_CONFIG.schoolCode);
      }

      const { data: schools, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch schools: ${error.message}`);
      }

      return schools || [];
    } catch (error) {
      console.error('Failed to get schools:', error);
      throw error;
    }
  }

  private async syncSchoolAttendance(school: any): Promise<void> {
    const batchProcessor = async (batch: any[], batchNumber: number) => {
      console.log(`  📦 Processing batch ${batchNumber}: ${batch.length} records`);

      let batchSuccessful = 0;
      let batchFailed = 0;

      for (const record of batch) {
        try {
          // Transform Aeries record to Supabase format
          const attendanceRecord = await this.transformAttendanceRecord(record, school);
          
          // Save to database
          await this.saveAttendanceRecord(attendanceRecord);
          
          batchSuccessful++;
          this.stats.successfulRecords++;

        } catch (recordError) {
          batchFailed++;
          this.stats.failedRecords++;
          
          this.stats.errors.push({
            type: 'RECORD_PROCESSING_ERROR',
            batchNumber,
            schoolCode: school.school_code,
            recordId: record.id || 'unknown',
            error: recordError instanceof Error ? recordError.message : String(recordError),
            timestamp: new Date().toISOString()
          });

          console.error(`    ❌ Record processing failed:`, recordError);
        }
      }

      console.log(`    ✅ Batch ${batchNumber}: ${batchSuccessful} successful, ${batchFailed} failed`);

      // Update progress periodically
      if (batchNumber % 10 === 0) {
        await this.saveProgressCheckpoint(batchNumber);
      }
    };

    // Process attendance batches with enhanced features
    const result = await this.apiClient.processAttendanceBatches(
      batchProcessor,
      {
        startDate: SYNC_CONFIG.startDate,
        endDate: SYNC_CONFIG.endDate,
        schoolCode: school.aeries_school_code,
        batchSize: SYNC_CONFIG.batchSize,
        resumeFromBatch: SYNC_CONFIG.resumeFromBatch,
        dateChunkSizeDays: SYNC_CONFIG.dateChunkSizeDays
      }
    );

    this.stats.totalProcessed += result.totalProcessed;
    this.stats.totalBatches += result.totalBatches;
    this.stats.errors.push(...result.errors);

    console.log(`  📊 School totals: ${result.totalProcessed} records in ${result.totalBatches} batches`);
    if (result.errors.length > 0) {
      console.log(`  ⚠️  School errors: ${result.errors.length}`);
    }
  }

  private async transformAttendanceRecord(aeriesRecord: any, school: any): Promise<any> {
    // Find the student in our database
    const { data: student } = await this.supabase
      .from('students')
      .select('id')
      .eq('aeries_student_id', aeriesRecord.studentId?.toString())
      .eq('school_id', school.id)
      .single();

    if (!student) {
      throw new Error(`Student ${aeriesRecord.studentId} not found in database`);
    }

    // Transform to Supabase attendance_records schema
    return {
      student_id: student.id,
      school_id: school.id,
      attendance_date: aeriesRecord.attendanceDate || aeriesRecord.date,
      is_present: aeriesRecord.dailyStatus === 'PRESENT' || aeriesRecord.status === 'P',
      is_full_day_absent: aeriesRecord.dailyStatus === 'ABSENT' || aeriesRecord.status === 'A',
      days_enrolled: parseFloat(aeriesRecord.daysEnrolled || '1.0'),
      
      // Period-based attendance
      period_1_status: this.mapAttendanceStatus(aeriesRecord.periods?.[0]?.status || 'PRESENT'),
      period_2_status: this.mapAttendanceStatus(aeriesRecord.periods?.[1]?.status || 'PRESENT'),
      period_3_status: this.mapAttendanceStatus(aeriesRecord.periods?.[2]?.status || 'PRESENT'),
      period_4_status: this.mapAttendanceStatus(aeriesRecord.periods?.[3]?.status || 'PRESENT'),
      period_5_status: this.mapAttendanceStatus(aeriesRecord.periods?.[4]?.status || 'PRESENT'),
      period_6_status: this.mapAttendanceStatus(aeriesRecord.periods?.[5]?.status || 'PRESENT'),
      period_7_status: this.mapAttendanceStatus(aeriesRecord.periods?.[6]?.status || 'PRESENT'),
      
      tardy_count: parseInt(aeriesRecord.tardyCount || '0'),
      can_be_corrected: this.isWithinCorrectionWindow(aeriesRecord.attendanceDate || aeriesRecord.date),
      correction_deadline: this.calculateCorrectionDeadline(aeriesRecord.attendanceDate || aeriesRecord.date),
      
      created_by: 'enhanced-attendance-sync',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private mapAttendanceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'P': 'PRESENT',
      'A': 'ABSENT',
      'T': 'TARDY',
      'E': 'EXCUSED_ABSENT',
      'U': 'UNEXCUSED_ABSENT',
      'S': 'SUSPENDED',
      'PRESENT': 'PRESENT',
      'ABSENT': 'ABSENT',
      'TARDY': 'TARDY',
      'EXCUSED_ABSENT': 'EXCUSED_ABSENT',
      'UNEXCUSED_ABSENT': 'UNEXCUSED_ABSENT',
      'SUSPENDED': 'SUSPENDED'
    };

    return statusMap[status?.toUpperCase()] || 'PRESENT';
  }

  private isWithinCorrectionWindow(attendanceDate: string): boolean {
    const date = new Date(attendanceDate);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7;
  }

  private calculateCorrectionDeadline(attendanceDate: string): string {
    const date = new Date(attendanceDate);
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  }

  private async saveAttendanceRecord(record: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('attendance_records')
        .upsert(record, {
          onConflict: 'student_id,attendance_date'
        });

      if (error) {
        throw new Error(`Failed to save attendance record: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Database save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async saveProgressCheckpoint(lastBatch: number): Promise<void> {
    try {
      const checkpoint = {
        operation_id: SYNC_CONFIG.operationId,
        last_completed_batch: lastBatch,
        total_processed: this.stats.totalProcessed,
        successful_records: this.stats.successfulRecords,
        failed_records: this.stats.failedRecords,
        schools_processed: this.stats.schoolsProcessed,
        config: SYNC_CONFIG,
        timestamp: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('aeries_sync_checkpoints')
        .upsert(checkpoint, {
          onConflict: 'operation_id'
        });

      if (error) {
        console.warn('Failed to save progress checkpoint:', error);
      }
    } catch (err) {
      console.warn('Progress checkpoint save error:', err);
    }
  }

  private displayFinalStats(): void {
    const duration = Math.round((Date.now() - this.stats.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    console.log('\n' + '='.repeat(70));
    console.log('🎯 ENHANCED ATTENDANCE SYNC RESULTS');
    console.log('='.repeat(70));
    console.log(`⏱️  Duration: ${minutes}m ${seconds}s`);
    console.log(`🏫 Schools Processed: ${this.stats.schoolsProcessed}`);
    console.log(`📦 Total Batches: ${this.stats.totalBatches}`);
    console.log(`📊 Total Records: ${this.stats.totalProcessed}`);
    console.log(`✅ Successful: ${this.stats.successfulRecords}`);
    console.log(`❌ Failed: ${this.stats.failedRecords}`);
    console.log(`🔥 Errors: ${this.stats.errors.length}`);
    
    if (this.stats.totalProcessed > 0) {
      const successRate = Math.round((this.stats.successfulRecords / this.stats.totalProcessed) * 100);
      console.log(`📈 Success Rate: ${successRate}%`);
      console.log(`⚡ Rate: ${Math.round(this.stats.totalProcessed / (duration || 1))} records/second`);
    }
    
    console.log('='.repeat(70));

    // Log completion
    logSecurityEvent({
      type: 'ENHANCED_ATTENDANCE_SYNC_COMPLETED',
      severity: this.stats.errors.length > 0 ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
      userId: 'system',
      correlationId: SYNC_CONFIG.operationId,
      details: `Enhanced attendance sync completed: ${this.stats.successfulRecords}/${this.stats.totalProcessed} records processed with ${this.stats.errors.length} errors`,
      timestamp: new Date()
    });

    // Display error summary if any
    if (this.stats.errors.length > 0) {
      console.log('\n🔍 ERROR SUMMARY:');
      const errorsByType = this.stats.errors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(errorsByType).forEach(([type, count]) => {
        console.log(`  • ${type}: ${count} errors`);
      });
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const syncManager = new EnhancedAttendanceSyncManager();

  try {
    await syncManager.initialize();
    await syncManager.executeSync();
    
    console.log('\n🎉 Enhanced attendance sync completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n💀 Enhanced attendance sync failed:', error);
    
    logSecurityEvent({
      type: 'ENHANCED_ATTENDANCE_SYNC_FAILED',
      severity: ErrorSeverity.HIGH,
      userId: 'system',
      correlationId: SYNC_CONFIG.operationId,
      details: `Enhanced attendance sync failed: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date()
    });
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { EnhancedAttendanceSyncManager, SYNC_CONFIG };