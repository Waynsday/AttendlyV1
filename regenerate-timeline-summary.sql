-- Regenerate grade_attendance_timeline_summary table with correct aeries_student_id joins
-- This will replace all data with properly calculated daily attendance summaries per school/date/grade

-- First, let's clear the existing data
TRUNCATE TABLE grade_attendance_timeline_summary;

-- Insert recalculated data using proper joins
INSERT INTO grade_attendance_timeline_summary (
  school_id,
  grade_level,
  summary_date,
  total_students,
  students_present,
  students_absent,
  daily_absences,
  cumulative_absences,
  excused_absences,
  unexcused_absences,
  tardy_count,
  chronic_absent_count,
  attendance_rate,
  absence_rate,
  school_year,
  is_school_day,
  created_at,
  updated_at
)
WITH daily_attendance_stats AS (
  -- Get attendance data joined properly with students via aeries_student_id
  SELECT 
    s.school_id,
    s.grade_level,
    ar.attendance_date,
    s.aeries_student_id,
    ar.is_present,
    CASE WHEN ar.is_present = false THEN 1 ELSE 0 END AS is_absent,
    -- Calculate school year based on attendance date
    CASE 
      WHEN EXTRACT(MONTH FROM ar.attendance_date::date) >= 8 
      THEN CONCAT(EXTRACT(YEAR FROM ar.attendance_date::date), '-', EXTRACT(YEAR FROM ar.attendance_date::date) + 1)
      ELSE CONCAT(EXTRACT(YEAR FROM ar.attendance_date::date) - 1, '-', EXTRACT(YEAR FROM ar.attendance_date::date))
    END AS school_year
  FROM students s
  INNER JOIN attendance_records ar ON s.aeries_student_id = ar.aeries_student_id
  WHERE ar.attendance_date IS NOT NULL
),
daily_summaries AS (
  -- Aggregate by school, grade, and date
  SELECT 
    das.school_id,
    das.grade_level,
    das.attendance_date AS summary_date,
    das.school_year,
    COUNT(DISTINCT das.aeries_student_id) AS total_students,
    COUNT(CASE WHEN das.is_present = true THEN 1 END) AS students_present,
    COUNT(CASE WHEN das.is_present = false THEN 1 END) AS students_absent,
    COUNT(CASE WHEN das.is_present = false THEN 1 END) AS daily_absences,
    -- For now, set cumulative_absences equal to daily_absences (could be enhanced)
    COUNT(CASE WHEN das.is_present = false THEN 1 END) AS cumulative_absences,
    -- Placeholder values for excused/unexcused (data not available in current schema)
    0 AS excused_absences,
    COUNT(CASE WHEN das.is_present = false THEN 1 END) AS unexcused_absences,
    -- Placeholder for tardy count (data not available in current schema)
    0 AS tardy_count,
    -- Placeholder for chronic absent count (complex calculation, set to 0 for now)
    0 AS chronic_absent_count
  FROM daily_attendance_stats das
  GROUP BY 
    das.school_id, 
    das.grade_level, 
    das.attendance_date,
    das.school_year
)
SELECT 
  ds.school_id,
  ds.grade_level,
  ds.summary_date,
  ds.total_students,
  ds.students_present,
  ds.students_absent,
  ds.daily_absences,
  ds.cumulative_absences,
  ds.excused_absences,
  ds.unexcused_absences,
  ds.tardy_count,
  ds.chronic_absent_count,
  -- Calculate attendance rate
  CASE 
    WHEN ds.total_students > 0 
    THEN ROUND((ds.students_present::numeric / ds.total_students::numeric) * 100, 2)
    ELSE 0 
  END AS attendance_rate,
  -- Calculate absence rate
  CASE 
    WHEN ds.total_students > 0 
    THEN ROUND((ds.students_absent::numeric / ds.total_students::numeric) * 100, 2)
    ELSE 0 
  END AS absence_rate,
  ds.school_year,
  true AS is_school_day, -- Assume all dates in attendance_records are school days
  NOW() AS created_at,
  NOW() AS updated_at
FROM daily_summaries ds
ORDER BY ds.summary_date, ds.school_id, ds.grade_level;

-- Verify the results
SELECT 
  'Timeline summary regenerated' AS status,
  COUNT(*) AS total_records,
  COUNT(DISTINCT summary_date) AS unique_dates,
  COUNT(DISTINCT school_id) AS unique_schools,
  COUNT(DISTINCT grade_level) AS unique_grades,
  MIN(summary_date) AS earliest_date,
  MAX(summary_date) AS latest_date
FROM grade_attendance_timeline_summary;

-- Show sample of regenerated data
SELECT 
  summary_date,
  s.school_name,
  gats.grade_level,
  gats.total_students,
  gats.students_present,
  gats.attendance_rate
FROM grade_attendance_timeline_summary gats
JOIN schools s ON gats.school_id = s.id
ORDER BY summary_date, s.school_name, gats.grade_level
LIMIT 20;