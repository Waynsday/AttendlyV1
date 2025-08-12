-- Fix for type mismatch error in get_student_attendance_data function
-- The error occurs because the function return type doesn't match the actual column types

-- Drop the existing function
DROP FUNCTION IF EXISTS get_student_attendance_data(TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT);

-- Recreate the function with corrected return types that match the actual view columns
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
  aeries_student_id TEXT,  -- Changed from VARCHAR(50) to TEXT
  full_name TEXT,
  grade_level INTEGER,
  school_name TEXT,        -- Changed from VARCHAR(255) to TEXT
  current_homeroom_teacher TEXT,  -- Changed from VARCHAR(255) to TEXT
  enrolled_days INTEGER,
  present_days INTEGER,
  absent_days INTEGER,
  attendance_rate NUMERIC,
  tier TEXT,
  risk_level TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  sort_clause TEXT;
  total_record_count BIGINT;
BEGIN
  -- Build dynamic sort clause using available columns from the view
  CASE p_sort_column
    WHEN 'name' THEN 
      IF p_sort_direction = 'desc' THEN
        sort_clause := 'full_name DESC NULLS LAST';
      ELSE
        sort_clause := 'full_name ASC NULLS LAST';
      END IF;
    WHEN 'grade' THEN 
      IF p_sort_direction = 'desc' THEN
        sort_clause := 'grade_level DESC NULLS LAST';
      ELSE
        sort_clause := 'grade_level ASC NULLS LAST';
      END IF;
    WHEN 'attendanceRate' THEN 
      IF p_sort_direction = 'desc' THEN
        sort_clause := 'attendance_rate DESC NULLS LAST';
      ELSE
        sort_clause := 'attendance_rate ASC NULLS LAST';
      END IF;
    WHEN 'absences' THEN 
      IF p_sort_direction = 'desc' THEN
        sort_clause := 'absent_days DESC NULLS LAST';
      ELSE
        sort_clause := 'absent_days ASC NULLS LAST';
      END IF;
    ELSE -- default sorting: Tier 3 first (high risk), then by full_name
      sort_clause := 'CASE WHEN risk_level = ''high'' THEN 1 WHEN risk_level = ''medium'' THEN 2 WHEN risk_level = ''low'' THEN 3 ELSE 4 END, full_name ASC NULLS LAST';
  END CASE;

  -- First, get the total count
  SELECT COUNT(*) INTO total_record_count
  FROM student_attendance_summary sas
  WHERE 
    (p_school_id IS NULL OR p_school_id = 'all' OR sas.school_id = p_school_id::UUID)
    AND (p_grade_level IS NULL OR sas.grade_level = p_grade_level)
    AND (p_tier IS NULL OR p_tier = 'all' OR 
         CASE 
           WHEN p_tier = '1' THEN sas.risk_level = 'low'
           WHEN p_tier = '2' THEN sas.risk_level = 'medium'
           WHEN p_tier = '3' THEN sas.risk_level = 'high'
           ELSE false
         END)
    AND (p_search IS NULL OR p_search = '' OR 
         sas.full_name ILIKE '%' || p_search || '%' OR 
         sas.aeries_student_id ILIKE '%' || p_search || '%');

  -- Now return the paginated results with consistent total count
  RETURN QUERY EXECUTE format('
    SELECT 
      sas.id,
      sas.aeries_student_id::TEXT,    -- Ensure TEXT type
      sas.full_name::TEXT,
      sas.grade_level,
      sas.school_name::TEXT,          -- Ensure TEXT type
      sas.current_homeroom_teacher::TEXT,  -- Ensure TEXT type
      sas.enrolled_days,
      sas.present_days,
      sas.absent_days,
      sas.attendance_rate,
      CASE 
        WHEN sas.risk_level = ''low'' THEN ''Tier 1''
        WHEN sas.risk_level = ''medium'' THEN ''Tier 2''
        WHEN sas.risk_level = ''high'' THEN ''Tier 3''
        ELSE ''Tier 1''
      END::TEXT as tier,
      sas.risk_level::TEXT,
      $7::BIGINT as total_count
    FROM student_attendance_summary sas
    WHERE 
      ($1 IS NULL OR $1 = ''all'' OR sas.school_id = $1::UUID)
      AND ($2 IS NULL OR sas.grade_level = $2)
      AND ($3 IS NULL OR $3 = ''all'' OR 
           CASE 
             WHEN $3 = ''1'' THEN sas.risk_level = ''low''
             WHEN $3 = ''2'' THEN sas.risk_level = ''medium''
             WHEN $3 = ''3'' THEN sas.risk_level = ''high''
             ELSE false
           END)
      AND ($4 IS NULL OR $4 = '''' OR 
           sas.full_name ILIKE ''%%'' || $4 || ''%%'' OR 
           sas.aeries_student_id ILIKE ''%%'' || $4 || ''%%'')
    ORDER BY %s
    LIMIT $5
    OFFSET $6
  ', sort_clause)
  USING p_school_id, p_grade_level, p_tier, p_search, p_limit, p_offset, total_record_count;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_student_attendance_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_attendance_data TO anon;

-- Test the function
SELECT * FROM get_student_attendance_data(
  p_school_id := 'all',
  p_grade_level := NULL,
  p_tier := NULL,
  p_search := NULL,
  p_limit := 5,
  p_offset := 0,
  p_sort_column := 'default',
  p_sort_direction := 'asc'
);