-- Fix for pagination issue - drop and recreate the function
DROP FUNCTION IF EXISTS get_student_attendance_data(TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT);

-- Create a function to get paginated student attendance data with filters and sorting
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
  aeries_student_id VARCHAR(50),
  full_name TEXT,
  grade_level INTEGER,
  school_name VARCHAR(255),
  current_homeroom_teacher VARCHAR(255),
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
  -- Build dynamic sort clause
  CASE p_sort_column
    WHEN 'name' THEN 
      IF p_sort_direction = 'desc' THEN
        sort_clause := 'last_name DESC NULLS LAST, first_name DESC NULLS LAST';
      ELSE
        sort_clause := 'last_name ASC NULLS LAST, first_name ASC NULLS LAST';
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
    ELSE -- default sorting: Tier 3 first, then by last name
      sort_clause := 'CASE WHEN tier = ''Tier 3'' THEN 1 WHEN tier = ''Tier 2'' THEN 2 WHEN tier = ''Tier 1'' THEN 3 ELSE 4 END, last_name ASC NULLS LAST, first_name ASC NULLS LAST';
  END CASE;

  -- First, get the total count
  SELECT COUNT(*) INTO total_record_count
  FROM student_attendance_summary sas
  WHERE 
    (p_school_id IS NULL OR p_school_id = 'all' OR sas.school_id = p_school_id::UUID)
    AND (p_grade_level IS NULL OR sas.grade_level = p_grade_level)
    AND (p_tier IS NULL OR p_tier = 'all' OR 
         CASE 
           WHEN p_tier = '1' THEN sas.tier = 'Tier 1'
           WHEN p_tier = '2' THEN sas.tier = 'Tier 2'
           WHEN p_tier = '3' THEN sas.tier = 'Tier 3'
           ELSE false
         END)
    AND (p_search IS NULL OR p_search = '' OR 
         sas.full_name ILIKE '%' || p_search || '%' OR 
         sas.aeries_student_id ILIKE '%' || p_search || '%');

  -- Now return the paginated results with consistent total count
  RETURN QUERY EXECUTE format('
    SELECT 
      sas.id,
      sas.aeries_student_id::VARCHAR(50),
      sas.full_name::TEXT,
      sas.grade_level,
      sas.school_name::VARCHAR(255),
      sas.current_homeroom_teacher::VARCHAR(255),
      sas.enrolled_days,
      sas.present_days,
      sas.absent_days,
      sas.attendance_rate,
      sas.tier::TEXT,
      sas.risk_level::TEXT,
      $7::BIGINT as total_count
    FROM student_attendance_summary sas
    WHERE 
      ($1 IS NULL OR $1 = ''all'' OR sas.school_id = $1::UUID)
      AND ($2 IS NULL OR sas.grade_level = $2)
      AND ($3 IS NULL OR $3 = ''all'' OR 
           CASE 
             WHEN $3 = ''1'' THEN sas.tier = ''Tier 1''
             WHEN $3 = ''2'' THEN sas.tier = ''Tier 2''
             WHEN $3 = ''3'' THEN sas.tier = ''Tier 3''
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
  p_limit := 20,
  p_offset := 200,
  p_sort_column := 'default',
  p_sort_direction := 'asc'
);