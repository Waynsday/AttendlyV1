-- Supabase RPC function to calculate attendance tiers efficiently
-- This function should be created in Supabase Dashboard SQL Editor

CREATE OR REPLACE FUNCTION calculate_attendance_tiers(
  p_school_id UUID,
  p_grade_level INTEGER,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  tier1_count INTEGER,
  tier2_count INTEGER,
  tier3_count INTEGER
) AS $$
DECLARE
  v_tier1_count INTEGER := 0;
  v_tier2_count INTEGER := 0;
  v_tier3_count INTEGER := 0;
BEGIN
  -- Calculate attendance rates and categorize into tiers
  WITH student_attendance AS (
    SELECT 
      s.id AS student_id,
      COUNT(CASE WHEN ar.is_present THEN 1 END) AS present_days,
      COUNT(ar.id) AS total_records,
      MAX(ar.days_enrolled) AS days_enrolled
    FROM students s
    LEFT JOIN attendance_records ar ON 
      s.id = ar.student_id 
      AND ar.school_id = p_school_id
      AND ar.attendance_date BETWEEN p_start_date AND p_end_date
    WHERE 
      s.school_id = p_school_id
      AND s.grade_level = p_grade_level
      AND s.is_active = true
    GROUP BY s.id
  ),
  attendance_rates AS (
    SELECT 
      student_id,
      CASE 
        WHEN COALESCE(days_enrolled, 0) > 0 THEN 
          (present_days::NUMERIC / days_enrolled) * 100
        WHEN total_records > 0 THEN 
          (present_days::NUMERIC / total_records) * 100
        ELSE 
          100 -- New students default to 100%
      END AS attendance_rate
    FROM student_attendance
  )
  SELECT 
    COUNT(CASE WHEN attendance_rate >= 95 THEN 1 END),
    COUNT(CASE WHEN attendance_rate >= 90 AND attendance_rate < 95 THEN 1 END),
    COUNT(CASE WHEN attendance_rate < 90 THEN 1 END)
  INTO v_tier1_count, v_tier2_count, v_tier3_count
  FROM attendance_rates;

  RETURN QUERY
  SELECT v_tier1_count, v_tier2_count, v_tier3_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_attendance_tiers(UUID, INTEGER, DATE, DATE) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION calculate_attendance_tiers IS 'Calculates attendance tier distribution for a specific grade level at a school within a date range. Tier 1: >=95%, Tier 2: 90-94.9%, Tier 3: <90%';