-- Comprehensive diagnostic to identify missing data for the three affected schools
-- Heritage, Mountain View, and Romoland Elementary

-- 1. Get the baseline - what we actually have in the database
SELECT 'CURRENT DATABASE STATE' as section;

SELECT 
  s.school_name,
  s.aeries_school_code,
  COUNT(DISTINCT st.aeries_student_id) as students_in_db,
  COUNT(DISTINCT ar.aeries_student_id) as students_with_attendance,
  COUNT(ar.*) as total_attendance_records,
  COUNT(CASE WHEN ar.is_present = true THEN 1 END) as present_records,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as absent_records
FROM schools s
LEFT JOIN students st ON s.id = st.school_id
LEFT JOIN attendance_records ar ON st.aeries_student_id = ar.aeries_student_id AND s.aeries_school_code = ar.school_code
WHERE s.school_name IN (
  'Heritage Elementary School',
  'Mountain View Elementary School', 
  'Romoland Elementary School'
)
GROUP BY s.school_name, s.aeries_school_code
ORDER BY s.school_name;

-- 2. Check if students exist but have NO attendance records at all
SELECT 'STUDENTS WITHOUT ATTENDANCE' as section;

SELECT 
  s.school_name,
  COUNT(st.aeries_student_id) as students_without_attendance
FROM schools s
JOIN students st ON s.id = st.school_id
LEFT JOIN attendance_records ar ON st.aeries_student_id = ar.aeries_student_id
WHERE s.school_name IN (
  'Heritage Elementary School',
  'Mountain View Elementary School', 
  'Romoland Elementary School'
)
AND ar.aeries_student_id IS NULL
GROUP BY s.school_name
ORDER BY s.school_name;

-- 3. Check if there are attendance records for these school codes but no matching students
SELECT 'ATTENDANCE WITHOUT STUDENTS' as section;

SELECT 
  ar.school_code,
  COUNT(DISTINCT ar.aeries_student_id) as students_in_attendance,
  COUNT(DISTINCT st.aeries_student_id) as students_in_students_table,
  COUNT(DISTINCT ar.aeries_student_id) - COUNT(DISTINCT st.aeries_student_id) as orphaned_attendance_records
FROM attendance_records ar
LEFT JOIN students st ON ar.aeries_student_id = st.aeries_student_id
LEFT JOIN schools s ON st.school_id = s.id AND s.aeries_school_code = ar.school_code
WHERE ar.school_code IN ('1', '2', '3')
GROUP BY ar.school_code
ORDER BY ar.school_code;

-- 4. Compare with other schools to see if these numbers make sense
SELECT 'COMPARISON WITH OTHER SCHOOLS' as section;

SELECT 
  s.school_name,
  s.aeries_school_code,
  COUNT(DISTINCT st.aeries_student_id) as students_enrolled,
  COUNT(ar.*) as attendance_records,
  CASE 
    WHEN COUNT(ar.*) > 0 
    THEN ROUND(COUNT(ar.*)::numeric / COUNT(DISTINCT st.aeries_student_id)::numeric, 1)
    ELSE 0 
  END as avg_records_per_student
FROM schools s
LEFT JOIN students st ON s.id = st.school_id
LEFT JOIN attendance_records ar ON st.aeries_student_id = ar.aeries_student_id
GROUP BY s.school_name, s.aeries_school_code
HAVING COUNT(DISTINCT st.aeries_student_id) > 0
ORDER BY COUNT(DISTINCT st.aeries_student_id) DESC;

-- 5. Check if there are students in attendance_records but not in students table
SELECT 'MISSING STUDENTS IN STUDENTS TABLE' as section;

SELECT 
  ar.school_code,
  COUNT(DISTINCT ar.aeries_student_id) as unique_students_in_attendance,
  COUNT(DISTINCT st.aeries_student_id) as students_found_in_students_table,
  COUNT(DISTINCT ar.aeries_student_id) - COUNT(DISTINCT st.aeries_student_id) as missing_from_students_table
FROM attendance_records ar
LEFT JOIN students st ON ar.aeries_student_id = st.aeries_student_id
WHERE ar.school_code IN ('1', '2', '3')
GROUP BY ar.school_code
ORDER BY ar.school_code;

-- 6. Sample of students who have attendance but aren't in students table
SELECT 'SAMPLE ORPHANED ATTENDANCE RECORDS' as section;

SELECT 
  ar.school_code,
  ar.aeries_student_id,
  COUNT(*) as attendance_record_count,
  MIN(ar.attendance_date) as first_date,
  MAX(ar.attendance_date) as last_date
FROM attendance_records ar
LEFT JOIN students st ON ar.aeries_student_id = st.aeries_student_id
WHERE ar.school_code IN ('1', '2', '3')
AND st.aeries_student_id IS NULL
GROUP BY ar.school_code, ar.aeries_student_id
ORDER BY ar.school_code, attendance_record_count DESC
LIMIT 20;

-- 7. Check date ranges to see if sync is incomplete
SELECT 'DATE RANGE ANALYSIS' as section;

SELECT 
  ar.school_code,
  MIN(ar.attendance_date) as earliest_date,
  MAX(ar.attendance_date) as latest_date,
  COUNT(DISTINCT ar.attendance_date) as unique_dates_with_data,
  COUNT(*) as total_records
FROM attendance_records ar
WHERE ar.school_code IN ('1', '2', '3')
GROUP BY ar.school_code
ORDER BY ar.school_code;

-- 8. Final summary of the data gap
SELECT 'DATA GAP SUMMARY' as section;

WITH attendance_summary AS (
  SELECT 
    school_code,
    COUNT(DISTINCT aeries_student_id) as students_with_attendance
  FROM attendance_records 
  WHERE school_code IN ('1', '2', '3')
  GROUP BY school_code
),
students_summary AS (
  SELECT 
    s.aeries_school_code,
    COUNT(st.aeries_student_id) as students_enrolled
  FROM schools s
  JOIN students st ON s.id = st.school_id
  WHERE s.school_name IN (
    'Heritage Elementary School',
    'Mountain View Elementary School', 
    'Romoland Elementary School'
  )
  GROUP BY s.aeries_school_code
)
SELECT 
  s.school_name,
  s.aeries_school_code,
  COALESCE(ss.students_enrolled, 0) as students_in_students_table,
  COALESCE(ats.students_with_attendance, 0) as students_with_attendance_records,
  COALESCE(ats.students_with_attendance, 0) - COALESCE(ss.students_enrolled, 0) as data_mismatch
FROM schools s
LEFT JOIN students_summary ss ON s.aeries_school_code = ss.aeries_school_code
LEFT JOIN attendance_summary ats ON s.aeries_school_code = ats.school_code
WHERE s.school_name IN (
  'Heritage Elementary School',
  'Mountain View Elementary School', 
  'Romoland Elementary School'
)
ORDER BY s.school_name;