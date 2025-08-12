-- Final fix for the student attendance data function
-- This addresses all type mismatches and ensures the function works properly

-- Drop the existing function completely
DROP FUNCTION IF EXISTS get_student_attendance_data CASCADE;

-- Create a new function with all correct types
CREATE OR REPLACE FUNCTION get_student_attendance_data(
  p_school_id TEXT DEFAULT NULL,
  p_grade_level INTEGER DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_sort_column TEXT DEFAULT 'default',
  p_sort_direction TEXT DEFAULT 'asc'
) 
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  grade_level INTEGER,
  current_homeroom_teacher TEXT,
  aeries_student_id TEXT,
  attendance_rate NUMERIC,
  absent_days BIGINT,
  enrolled_days BIGINT,
  present_days BIGINT,
  risk_level TEXT,
  tardies BIGINT,  -- Changed from INTEGER to BIGINT to match SUM() return type
  school_name TEXT,
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Get total count for pagination with proper UUID casting
  SELECT COUNT(*)
  INTO v_total_count
  FROM students s
  JOIN schools sch ON s.school_id = sch.id
  WHERE s.is_active = true
    AND (p_school_id IS NULL OR s.school_id = p_school_id::UUID)
    AND (p_grade_level IS NULL OR s.grade_level = p_grade_level)
    AND (p_search IS NULL OR 
         LOWER(s.first_name || ' ' || s.last_name) LIKE '%' || LOWER(p_search) || '%' OR
         LOWER(COALESCE(s.aeries_student_id, '')) LIKE '%' || LOWER(p_search) || '%');

  -- Return the main query
  RETURN QUERY
  WITH student_attendance_stats AS (
    SELECT 
      s.id,
      (s.first_name || ' ' || s.last_name) AS full_name,
      s.grade_level,
      COALESCE(s.current_homeroom_teacher, 'Staff') AS current_homeroom_teacher,
      COALESCE(s.aeries_student_id, '') AS aeries_student_id,
      sch.school_name,
      -- Calculate attendance metrics with proper handling
      COALESCE(
        COUNT(ar.id) FILTER (WHERE ar.is_present = true) * 100.0 / 
        NULLIF(COUNT(ar.id), 0), 
        100.0
      ) AS attendance_rate,
      COUNT(ar.id) FILTER (WHERE ar.is_present = false) AS absent_days,
      COUNT(ar.id) AS enrolled_days,
      COUNT(ar.id) FILTER (WHERE ar.is_present = true) AS present_days,
      -- Calculate tardies from the tardy_count column
      COALESCE(SUM(COALESCE(ar.tardy_count, 0)), 0) AS tardies
    FROM students s
    JOIN schools sch ON s.school_id = sch.id
    LEFT JOIN attendance_records ar ON s.id = ar.student_id 
      AND ar.attendance_date >= '2024-08-15' 
      AND ar.attendance_date <= '2025-06-12'
    WHERE s.is_active = true
      AND (p_school_id IS NULL OR s.school_id = p_school_id::UUID)
      AND (p_grade_level IS NULL OR s.grade_level = p_grade_level)
      AND (p_search IS NULL OR 
           LOWER(s.first_name || ' ' || s.last_name) LIKE '%' || LOWER(p_search) || '%' OR
           LOWER(COALESCE(s.aeries_student_id, '')) LIKE '%' || LOWER(p_search) || '%')
    GROUP BY s.id, s.first_name, s.last_name, s.grade_level, 
             s.current_homeroom_teacher, s.aeries_student_id, sch.school_name
  )
  SELECT 
    sas.id,
    sas.full_name::TEXT,
    sas.grade_level,
    sas.current_homeroom_teacher::TEXT,
    sas.aeries_student_id::TEXT,
    ROUND(sas.attendance_rate, 1),
    sas.absent_days,
    sas.enrolled_days,
    sas.present_days,
    -- Determine risk level based on attendance rate
    CASE 
      WHEN sas.attendance_rate >= 95 THEN 'low'::TEXT
      WHEN sas.attendance_rate >= 90 THEN 'medium'::TEXT
      ELSE 'high'::TEXT
    END AS risk_level,
    sas.tardies,
    sas.school_name::TEXT,
    v_total_count
  FROM student_attendance_stats sas
  WHERE (p_tier IS NULL OR 
         (p_tier = 'Tier 1' AND sas.attendance_rate >= 95) OR
         (p_tier = 'Tier 2' AND sas.attendance_rate >= 90 AND sas.attendance_rate < 95) OR
         (p_tier = 'Tier 3' AND sas.attendance_rate < 90))
  ORDER BY 
    CASE 
      WHEN p_sort_column = 'name' AND p_sort_direction = 'asc' THEN sas.full_name
      WHEN p_sort_column = 'attendanceRate' AND p_sort_direction = 'asc' THEN sas.attendance_rate::TEXT
      WHEN p_sort_column = 'grade' AND p_sort_direction = 'asc' THEN sas.grade_level::TEXT
      ELSE sas.full_name
    END ASC,
    CASE 
      WHEN p_sort_column = 'name' AND p_sort_direction = 'desc' THEN sas.full_name
      WHEN p_sort_column = 'attendanceRate' AND p_sort_direction = 'desc' THEN sas.attendance_rate::TEXT
      WHEN p_sort_column = 'grade' AND p_sort_direction = 'desc' THEN sas.grade_level::TEXT
      ELSE NULL
    END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_student_attendance_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_attendance_data TO service_role;

-- Test the function to make sure it works
SELECT 'Testing function...' as status;
SELECT COUNT(*) as test_result FROM get_student_attendance_data(NULL, NULL, NULL, NULL, 1, 0, 'default', 'asc');