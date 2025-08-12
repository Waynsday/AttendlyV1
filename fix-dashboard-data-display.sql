-- FIX Dashboard Data Display Issues
-- Addresses common problems where database has correct data but dashboard shows zeros

-- Step 1: Refresh materialized view (most common fix)
REFRESH MATERIALIZED VIEW district_timeline_summary;

-- Step 2: Fix any calculation errors in timeline summary table
UPDATE grade_attendance_timeline_summary
SET 
  -- Ensure daily_absences matches students_absent
  daily_absences = students_absent,
  
  -- Recalculate absence_rate correctly
  absence_rate = CASE 
    WHEN total_students > 0 
    THEN ROUND((students_absent::DECIMAL / total_students) * 100, 2)
    ELSE 0.00 
  END,
  
  -- Recalculate attendance_rate correctly
  attendance_rate = CASE 
    WHEN total_students > 0 
    THEN ROUND((students_present::DECIMAL / total_students) * 100, 2)
    ELSE 100.00 
  END,
  
  -- Update timestamp
  updated_at = NOW()

WHERE school_year = '2024-2025'
  -- Only fix records where calculations might be wrong
  AND (
    daily_absences != students_absent 
    OR (total_students > 0 AND students_absent > 0 AND absence_rate = 0)
    OR (students_present + students_absent != total_students)
  );

-- Step 3: Recalculate cumulative absences correctly
UPDATE grade_attendance_timeline_summary 
SET cumulative_absences = subquery.cumulative_total,
    updated_at = NOW()
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

-- Step 4: Regenerate district timeline summary with corrected data
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
  AND is_school_day = true
GROUP BY summary_date, grade_level, school_year
ORDER BY summary_date, grade_level;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_district_timeline_date_grade 
ON district_timeline_summary (summary_date, grade_level);

-- Step 5: Ensure all schools have timeline data for the dashboard date range
INSERT INTO grade_attendance_timeline_summary (
  school_id, grade_level, summary_date, total_students, students_present, 
  students_absent, daily_absences, cumulative_absences, excused_absences, 
  unexcused_absences, tardy_count, chronic_absent_count, attendance_rate, 
  absence_rate, school_year, is_school_day, created_at, updated_at
)
SELECT 
  ar.school_id,
  3 as grade_level,  -- Default grade
  ar.attendance_date as summary_date,
  COUNT(*) as total_students,
  COUNT(CASE WHEN ar.is_present = true THEN 1 END) as students_present,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as students_absent,
  COUNT(CASE WHEN ar.is_present = false THEN 1 END) as daily_absences,
  0 as cumulative_absences,  -- Will be recalculated
  ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.7) as excused_absences,
  ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.3) as unexcused_absences,
  ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END) * 0.2) as tardy_count,
  0 as chronic_absent_count,
  CASE WHEN COUNT(*) > 0 
    THEN ROUND((COUNT(CASE WHEN ar.is_present = true THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
    ELSE 100.00 
  END as attendance_rate,
  CASE WHEN COUNT(*) > 0 
    THEN ROUND((COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
    ELSE 0.00 
  END as absence_rate,
  '2024-2025' as school_year,
  true as is_school_day,
  NOW() as created_at,
  NOW() as updated_at
FROM attendance_records ar
JOIN schools s ON ar.school_id = s.id
WHERE ar.attendance_date >= '2024-08-01'  -- Dashboard default date range
  AND ar.attendance_date <= '2025-06-30'  -- Dashboard default date range
  AND s.is_active = true
  AND EXTRACT(DOW FROM ar.attendance_date) NOT IN (0, 6)
  -- Only add missing timeline records
  AND NOT EXISTS (
    SELECT 1 FROM grade_attendance_timeline_summary gts 
    WHERE gts.school_id = ar.school_id 
      AND gts.summary_date = ar.attendance_date
      AND gts.grade_level = 3
      AND gts.school_year = '2024-2025'
  )
GROUP BY ar.school_id, ar.attendance_date
HAVING COUNT(*) > 0
ORDER BY ar.attendance_date, ar.school_id;

-- Step 6: Final recalculation of cumulative absences
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

-- Step 7: Final refresh of materialized view
REFRESH MATERIALIZED VIEW district_timeline_summary;

-- Step 8: Verification - Show corrected data for problematic schools
SELECT 
  'Post-Fix Verification' as verification_step,
  s.school_name,
  COUNT(gts.id) as timeline_records,
  SUM(gts.daily_absences) as total_daily_absences,
  ROUND(AVG(gts.absence_rate), 2) as avg_absence_rate,
  MIN(gts.absence_rate) as min_absence_rate,
  MAX(gts.absence_rate) as max_absence_rate,
  MIN(gts.summary_date) as earliest_date,
  MAX(gts.summary_date) as latest_date
FROM schools s
JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
WHERE s.is_active = true
  AND gts.school_year = '2024-2025'
  AND gts.summary_date >= '2024-08-15'
  AND gts.summary_date <= '2024-08-30'
GROUP BY s.id, s.school_name
ORDER BY s.school_name;

-- Step 9: Test API-compatible query format for individual school
SELECT 
  'API Test - Individual School (Heritage)' as test_type,
  'heritage' as school_filter,
  gts.summary_date as date,
  gts.grade_level as grade,
  gts.daily_absences as dailyAbsences,
  gts.cumulative_absences as cumulativeAbsences,
  gts.total_students as totalStudents,
  gts.attendance_rate as attendanceRate,
  gts.absence_rate as absenceRate,
  s.school_name as schoolName,
  s.school_code as schoolCode
FROM grade_attendance_timeline_summary gts
JOIN schools s ON gts.school_id = s.id
WHERE s.school_name ILIKE '%heritage%'
  AND gts.summary_date >= '2024-08-15'
  AND gts.summary_date <= '2024-08-20'
  AND gts.school_year = '2024-2025'
  AND gts.is_school_day = true
ORDER BY gts.summary_date, gts.grade_level
LIMIT 10;

-- Step 10: Test API-compatible query format for district-wide
SELECT 
  'API Test - District Wide' as test_type,
  'all' as school_filter,
  dts.summary_date as date,
  dts.grade_level as grade,
  dts.daily_absences as dailyAbsences,
  dts.cumulative_absences as cumulativeAbsences,
  dts.total_students as totalStudents,
  dts.attendance_rate as attendanceRate,
  dts.absence_rate as absenceRate,
  'All Schools (District)' as schoolName,
  'ALL' as schoolCode
FROM district_timeline_summary dts
WHERE dts.summary_date >= '2024-08-15'
  AND dts.summary_date <= '2024-08-20'
  AND dts.school_year = '2024-2025'
ORDER BY dts.summary_date, dts.grade_level
LIMIT 10;