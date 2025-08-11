-- Debug the function call to see actual vs expected types
-- Execute this in Supabase Dashboard SQL Editor

-- Test the function with minimal parameters to see what it returns
SELECT * FROM get_student_attendance_data(
  p_school_id := NULL,
  p_grade_level := NULL,
  p_tier := NULL,
  p_search := NULL,
  p_limit := 3,
  p_offset := 0,
  p_sort_column := 'default',
  p_sort_direction := 'asc'
) LIMIT 3;

-- Also test with a specific school ID to check UUID casting
-- (Replace '001' with an actual school ID from your database)
SELECT * FROM get_student_attendance_data(
  p_school_id := '001',
  p_grade_level := NULL,
  p_tier := NULL,
  p_search := NULL,
  p_limit := 2,
  p_offset := 0,
  p_sort_column := 'default',
  p_sort_direction := 'asc'
) LIMIT 2;