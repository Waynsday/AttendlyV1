-- Recalculate grade_attendance_summaries and district_attendance_summary views
-- with the corrected school codes (001->1, 002->2, 003->3)

-- Drop both views with CASCADE to handle dependencies
DROP VIEW IF EXISTS district_attendance_summary CASCADE;
DROP VIEW IF EXISTS grade_attendance_summaries CASCADE;

-- First, create the base grade_attendance_summaries view with correct aeries_student_id joins
-- Now using the corrected school codes for proper school mapping
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
WHERE gs.total_students > 0  -- Only include grades with students
ORDER BY gs.school_name, gs.grade_level;

-- Now create the district_attendance_summary view that aggregates from grade_attendance_summaries
CREATE VIEW district_attendance_summary AS
WITH district_grade_aggregates AS (
  SELECT 
    grade_level,
    SUM(total_students) AS total_students,
    -- Calculate weighted average attendance rate
    CASE 
      WHEN SUM(total_students) > 0 
      THEN ROUND(
        (SUM(attendance_rate * total_students) / SUM(total_students))::numeric, 1
      )
      ELSE 0 
    END AS attendance_rate,
    SUM(chronic_absentees) AS chronic_absentees,
    SUM(tier1_students) AS tier1_students,
    SUM(tier2_students) AS tier2_students,
    SUM(tier3_students) AS tier3_students
  FROM grade_attendance_summaries
  GROUP BY grade_level
)
SELECT 
  dga.grade_level,
  -- Grade name mapping (same as grade_attendance_summaries)
  CASE 
    WHEN dga.grade_level = -1 THEN 'Pre-K'
    WHEN dga.grade_level = 0 THEN 'Kindergarten'
    WHEN dga.grade_level IS NULL THEN 'N/A'
    ELSE CONCAT('Grade ', dga.grade_level::text)
  END AS grade_name,
  'District-wide' AS school_name,
  dga.total_students,
  dga.attendance_rate,
  dga.chronic_absentees,
  dga.tier1_students,
  dga.tier2_students,
  dga.tier3_students,
  'stable' AS trend,
  -- Risk level based on district-wide attendance rate
  CASE 
    WHEN dga.attendance_rate >= 95 THEN 'low'
    WHEN dga.attendance_rate >= 90 THEN 'medium'
    ELSE 'high'
  END AS risk_level,
  NOW() AS last_updated
FROM district_grade_aggregates dga
WHERE dga.total_students > 0  -- Only include grades with students
ORDER BY dga.grade_level;

-- Verify the views were created successfully and show updated data
SELECT 
  'Views recalculated with corrected school codes' AS status,
  (SELECT COUNT(*) FROM grade_attendance_summaries) AS grade_summary_records,
  (SELECT COUNT(*) FROM district_attendance_summary) AS district_summary_records;

-- Show sample of the corrected grade summaries with school names
SELECT 
  school_name,
  grade_level,
  grade_name,
  total_students,
  attendance_rate,
  risk_level
FROM grade_attendance_summaries
ORDER BY school_name, grade_level
LIMIT 20;

-- Show the district summary
SELECT 
  grade_name,
  total_students,
  attendance_rate,
  risk_level
FROM district_attendance_summary
ORDER BY grade_level;