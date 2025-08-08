/**
 * @fileoverview Enhanced Aeries Client Usage Example
 * 
 * Demonstrates how to use the enhanced Aeries API client with
 * circuit breaker, retry logic, and Romoland-specific features.
 */

import { EnhancedAeriesClient } from '../src/lib/aeries/enhanced-aeries-client';
import { CircuitBreakerState } from '../src/lib/aeries/circuit-breaker';

/**
 * Example: Basic usage of the Enhanced Aeries Client
 */
async function basicUsageExample() {
  console.log('\n=== Basic Enhanced Aeries Client Usage ===');
  
  const client = new EnhancedAeriesClient({
    baseUrl: 'https://romolandapi.aeries.net/admin/api/v5',
    apiKey: process.env.AERIES_API_KEY || 'your-api-key',
    clientId: process.env.AERIES_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.AERIES_CLIENT_SECRET || 'your-client-secret',
    certificatePath: './certs/aeries-client.crt',
    
    // Circuit breaker configuration
    circuitBreakerConfig: {
      failureThreshold: 5,        // Open circuit after 5 failures
      recoveryTimeout: 60000,     // Wait 60 seconds before trying again
      monitoringPeriod: 300000,   // Monitor over 5 minutes
      halfOpenMaxRequests: 1      // Allow 1 request in half-open state
    },
    
    // Retry configuration
    retryConfig: {
      maxAttempts: 3,      // Try up to 3 times
      baseDelay: 1000,     // Start with 1 second delay
      maxDelay: 30000,     // Max 30 seconds delay
      multiplier: 2        // Double delay each time
    },
    
    // Dead letter queue configuration
    deadLetterQueueConfig: {
      maxRetries: 3,           // Give up after 3 retries
      retryDelayMs: 5000,      // 5 second base retry delay
      maxQueueSize: 1000,      // Keep up to 1000 failed operations
      persistencePath: './data/failed-operations.json'
    },
    
    // Data validation configuration
    validationConfig: {
      strictMode: true,
      enablePIIScanning: true,
      maxRecordSize: 10000,
      allowedSchools: ['RHS', 'RMS', 'RES', 'HHS']
    }
  });

  try {
    // Initialize the client
    await client.initialize();
    console.log('✅ Enhanced Aeries client initialized successfully');
    
    // Get attendance data with automatic retry and circuit breaker protection
    const attendance = await client.getAttendanceByDateRange('2024-08-15', '2024-08-16', 'RHS');
    console.log(`✅ Retrieved ${attendance.data.length} attendance records`);
    
    // Get circuit breaker status
    const circuitState = client.getCircuitBreakerState();
    console.log(`📊 Circuit breaker state: ${circuitState}`);
    
    // Get performance metrics
    const metrics = client.getMetrics();
    console.log(`📈 Collected ${metrics.length} performance metrics`);
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  } finally {
    await client.cleanup();
  }
}

/**
 * Example: Romoland-specific attendance handling
 */
async function romolandSpecificExample() {
  console.log('\n=== Romoland-Specific Attendance Handling ===');
  
  const client = new EnhancedAeriesClient({
    baseUrl: 'https://romolandapi.aeries.net/admin/api/v5',
    apiKey: process.env.AERIES_API_KEY || 'your-api-key',
    clientId: process.env.AERIES_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.AERIES_CLIENT_SECRET || 'your-client-secret',
    certificatePath: './certs/aeries-client.crt'
  });

  try {
    await client.initialize();
    
    // Get middle school attendance with 7-period handling
    console.log('📚 Getting Romoland Middle School attendance...');
    const rmsAttendance = await client.getRomolandAttendanceData(
      '2024-08-15', 
      '2024-08-16', 
      'RMS'
    );
    
    // Process attendance to identify full-day absences
    rmsAttendance.data.forEach(record => {
      if (record.periods.length === 7) {
        const absentPeriods = record.periods.filter(p => p.status === 'ABSENT').length;
        if (absentPeriods === 7) {
          console.log(`🚨 Student ${record.studentNumber} was absent all 7 periods on ${record.attendanceDate}`);
        } else if (absentPeriods > 0) {
          console.log(`⚠️  Student ${record.studentNumber} was absent ${absentPeriods}/7 periods on ${record.attendanceDate}`);
        }
      }
    });
    
    // Sync with 7-day correction window
    console.log('🔄 Syncing with correction window...');
    await client.syncAttendanceWithCorrectionWindow('2024-08-15', '2024-08-22');
    console.log('✅ Sync with correction window completed');
    
  } catch (error) {
    console.error('❌ Romoland-specific error:', error instanceof Error ? error.message : String(error));
  } finally {
    await client.cleanup();
  }
}

