-- Quick diagnostic for Heritage, Mountain View, and Romoland Elementary
-- Check attendance_records data for the corrected school codes

-- 1. Check attendance records for the corrected school codes (1, 2, 3)
SELECT 
  school_code,
  COUNT(*) as attendance_records,
  COUNT(DISTINCT aeries_student_id) as unique_students,
  COUNT(DISTINCT attendance_date) as unique_dates
FROM attendance_records 
WHERE school_code IN ('1', '2', '3')
GROUP BY school_code
ORDER BY school_code;

-- 2. Check which schools these codes correspond to
SELECT 
  s.school_name,
  s.aeries_school_code,
  COUNT(ar.*) as attendance_records
FROM schools s
LEFT JOIN attendance_records ar ON s.aeries_school_code = ar.school_code
WHERE s.school_name IN (
  'Heritage Elementary School',
  'Mountain View Elementary School', 
  'Romoland Elementary School'
)
GROUP BY s.school_name, s.aeries_school_code
ORDER BY s.school_name;

-- 3. Check student assignments for these schools
SELECT 
  s.school_name,
  COUNT(st.*) as enrolled_students
FROM schools s
LEFT JOIN students st ON s.id = st.school_id
WHERE s.school_name IN (
  'Heritage Elementary School',
  'Mountain View Elementary School', 
  'Romoland Elementary School'
)
GROUP BY s.school_name
ORDER BY s.school_name;

-- 4. Check what's in the grade_attendance_summaries view for these schools
SELECT 
  school_name,
  grade_level,
  total_students,
  attendance_rate,
  chronic_absentees
FROM grade_attendance_summaries
WHERE school_name IN (
  'Heritage Elementary School',
  'Mountain View Elementary School', 
  'Romoland Elementary School'
)
ORDER BY school_name, grade_level;

-- 5. Check if there are any attendance records at all for students from these schools
WITH school_students AS (
  SELECT st.aeries_student_id, s.school_name, s.aeries_school_code
  FROM students st
  JOIN schools s ON st.school_id = s.id
  WHERE s.school_name IN (
    'Heritage Elementary School',
    'Mountain View Elementary School', 
    'Romoland Elementary School'
  )
)
SELECT 
  ss.school_name,
  COUNT(DISTINCT ss.aeries_student_id) as students_assigned,
  COUNT(ar.*) as attendance_records_found,
  STRING_AGG(DISTINCT ar.school_code, ', ') as found_school_codes
FROM school_students ss
LEFT JOIN attendance_records ar ON ss.aeries_student_id = ar.aeries_student_id
GROUP BY ss.school_name
ORDER BY ss.school_name;