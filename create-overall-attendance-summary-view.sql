-- Create overall attendance summary view (across all grades) for dashboard header
-- This provides district-wide and school-specific summary statistics without grade filtering

CREATE OR REPLACE VIEW overall_attendance_summary AS
WITH attendance_stats AS (
  -- Calculate attendance statistics across all students
  SELECT 
    s.school_id,
    sch.school_name,
    sch.aeries_school_code,
    COUNT(DISTINCT s.aeries_student_id) AS total_students,
    COUNT(ar.attendance_date) AS total_attendance_records,
    COUNT(CASE WHEN ar.all_day_attendance_code = 'P' THEN 1 END) AS total_present_records,
    COUNT(CASE WHEN ar.all_day_attendance_code = 'A' THEN 1 END) AS total_absent_records,
    COUNT(DISTINCT s.grade_level) AS grade_levels_count,
    -- Calculate overall attendance rate
    CASE 
      WHEN COUNT(ar.attendance_date) > 0 
      THEN ROUND((COUNT(CASE WHEN ar.all_day_attendance_code = 'P' THEN 1 END)::numeric / COUNT(ar.attendance_date)::numeric) * 100, 2)
      ELSE 0 
    END AS attendance_rate,
    -- Calculate absence rate
    CASE 
      WHEN COUNT(ar.attendance_date) > 0 
      THEN ROUND((COUNT(CASE WHEN ar.all_day_attendance_code = 'A' THEN 1 END)::numeric / COUNT(ar.attendance_date)::numeric) * 100, 2)
      ELSE 0 
    END AS absence_rate,
    -- Date range
    MIN(ar.attendance_date) AS earliest_date,
    MAX(ar.attendance_date) AS latest_date
  FROM students s
  LEFT JOIN schools sch ON s.school_id = sch.id
  LEFT JOIN attendance_records ar ON s.aeries_student_id = ar.aeries_student_id
  WHERE s.is_active = true
  GROUP BY s.school_id, sch.school_name, sch.aeries_school_code
),
district_stats AS (
  -- Calculate district-wide statistics (all schools combined)
  SELECT 
    NULL::uuid AS school_id,
    'All Schools' AS school_name,
    'ALL' AS aeries_school_code,
    SUM(total_students) AS total_students,
    SUM(total_attendance_records) AS total_attendance_records,
    SUM(total_present_records) AS total_present_records,
    SUM(total_absent_records) AS total_absent_records,
    MAX(grade_levels_count) AS grade_levels_count, -- Max grade levels across all schools
    -- Calculate weighted average attendance rate
    CASE 
      WHEN SUM(total_attendance_records) > 0 
      THEN ROUND((SUM(total_present_records)::numeric / SUM(total_attendance_records)::numeric) * 100, 2)
      ELSE 0 
    END AS attendance_rate,
    -- Calculate weighted average absence rate
    CASE 
      WHEN SUM(total_attendance_records) > 0 
      THEN ROUND((SUM(total_absent_records)::numeric / SUM(total_attendance_records)::numeric) * 100, 2)
      ELSE 0 
    END AS absence_rate,
    MIN(earliest_date) AS earliest_date,
    MAX(latest_date) AS latest_date
  FROM attendance_stats
),
all_stats AS (
  -- Combine school-specific and district-wide stats
  SELECT *, 0 as sort_order FROM district_stats  -- District-wide first
  UNION ALL
  SELECT *, 1 as sort_order FROM attendance_stats -- Schools second
)
SELECT 
  school_id,
  school_name,
  aeries_school_code,
  total_students,
  total_attendance_records,
  total_present_records,
  total_absent_records,
  grade_levels_count,
  attendance_rate,
  absence_rate,
  earliest_date,
  latest_date
FROM all_stats
ORDER BY sort_order, school_name;

-- Grant permissions
GRANT SELECT ON overall_attendance_summary TO authenticated;
GRANT SELECT ON overall_attendance_summary TO anon;

-- Test the view
SELECT 'Testing overall_attendance_summary view' AS status;

-- Show district-wide summary
SELECT 
  'District-wide summary' AS type,
  school_name,
  total_students,
  total_absent_records AS total_absences,
  absence_rate,
  grade_levels_count,
  earliest_date,
  latest_date
FROM overall_attendance_summary 
WHERE school_id IS NULL;

-- Show school-specific summaries (first 3 schools)
SELECT 
  'School-specific summaries' AS type,
  school_name,
  total_students,
  total_absent_records AS total_absences,
  absence_rate,
  grade_levels_count
FROM overall_attendance_summary 
WHERE school_id IS NOT NULL
ORDER BY school_name
LIMIT 3;

SELECT 'Overall attendance summary view created successfully!' AS final_status;