-- VERIFY Zero Absence Schools: Heritage, Mountain View, and Romoland Elementary
-- Check raw attendance data to determine if 0 absences is accurate or a data issue

-- Step 1: Check raw attendance records for these specific schools
SELECT 
  'Raw Attendance Records Check' as analysis_type,
  s.school_name,
  s.school_code,
  COUNT(ar.id) as total_attendance_records,
  COUNT(CASE WHEN ar.is_present = true THEN 1 END) as present_records,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as absent_records,
  COUNT(CASE WHEN ar.is_present IS NULL THEN 1 END) as null_records,
  ROUND(
    COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / NULLIF(COUNT(ar.id), 0) * 100, 2
  ) as absence_percentage,
  MIN(ar.attendance_date) as earliest_date,
  MAX(ar.attendance_date) as latest_date,
  COUNT(DISTINCT ar.attendance_date) as unique_dates,
  COUNT(DISTINCT ar.student_id) as unique_students
FROM schools s
LEFT JOIN attendance_records ar ON s.id = ar.school_id
  AND ar.attendance_date >= '2024-08-15'
  AND ar.attendance_date <= '2024-10-31'  -- Focus on first semester
WHERE s.school_name IN ('Heritage Elementary', 'Mountain View Elementary', 'Romoland Elementary')
  OR s.school_name ILIKE '%heritage%'
  OR s.school_name ILIKE '%mountain%view%' 
  OR s.school_name ILIKE '%romoland%'
GROUP BY s.id, s.school_name, s.school_code
ORDER BY s.school_name;

-- Step 2: Sample actual attendance records for these schools
SELECT 
  'Sample Attendance Records' as sample_type,
  s.school_name,
  ar.attendance_date,
  ar.is_present,
  COUNT(*) as record_count,
  COUNT(DISTINCT ar.student_id) as unique_students_this_day
FROM schools s
JOIN attendance_records ar ON s.id = ar.school_id
WHERE (s.school_name ILIKE '%heritage%' 
    OR s.school_name ILIKE '%mountain%view%' 
    OR s.school_name ILIKE '%romoland%')
  AND ar.attendance_date >= '2024-08-15'
  AND ar.attendance_date <= '2024-08-25'  -- Sample first 10 days
  AND s.is_active = true
GROUP BY s.school_name, ar.attendance_date, ar.is_present
ORDER BY s.school_name, ar.attendance_date, ar.is_present;

-- Step 3: Compare with schools that DO have absences
SELECT 
  'Comparison with Other Schools' as comparison_type,
  s.school_name,
  COUNT(ar.id) as total_records,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as absent_records,
  ROUND(
    COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / NULLIF(COUNT(ar.id), 0) * 100, 2
  ) as absence_percentage
FROM schools s
JOIN attendance_records ar ON s.id = ar.school_id
WHERE s.is_active = true
  AND ar.attendance_date >= '2024-08-15'
  AND ar.attendance_date <= '2024-08-25'
GROUP BY s.id, s.school_name
HAVING COUNT(ar.id) > 0
ORDER BY absence_percentage DESC;

-- Step 4: Check if the issue is in the timeline generation
SELECT 
  'Timeline Generation Check' as check_type,
  s.school_name,
  gts.summary_date,
  gts.total_students,
  gts.students_present,
  gts.students_absent,
  gts.daily_absences,
  gts.absence_rate
FROM schools s
JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
WHERE (s.school_name ILIKE '%heritage%' 
    OR s.school_name ILIKE '%mountain%view%' 
    OR s.school_name ILIKE '%romoland%')
  AND gts.summary_date >= '2024-08-15'
  AND gts.summary_date <= '2024-08-25'
ORDER BY s.school_name, gts.summary_date;

-- Step 5: Check for data encoding issues (is_present field)
SELECT 
  'Data Encoding Check' as check_type,
  s.school_name,
  ar.is_present,
  COUNT(*) as record_count,
  -- Check if there are any non-standard values
  MIN(ar.is_present::text) as min_value,
  MAX(ar.is_present::text) as max_value
FROM schools s
JOIN attendance_records ar ON s.id = ar.school_id
WHERE (s.school_name ILIKE '%heritage%' 
    OR s.school_name ILIKE '%mountain%view%' 
    OR s.school_name ILIKE '%romoland%')
  AND ar.attendance_date >= '2024-08-15'
  AND ar.attendance_date <= '2024-08-25'
GROUP BY s.school_name, ar.is_present
ORDER BY s.school_name, ar.is_present;

-- Step 6: Check if these schools have different data patterns
SELECT 
  'School Data Pattern Analysis' as analysis_type,
  s.school_name,
  -- Check if all records are always present=true
  CASE 
    WHEN COUNT(CASE WHEN ar.is_present = false THEN 1 END) = 0 
    THEN 'ALL_PRESENT_NO_ABSENCES'
    WHEN COUNT(CASE WHEN ar.is_present = true THEN 1 END) = 0 
    THEN 'ALL_ABSENT_NO_PRESENT'
    WHEN COUNT(CASE WHEN ar.is_present IS NULL THEN 1 END) > 0
    THEN 'HAS_NULL_VALUES'
    ELSE 'NORMAL_MIXED_DATA'
  END as data_pattern,
  COUNT(*) as total_records
FROM schools s
JOIN attendance_records ar ON s.id = ar.school_id
WHERE s.is_active = true
  AND ar.attendance_date >= '2024-08-15'
  AND ar.attendance_date <= '2024-10-31'
GROUP BY s.id, s.school_name
HAVING COUNT(*) > 0
ORDER BY 
  CASE 
    WHEN COUNT(CASE WHEN ar.is_present = false THEN 1 END) = 0 THEN 0
    ELSE 1
  END,
  s.school_name;

-- Step 7: Detailed breakdown of suspicious schools (0 absence schools)
SELECT 
  'Detailed Zero-Absence School Analysis' as detailed_analysis,
  s.school_name,
  s.school_code,
  s.id as school_uuid,
  COUNT(ar.id) as total_attendance_records,
  COUNT(DISTINCT ar.student_id) as unique_students,
  COUNT(DISTINCT ar.attendance_date) as unique_dates,
  MIN(ar.attendance_date) as earliest_record,
  MAX(ar.attendance_date) as latest_record,
  -- Detailed breakdown of is_present values
  COUNT(CASE WHEN ar.is_present = true THEN 1 END) as explicitly_present,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as explicitly_absent,
  COUNT(CASE WHEN ar.is_present IS NULL THEN 1 END) as null_present_field,
  -- Check for any patterns in student IDs or dates
  COUNT(DISTINCT EXTRACT(DOW FROM ar.attendance_date)) as different_weekdays_represented
FROM schools s
JOIN attendance_records ar ON s.id = ar.school_id
WHERE s.is_active = true
  AND ar.attendance_date >= '2024-08-15'
  AND ar.attendance_date <= '2024-10-31'
GROUP BY s.id, s.school_name, s.school_code
-- Focus on schools with 0 absences
HAVING COUNT(CASE WHEN ar.is_present = false THEN 1 END) = 0
ORDER BY s.school_name;