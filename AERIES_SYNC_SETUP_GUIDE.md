# Comprehensive Aeries Sync Setup Guide

This guide walks through setting up and running the comprehensive Aeries API sync functionality that will populate your entire Supabase database with all relevant data from Aeries.

## Overview

The comprehensive sync solution includes:
- **Complete database schema** for all Aeries data types
- **Production-ready sync script** with error handling and retry logic
- **All data types**: Schools, Students, Teachers, Attendance, Schedules, Terms
- **Progress tracking** and operation logging
- **Rate limiting** and API best practices

## Prerequisites

1. **Aeries API Access**
   - Active Aeries SIS system with API enabled
   - Valid API certificate (32-character alphanumeric string)
   - Base URL for your district's Aeries API
   - Appropriate permissions for all required endpoints

2. **Supabase Project**
   - Active Supabase project
   - Service role key with full database access
   - Ability to run SQL scripts in the dashboard

3. **Node.js Environment**
   - Node.js 18+ installed
   - TypeScript support
   - Required npm packages (see package.json)

## Step 1: Database Schema Setup

### 1.1 Run the Comprehensive Schema Update

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor** 
3. Create a **New Query**
4. Copy the entire contents of `COMPREHENSIVE_AERIES_SCHEMA_UPDATES.sql`
5. Paste into the SQL Editor
6. Click **Run** to execute

This will create/update all necessary tables:
- `schools` - School information and configuration
- `students` - Complete student demographics (enhanced)
- `teachers` - Staff information and roles
- `teacher_assignments` - Class assignments and schedules
- `school_terms` - Academic calendar
- `absence_codes` - Attendance code definitions
- `student_schedules` - Student class schedules
- `aeries_sync_operations` - Sync operation tracking

### 1.2 Verify Schema Creation

Run this query in Supabase to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'schools', 'students', 'teachers', 'teacher_assignments',
    'school_terms', 'absence_codes', 'student_schedules', 
    'aeries_sync_operations', 'attendance_records'
  )
ORDER BY table_name;
```

You should see all 9 tables listed.

## Step 2: Environment Configuration

### 2.1 Required Environment Variables

Create or update your `.env.local` file with these variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Aeries API Configuration  
AERIES_API_BASE_URL=https://your-district.aeries.net/aeries/api/v5
AERIES_API_KEY=your-32-character-certificate-key

# Optional: Sync Configuration
AERIES_SYNC_ENABLED=true
AERIES_BATCH_SIZE=100
AERIES_RATE_LIMIT_PER_MINUTE=60
AERIES_ATTENDANCE_START_DATE=2024-08-15
AERIES_ATTENDANCE_END_DATE=2025-06-12
```

### 2.2 Validate Configuration

You can test your configuration by running:

```bash
npx ts-node -e "
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY', 
  'AERIES_API_BASE_URL',
  'AERIES_API_KEY'
];

const missing = required.filter(env => !process.env[env]);
if (missing.length > 0) {
  console.log('❌ Missing:', missing.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set');
}
"
```

## Step 3: Run the Comprehensive Sync

### 3.1 Execute the Sync

Run the comprehensive sync script:

```bash
npx ts-node comprehensive-aeries-sync-v2.ts
```

### 3.2 Monitor Progress

The sync will display detailed progress information:

```
🚀 Comprehensive Aeries Sync - Production v2
===============================================================
Operation ID: aeries-comprehensive-1704123456789
School Year: 2024-2025
Date Range: 2024-08-15 to 2025-06-12
===============================================================

📋 Step 1: Syncing Schools...
   📚 Processing 10 schools...
   ✅ Successfully synced 10 schools

📋 Step 2: Syncing Students...
   📚 Processing students for 10 schools...
   
   🏫 Roosevelt Middle School (120):
     📊 Processing 850 students in batches...
     ✅ Batch 1/9: 100 students
     ✅ Batch 2/9: 100 students
     ...
```

### 3.3 Sync Duration

Expect the following approximate durations:
- **Schools**: 1-2 minutes
- **Students**: 10-30 minutes (depending on student count)
- **Teachers**: 5-10 minutes  
- **Attendance**: 20-60 minutes (most time-consuming)
- **Other data**: 5-10 minutes

**Total estimated time**: 45-120 minutes for complete sync

## Step 4: Verify Data Integrity

### 4.1 Check Record Counts

Run these queries in Supabase to verify data was synced:

```sql
-- Schools
SELECT COUNT(*) as school_count FROM schools WHERE is_active = true;

-- Students  
SELECT COUNT(*) as student_count FROM students WHERE is_active = true;

-- Teachers
SELECT COUNT(*) as teacher_count FROM teachers WHERE is_active = true;

-- Attendance Records
SELECT COUNT(*) as attendance_count FROM attendance_records;

-- Sync Operations
SELECT * FROM aeries_sync_operations ORDER BY start_time DESC LIMIT 5;
```

### 4.2 Sample Data Verification

Check that student data is complete:

