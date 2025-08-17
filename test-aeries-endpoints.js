#!/usr/bin/env node

/**
 * Test Aeries API Endpoints - Check what endpoints work and return data
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const AERIES_API_KEY = process.env.AERIES_API_KEY;
const AERIES_BASE_URL = 'romolandapi.aeries.net';

async function aeriesAPIRequest(endpoint) {
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
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(10000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function testEndpoints() {
  console.log('🧪 Testing Aeries API Endpoints');
  console.log('================================');
  
  const schoolCode = '1'; // Test with school 1
  
  const endpoints = [
    `/schools`,
    `/schools/${schoolCode}`,
    `/schools/${schoolCode}/students`,
    `/schools/${schoolCode}/AttendanceHistory`,
    `/schools/${schoolCode}/AttendanceHistory/details`,
    `/schools/${schoolCode}/AttendanceHistory/details/year/2024-2025`,
    `/schools/${schoolCode}/attendance`
  ];

  for (const endpoint of endpoints) {
    try {
      const result = await aeriesAPIRequest(endpoint);
      console.log(`✅ ${endpoint}`);
      console.log(`   Status: ${result.status}`);
      
      if (Array.isArray(result.data)) {
        console.log(`   Data: Array with ${result.data.length} items`);
        if (result.data.length > 0) {
          console.log(`   First item keys: ${Object.keys(result.data[0]).join(', ')}`);
        }
      } else if (typeof result.data === 'object') {
        console.log(`   Data: Object with keys: ${Object.keys(result.data).join(', ')}`);
      } else {
        console.log(`   Data: ${typeof result.data} - ${result.data.toString().substring(0, 100)}`);
      }
      console.log('');
      
    } catch (error) {
      console.log(`❌ ${endpoint}`);
      console.log(`   Error: ${error.message}`);
      console.log('');
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testEndpoints().catch(console.error);