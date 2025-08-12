#!/usr/bin/env tsx
/**
 * @fileoverview Aeries Sync Setup and Initial Data Population
 * 
 * This script sets up the Aeries integration and runs an initial sync
 * to populate the Supabase database with student and attendance data
 * from the Romoland School District.
 * 
 * Usage:
 *   pnpm run setup:aeries
 * 
 * Prerequisites:
 *   1. .env.local configured with Aeries API credentials
 *   2. Supabase database schema deployed (migration 008)
 *   3. Network access to Aeries API
 */

import { getSimpleAeriesClient } from './src/lib/aeries/simple-aeries-client';
import { getAeriesSyncService } from './src/lib/aeries/aeries-sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface SetupResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

class AeriesSyncSetup {
  private supabase: ReturnType<typeof createClient>;
  private errors: string[] = [];

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Run complete Aeries setup and initial sync
   */
  async runSetup(): Promise<SetupResult> {
    console.log('🚀 Starting Aeries Sync Setup for Romoland School District');
    console.log('===============================================================');

    try {
      // Step 1: Validate configuration
      console.log('\n📋 Step 1: Validating configuration...');
      const configResult = await this.validateConfiguration();
      if (!configResult.success) {
        return configResult;
      }

      // Step 2: Test Aeries API connection
      console.log('\n🔌 Step 2: Testing Aeries API connection...');
      const connectionResult = await this.testAeriesConnection();
      if (!connectionResult.success) {
        return connectionResult;
      }

      // Step 3: Initialize database tables
      console.log('\n🗄️  Step 3: Initializing database tables...');
      const databaseResult = await this.initializeDatabase();
      if (!databaseResult.success) {
        return databaseResult;
      }

      // Step 4: Sync school data
      console.log('\n🏫 Step 4: Syncing school information...');
      const schoolResult = await this.syncSchoolData();
      if (!schoolResult.success) {
        return schoolResult;
      }

      // Step 5: Run initial data sync
      console.log('\n📊 Step 5: Running initial attendance data sync...');
      const syncResult = await this.runInitialSync();
      if (!syncResult.success) {
        return syncResult;
      }

      console.log('\n✅ Aeries Sync Setup completed successfully!');
      console.log('===============================================================');
      
      return {
        success: true,
        message: 'Aeries integration setup complete',
        data: {
          schoolsConfigured: schoolResult.data?.schoolCount || 0,
          syncOperationId: syncResult.data?.operationId,
          recordsProcessed: syncResult.data?.recordsProcessed || 0
        }
      };

    } catch (error) {
      const errorMessage = `Setup failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('\n❌', errorMessage);
      
      return {
        success: false,
        message: errorMessage,
        errors: this.errors
      };
    }
  }

  /**
   * Validate all required configuration
   */
  private async validateConfiguration(): Promise<SetupResult> {
    const requiredVars = [
      'AERIES_API_BASE_URL',
      'AERIES_DISTRICT_CODE',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const optionalAuth = [
      'AERIES_API_KEY',
      'AERIES_CERTIFICATE_PATH'
    ];

    // Check required variables
    const missing = requiredVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
      return {
        success: false,
        message: `Missing required environment variables: ${missing.join(', ')}`,
        errors: [`Please configure these variables in .env.local`]
      };
    }

    // Check authentication method
    const hasApiKey = !!process.env.AERIES_API_KEY;
    const hasCertificate = !!process.env.AERIES_CERTIFICATE_PATH;

    if (!hasApiKey && !hasCertificate) {
      return {
        success: false,
        message: 'No Aeries authentication method configured',
        errors: ['Either AERIES_API_KEY or AERIES_CERTIFICATE_PATH is required']
      };
    }

    console.log('   ✅ Environment variables configured');
    console.log(`   ✅ Authentication: ${hasApiKey ? 'API Key' : 'Certificate'}`);
    console.log(`   ✅ District: ${process.env.AERIES_DISTRICT_CODE}`);
    console.log(`   ✅ Base URL: ${process.env.AERIES_API_BASE_URL}`);

    return {
      success: true,
      message: 'Configuration validated successfully'
    };
  }

  /**
   * Test connection to Aeries API
   */
  private async testAeriesConnection(): Promise<SetupResult> {
    try {
      const client = await getSimpleAeriesClient();
      
      // Test basic connection
      const healthCheck = await client.healthCheck();
      if (!healthCheck) {
        console.log('   ⚠️  Health check failed, trying schools endpoint instead...');
      }

      // Try to fetch schools as a more reliable test
      const schoolsResponse = await client.getSchools();
      if (!schoolsResponse.success) {
        throw new Error('Failed to fetch schools from Aeries API');
      }

      console.log(`   ✅ Connected to Aeries API successfully`);
      console.log(`   ✅ Found ${schoolsResponse.data.length} schools`);

      return {
        success: true,
        message: 'Aeries API connection successful',
        data: {
          schoolCount: schoolsResponse.data.length,
          schools: schoolsResponse.data
        }
      };

    } catch (error) {
      const errorMessage = `Aeries API connection failed: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(errorMessage);
      
      return {
        success: false,
        message: errorMessage,
        errors: [
          'Check your Aeries API credentials in .env.local',
          'Verify network connectivity to Aeries server',
          'Contact Vince Butler (CTO) for API access'
        ]
      };
    }
  }

