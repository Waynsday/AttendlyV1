/**
 * @fileoverview Simple Aeries Test API
 * 
 * COPY-PASTE READY endpoint to test Aeries integration
 * with minimal configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { testAeriesConnection, getSimpleAeriesClient } from '@/lib/aeries/simple-aeries-client';

// =====================================================
// GET /api/aeries/test - Test Aeries connection
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('[Aeries Test] Starting connection test...');

    // Get query parameters
    const url = new URL(request.url);
    const test = url.searchParams.get('test') || 'connection';

    let result: any = {};

    switch (test) {
      case 'connection':
        result = await testConnection();
        break;
      
      case 'config':
        result = await testConfig();
        break;
      
      case 'schools':
        result = await testSchools();
        break;
      
      case 'attendance':
        const date = url.searchParams.get('date') || '2024-08-15';
        result = await testAttendance(date);
        break;
      
      default:
        result = await testConnection();
    }

    return NextResponse.json({
      success: true,
      test,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('[Aeries Test] Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'AERIES_TEST_FAILED'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// =====================================================
// Test Functions
// =====================================================

async function testConnection() {
  console.log('[Aeries Test] Testing basic connection...');
  
  try {
    const isConnected = await testAeriesConnection();
    
    return {
      connected: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed',
      details: {
        baseUrl: process.env.AERIES_API_BASE_URL || 'Not configured',
        districtCode: process.env.AERIES_DISTRICT_CODE || 'Not configured',
        certificatePath: process.env.AERIES_CERTIFICATE_PATH || 'Not configured'
      }
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Connection test failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testConfig() {
  console.log('[Aeries Test] Testing configuration...');
  
  try {
    const client = await getSimpleAeriesClient();
    const config = client.getConfig();
    
    return {
      valid: true,
      message: 'Configuration loaded successfully',
      config: {
        baseUrl: config.baseUrl,
        districtCode: config.districtCode,
        batchSize: config.batchSize,
        rateLimitPerMinute: config.rateLimitPerMinute,
        hasCertificate: !!config.certificatePath
      }
    };
  } catch (error) {
    return {
      valid: false,
      message: 'Configuration test failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testSchools() {
  console.log('[Aeries Test] Testing schools endpoint...');
  
  try {
    const client = await getSimpleAeriesClient();
    const schools = await client.getSchools();
    
    if (schools.success) {
      return {
        success: true,
        message: `Found ${schools.data.length} schools`,
        schools: schools.data.map(school => ({
          code: school.schoolCode,
          name: school.schoolName,
          active: school.active
        }))
      };
    } else {
      return {
        success: false,
        message: 'Failed to get schools',
        schools: []
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Schools test failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testAttendance(date: string) {
  console.log(`[Aeries Test] Testing attendance for ${date}...`);
  
  try {
    const client = await getSimpleAeriesClient();
    const attendance = await client.getAttendanceByDateRange(date, date, { batchSize: 5 });
    
    if (attendance.success) {
      return {
        success: true,
        message: `Found ${attendance.data.length} attendance records for ${date}`,
        sample: attendance.data.slice(0, 3).map(record => ({
          studentNumber: record.studentNumber,
          schoolCode: record.schoolCode,
          status: record.dailyStatus,
          date: record.attendanceDate
        })),
        total: attendance.data.length
      };
    } else {
      return {
        success: false,
        message: `Failed to get attendance for ${date}`,
        sample: []
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Attendance test failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}