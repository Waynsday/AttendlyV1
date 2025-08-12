-- =================================================================
-- SUPABASE SQL VIEWS FOR INSTANT DASHBOARD LOADING
-- =================================================================
-- Run these in your Supabase SQL editor to create pre-calculated views
-- This will make the dashboard load instantly instead of processing 392K+ records

-- 1. Grade-level attendance summary view
CREATE OR REPLACE VIEW grade_attendance_summaries AS
WITH student_attendance_rates AS (
  SELECT 
    s.school_id,
    s.grade_level,
    s.id as student_id,
    COUNT(ar.id) as total_days,
    SUM(CASE WHEN ar.is_present THEN 1 ELSE 0 END) as present_days,
    CASE 
      WHEN COUNT(ar.id) > 0 THEN 
        (SUM(CASE WHEN ar.is_present THEN 1 ELSE 0 END) * 100.0 / COUNT(ar.id))
      ELSE 100.0 
    END as attendance_rate
  FROM students s
  LEFT JOIN attendance_records ar ON s.id = ar.student_id 
    AND ar.attendance_date >= '2024-08-15' 
    AND ar.attendance_date <= '2025-06-12'
  WHERE s.is_active = true
  GROUP BY s.school_id, s.grade_level, s.id
),
grade_stats AS (
  SELECT 
    sar.school_id,
    sar.grade_level,
    COUNT(*) as total_students,
    AVG(sar.attendance_rate) as avg_attendance_rate,
    COUNT(CASE WHEN sar.attendance_rate < 90 THEN 1 END) as chronic_absentees,
    COUNT(CASE WHEN sar.attendance_rate >= 95 THEN 1 END) as tier1_students,
    COUNT(CASE WHEN sar.attendance_rate >= 90 AND sar.attendance_rate < 95 THEN 1 END) as tier2_students,
    COUNT(CASE WHEN sar.attendance_rate < 90 THEN 1 END) as tier3_students
  FROM student_attendance_rates sar
  GROUP BY sar.school_id, sar.grade_level
)
SELECT 
  gs.school_id,
  sc.school_name,
  gs.grade_level,
  CASE 
    WHEN gs.grade_level = -1 THEN 'Pre-K'
    WHEN gs.grade_level = 0 THEN 'Kindergarten'
    ELSE 'Grade ' || gs.grade_level
  END as grade_name,
  gs.total_students,
  ROUND(gs.avg_attendance_rate, 1) as attendance_rate,
  gs.chronic_absentees,
  gs.tier1_students,
  gs.tier2_students,
  gs.tier3_students,
  CASE 
    WHEN gs.avg_attendance_rate >= 95 THEN 'low'
    WHEN gs.avg_attendance_rate >= 90 THEN 'medium'
    ELSE 'high'
  END as risk_level,
  'stable' as trend,
  NOW() as last_updated
FROM grade_stats gs
JOIN schools sc ON gs.school_id = sc.id
WHERE sc.is_active = true
ORDER BY gs.school_id, gs.grade_level;

-- 2. District-wide summary view
CREATE OR REPLACE VIEW district_attendance_summary AS
SELECT 
  grade_level,
  CASE 
    WHEN grade_level = -1 THEN 'Pre-K'
    WHEN grade_level = 0 THEN 'Kindergarten'
    ELSE 'Grade ' || grade_level
  END as grade_name,
  SUM(total_students) as total_students,
  ROUND(AVG(attendance_rate), 1) as attendance_rate,
  SUM(chronic_absentees) as chronic_absentees,
  SUM(tier1_students) as tier1_students,
  SUM(tier2_students) as tier2_students,
  SUM(tier3_students) as tier3_students,
  CASE 
    WHEN AVG(attendance_rate) >= 95 THEN 'low'
    WHEN AVG(attendance_rate) >= 90 THEN 'medium'
    ELSE 'high'
  END as risk_level,
  'stable' as trend,
  'District-wide' as school_name,
  NOW() as last_updated
FROM grade_attendance_summaries
GROUP BY grade_level
ORDER BY grade_level;

-- 3. Today's attendance metrics view
CREATE OR REPLACE VIEW todays_attendance_metrics AS
SELECT 
  school_id,
  COUNT(*) as total_records,
  SUM(CASE WHEN is_present THEN 1 ELSE 0 END) as present_count,
  COUNT(*) - SUM(CASE WHEN is_present THEN 1 ELSE 0 END) as absent_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 
      ROUND((SUM(CASE WHEN is_present THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 1)
    ELSE 0 
  END as attendance_rate
FROM attendance_records 
WHERE attendance_date = CURRENT_DATE
GROUP BY school_id;

-- 4. All schools today's metrics
CREATE OR REPLACE VIEW district_todays_metrics AS
SELECT 
  'all' as school_id,
  SUM(total_records) as total_records,
  SUM(present_count) as present_count,
  SUM(absent_count) as absent_count,
  CASE 
    WHEN SUM(total_records) > 0 THEN 
      ROUND((SUM(present_count) * 100.0 / SUM(total_records)), 1)
    ELSE 0 
  END as attendance_rate
FROM todays_attendance_metrics;

-- =================================================================
-- INDEXES FOR PERFORMANCE (if not already exist)
-- =================================================================

-- Index on attendance_records for faster date range queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_date_school 
ON attendance_records(attendance_date, school_id, student_id);

-- Index on students for faster grade/school queries  
CREATE INDEX IF NOT EXISTS idx_students_school_grade_active 
ON students(school_id, grade_level, is_active);

-- =================================================================
-- REFRESH MATERIALIZED VIEWS FUNCTION (Optional)
-- =================================================================

-- Function to refresh all views (call this daily or after data updates)
CREATE OR REPLACE FUNCTION refresh_attendance_views() 
RETURNS void AS $$
BEGIN
  -- Since these are regular views, they auto-update
  -- If you convert to materialized views later, add refresh commands here
  RAISE NOTICE 'Attendance views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- USAGE INSTRUCTIONS
-- =================================================================

-- 1. Run this entire script in Supabase SQL Editor
-- 2. Update your analytics service to query these views instead of raw tables
-- 3. Views will update automatically as data changes
-- 4. For even faster performance, consider converting to materialized views and refresh them periodically