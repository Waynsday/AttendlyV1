-- Debug why tardies show 0 in the API but not in the view
-- Execute this in Supabase Dashboard SQL Editor

-- 1. Check if student_attendance_summary view has tardy data
SELECT 
  full_name,
  tardies,
  attendance_rate,
  school_name
FROM student_attendance_summary 
WHERE tardies > 0
ORDER BY tardies DESC
LIMIT 10;

-- 2. Check what the function returns (should match the API)
SELECT 
  full_name,
  tardies,
  attendance_rate,
  school_name
FROM get_student_attendance_data(NULL, NULL, NULL, NULL, 10, 0, 'default', 'asc')
WHERE tardies > 0
ORDER BY tardies DESC
LIMIT 10;

-- 3. Check raw attendance_records for tardy_count data
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE tardy_count > 0) as records_with_tardies,
  SUM(tardy_count) as total_tardies,
  MAX(tardy_count) as max_tardy_count,
  AVG(tardy_count) FILTER (WHERE tardy_count > 0) as avg_tardies
FROM attendance_records;

-- 4. Check if there's a mismatch in date ranges between view and function
SELECT 'View vs Function Date Range Comparison' as comparison;

-- 5. Sample raw data to see the actual tardy_count values
SELECT 
  s.first_name || ' ' || s.last_name as student_name,
  ar.attendance_date,
  ar.tardy_count,
  ar.is_present,
  sch.school_name
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN schools sch ON s.school_id = sch.id
WHERE ar.tardy_count > 0
ORDER BY ar.tardy_count DESC, ar.attendance_date DESC
LIMIT 10;