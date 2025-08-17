-- Create sample students for testing the attendance sync
-- This allows us to test full-school-year-sync.js without needing the full Aeries student API

-- First get the school IDs
SELECT id, school_name, aeries_school_code FROM schools WHERE is_active = true ORDER BY aeries_school_code;

-- Insert sample students for each school to test the sync
-- School 1 (Romoland Elementary)
INSERT INTO students (aeries_student_id, school_id, first_name, last_name, grade_level, is_active, created_at, updated_at)
SELECT 
  (1000000 + generate_series(1, 10))::text,
  (SELECT id FROM schools WHERE aeries_school_code = '1'),
  'Student',
  'Test' || generate_series(1, 10),
  (CASE 
    WHEN generate_series(1, 10) <= 2 THEN 'K'
    WHEN generate_series(1, 10) <= 4 THEN '1'
    WHEN generate_series(1, 10) <= 6 THEN '2'
    WHEN generate_series(1, 10) <= 8 THEN '3'
    ELSE '4'
  END),
  true,
  NOW(),
  NOW();

-- School 2 (Heritage Elementary)  
INSERT INTO students (aeries_student_id, school_id, first_name, last_name, grade_level, is_active, created_at, updated_at)
SELECT 
  (2000000 + generate_series(1, 10))::text,
  (SELECT id FROM schools WHERE aeries_school_code = '2'),
  'Student',
  'Heritage' || generate_series(1, 10),
  (CASE 
    WHEN generate_series(1, 10) <= 2 THEN 'K'
    WHEN generate_series(1, 10) <= 4 THEN '1'
    WHEN generate_series(1, 10) <= 6 THEN '2'
    WHEN generate_series(1, 10) <= 8 THEN '3'
    ELSE '4'
  END),
  true,
  NOW(),
  NOW();

-- School 3 (Mountain View Elementary)
INSERT INTO students (aeries_student_id, school_id, first_name, last_name, grade_level, is_active, created_at, updated_at)
SELECT 
  (3000000 + generate_series(1, 10))::text,
  (SELECT id FROM schools WHERE aeries_school_code = '3'),
  'Student',
  'Mountain' || generate_series(1, 10),
  (CASE 
    WHEN generate_series(1, 10) <= 2 THEN 'K'
    WHEN generate_series(1, 10) <= 4 THEN '1'
    WHEN generate_series(1, 10) <= 6 THEN '2'
    WHEN generate_series(1, 10) <= 8 THEN '3'
    ELSE '4'
  END),
  true,
  NOW(),
  NOW();

-- Verify the sample data
SELECT 
  s.aeries_student_id,
  s.first_name,
  s.last_name,
  s.grade_level,
  sch.school_name,
  sch.aeries_school_code
FROM students s
JOIN schools sch ON s.school_id = sch.id
ORDER BY sch.aeries_school_code, s.aeries_student_id;

-- Show count by school
SELECT 
  sch.school_name,
  sch.aeries_school_code,
  COUNT(s.id) as student_count
FROM schools sch
LEFT JOIN students s ON s.school_id = sch.id
WHERE sch.is_active = true
GROUP BY sch.id, sch.school_name, sch.aeries_school_code
ORDER BY sch.aeries_school_code;