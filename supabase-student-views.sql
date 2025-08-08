-- Supabase Views for Student Attendance Data
-- These views pre-calculate attendance metrics for fast access
-- Run these commands in the Supabase SQL Editor

-- Drop existing views if they exist
DROP VIEW IF EXISTS student_attendance_summary CASCADE;
DROP VIEW IF EXISTS student_current_data CASCADE;

-- Create a view for current student data with attendance metrics
CREATE OR REPLACE VIEW student_attendance_summary AS
WITH attendance_metrics AS (
  SELECT 
    ar.aeries_student_id,
    COUNT(*) as total_days,
    COUNT(CASE WHEN ar.is_present = true THEN 1 END) as present_days,
    COUNT(CASE WHEN ar.is_present = false THEN 1 END) as absent_days,
    ROUND(
      CASE 
        WHEN COUNT(*) > 0 
        THEN (COUNT(CASE WHEN ar.is_present = true THEN 1 END)::numeric / COUNT(*)::numeric) * 100
        ELSE 0 
      END, 2
    ) as attendance_rate
  FROM attendance_records ar
  WHERE ar.attendance_date >= '2024-08-15'
    AND ar.attendance_date <= '2025-06-12'
  GROUP BY ar.aeries_student_id
)
SELECT 
  s.id,
  s.aeries_student_id::VARCHAR(50),
  s.first_name,
  s.last_name,
  CONCAT(s.last_name, ', ', s.first_name)::TEXT as full_name,
  s.grade_level,
  s.school_id,
  sch.school_name::VARCHAR(255),
  s.current_homeroom_teacher::VARCHAR(255),
  COALESCE(am.total_days, 0)::INTEGER as enrolled_days,
  COALESCE(am.present_days, 0)::INTEGER as present_days,
  COALESCE(am.absent_days, 0)::INTEGER as absent_days,
  COALESCE(am.attendance_rate, 0)::NUMERIC as attendance_rate,
  -- Calculate tier based on attendance rate
  CASE 
    WHEN COALESCE(am.attendance_rate, 0) >= 95 THEN 'Tier 1'
    WHEN COALESCE(am.attendance_rate, 0) >= 90 THEN 'Tier 2'
    ELSE 'Tier 3'
  END as tier,
  -- Calculate risk level
  CASE 
    WHEN COALESCE(am.attendance_rate, 0) >= 95 THEN 'low'
    WHEN COALESCE(am.attendance_rate, 0) >= 90 THEN 'medium'
    ELSE 'high'
  END as risk_level
FROM students s
INNER JOIN schools sch ON s.school_id = sch.id
LEFT JOIN attendance_metrics am ON s.aeries_student_id = am.aeries_student_id
WHERE s.is_active = true;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_summary_school 
ON students(school_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_student_attendance_summary_grade 
ON students(grade_level) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_student_attendance_summary_aeries_id 
ON students(aeries_student_id) WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON student_attendance_summary TO authenticated;
GRANT SELECT ON student_attendance_summary TO anon;

-- Create a function to get paginated student attendance data with filters and sorting
CREATE OR REPLACE FUNCTION get_student_attendance_data(
  p_school_id TEXT DEFAULT NULL,
  p_grade_level INTEGER DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_sort_column TEXT DEFAULT 'grade_level',
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
AS $$
DECLARE
  sort_clause TEXT;
BEGIN
  -- Build dynamic sort clause
  CASE p_sort_column
    WHEN 'name' THEN sort_clause := 'fs.full_name';
    WHEN 'grade' THEN sort_clause := 'fs.grade_level';
    WHEN 'attendanceRate' THEN sort_clause := 'fs.attendance_rate';
    WHEN 'absences' THEN sort_clause := 'fs.absent_days';
    ELSE sort_clause := 'fs.grade_level';
  END CASE;
  
  IF p_sort_direction = 'desc' THEN
    sort_clause := sort_clause || ' DESC';
  ELSE 
    sort_clause := sort_clause || ' ASC';
  END IF;

  RETURN QUERY EXECUTE format('
    WITH filtered_students AS (
      SELECT *
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
    ),
    counted_students AS (
      SELECT COUNT(*) as total_count FROM filtered_students
    )
    SELECT 
      fs.id,
      fs.aeries_student_id::VARCHAR(50),
      fs.full_name::TEXT,
      fs.grade_level,
      fs.school_name::VARCHAR(255),
      fs.current_homeroom_teacher::VARCHAR(255),
      fs.enrolled_days,
      fs.present_days,
      fs.absent_days,
      fs.attendance_rate,
      fs.tier::TEXT,
      fs.risk_level::TEXT,
      cs.total_count
    FROM filtered_students fs
    CROSS JOIN counted_students cs
    ORDER BY %s
    LIMIT $5
    OFFSET $6
  ', sort_clause)
  USING p_school_id, p_grade_level, p_tier, p_search, p_limit, p_offset;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_student_attendance_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_attendance_data TO anon;

-- Test the view
SELECT COUNT(*) as total_students FROM student_attendance_summary;

-- Test the function
SELECT * FROM get_student_attendance_data(
  p_school_id := 'all',
  p_grade_level := NULL,
  p_tier := NULL,
  p_search := NULL,
  p_limit := 20,
  p_offset := 0,
  p_sort_column := 'grade',
  p_sort_direction := 'asc'
);