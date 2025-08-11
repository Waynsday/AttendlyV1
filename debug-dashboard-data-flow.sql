-- DEBUG Dashboard Data Flow
-- Trace data from database → timeline API → dashboard to find where absences are lost

-- Step 1: Verify timeline summary table has correct absence data
SELECT 
  'Timeline Summary Data Check' as check_type,
  s.school_name,
  gts.summary_date,
  gts.grade_level,
  gts.total_students,
  gts.students_present,
  gts.students_absent,
  gts.daily_absences,
  gts.absence_rate,
  gts.cumulative_absences
FROM schools s
JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
WHERE (s.school_name ILIKE '%heritage%' 
    OR s.school_name ILIKE '%mountain%view%' 
    OR s.school_name ILIKE '%romoland%')
  AND gts.summary_date >= '2024-08-15'
  AND gts.summary_date <= '2024-08-20'
  AND s.is_active = true
ORDER BY s.school_name, gts.summary_date, gts.grade_level;

-- Step 2: Check district timeline summary (materialized view)
SELECT 
  'District Timeline Summary Check' as check_type,
  dts.summary_date,
  dts.grade_level,
  dts.total_students,
  dts.students_present,
  dts.students_absent,
  dts.daily_absences,
  dts.absence_rate,
  dts.participating_schools
FROM district_timeline_summary dts
WHERE dts.summary_date >= '2024-08-15'
  AND dts.summary_date <= '2024-08-20'
ORDER BY dts.summary_date, dts.grade_level;

-- Step 3: Test the exact query the API uses for individual schools
SELECT 
  'API Individual School Query Test' as query_test,
  gts.summary_date as date,
  gts.grade_level as grade,
  gts.daily_absences as dailyAbsences,
  gts.cumulative_absences as cumulativeAbsences,
  gts.total_students as totalStudents,
  gts.attendance_rate as attendanceRate,
  gts.absence_rate as absenceRate
FROM grade_attendance_timeline_summary gts
JOIN schools s ON gts.school_id = s.id
WHERE gts.school_id = (
  SELECT id FROM schools 
  WHERE school_name ILIKE '%heritage%' 
  LIMIT 1
)
  AND gts.summary_date >= '2024-08-15'
  AND gts.summary_date <= '2024-08-20'
  AND gts.school_year = '2024-2025'
  AND gts.is_school_day = true
ORDER BY gts.summary_date, gts.grade_level;

-- Step 4: Test the exact query the API uses for district-wide data
SELECT 
  'API District-wide Query Test' as query_test,
  dts.summary_date as date,
  dts.grade_level as grade,
  dts.daily_absences as dailyAbsences,
  dts.cumulative_absences as cumulativeAbsences,
  dts.total_students as totalStudents,
  dts.attendance_rate as attendanceRate,
  dts.absence_rate as absenceRate
FROM district_timeline_summary dts
WHERE dts.summary_date >= '2024-08-15'
  AND dts.summary_date <= '2024-08-20'
  AND dts.school_year = '2024-2025'
ORDER BY dts.summary_date, dts.grade_level;

-- Step 5: Check if the issue is with specific grade levels
SELECT 
  'Grade Level Analysis' as analysis_type,
  s.school_name,
  gts.grade_level,
  COUNT(gts.id) as timeline_records,
  SUM(gts.daily_absences) as total_daily_absences,
  AVG(gts.absence_rate) as avg_absence_rate,
  MIN(gts.absence_rate) as min_absence_rate,
  MAX(gts.absence_rate) as max_absence_rate
FROM schools s
JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
WHERE (s.school_name ILIKE '%heritage%' 
    OR s.school_name ILIKE '%mountain%view%' 
    OR s.school_name ILIKE '%romoland%')
  AND gts.summary_date >= '2024-08-15'
  AND gts.summary_date <= '2024-08-30'
GROUP BY s.school_name, gts.grade_level
ORDER BY s.school_name, gts.grade_level;

-- Step 6: Check if the materialized view needs refreshing
SELECT 
  'Materialized View Status' as status_check,
  schemaname,
  matviewname as view_name,
  hasindexes,
  ispopulated,
  definition
FROM pg_matviews 
WHERE matviewname = 'district_timeline_summary';

-- Step 7: Compare timeline data with raw attendance data for a specific school/date
WITH raw_attendance AS (
  SELECT 
    s.school_name,
    ar.attendance_date,
    COUNT(*) as total_students_raw,
    COUNT(CASE WHEN ar.is_present = false THEN 1 END) as absent_students_raw,
    ROUND(COUNT(CASE WHEN ar.is_present = false THEN 1 END)::DECIMAL / COUNT(*) * 100, 2) as absence_rate_raw
  FROM schools s
  JOIN attendance_records ar ON s.id = ar.school_id
  WHERE s.school_name ILIKE '%heritage%'
    AND ar.attendance_date = '2024-08-15'
  GROUP BY s.school_name, ar.attendance_date
),
timeline_data AS (
  SELECT 
    s.school_name,
    gts.summary_date,
    SUM(gts.total_students) as total_students_timeline,
    SUM(gts.students_absent) as absent_students_timeline,
    AVG(gts.absence_rate) as absence_rate_timeline
  FROM schools s
  JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
  WHERE s.school_name ILIKE '%heritage%'
    AND gts.summary_date = '2024-08-15'
  GROUP BY s.school_name, gts.summary_date
)
SELECT 
  'Raw vs Timeline Comparison for Heritage Elementary 2024-08-15' as comparison,
  ra.school_name,
  ra.total_students_raw,
  ra.absent_students_raw,
  ra.absence_rate_raw,
  tl.total_students_timeline,
  tl.absent_students_timeline,
  tl.absence_rate_timeline,
  CASE 
    WHEN ra.absent_students_raw != tl.absent_students_timeline 
    THEN '⚠️ MISMATCH - Timeline data incorrect'
    ELSE '✅ MATCH - Data consistent'
  END as data_consistency
FROM raw_attendance ra
FULL OUTER JOIN timeline_data tl ON ra.school_name = tl.school_name;

-- Step 8: Check for any timeline records with incorrect calculations
SELECT 
  'Timeline Calculation Errors' as error_check,
  s.school_name,
  gts.summary_date,
  gts.grade_level,
  gts.total_students,
  gts.students_present,
  gts.students_absent,
  gts.daily_absences,
  -- Verify calculations are correct
  CASE 
    WHEN gts.students_present + gts.students_absent != gts.total_students 
    THEN '⚠️ Present + Absent != Total'
    WHEN gts.daily_absences != gts.students_absent 
    THEN '⚠️ Daily Absences != Students Absent'
    WHEN gts.total_students > 0 AND gts.absence_rate = 0 AND gts.students_absent > 0
    THEN '⚠️ Has absences but shows 0% rate'
    ELSE '✅ Calculations correct'
  END as calculation_status,
  -- Recalculate absence rate to verify
  CASE 
    WHEN gts.total_students > 0 
    THEN ROUND((gts.students_absent::DECIMAL / gts.total_students) * 100, 2)
    ELSE 0 
  END as recalculated_absence_rate,
  gts.absence_rate as stored_absence_rate
FROM schools s
JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
WHERE (s.school_name ILIKE '%heritage%' 
    OR s.school_name ILIKE '%mountain%view%' 
    OR s.school_name ILIKE '%romoland%')
  AND gts.summary_date >= '2024-08-15'
  AND gts.summary_date <= '2024-08-20'
ORDER BY s.school_name, gts.summary_date, gts.grade_level;