#!/usr/bin/env node

/**
 * Examine the structure of student data from Aeries API
 */

const https = require('https');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const AERIES_API_URL = process.env.AERIES_API_BASE_URL;
const AERIES_API_KEY = process.env.AERIES_API_KEY;

async function makeRequest(endpoint) {
  const url = `${AERIES_API_URL}/${endpoint}`;
  console.log(`📡 Examining: ${url}`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(AERIES_API_URL).hostname,
      path: new URL(url).pathname + new URL(url).search,
      method: 'GET',
      headers: {
        'AERIES-CERT': AERIES_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function examineStudentData() {
  console.log('🔍 Examining student data structure...\n');

  try {
    // Get a sample from the bulk endpoint
    console.log('1. Examining bulk student data (schools/999/students):');
    const bulkStudents = await makeRequest('schools/999/students');
    console.log(`   📊 Total students: ${bulkStudents.length}`);
    
    if (bulkStudents.length > 0) {
      const sample = bulkStudents[0];
      console.log('   📋 Sample student fields:');
      console.log(JSON.stringify(sample, null, 2));
    }

    // Get individual school data for comparison
    console.log('\n2. Examining individual school data (schools/001/students):');
    const school001Students = await makeRequest('schools/001/students');
    console.log(`   📊 School 001 students: ${school001Students.length}`);
    
    if (school001Students.length > 0) {
      const sample = school001Students[0];
      console.log('   📋 Sample student fields:');
      console.log(JSON.stringify(sample, null, 2));
    }

    // Compare the two approaches
    if (bulkStudents.length > 0 && school001Students.length > 0) {
      console.log('\n3. Field comparison:');
      const bulkFields = Object.keys(bulkStudents[0]);
      const schoolFields = Object.keys(school001Students[0]);
      
      console.log('   Fields in bulk data:', bulkFields.slice(0, 10));
      console.log('   Fields in school data:', schoolFields.slice(0, 10));
      
      const uniqueToBulk = bulkFields.filter(f => !schoolFields.includes(f));
      const uniqueToSchool = schoolFields.filter(f => !bulkFields.includes(f));
      
      if (uniqueToBulk.length > 0) {
        console.log('   🔍 Unique to bulk data:', uniqueToBulk);
      }
      if (uniqueToSchool.length > 0) {
        console.log('   🔍 Unique to school data:', uniqueToSchool);
      }
    }

    // Look for school-related fields
    console.log('\n4. Looking for school identification fields:');
    if (bulkStudents.length > 0) {
      const student = bulkStudents[0];
      const schoolFields = Object.keys(student).filter(key => 
        key.toLowerCase().includes('school') || 
        key.toLowerCase().includes('site') ||
        key.toLowerCase().includes('code')
      );
      console.log('   🏫 School-related fields:', schoolFields);
      
      schoolFields.forEach(field => {
        console.log(`   • ${field}: ${student[field]}`);
      });
    }

  } catch (error) {
    console.error('❌ Error examining data:', error.message);
  }
}

examineStudentData();