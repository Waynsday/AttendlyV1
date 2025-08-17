#!/usr/bin/env node

/**
 * Comprehensive Aeries Student API Test Suite
 * Tests every possible combination of student-related endpoints to find working methods
 * for populating the students table with real Aeries data
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const AERIES_API_KEY = process.env.AERIES_API_KEY;
const AERIES_BASE_URL = 'romolandapi.aeries.net';

const testResults = {
  successful: [],
  failed: [],
  timeouts: [],
  startTime: Date.now()
};

async function aeriesAPIRequest(endpoint, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const fullPath = `/admin/api/v5${endpoint}`;
    const options = {
      hostname: AERIES_BASE_URL,
      path: fullPath,
      method: 'GET',
      headers: {
        'AERIES-CERT': AERIES_API_KEY,
        'Accept': 'application/json'
      }
    };

    console.log(`🔗 Testing: ${fullPath}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, size: data.length });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, size: data.length });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(timeout, () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function testEndpoint(name, endpoint, timeout = 30000) {
  try {
    const startTime = Date.now();
    const result = await aeriesAPIRequest(endpoint, timeout);
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${name}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Data size: ${result.size} bytes`);
    
    if (result.status === 200) {
      if (Array.isArray(result.data)) {
        console.log(`   Records: ${result.data.length} items`);
        if (result.data.length > 0) {
          const sampleRecord = result.data[0];
          console.log(`   Sample fields: ${Object.keys(sampleRecord).slice(0, 10).join(', ')}`);
          
          // Check if this looks like student data
          const studentFields = ['StudentID', 'FirstName', 'LastName', 'Grade', 'StudentNumber'];
          const hasStudentFields = studentFields.some(field => sampleRecord.hasOwnProperty(field));
          if (hasStudentFields) {
            console.log(`   🎓 CONTAINS STUDENT DATA!`);
          }
        }
      } else if (typeof result.data === 'object') {
        console.log(`   Object keys: ${Object.keys(result.data).slice(0, 10).join(', ')}`);
      }
      
      testResults.successful.push({
        name,
        endpoint,
        status: result.status,
        duration,
        dataSize: result.size,
        recordCount: Array.isArray(result.data) ? result.data.length : 'N/A',
        sampleData: Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : result.data
      });
    } else {
      console.log(`   Response: ${result.data.toString().substring(0, 200)}`);
      testResults.failed.push({ name, endpoint, status: result.status, error: result.data });
    }
    
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    
    if (error.message === 'Request timeout') {
      testResults.timeouts.push({ name, endpoint, error: error.message });
    } else {
      testResults.failed.push({ name, endpoint, error: error.message });
    }
  }
  
  console.log('');
}

async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE AERIES STUDENT API TEST SUITE');
  console.log('='.repeat(60));
  console.log('Testing every possible student data retrieval method...\n');

  // First, get list of schools to test with
  const schools = ['1', '2', '3', '120', '160', '250', '348']; // Known school codes
  
  console.log('📋 PHASE 1: District-Level Endpoints');
  console.log('-'.repeat(40));

  // Test district-level endpoints
  await testEndpoint('All Schools', '/schools');
  await testEndpoint('District Students (no school)', '/students', 45000);
  await testEndpoint('District Info', '/', 10000);

  console.log('📋 PHASE 2: School-Specific Student Endpoints');
  console.log('-'.repeat(40));

  // Test each school with different methods
  for (const schoolCode of schools.slice(0, 3)) { // Test first 3 schools to save time
    console.log(`\n🏫 Testing School ${schoolCode}:`);
    
    // Basic student endpoints
    await testEndpoint(`School ${schoolCode} - All Students`, `/schools/${schoolCode}/students`, 60000);
    await testEndpoint(`School ${schoolCode} - Students Extended`, `/schools/${schoolCode}/students/extended`, 60000);
    await testEndpoint(`School ${schoolCode} - Student Groups`, `/schools/${schoolCode}/StudentGroups`, 15000);
    
    // Grade-specific endpoints
    const grades = ['K', '1', '2', '3', '4', '5', '6'];
    for (const grade of grades.slice(0, 2)) { // Test first 2 grades
      await testEndpoint(`School ${schoolCode} Grade ${grade}`, `/schools/${schoolCode}/students/grade/${grade}`, 30000);
    }
  }

  console.log('📋 PHASE 3: Paginated Bulk Retrieval');
  console.log('-'.repeat(40));

  // Test pagination methods for the first school
  const testSchool = schools[0];
  await testEndpoint(`School ${testSchool} - First 50 Students`, `/schools/${testSchool}/students?StartingRecord=1&EndingRecord=50`, 30000);
  await testEndpoint(`School ${testSchool} - Next 50 Students`, `/schools/${testSchool}/students?StartingRecord=51&EndingRecord=100`, 30000);

  console.log('📋 PHASE 4: Alternative Data Access Methods');
  console.log('-'.repeat(40));

  // Test data changes endpoints (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const year = thirtyDaysAgo.getFullYear();
  const month = (thirtyDaysAgo.getMonth() + 1).toString().padStart(2, '0');
  const day = thirtyDaysAgo.getDate().toString().padStart(2, '0');
  
  await testEndpoint('Student Data Changes - Recent', `/StudentDataChanges/student/${year}/${month}/${day}/00/00`, 30000);
  await testEndpoint('Enrollment Data Changes - Recent', `/StudentDataChanges/enrollment/${year}/${month}/${day}/00/00`, 30000);

  console.log('📋 PHASE 5: Database Year Variations');
  console.log('-'.repeat(40));

  // Test different database years
  const currentYear = new Date().getFullYear();
  const dbYears = [`${currentYear-1}-${currentYear}`, `${currentYear}-${currentYear+1}`];
  
  for (const dbYear of dbYears) {
    await testEndpoint(`School ${testSchool} - DB Year ${dbYear}`, `/schools/${testSchool}/students?DatabaseYear=${dbYear}`, 30000);
  }

  // Generate comprehensive report
  generateReport();
}

function generateReport() {
  const totalTime = (Date.now() - testResults.startTime) / 1000;
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`⏱️  Total test duration: ${totalTime.toFixed(1)} seconds`);
  console.log(`✅ Successful endpoints: ${testResults.successful.length}`);
  console.log(`❌ Failed endpoints: ${testResults.failed.length}`);
  console.log(`⏰ Timed out endpoints: ${testResults.timeouts.length}`);

  if (testResults.successful.length > 0) {
    console.log('\n🎉 SUCCESSFUL ENDPOINTS (WITH STUDENT DATA):');
    console.log('-'.repeat(50));
    
    testResults.successful
      .filter(result => result.recordCount > 0)
      .sort((a, b) => b.recordCount - a.recordCount)
      .forEach(result => {
        console.log(`✅ ${result.name}`);
        console.log(`   Endpoint: ${result.endpoint}`);
        console.log(`   Records: ${result.recordCount}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Data size: ${result.dataSize} bytes`);
        
        if (result.sampleData && typeof result.sampleData === 'object') {
          const studentFields = ['StudentID', 'FirstName', 'LastName', 'Grade', 'StudentNumber', 'SchoolCode'];
          const availableFields = studentFields.filter(field => result.sampleData.hasOwnProperty(field));
          if (availableFields.length > 0) {
            console.log(`   🎓 Student fields: ${availableFields.join(', ')}`);
          }
        }
        console.log('');
      });
  }

  if (testResults.timeouts.length > 0) {
    console.log('\n⏰ ENDPOINTS THAT TIMED OUT (POTENTIALLY LARGE DATASETS):');
    console.log('-'.repeat(50));
    testResults.timeouts.forEach(result => {
      console.log(`⏰ ${result.name}: ${result.endpoint}`);
    });
  }

  if (testResults.failed.length > 0) {
    console.log('\n❌ FAILED ENDPOINTS:');
    console.log('-'.repeat(50));
    testResults.failed.forEach(result => {
      console.log(`❌ ${result.name}: ${result.endpoint} (${result.status || result.error})`);
    });
  }

  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('-'.repeat(30));
  
  const workingEndpoints = testResults.successful.filter(r => r.recordCount > 0);
  if (workingEndpoints.length > 0) {
    console.log('✅ Use these endpoints for student data population:');
    workingEndpoints.forEach(result => {
      console.log(`   - ${result.endpoint} (${result.recordCount} records)`);
    });
  } else {
    console.log('⚠️  No endpoints returned student data successfully.');
    console.log('   Consider using paginated requests with smaller batches.');
    console.log('   Large datasets may require different timeout/chunking strategies.');
  }

  if (testResults.timeouts.length > 0) {
    console.log('\n📋 For timeout endpoints, try:');
    console.log('   - Increasing timeout values (60s+)');
    console.log('   - Using pagination (StartingRecord/EndingRecord)');
    console.log('   - Processing by grade level');
    console.log('   - Requesting specific student fields only');
  }
}

// Run the comprehensive tests
runComprehensiveTests().catch(console.error);