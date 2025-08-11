-- Create optimized functions for district-wide timeline queries
-- These functions will be called by the API for better performance

-- Function 1: Get district-wide timeline data (used by the API)
CREATE OR REPLACE FUNCTION get_district_timeline_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_school_year TEXT DEFAULT '2024-2025',
  p_grade_filter TEXT DEFAULT ''
)
RETURNS TABLE (
  summary_date DATE,
  grade_level INTEGER,
  total_daily_absences BIGINT,
  total_cumulative_absences BIGINT,
  total_students BIGINT,
  avg_attendance_rate NUMERIC,
  avg_absence_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use the materialized view for performance
  RETURN QUERY
  SELECT 
    dts.summary_date,
    dts.grade_level,
    dts.daily_absences as total_daily_absences,
    dts.cumulative_absences as total_cumulative_absences,
    dts.total_students,
    dts.attendance_rate as avg_attendance_rate,
    dts.absence_rate as avg_absence_rate
  FROM district_timeline_summary dts
  WHERE dts.summary_date >= p_start_date
    AND dts.summary_date <= p_end_date
    AND dts.school_year = p_school_year
    AND (p_grade_filter = '' OR ('AND grade_level = ANY(ARRAY[' || p_grade_filter || '])'))
  ORDER BY dts.summary_date, dts.grade_level;
END;
$$;

-- Function 2: Get school-specific timeline data
CREATE OR REPLACE FUNCTION get_school_timeline_summary(
  p_school_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_school_year TEXT DEFAULT '2024-2025'
)
RETURNS TABLE (
  summary_date DATE,
  grade_level INTEGER,
  daily_absences INTEGER,
  cumulative_absences INTEGER,
  total_students INTEGER,
  attendance_rate NUMERIC,
  absence_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gts.summary_date,
    gts.grade_level,
    gts.daily_absences,
    gts.cumulative_absences,
    gts.total_students,
    gts.attendance_rate,
    gts.absence_rate
  FROM grade_attendance_timeline_summary gts
  WHERE gts.school_id = p_school_id
    AND gts.summary_date >= p_start_date
    AND gts.summary_date <= p_end_date
    AND gts.school_year = p_school_year
    AND gts.is_school_day = true
  ORDER BY gts.summary_date, gts.grade_level;
END;
$$;

-- Function 3: Get all schools with their timeline data availability
CREATE OR REPLACE FUNCTION get_schools_with_timeline_data()
RETURNS TABLE (
  school_id UUID,
  school_name TEXT,
  school_code TEXT,
  earliest_date DATE,
  latest_date DATE,
  total_timeline_records BIGINT,
  grades_available INTEGER[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as school_id,
    s.school_name,
    s.school_code,
    MIN(gts.summary_date) as earliest_date,
    MAX(gts.summary_date) as latest_date,
    COUNT(gts.id) as total_timeline_records,
    ARRAY_AGG(DISTINCT gts.grade_level ORDER BY gts.grade_level) as grades_available
  FROM schools s
  LEFT JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
  WHERE s.is_active = true
  GROUP BY s.id, s.school_name, s.school_code
  ORDER BY s.school_name;
END;
$$;

-- Function 4: Refresh timeline data for a specific date range
CREATE OR REPLACE FUNCTION refresh_timeline_for_date_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Delete existing records for the date range
  DELETE FROM grade_attendance_timeline_summary
  WHERE summary_date >= p_start_date 
    AND summary_date <= p_end_date;

  -- Recreate timeline data from attendance records
  INSERT INTO grade_attendance_timeline_summary (
    school_id, grade_level, summary_date, total_students, students_present, 
    students_absent, daily_absences, cumulative_absences, excused_absences, 
    unexcused_absences, tardy_count, chronic_absent_count, attendance_rate, 
    absence_rate, school_year, is_school_day, created_at, updated_at
  )
  SELECT 
    ar.school_id,
    st.grade_level,
    ar.attendance_date as summary_date,
    COUNT(*) as total_students,
    COUNT(CASE WHEN ar.is_present = true THEN 1 END) as students_present,
    COUNT(CASE WHEN ar.is_present = false THEN 1 END) as students_absent,
    COUNT(CASE WHEN ar.is_present = false THEN 1 END) as daily_absences,
    0 as cumulative_absences, -- Will be calculated after
    COUNT(CASE WHEN ar.is_present = false AND ar.absence_type IN ('EXCUSED_ABSENT', 'PARTIAL_DAY') THEN 1 END) as excused_absences,
    COUNT(CASE WHEN ar.is_present = false AND ar.absence_type = 'UNEXCUSED_ABSENT' THEN 1 END) as unexcused_absences,
    COUNT(CASE WHEN ar.absence_type = 'TARDY' THEN 1 END) as tardy_count,
    0 as chronic_absent_count,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN ar.is_present = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2) ELSE 100.00 END as attendance_rate,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2) ELSE 0.00 END as absence_rate,
    '2024-2025' as school_year,
    true as is_school_day,
    NOW() as created_at,
    NOW() as updated_at
  FROM attendance_records ar
  JOIN students st ON ar.student_id = st.id
  JOIN schools s ON ar.school_id = s.id
  WHERE ar.attendance_date >= p_start_date
    AND ar.attendance_date <= p_end_date
    AND s.is_active = true
    AND st.grade_level IS NOT NULL
    AND st.grade_level BETWEEN 1 AND 5
    AND EXTRACT(DOW FROM ar.attendance_date) NOT IN (0, 6)
  GROUP BY ar.school_id, st.grade_level, ar.attendance_date
  HAVING COUNT(*) > 0;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  -- Recalculate cumulative absences
  UPDATE grade_attendance_timeline_summary 
  SET cumulative_absences = subquery.cumulative_total
  FROM (
    SELECT 
      id,
      SUM(daily_absences) OVER (
        PARTITION BY school_id, grade_level 
        ORDER BY summary_date 
        ROWS UNBOUNDED PRECEDING
      ) as cumulative_total
    FROM grade_attendance_timeline_summary
    WHERE summary_date >= p_start_date AND summary_date <= p_end_date
  ) subquery
  WHERE grade_attendance_timeline_summary.id = subquery.id;

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW district_timeline_summary;

  RETURN 'Refreshed ' || affected_rows || ' timeline records for date range ' || p_start_date || ' to ' || p_end_date;
END;
$$;

-- Function 5: Get timeline statistics
CREATE OR REPLACE FUNCTION get_timeline_statistics()
RETURNS TABLE (
  metric TEXT,
  value BIGINT,
  details TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Total Timeline Records'::TEXT as metric,
    COUNT(*)::BIGINT as value,
    ('Schools: ' || COUNT(DISTINCT school_id) || ', Grades: ' || COUNT(DISTINCT grade_level) || ', Date Range: ' || MIN(summary_date) || ' to ' || MAX(summary_date))::TEXT as details
  FROM grade_attendance_timeline_summary
  UNION ALL
  SELECT 
    'District Records'::TEXT as metric,
    COUNT(*)::BIGINT as value,
    ('Grades: ' || COUNT(DISTINCT grade_level) || ', Date Range: ' || MIN(summary_date) || ' to ' || MAX(summary_date))::TEXT as details
  FROM district_timeline_summary
  UNION ALL
  SELECT 
    'Total Students in Timeline'::TEXT as metric,
    SUM(DISTINCT total_students)::BIGINT as value,
    ('Average Daily Absences: ' || ROUND(AVG(daily_absences), 2) || ', Average Absence Rate: ' || ROUND(AVG(absence_rate), 2) || '%')::TEXT as details
  FROM grade_attendance_timeline_summary;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_district_timeline_summary(DATE, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_school_timeline_summary(UUID, DATE, DATE, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_schools_with_timeline_data() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_timeline_for_date_range(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_timeline_statistics() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_district_timeline() TO authenticated;