/**
 * Example: Error handling and dead letter queue processing
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling and Dead Letter Queue ===');
  
  const client = new EnhancedAeriesClient({
    baseUrl: 'https://invalid-url.example.com', // Intentionally invalid URL
    apiKey: 'invalid-key',
    clientId: 'invalid-client',
    clientSecret: 'invalid-secret',
    certificatePath: './certs/aeries-client.crt',
    
    // Aggressive circuit breaker for demo
    circuitBreakerConfig: {
      failureThreshold: 2,
      recoveryTimeout: 10000
    },
    
    // Quick retries for demo
    retryConfig: {
      maxAttempts: 2,
      baseDelay: 100,
      maxDelay: 1000
    }
  });

  try {
    await client.initialize();
    
    // This will fail and trigger circuit breaker
    console.log('🔥 Attempting request that will fail...');
    await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');
    
  } catch (error) {
    console.log('❌ Expected failure:', error instanceof Error ? error.message : String(error));
    
    // Check circuit breaker state
    const state = client.getCircuitBreakerState();
    console.log(`⚡ Circuit breaker state: ${state}`);
    
    // Check dead letter queue
    const dlqStats = await client.getDeadLetterQueueStats();
    console.log('📬 Dead Letter Queue Stats:', dlqStats);
    
    // Process dead letter queue
    console.log('🔄 Processing dead letter queue...');
    await client.processDeadLetterQueue();
    
  } finally {
    await client.cleanup();
  }
}

/**
 * Example: Monitoring and metrics collection
 */
async function monitoringExample() {
  console.log('\n=== Monitoring and Metrics Collection ===');
  
  const client = new EnhancedAeriesClient({
    baseUrl: 'https://romolandapi.aeries.net/admin/api/v5',
    apiKey: process.env.AERIES_API_KEY || 'your-api-key',
    clientId: process.env.AERIES_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.AERIES_CLIENT_SECRET || 'your-client-secret',
    certificatePath: './certs/aeries-client.crt'
  });

  // Event listeners for monitoring
  client.on('initialized', () => {
    console.log('🎉 Client initialized event received');
  });

  client.on('circuitBreakerStateChange', (event) => {
    console.log(`⚡ Circuit breaker changed: ${event.from} -> ${event.to} (${event.reason})`);
  });

  try {
    await client.initialize();
    
    // Perform some operations to generate metrics
    const startTime = Date.now();
    
    for (let i = 0; i < 3; i++) {
      try {
        await client.getAttendanceByDateRange('2024-08-15', '2024-08-16');
        console.log(`✅ Request ${i + 1} completed`);
      } catch (error) {
        console.log(`❌ Request ${i + 1} failed`);
      }
    }
    
    const endTime = Date.now();
    
    // Collect metrics
    const metrics = client.getMetrics();
    console.log(`📊 Total operations: ${metrics.length}`);
    console.log(`⏱️  Total time: ${endTime - startTime}ms`);
    
    // Calculate success rate
    const successful = metrics.filter(m => m.success).length;
    const successRate = metrics.length > 0 ? (successful / metrics.length) * 100 : 0;
    console.log(`📈 Success rate: ${successRate.toFixed(1)}%`);
    
    // Show average response time
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const avgDuration = metrics.length > 0 ? totalDuration / metrics.length : 0;
    console.log(`⚡ Average response time: ${avgDuration.toFixed(1)}ms`);
    
  } catch (error) {
    console.error('❌ Monitoring error:', error instanceof Error ? error.message : String(error));
  } finally {
    await client.cleanup();
  }
}

/**
 * Example: Security and compliance features
 */
async function securityExample() {
  console.log('\n=== Security and Compliance Features ===');
  
  const client = new EnhancedAeriesClient({
    baseUrl: 'https://romolandapi.aeries.net/admin/api/v5',
    apiKey: process.env.AERIES_API_KEY || 'your-api-key',
    clientId: process.env.AERIES_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.AERIES_CLIENT_SECRET || 'your-client-secret',
    certificatePath: './certs/aeries-client.crt',
    
    // Enhanced validation for security
    validationConfig: {
      strictMode: true,           // Strict validation mode
      enablePIIScanning: true,    // Scan for PII in responses
      maxRecordSize: 5000,        // Smaller max record size
      allowedSchools: ['RHS']     // Only allow specific schools
    }
  });

  try {
    await client.initialize();
    
    // Certificate validation
    const certValid = await client.validateCertificate();
    console.log(`🔒 Certificate validation: ${certValid ? 'Valid' : 'Invalid'}`);
    
    // Rate limiting check
    const rateLimitOk = await client.checkRateLimit();
    console.log(`⏱️  Rate limit status: ${rateLimitOk ? 'OK' : 'Limited'}`);
    
    // Try to get data - will be validated and sanitized
    console.log('🔍 Getting attendance data with PII scanning...');
    const attendance = await client.getAttendanceByDateRange('2024-08-15', '2024-08-16', 'RHS');
    
    console.log(`✅ Retrieved ${attendance.data.length} validated and sanitized records`);
    console.log('🛡️  All PII has been automatically sanitized');
    
  } catch (error) {
    console.error('❌ Security error:', error instanceof Error ? error.message : String(error));
  } finally {
    await client.cleanup();
  }
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('🚀 Enhanced Aeries Client Examples');
  console.log('=====================================');
  
  try {
    await basicUsageExample();
    await romolandSpecificExample();
    await errorHandlingExample();
    await monitoringExample();
    await securityExample();
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
  }
}

// Run examples if called directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicUsageExample,
  romolandSpecificExample,
  errorHandlingExample,
  monitoringExample,
  securityExample
};