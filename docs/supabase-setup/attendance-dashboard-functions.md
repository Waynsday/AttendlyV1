# Attendance Dashboard SQL Functions Setup

This document outlines the SQL functions that need to be created in Supabase Dashboard to support the enhanced attendance dashboard functionality.

## Prerequisites

1. Access to Supabase Dashboard SQL Editor
2. Admin privileges on the project
3. Confirmed database schema with:
   - `schools` table
   - `students` table  
   - `attendance_records` table

## Required Functions

### 1. Grade Attendance Summaries Function

**Purpose**: Efficiently calculates attendance summaries by grade level for a specific school.

**File**: `/supabase/functions/get_grade_attendance_summaries.sql`

**Execute in Supabase SQL Editor**:

```sql
-- Copy and paste the entire content from:
-- supabase/functions/get_grade_attendance_summaries.sql
```

**Usage**:
```sql
SELECT * FROM get_grade_attendance_summaries(
  'school_uuid_here',
  '2024-08-15'::date,
  '2024-12-31'::date
);
```

### 2. Attendance Tiers Calculation Function

**Purpose**: Calculates tier distribution (Tier 1: ≥95%, Tier 2: 90-94.9%, Tier 3: <90%) for a grade level.

**File**: `/supabase/functions/calculate_attendance_tiers.sql`

**Execute in Supabase SQL Editor**:

```sql
-- Copy and paste the entire content from:
-- supabase/functions/calculate_attendance_tiers.sql
```

**Usage**:
```sql
SELECT * FROM calculate_attendance_tiers(
  'school_uuid_here',
  6, -- grade level
  '2024-08-15'::date,
  '2024-12-31'::date
);
```

## Database Indexes for Performance

Execute these statements to create optimal indexes:

```sql
-- Attendance records indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_records_student_date 
ON attendance_records(student_id, attendance_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_records_school_date 
ON attendance_records(school_id, attendance_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_records_date_present 
ON attendance_records(attendance_date, is_present);

-- Students indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_school_grade_active 
ON students(school_id, grade_level, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_active_grade 
ON students(is_active, grade_level) WHERE is_active = true;

-- Schools indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schools_active 
ON schools(is_active) WHERE is_active = true;
```

## Row Level Security (RLS) Policies

Ensure these RLS policies are in place:

```sql
-- Enable RLS on all tables
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Example policy for attendance_records (adjust based on your auth setup)
CREATE POLICY "attendance_records_select_policy" ON attendance_records
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM students 
    WHERE students.id = attendance_records.student_id 
    AND students.school_id IN (
      -- Add your school access logic here
      SELECT id FROM schools WHERE is_active = true
    )
  )
);

-- Similar policies needed for students and schools tables
```

## Function Permissions

Grant execute permissions to authenticated users:

```sql
-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_grade_attendance_summaries(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_attendance_tiers(UUID, INTEGER, DATE, DATE) TO authenticated;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
```

## Verification Steps

1. **Test Functions**: Execute test queries to ensure functions work correctly
2. **Check Performance**: Run EXPLAIN ANALYZE on complex queries
3. **Verify Permissions**: Test with different user roles
4. **Monitor Resources**: Check query execution times and resource usage

### Test Queries

```sql
-- Test grade summaries function
SELECT 
  grade_level,
  school_name,
  total_students,
  attendance_rate,
  tier1_count,
  tier2_count,
  tier3_count
FROM get_grade_attendance_summaries(
  (SELECT id FROM schools WHERE is_active = true LIMIT 1),
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);

-- Test tiers calculation function
SELECT 
  tier1_count,
  tier2_count,
  tier3_count
FROM calculate_attendance_tiers(
  (SELECT id FROM schools WHERE is_active = true LIMIT 1),
  6,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure RLS policies allow access
2. **Function Not Found**: Verify function was created in correct schema
3. **Slow Performance**: Check if indexes are created and being used
4. **Type Errors**: Ensure UUID values are properly formatted

### Performance Monitoring

```sql
-- Check function execution stats
SELECT 
  schemaname,
  funcname,
  calls,
  total_time,
  mean_time
FROM pg_stat_user_functions 
WHERE funcname IN ('get_grade_attendance_summaries', 'calculate_attendance_tiers');

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('attendance_records', 'students', 'schools');
```

## Security Considerations

1. **Input Validation**: Functions validate all input parameters
2. **SQL Injection**: Uses parameterized queries throughout
3. **Data Access**: Respects RLS policies and user permissions
4. **Audit Logging**: Consider enabling query logging for security audit

## Deployment Checklist

- [ ] Both RPC functions created successfully
- [ ] All performance indexes created
- [ ] RLS policies configured
- [ ] Function permissions granted
- [ ] Test queries executed successfully
- [ ] Performance verified (< 500ms for single school queries)
- [ ] Security policies tested with different user roles
- [ ] Documentation updated with any environment-specific changes

## Support

If you encounter issues:
1. Check Supabase Dashboard logs
2. Verify database schema matches expectations
3. Test with simplified queries first
4. Contact development team with specific error messages