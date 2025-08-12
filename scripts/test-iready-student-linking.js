#!/usr/bin/env node

/**
 * Test iReady Student ID Linking
 * 
 * This script tests the student ID linking between iReady CSV data
 * and the students table to ensure proper matching before full upload
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class iReadyLinkingTest {
  constructor() {
    this.referencesDir = '../References/iReady Data';
    this.testResults = {
      totalIReadyRecords: 0,
      uniqueStudentIds: new Set(),
      matchedStudents: 0,
      unmatchedStudents: 0,
      matchedExamples: [],
      unmatchedExamples: [],
      duplicateIReadyIds: new Set()
    };
  }

  async testStudentLinking() {
    console.log('🔗 TESTING IREADY STUDENT ID LINKING');
    console.log('='.repeat(50));
    
    try {
      // 1. Load students from database
      console.log('\n📊 Step 1: Loading students from database...');
      
      // Fetch all students in batches to overcome Supabase limit
      const allStudents = [];
      let start = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from('students')
          .select('id, district_student_id, first_name, last_name, school_id')
          .range(start, start + batchSize - 1);
        
        if (batchError) throw batchError;
        
        if (!batch || batch.length === 0) break;
        
        allStudents.push(...batch);
        start += batchSize;
        
        if (batch.length < batchSize) break; // Last batch
      }
      
      const students = allStudents;
      
      const studentMap = new Map();
      students.forEach(student => {
        studentMap.set(student.district_student_id, student);
      });
      
      console.log(`   ✅ Loaded ${students.length} students from database`);
      console.log(`   📊 District student IDs range: ${Math.min(...students.map(s => parseInt(s.district_student_id)))} - ${Math.max(...students.map(s => parseInt(s.district_student_id)))}`);
      
      // 2. Test with sample iReady data
      console.log('\n📊 Step 2: Testing iReady data linking...');
      
      const testFiles = [
        { path: 'Current_Year/diagnostic_results_ela_CONFIDENTIAL.csv', subject: 'ELA', year: 2024 },
        { path: 'Current_Year/diagnostic_results_math_CONFIDENTIAL.csv', subject: 'MATH', year: 2024 }
      ];
      
      for (const fileConfig of testFiles) {
        await this.testFileMatching(fileConfig, studentMap);
      }
      
      // 3. Display results
      this.displayResults();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      throw error;
    }
  }
  
  async testFileMatching(fileConfig, studentMap) {
    const filePath = path.join(this.referencesDir, fileConfig.path);
    
    if (!fs.existsSync(filePath)) {
      console.log(`   ⚠️  File not found: ${fileConfig.path}`);
      return;
    }
    
    console.log(`\n📄 Testing file: ${fileConfig.path}`);
    console.log(`   Subject: ${fileConfig.subject}, Year: ${fileConfig.year}`);
    
    return new Promise((resolve, reject) => {
      const results = [];
      let rowCount = 0;
      const maxTestRows = 1000; // Test first 1000 rows for speed
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowCount++;
          if (rowCount <= maxTestRows) {
            results.push(row);
          }
        })
        .on('end', () => {
          console.log(`   📊 Testing first ${Math.min(rowCount, maxTestRows)} records of ${rowCount} total`);
          this.analyzeMatching(results, studentMap, fileConfig);
          resolve();
        })
        .on('error', reject);
    });
  }
  
  analyzeMatching(records, studentMap, fileConfig) {
    let fileMatched = 0;
    let fileUnmatched = 0;
    
    records.forEach(record => {
      this.testResults.totalIReadyRecords++;
      
      // Extract student ID (7-digit)
      const studentId = record['Student ID'] || record['District Student ID'] || record['StudentID'];
      
      if (!studentId) {
        fileUnmatched++;
        this.testResults.unmatchedStudents++;
        return;
      }
      
      const cleanStudentId = studentId.toString().trim();
      this.testResults.uniqueStudentIds.add(cleanStudentId);
      
      // Check for duplicates within iReady data
      if (this.testResults.uniqueStudentIds.has(cleanStudentId)) {
        this.testResults.duplicateIReadyIds.add(cleanStudentId);
      }
      
      // Test matching with database
      const matchedStudent = studentMap.get(cleanStudentId);
      
      if (matchedStudent) {
        fileMatched++;
        this.testResults.matchedStudents++;
        
        // Save example matches (limit to avoid too much data)
        if (this.testResults.matchedExamples.length < 10) {
          this.testResults.matchedExamples.push({
            ireadyId: cleanStudentId,
            ireadyName: `${record['First Name'] || ''} ${record['Last Name'] || ''}`.trim(),
            dbName: `${matchedStudent.first_name} ${matchedStudent.last_name}`,
            subject: fileConfig.subject,
            overallScore: record['Overall Scale Score']
          });
        }
      } else {
        fileUnmatched++;
        this.testResults.unmatchedStudents++;
        
        // Save example unmatched (limit to avoid too much data)
        if (this.testResults.unmatchedExamples.length < 10) {
          this.testResults.unmatchedExamples.push({
            ireadyId: cleanStudentId,
            ireadyName: `${record['First Name'] || ''} ${record['Last Name'] || ''}`.trim(),
            subject: fileConfig.subject,
            idLength: cleanStudentId.length
          });
        }
      }
    });
    
    const matchRate = Math.round((fileMatched / records.length) * 100);
    console.log(`   ✅ Matched: ${fileMatched}/${records.length} (${matchRate}%)`);
    console.log(`   ❌ Unmatched: ${fileUnmatched}/${records.length} (${100 - matchRate}%)`);
  }
  
  displayResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 IREADY STUDENT LINKING TEST RESULTS');
    console.log('='.repeat(50));
    
    const totalTests = this.testResults.totalIReadyRecords;
    const matchRate = Math.round((this.testResults.matchedStudents / totalTests) * 100);
    
    console.log(`📊 Total iReady records tested: ${totalTests.toLocaleString()}`);
    console.log(`📊 Unique student IDs in iReady: ${this.testResults.uniqueStudentIds.size.toLocaleString()}`);
    console.log(`✅ Successfully matched: ${this.testResults.matchedStudents.toLocaleString()} (${matchRate}%)`);
    console.log(`❌ Failed to match: ${this.testResults.unmatchedStudents.toLocaleString()} (${100 - matchRate}%)`);
    
    if (this.testResults.duplicateIReadyIds.size > 0) {
      console.log(`⚠️  Duplicate iReady IDs found: ${this.testResults.duplicateIReadyIds.size}`);
    }
    
    // Show example matches
    if (this.testResults.matchedExamples.length > 0) {
      console.log('\n✅ Example successful matches:');
      this.testResults.matchedExamples.slice(0, 5).forEach((match, index) => {
        console.log(`   ${index + 1}. ID: ${match.ireadyId}`);
        console.log(`      iReady: ${match.ireadyName} (${match.subject}, Score: ${match.overallScore})`);
        console.log(`      Database: ${match.dbName}`);
      });
    }
    
    // Show example unmatched
    if (this.testResults.unmatchedExamples.length > 0) {
      console.log('\n❌ Example unmatched records:');
      this.testResults.unmatchedExamples.slice(0, 5).forEach((unmatch, index) => {
        console.log(`   ${index + 1}. ID: ${unmatch.ireadyId} (${unmatch.idLength} digits)`);
        console.log(`      iReady: ${unmatch.ireadyName} (${unmatch.subject})`);
        console.log(`      Status: No matching student in database`);
      });
    }
    
    // Recommendation
    console.log('\n📋 RECOMMENDATION:');
    if (matchRate >= 95) {
      console.log('✅ Excellent match rate! Safe to proceed with full upload.');
    } else if (matchRate >= 80) {
      console.log('⚠️  Good match rate. Consider investigating unmatched records before full upload.');
    } else if (matchRate >= 50) {
      console.log('⚠️  Moderate match rate. Review student ID format and data before proceeding.');
    } else {
      console.log('❌ Poor match rate. Do NOT proceed with upload until ID matching is fixed.');
    }
    
    console.log(`\n🚀 If satisfied with results, run: node simple-iready-upload.js`);
  }
}

async function main() {
  try {
    const tester = new iReadyLinkingTest();
    await tester.testStudentLinking();
  } catch (error) {
    console.error('💥 Test process failed:', error);
    process.exit(1);
  }
}

main();