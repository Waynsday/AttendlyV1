-- Clean attendance_records table school_code column
-- Replace incorrect school codes with correct aeries_school_code values

-- Show current school_code distribution before cleaning
SELECT 
  school_code,
  COUNT(*) as record_count,
  COUNT(DISTINCT aeries_student_id) as unique_students
FROM attendance_records 
GROUP BY school_code 
ORDER BY school_code;

-- Update school codes according to the mapping:
-- 001 -> 1 (Romoland Elementary School)
-- 002 -> 2 (Heritage Elementary School) 
-- 003 -> 3 (Mountain View Elementary School)

-- Update 001 to 1
UPDATE attendance_records 
SET school_code = '1' 
WHERE school_code = '001';

-- Update 002 to 2
UPDATE attendance_records 
SET school_code = '2' 
WHERE school_code = '002';

-- Update 003 to 3
UPDATE attendance_records 
SET school_code = '3' 
WHERE school_code = '003';

-- Show the results after cleaning
SELECT 
  school_code,
  COUNT(*) as record_count,
  COUNT(DISTINCT aeries_student_id) as unique_students
FROM attendance_records 
GROUP BY school_code 
ORDER BY school_code;

-- Verify the school codes now match the schools table
SELECT 
  s.school_name,
  s.aeries_school_code,
  COUNT(ar.id) as attendance_records
FROM schools s
LEFT JOIN attendance_records ar ON s.aeries_school_code = ar.school_code
GROUP BY s.school_name, s.aeries_school_code
ORDER BY s.school_name;

-- Show success message
SELECT 'Attendance records school_code cleanup completed successfully' as status;