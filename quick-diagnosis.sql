-- SUPER FAST diagnosis - no complex JOINs
-- Run this first to identify the exact issues

-- Quick Check 1: Which schools have no timeline data?
SELECT 
  'Schools Missing Timeline Data' as issue,
  s.school_name,
  s.school_code
FROM schools s
WHERE s.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM grade_attendance_timeline_summary gts 
    WHERE gts.school_id = s.id
  )
ORDER BY s.school_name;

-- Quick Check 2: Do these schools have attendance records?
SELECT 
  'Attendance Records Check' as check_type,
  s.school_name,
  (SELECT COUNT(*) 
   FROM attendance_records ar 
   WHERE ar.school_id = s.id 
     AND ar.attendance_date >= '2024-08-15' 
     AND ar.attendance_date <= '2024-08-30'
  ) as attendance_count,
  (SELECT MIN(attendance_date) 
   FROM attendance_records ar 
   WHERE ar.school_id = s.id
  ) as earliest_date,
  (SELECT MAX(attendance_date) 
   FROM attendance_records ar 
   WHERE ar.school_id = s.id
  ) as latest_date
FROM schools s
WHERE s.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM grade_attendance_timeline_summary gts 
    WHERE gts.school_id = s.id
  )
ORDER BY s.school_name;

-- Quick Check 3: Sample attendance data for Golden Valley specifically
SELECT 
  'Golden Valley Sample Data' as check_type,
  ar.attendance_date,
  ar.is_present,
  COUNT(*) as record_count
FROM schools s
JOIN attendance_records ar ON s.id = ar.school_id
WHERE s.school_name ILIKE '%golden%valley%'
  AND ar.attendance_date >= '2024-08-15'
  AND ar.attendance_date <= '2024-08-25'
GROUP BY ar.attendance_date, ar.is_present
ORDER BY ar.attendance_date, ar.is_present;

-- Quick Check 4: Current timeline coverage summary
SELECT 
  'Timeline Coverage Summary' as summary,
  (SELECT COUNT(*) FROM schools WHERE is_active = true) as total_active_schools,
  (SELECT COUNT(DISTINCT school_id) FROM grade_attendance_timeline_summary) as schools_with_timeline,
  (SELECT COUNT(*) FROM grade_attendance_timeline_summary) as total_timeline_records,
  (SELECT MIN(summary_date) FROM grade_attendance_timeline_summary) as earliest_timeline_date,
  (SELECT MAX(summary_date) FROM grade_attendance_timeline_summary) as latest_timeline_date;