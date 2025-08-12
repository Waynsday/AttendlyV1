#!/usr/bin/env node

/**
 * Complete Student ID Mapping for iReady Data
 * 
 * This script processes ALL iReady records and maps the 7-digit iReady student IDs
 * to the 4-digit student database IDs using the last 4 digits pattern.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class StudentIdMapper {
  constructor() {
    this.batchSize = 50;
    this.totalProcessed = 0;
    this.successfulMappings = 0;
    this.startTime = Date.now();
  }

  async completeMapping() {
    console.log('🔗 COMPLETE STUDENT ID MAPPING');
    console.log('='.repeat(50));

    try {
      // Get total count of unmapped records
      const { count: totalUnmapped } = await supabase
        .from('iready_diagnostic_results')
        .select('*', { count: 'exact', head: true })
        .is('student_id', null);

      console.log(`📊 Total unmapped records: ${totalUnmapped || 0}`);

      if (!totalUnmapped || totalUnmapped === 0) {
        console.log('✅ All records already have student IDs mapped!');
        return;
      }

      // Process in batches
      let offset = 0;
      const totalBatches = Math.ceil(totalUnmapped / this.batchSize);

      while (offset < totalUnmapped) {
        const batchNumber = Math.floor(offset / this.batchSize) + 1;
        const progress = Math.round((offset / totalUnmapped) * 100);

        console.log(`\n⚙️  Processing batch ${batchNumber}/${totalBatches} (${progress}%)`);

        const { data: batch } = await supabase
          .from('iready_diagnostic_results')
          .select('id, district_student_id, student_name')
          .is('student_id', null)
          .range(offset, offset + this.batchSize - 1);

        if (!batch || batch.length === 0) {
          break;
        }

        await this.processBatch(batch);
        offset += this.batchSize;

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      this.displayFinalResults();

    } catch (error) {
      console.error('❌ Mapping failed:', error.message);
      throw error;
    }
  }

  async processBatch(records) {
    const mappingPromises = records.map(record => this.mapSingleRecord(record));
    const results = await Promise.allSettled(mappingPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    this.successfulMappings += successful;
    this.totalProcessed += records.length;

    process.stdout.write(`   📈 Batch: ${successful}/${records.length} mapped | Total: ${this.successfulMappings}/${this.totalProcessed}\r`);
  }

  async mapSingleRecord(record) {
    try {
      const ireadyId = record.district_student_id;
      
      if (!ireadyId || ireadyId.length !== 7) {
        return false;
      }

      // Extract last 4 digits
      const last4Digits = ireadyId.slice(-4);

      // Find matching student
      const { data: studentMatch } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('district_student_id', last4Digits)
        .single();

      if (studentMatch) {
        // Update the iReady record
        const { error: updateError } = await supabase
          .from('iready_diagnostic_results')
          .update({ student_id: studentMatch.id })
          .eq('id', record.id);

        if (!updateError) {
          // Log successful mappings occasionally
          if (this.successfulMappings < 10 || this.successfulMappings % 100 === 0) {
            console.log(`\n   ✅ ${ireadyId} → ${last4Digits} (${record.student_name} → ${studentMatch.first_name} ${studentMatch.last_name})`);
          }
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  displayFinalResults() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    const successRate = this.totalProcessed > 0 ? Math.round((this.successfulMappings / this.totalProcessed) * 100) : 0;

    console.log('\n' + '='.repeat(50));
    console.log('🎉 STUDENT ID MAPPING COMPLETED!');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
    console.log(`📊 Total Records Processed: ${this.totalProcessed}`);
    console.log(`✅ Successfully Mapped: ${this.successfulMappings}`);
    console.log(`📈 Success Rate: ${successRate}%`);

    if (successRate >= 80) {
      console.log('🏆 EXCELLENT! High mapping success rate achieved.');
    } else if (successRate >= 50) {
      console.log('✅ GOOD! Reasonable mapping success rate.');
    } else if (successRate >= 20) {
      console.log('⚠️  PARTIAL SUCCESS! Some mappings completed.');
    } else {
      console.log('❌ LOW SUCCESS RATE! May need additional mapping strategies.');
    }

    console.log('\n💡 NEXT STEPS:');
    console.log('   • Run verification script to check final results');
    console.log('   • Continue with remaining iReady data upload');
    console.log('   • Monitor teacher ID resolution');
  }
}

async function main() {
  try {
    const mapper = new StudentIdMapper();
    await mapper.completeMapping();
  } catch (error) {
    console.error('💥 Mapping process failed:', error);
    process.exit(1);
  }
}

main();