```sql
SELECT 
  student_id,
  first_name,
  last_name,
  grade_level,
  school_code,
  enrollment_status,
  aeries_student_number,
  sync_metadata
FROM students 
WHERE is_active = true 
LIMIT 5;
```

Check attendance data:

```sql
SELECT 
  student_id,
  date,
  daily_status,
  minutes_absent,
  school_year,
  sync_operation_id
FROM attendance_records 
ORDER BY date DESC 
LIMIT 10;
```

### 4.3 Use Built-in Views

Query the created views for reporting:

```sql
-- Active students with school info
SELECT * FROM active_students_with_schools LIMIT 10;

-- Attendance summary
SELECT * FROM student_attendance_summary LIMIT 10;

-- Teacher assignments
SELECT * FROM teacher_assignments_with_schools LIMIT 10;
```

## Step 5: Handle Common Issues

### 5.1 API Connection Issues

**Problem**: 401 Unauthorized errors
**Solution**: Verify your `AERIES_API_KEY` is correct and has proper permissions

**Problem**: 404 Not Found for endpoints
**Solution**: Some endpoints may not be available in your Aeries version. The sync script handles this gracefully.

**Problem**: Rate limiting (429 errors)
**Solution**: The sync includes automatic retry logic with exponential backoff

### 5.2 Database Issues

**Problem**: Foreign key constraint errors
**Solution**: Ensure you ran the complete schema update script first

**Problem**: Duplicate key errors
**Solution**: The sync uses `UPSERT` operations to handle duplicates automatically

### 5.3 Data Quality Issues

**Problem**: Missing student data
**Solution**: Check that students are active in Aeries and your API permissions include student data

**Problem**: No attendance records
**Solution**: Attendance endpoints vary by district. The sync tries multiple endpoints automatically.

## Step 6: Set Up Automated Syncing

### 6.1 Create Incremental Sync

For ongoing maintenance, create a smaller incremental sync that runs daily:

```typescript
// incremental-sync.ts
import { ComprehensiveAeriesSync } from './comprehensive-aeries-sync-v2';

class IncrementalSync extends ComprehensiveAeriesSync {
  constructor() {
    super();
    // Override to only sync recent data
    this.ATTENDANCE_START_DATE = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]; // Last 7 days
  }
  
  async run() {
    // Only sync attendance and recently modified students
    await this.syncAttendanceRecords();
    await this.syncRecentStudentChanges();
  }
}
```

### 6.2 Schedule with Cron

Add to your system cron tab:

```bash
# Daily at 2 AM
0 2 * * * cd /path/to/project && npx ts-node incremental-sync.ts
```

## Step 7: Frontend Integration

### 7.1 Update Frontend Queries

Your frontend can now query comprehensive data:

```typescript
// Get student with school info
const { data: students } = await supabase
  .from('active_students_with_schools')
  .select('*')
  .eq('school_code', '120');

// Get attendance summary
const { data: attendance } = await supabase
  .from('student_attendance_summary')
  .select('*')
  .gte('attendance_percentage', 90);

// Get teacher assignments
const { data: teachers } = await supabase
  .from('teacher_assignments_with_schools')
  .select('*')
  .eq('school_code', '120');
```

### 7.2 Real-time Subscriptions

Set up real-time subscriptions for live data:

```typescript
// Subscribe to attendance updates
const subscription = supabase
  .channel('attendance_changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'attendance_records'
  }, (payload) => {
    console.log('New attendance record:', payload.new);
  })
  .subscribe();
```

## Troubleshooting

### Common Error Messages

1. **"Certificate file not found"**
   - Ensure certificate files exist and have proper permissions

2. **"Invalid response format for schools"**
   - Check that your Aeries API is responding with JSON format

3. **"No active schools found in database"**
   - Run the schools sync first, or check school data in Aeries

4. **"Rate limit exceeded"**
   - The sync will automatically retry, but you may need to adjust `RATE_LIMIT_DELAY`

### Performance Optimization

1. **Reduce batch size** for slower connections:
   ```env
   AERIES_BATCH_SIZE=50
   ```

2. **Increase delays** for rate limiting:
   ```typescript
   private readonly RATE_LIMIT_DELAY = 2000; // 2 seconds
   ```

3. **Limit student count** for testing:
   ```typescript
   .limit(100) // Add to student queries
   ```

## Support

For additional support:

1. Check the sync operation logs in the `aeries_sync_operations` table
2. Review error details in the operation metadata
3. Consult Aeries API documentation for endpoint-specific issues
4. Contact your Aeries administrator for API permission issues

## Summary

This comprehensive sync solution provides:

✅ **Complete data migration** from Aeries to Supabase  
✅ **Production-ready error handling** and retry logic  
✅ **Comprehensive logging** and operation tracking  
✅ **All major data types** needed for school operations  
✅ **Rate limiting** and API best practices  
✅ **Flexible configuration** for different districts  
✅ **Built-in reporting views** for common queries  

Your AP Tool frontend can now access complete, real-time school data directly from Supabase, with all the benefits of a modern database system while maintaining sync with your Aeries SIS.