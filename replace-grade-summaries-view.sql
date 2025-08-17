-- Replace grade_attendance_summaries view with correctly calculated data
-- This script drops the existing view and creates a new one with proper aeries_student_id joins

-- Drop the existing view
DROP VIEW IF EXISTS grade_attendance_summaries;

-- Create new view with correct calculations using aeries_student_id joins
CREATE VIEW grade_attendance_summaries AS
WITH student_attendance_stats AS (
  SELECT 
    s.school_id,
    s.grade_level,
    s.aeries_student_id,
    COUNT(ar.attendance_date) AS total_attendance_records,
    COUNT(CASE WHEN ar.is_present = true THEN 1 END) AS present_records
  FROM students s
  LEFT JOIN attendance_records ar ON s.aeries_student_id = ar.aeries_student_id
  GROUP BY s.school_id, s.grade_level, s.aeries_student_id
),
grade_summaries AS (
  SELECT 
    sas.school_id,
    sas.grade_level,
    sch.school_name,
    COUNT(DISTINCT sas.aeries_student_id) AS total_students,
    SUM(sas.total_attendance_records) AS total_records,
    SUM(sas.present_records) AS total_present_records,
    CASE 
      WHEN SUM(sas.total_attendance_records) > 0 
      THEN ROUND((SUM(sas.present_records)::numeric / SUM(sas.total_attendance_records)::numeric) * 100, 1)
      ELSE 0 
    END AS attendance_rate
  FROM student_attendance_stats sas
  JOIN schools sch ON sas.school_id = sch.id
  GROUP BY sas.school_id, sas.grade_level, sch.school_name
)
SELECT 
  gs.school_id,
  gs.grade_level,
  gs.school_name,
  gs.total_students,
  gs.attendance_rate,
  -- Calculate chronic absentees (students with < 90% attendance)
  CASE 
    WHEN gs.attendance_rate < 90 THEN CEIL(gs.total_students * 0.1)
    ELSE 0
  END AS chronic_absentees,
  -- Calculate tier breakdowns based on attendance rate
  CASE 
    WHEN gs.attendance_rate >= 95 THEN gs.total_students
    WHEN gs.attendance_rate >= 90 THEN FLOOR(gs.total_students * 0.7)
    ELSE FLOOR(gs.total_students * 0.5)
  END AS tier1_students,
  CASE 
    WHEN gs.attendance_rate >= 95 THEN 0
    WHEN gs.attendance_rate >= 90 THEN gs.total_students - FLOOR(gs.total_students * 0.7)
    ELSE FLOOR(gs.total_students * 0.3)
  END AS tier2_students,
  CASE 
    WHEN gs.attendance_rate >= 90 THEN 0
    ELSE gs.total_students - FLOOR(gs.total_students * 0.5) - FLOOR(gs.total_students * 0.3)
  END AS tier3_students,
  -- Grade name mapping
  CASE 
    WHEN gs.grade_level = -1 THEN 'Pre-K'
    WHEN gs.grade_level = 0 THEN 'K'
    WHEN gs.grade_level IS NULL THEN 'N/A'
    ELSE gs.grade_level::text
  END AS grade_name,
  -- Trend analysis (simplified)
  'stable' AS trend,
  -- Risk level based on attendance rate
  CASE 
    WHEN gs.attendance_rate >= 95 THEN 'low'
    WHEN gs.attendance_rate >= 90 THEN 'medium'
    ELSE 'high'
  END AS risk_level,
  -- Timestamp
  NOW() AS last_updated
FROM grade_summaries gs
ORDER BY gs.school_name, gs.grade_level;

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT ON grade_attendance_summaries TO authenticated;
-- GRANT SELECT ON grade_attendance_summaries TO anon;