-- Check existing tardy data in the database
-- Execute this in Supabase Dashboard SQL Editor to see what tardy data exists

-- Check if tardy_count column has any non-zero values
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE tardy_count > 0) as records_with_tardies,
  MAX(tardy_count) as max_tardies,
  SUM(tardy_count) as total_tardies
FROM attendance_records;

-- Sample some records with tardies (if any exist)
SELECT 
  student_id,
  attendance_date,
  tardy_count,
  is_present,
  period_1_status,
  period_2_status,
  period_3_status
FROM attendance_records 
WHERE tardy_count > 0 
LIMIT 10;

-- Check attendance status values to see what's available
SELECT 
  period_1_status,
  COUNT(*) as count
FROM attendance_records 
WHERE period_1_status IS NOT NULL
GROUP BY period_1_status
ORDER BY count DESC
LIMIT 10;