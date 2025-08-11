-- Final fix: Make the function use the same tardy data as the view
-- Execute this in Supabase Dashboard SQL Editor

-- Option 1: Update the function to query from student_attendance_summary view directly
-- This ensures consistency between /api/students and /api/students-fast

DROP FUNCTION IF EXISTS get_student_attendance_data CASCADE;

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
  tardies BIGINT,
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
  FROM student_attendance_summary sas
  JOIN schools sch ON sas.school_id = sch.id
  WHERE (p_school_id IS NULL OR sas.school_id = p_school_id::UUID)
    AND (p_grade_level IS NULL OR sas.grade_level = p_grade_level)
    AND (p_search IS NULL OR 
         LOWER(sas.first_name || ' ' || sas.last_name) LIKE '%' || LOWER(p_search) || '%' OR
         LOWER(COALESCE(sas.aeries_student_id, '')) LIKE '%' || LOWER(p_search) || '%');

  -- Return data directly from student_attendance_summary view
  -- This ensures consistency with /api/students endpoint
  RETURN QUERY
  SELECT 
    sas.id,
    (sas.first_name || ' ' || sas.last_name)::TEXT AS full_name,
    sas.grade_level,
    COALESCE(sas.current_homeroom_teacher, 'Staff')::TEXT,
    COALESCE(sas.aeries_student_id, '')::TEXT,
    COALESCE(sas.attendance_rate, 0)::NUMERIC,
    COALESCE(sas.absent_days, 0)::BIGINT,
    COALESCE(sas.enrolled_days, 0)::BIGINT, 
    COALESCE(sas.present_days, 0)::BIGINT,
    -- Determine risk level based on attendance rate
    CASE 
      WHEN COALESCE(sas.attendance_rate, 0) >= 95 THEN 'low'::TEXT
      WHEN COALESCE(sas.attendance_rate, 0) >= 90 THEN 'medium'::TEXT
      ELSE 'high'::TEXT
    END AS risk_level,
    COALESCE(sas.tardies, 0)::BIGINT,  -- Use tardies directly from the view
    sch.school_name::TEXT,
    v_total_count
  FROM student_attendance_summary sas
  JOIN schools sch ON sas.school_id = sch.id
  WHERE (p_school_id IS NULL OR sas.school_id = p_school_id::UUID)
    AND (p_grade_level IS NULL OR sas.grade_level = p_grade_level)
    AND (p_search IS NULL OR 
         LOWER(sas.first_name || ' ' || sas.last_name) LIKE '%' || LOWER(p_search) || '%' OR
         LOWER(COALESCE(sas.aeries_student_id, '')) LIKE '%' || LOWER(p_search) || '%')
    AND (p_tier IS NULL OR 
         (p_tier = 'Tier 1' AND COALESCE(sas.attendance_rate, 0) >= 95) OR
         (p_tier = 'Tier 2' AND COALESCE(sas.attendance_rate, 0) >= 90 AND COALESCE(sas.attendance_rate, 0) < 95) OR
         (p_tier = 'Tier 3' AND COALESCE(sas.attendance_rate, 0) < 90))
  ORDER BY 
    CASE 
      WHEN p_sort_column = 'name' AND p_sort_direction = 'asc' THEN sas.first_name || ' ' || sas.last_name
      WHEN p_sort_column = 'attendanceRate' AND p_sort_direction = 'asc' THEN sas.attendance_rate::TEXT
      WHEN p_sort_column = 'grade' AND p_sort_direction = 'asc' THEN sas.grade_level::TEXT
      ELSE sas.first_name || ' ' || sas.last_name
    END ASC,
    CASE 
      WHEN p_sort_column = 'name' AND p_sort_direction = 'desc' THEN sas.first_name || ' ' || sas.last_name
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

-- Test the function
SELECT 'Function updated to use student_attendance_summary view directly' as status;
SELECT 
  full_name,
  tardies,
  attendance_rate
FROM get_student_attendance_data(NULL, NULL, NULL, NULL, 5, 0, 'default', 'asc')
WHERE tardies > 0
LIMIT 3;