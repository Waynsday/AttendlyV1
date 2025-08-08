-- Supabase RPC function to get grade-level attendance summaries efficiently
-- This function should be created in Supabase Dashboard SQL Editor

CREATE OR REPLACE FUNCTION get_grade_attendance_summaries(
  p_school_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  grade_level INTEGER,
  school_name TEXT,
  total_students INTEGER,
  attendance_rate NUMERIC,
  chronic_absentees INTEGER,
  tier1_count INTEGER,
  tier2_count INTEGER,
  tier3_count INTEGER,
  monthly_rates JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH grade_students AS (
    -- Get all active students grouped by grade
    SELECT 
      s.grade_level,
      sch.school_name,
      s.id AS student_id
    FROM students s
    JOIN schools sch ON s.school_id = sch.id
    WHERE 
      s.school_id = p_school_id
      AND s.is_active = true
  ),
  student_attendance_stats AS (
    -- Calculate attendance stats per student
    SELECT 
      gs.grade_level,
      gs.school_name,
      gs.student_id,
      COUNT(CASE WHEN ar.is_present THEN 1 END) AS present_days,
      COUNT(ar.id) AS total_records,
      MAX(ar.days_enrolled) AS days_enrolled
    FROM grade_students gs
    LEFT JOIN attendance_records ar ON 
      gs.student_id = ar.student_id
      AND ar.attendance_date BETWEEN p_start_date AND p_end_date
    GROUP BY gs.grade_level, gs.school_name, gs.student_id
  ),
  student_rates AS (
    -- Calculate attendance rate per student
    SELECT 
      grade_level,
      school_name,
      student_id,
      CASE 
        WHEN COALESCE(days_enrolled, 0) > 0 THEN 
          (present_days::NUMERIC / days_enrolled) * 100
        WHEN total_records > 0 THEN 
          (present_days::NUMERIC / total_records) * 100
        ELSE 
          100 -- New students default to 100%
      END AS attendance_rate
    FROM student_attendance_stats
  ),
  grade_summaries AS (
    -- Aggregate by grade level
    SELECT 
      sr.grade_level,
      sr.school_name,
      COUNT(DISTINCT sr.student_id) AS total_students,
      AVG(sr.attendance_rate) AS attendance_rate,
      COUNT(CASE WHEN sr.attendance_rate < 90 THEN 1 END) AS chronic_absentees,
      COUNT(CASE WHEN sr.attendance_rate >= 95 THEN 1 END) AS tier1_count,
      COUNT(CASE WHEN sr.attendance_rate >= 90 AND sr.attendance_rate < 95 THEN 1 END) AS tier2_count,
      COUNT(CASE WHEN sr.attendance_rate < 90 THEN 1 END) AS tier3_count
    FROM student_rates sr
    GROUP BY sr.grade_level, sr.school_name
  ),
  monthly_attendance AS (
    -- Calculate monthly attendance rates
    SELECT 
      gs.grade_level,
      DATE_TRUNC('month', ar.attendance_date) AS month,
      COUNT(CASE WHEN ar.is_present THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100 AS rate
    FROM grade_students gs
    LEFT JOIN attendance_records ar ON 
      gs.student_id = ar.student_id
      AND ar.attendance_date BETWEEN p_start_date AND p_end_date
    WHERE ar.id IS NOT NULL
    GROUP BY gs.grade_level, DATE_TRUNC('month', ar.attendance_date)
  ),
  monthly_json AS (
    -- Convert monthly data to JSON
    SELECT 
      grade_level,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'month', TO_CHAR(month, 'Mon'),
          'rate', ROUND(rate, 1)
        ) ORDER BY month
      ) AS monthly_rates
    FROM monthly_attendance
    GROUP BY grade_level
  )
  SELECT 
    gs.grade_level,
    gs.school_name,
    gs.total_students,
    ROUND(gs.attendance_rate, 1) AS attendance_rate,
    gs.chronic_absentees,
    gs.tier1_count,
    gs.tier2_count,
    gs.tier3_count,
    COALESCE(mj.monthly_rates, '[]'::JSONB) AS monthly_rates
  FROM grade_summaries gs
  LEFT JOIN monthly_json mj ON gs.grade_level = mj.grade_level
  WHERE gs.total_students > 0
  ORDER BY gs.grade_level;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_grade_attendance_summaries(UUID, DATE, DATE) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_grade_attendance_summaries IS 'Returns grade-level attendance summaries for a school including tier distributions and monthly trends';