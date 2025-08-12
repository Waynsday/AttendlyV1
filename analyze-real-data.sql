-- Analyze real attendance data in Supabase
-- Run these queries to understand the current data structure

-- 1. Check what real attendance data we have
SELECT 
  COUNT(*) as total_attendance_records,
  MIN(attendance_date) as earliest_date,
  MAX(attendance_date) as latest_date,
  COUNT(DISTINCT student_id) as unique_students,
  COUNT(DISTINCT school_id) as unique_schools
FROM attendance_records;

-- 2. Check attendance by school and date
SELECT 
  s.school_name,
  s.school_code,
  COUNT(*) as total_records,
  MIN(ar.attendance_date) as earliest_date,
  MAX(ar.attendance_date) as latest_date,
  COUNT(DISTINCT ar.student_id) as unique_students,
  ROUND(
    (COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as absence_rate_percent
FROM attendance_records ar
JOIN schools s ON ar.school_id = s.id
WHERE s.is_active = true
GROUP BY s.school_name, s.school_code, s.id
ORDER BY s.school_name;

-- 3. Check students table for grade levels
SELECT 
  s.school_id,
  sch.school_name,
  st.grade_level,
  COUNT(*) as student_count
FROM students st
JOIN schools sch ON st.school_id = sch.id
JOIN attendance_records s ON st.id = s.student_id
WHERE sch.is_active = true AND st.grade_level IS NOT NULL
GROUP BY s.school_id, sch.school_name, st.grade_level
ORDER BY sch.school_name, st.grade_level;

-- 4. Check current timeline summary data
SELECT 
  COUNT(*) as timeline_records,
  MIN(summary_date) as earliest_summary,
  MAX(summary_date) as latest_summary,
  COUNT(DISTINCT school_id) as schools_in_timeline,
  COUNT(DISTINCT grade_level) as grades_in_timeline
FROM grade_attendance_timeline_summary;

-- 5. Sample of actual attendance data patterns
SELECT 
  ar.attendance_date,
  s.school_name,
  st.grade_level,
  COUNT(*) as total_students,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as absent_count,
  COUNT(CASE WHEN ar.is_present = true THEN 1 END) as present_count,
  ROUND(
    (COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as absence_rate_percent
FROM attendance_records ar
JOIN students st ON ar.student_id = st.id
JOIN schools s ON ar.school_id = s.id
WHERE ar.attendance_date >= '2024-08-15' 
  AND ar.attendance_date <= '2024-08-30'
  AND s.is_active = true
  AND st.grade_level IS NOT NULL
GROUP BY ar.attendance_date, s.school_name, st.grade_level, s.id
ORDER BY ar.attendance_date, s.school_name, st.grade_level
LIMIT 20;