  /**
   * Initialize database tables and verify schema
   */
  private async initializeDatabase(): Promise<SetupResult> {
    try {
      // Check if tables exist
      const { data: tables, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', [
          'schools',
          'students', 
          'attendance_records',
          'academic_performance',
          'interventions',
          'aeries_sync_operations'
        ]);

      if (error) {
        throw new Error(`Database check failed: ${error.message}`);
      }

      const existingTables = tables?.map(t => t.table_name) || [];
      const requiredTables = ['schools', 'students', 'attendance_records'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        return {
          success: false,
          message: `Missing database tables: ${missingTables.join(', ')}`,
          errors: [
            'Please run the database migration first:',
            'Run migration 008_complete_romoland_schema.sql in Supabase'
          ]
        };
      }

      console.log(`   ✅ Database schema verified (${existingTables.length} tables found)`);

      return {
        success: true,
        message: 'Database initialized successfully'
      };

    } catch (error) {
      const errorMessage = `Database initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(errorMessage);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Sync school information from Aeries
   */
  private async syncSchoolData(): Promise<SetupResult> {
    try {
      const client = await getSimpleAeriesClient();
      const schoolsResponse = await client.getSchools();

      if (!schoolsResponse.success) {
        throw new Error('Failed to fetch schools from Aeries');
      }

      // Update schools table with Aeries data
      for (const school of schoolsResponse.data) {
        const { error } = await this.supabase
          .from('schools')
          .upsert({
            school_code: school.schoolCode,
            school_name: school.schoolName,
            is_active: school.active,
            aeries_data: school,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.warn(`   ⚠️  Failed to update school ${school.schoolCode}: ${error.message}`);
          this.errors.push(`School sync error: ${error.message}`);
        }
      }

      console.log(`   ✅ Synced ${schoolsResponse.data.length} schools`);

      return {
        success: true,
        message: 'School data synced successfully',
        data: {
          schoolCount: schoolsResponse.data.length
        }
      };

    } catch (error) {
      const errorMessage = `School sync failed: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(errorMessage);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Run initial attendance data sync
   */
  private async runInitialSync(): Promise<SetupResult> {
    try {
      const syncService = await getAeriesSyncService();
      
      // Calculate date range for current school year
      const startDate = process.env.AERIES_ATTENDANCE_START_DATE || '2024-08-15';
      const endDate = process.env.AERIES_ATTENDANCE_END_DATE || '2025-06-12';

      console.log(`   📅 Syncing attendance data: ${startDate} to ${endDate}`);
      console.log('   ⏳ This may take several minutes...');

      const syncOperation = await syncService.startSync({
        syncType: 'FULL_SYNC',
        startDate,
        endDate,
        batchSize: parseInt(process.env.AERIES_BATCH_SIZE || '100')
      }, 'setup-script');

      // Monitor sync progress
      let lastUpdate = Date.now();
      const progressInterval = setInterval(async () => {
        const currentOp = syncService.getCurrentOperation();
        if (currentOp && currentOp.status === 'IN_PROGRESS') {
          const progress = currentOp.progress;
          console.log(`   📊 Progress: ${progress.processedRecords}/${progress.totalRecords} records (Batch ${progress.currentBatch}/${progress.totalBatches})`);
          lastUpdate = Date.now();
        }
      }, 10000);

      // Wait for sync to complete
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const currentOp = syncService.getCurrentOperation();
        if (!currentOp || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(currentOp.status)) {
          clearInterval(progressInterval);
          
          if (currentOp?.status === 'COMPLETED') {
            console.log(`   ✅ Sync completed: ${currentOp.progress.successfulRecords} records processed`);
            console.log(`   📈 Success rate: ${Math.round((currentOp.progress.successfulRecords / currentOp.progress.processedRecords) * 100)}%`);
            
            if (currentOp.errors.length > 0) {
              console.log(`   ⚠️  ${currentOp.errors.length} errors occurred during sync`);
              this.errors.push(...currentOp.errors.map(e => e.errorMessage));
            }
            
            return {
              success: true,
              message: 'Initial sync completed successfully',
              data: {
                operationId: currentOp.operationId,
                recordsProcessed: currentOp.progress.successfulRecords,
                errors: currentOp.errors.length
              }
            };
          } else {
            throw new Error(`Sync failed with status: ${currentOp?.status}`);
          }
        }

        // Timeout after 30 minutes
        if (Date.now() - lastUpdate > 30 * 60 * 1000) {
          clearInterval(progressInterval);
          throw new Error('Sync operation timed out after 30 minutes');
        }
      }

    } catch (error) {
      const errorMessage = `Initial sync failed: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(errorMessage);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }
}

// =====================================================
// Main Execution
// =====================================================

async function main() {
  try {
    const setup = new AeriesSyncSetup();
    const result = await setup.runSetup();

    if (result.success) {
      console.log('\n🎉 SUCCESS! Aeries integration is ready.');
      console.log('\nNext steps:');
      console.log('1. Access the AP Tool dashboard to view synced data');
      console.log('2. Configure automated daily sync schedule');
      console.log('3. Set up user accounts for Assistant Principals');
      console.log('4. Begin attendance recovery workflows');
      
      if (result.data) {
        console.log('\nSync Summary:');
        console.log(`- Schools configured: ${result.data.schoolsConfigured}`);
        console.log(`- Records processed: ${result.data.recordsProcessed}`);
        console.log(`- Operation ID: ${result.data.syncOperationId}`);
      }

      process.exit(0);
    } else {
      console.error('\n❌ SETUP FAILED');
      console.error(`Reason: ${result.message}`);
      
      if (result.errors && result.errors.length > 0) {
        console.error('\nErrors:');
        result.errors.forEach((error, index) => {
          console.error(`${index + 1}. ${error}`);
        });
      }

      console.error('\nTroubleshooting:');
      console.error('1. Check .env.local configuration');
      console.error('2. Verify Aeries API credentials');
      console.error('3. Ensure database migration is applied');
      console.error('4. Contact Vince Butler for API access issues');

      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  main();
}

export { AeriesSyncSetup };