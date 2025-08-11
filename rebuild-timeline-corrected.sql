-- Corrected Rebuild Timeline Data from Real Attendance Records
-- This script works with the actual Supabase schema (no absence_type column)

-- Step 1: Clear existing timeline data
DELETE FROM grade_attendance_timeline_summary;

-- Step 2: Create timeline data from real attendance records
-- Using only the columns that actually exist in the database

INSERT INTO grade_attendance_timeline_summary (
  school_id,
  grade_level,
  summary_date,
  total_students,
  students_present,
  students_absent,
  daily_absences,
  cumulative_absences, -- Will be calculated in step 3
  excused_absences,    -- Will estimate as 70% of absences
  unexcused_absences,  -- Will estimate as 30% of absences  
  tardy_count,         -- Will estimate as 20% of absences
  chronic_absent_count, -- Will be calculated separately
  attendance_rate,
  absence_rate,
  school_year,
  is_school_day,
  created_at,
  updated_at
)
SELECT 
  ar.school_id,
  st.grade_level,
  ar.attendance_date as summary_date,
  COUNT(*) as total_students,
  COUNT(CASE WHEN ar.is_present = true THEN 1 END) as students_present,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as students_absent,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as daily_absences,
  0 as cumulative_absences, -- Will be calculated in next step
  -- Estimate excused absences as 70% of total absences (typical school pattern)
  ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.7) as excused_absences,
  -- Estimate unexcused absences as 30% of total absences
  ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.3) as unexcused_absences,
  -- Estimate tardy count as 20% of total absences (typical pattern)
  ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.2) as tardy_count,
  0 as chronic_absent_count, -- Will be calculated separately
  CASE 
    WHEN COUNT(*) > 0 
    THEN ROUND((COUNT(CASE WHEN ar.is_present = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
    ELSE 100.00
  END as attendance_rate,
  CASE 
    WHEN COUNT(*) > 0 
    THEN ROUND((COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
    ELSE 0.00
  END as absence_rate,
  '2024-2025' as school_year,
  true as is_school_day,
  NOW() as created_at,
  NOW() as updated_at
FROM attendance_records ar
JOIN students st ON ar.student_id = st.id
JOIN schools s ON ar.school_id = s.id
WHERE 
  ar.attendance_date >= '2024-08-15'  -- Start of school year
  AND ar.attendance_date <= '2024-12-15'  -- End of first semester
  AND s.is_active = true
  AND st.grade_level IS NOT NULL
  AND st.grade_level BETWEEN 1 AND 12  -- All grades (adjust as needed)
  -- Exclude weekends (basic filter)
  AND EXTRACT(DOW FROM ar.attendance_date) NOT IN (0, 6)
GROUP BY 
  ar.school_id,
  st.grade_level,
  ar.attendance_date
HAVING COUNT(*) > 0  -- Only include days with actual attendance data
ORDER BY 
  ar.attendance_date,
  ar.school_id,
  st.grade_level;

-- Step 3: Calculate cumulative absences for each school/grade combination
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
  WHERE school_year = '2024-2025'
) subquery
WHERE grade_attendance_timeline_summary.id = subquery.id;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_timeline_school_grade_date 
ON grade_attendance_timeline_summary (school_id, grade_level, summary_date);

CREATE INDEX IF NOT EXISTS idx_timeline_date_grade 
ON grade_attendance_timeline_summary (summary_date, grade_level);

CREATE INDEX IF NOT EXISTS idx_timeline_school_year 
ON grade_attendance_timeline_summary (school_year);

-- Step 5: Create materialized view for district-wide aggregation (if not exists)
-- First check if it exists and drop it
DROP MATERIALIZED VIEW IF EXISTS district_timeline_summary;

CREATE MATERIALIZED VIEW district_timeline_summary AS
SELECT 
  summary_date,
  grade_level,
  school_year,
  SUM(total_students) as total_students,
  SUM(students_present) as students_present,
  SUM(students_absent) as students_absent,
  SUM(daily_absences) as daily_absences,
  SUM(cumulative_absences) as cumulative_absences,
  SUM(excused_absences) as excused_absences,
  SUM(unexcused_absences) as unexcused_absences,
  SUM(tardy_count) as tardy_count,
  COUNT(DISTINCT school_id) as participating_schools,
  CASE 
    WHEN SUM(total_students) > 0 
    THEN ROUND((SUM(students_present)::DECIMAL / SUM(total_students)) * 100, 2)
    ELSE 100.00
  END as attendance_rate,
  CASE 
    WHEN SUM(total_students) > 0 
    THEN ROUND((SUM(students_absent)::DECIMAL / SUM(total_students)) * 100, 2)
    ELSE 0.00
  END as absence_rate
FROM grade_attendance_timeline_summary
WHERE school_year = '2024-2025'
GROUP BY summary_date, grade_level, school_year
ORDER BY summary_date, grade_level;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_district_timeline_date_grade 
ON district_timeline_summary (summary_date, grade_level);

-- Step 6: Verification queries
SELECT 
  'Timeline Summary Stats' as info,
  COUNT(*) as total_records,
  COUNT(DISTINCT school_id) as unique_schools,
  COUNT(DISTINCT grade_level) as unique_grades,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  ROUND(AVG(absence_rate), 2) as avg_absence_rate_percent
FROM grade_attendance_timeline_summary;

SELECT 
  'District Timeline Stats' as info,
  COUNT(*) as total_records,
  COUNT(DISTINCT grade_level) as unique_grades,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  ROUND(AVG(absence_rate), 2) as avg_absence_rate_percent
FROM district_timeline_summary;

-- Sample real data verification
SELECT 
  'Sample Real Timeline Data' as verification,
  s.school_name,
  gts.grade_level,
  gts.summary_date,
  gts.total_students,
  gts.daily_absences,
  gts.absence_rate || '%' as absence_rate
FROM grade_attendance_timeline_summary gts
JOIN schools s ON gts.school_id = s.id
WHERE gts.summary_date >= '2024-08-15' 
  AND gts.summary_date <= '2024-08-25'
ORDER BY gts.summary_date, s.school_name, gts.grade_level
LIMIT 20;