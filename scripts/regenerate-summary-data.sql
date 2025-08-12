-- =====================================================
-- REGENERATE IREADY YEAR SUMMARY DATA
-- =====================================================
-- 
-- This script regenerates the iready_year_summary table data
-- using the new academic_year_int column structure.
--
-- Run this script in Supabase SQL Editor after the migration
-- Date: 2025-07-30
-- =====================================================

-- 1. Clear existing summary data
TRUNCATE TABLE iready_year_summary;

-- 2. Regenerate summary statistics from current diagnostic data
INSERT INTO iready_year_summary (
  academic_year_int, school_year, subject, grade_level,
  total_students, total_assessments,
  placement_three_plus_below, placement_two_below, placement_one_below,
  placement_on_level, placement_one_above, placement_two_above, placement_three_plus_above,
  avg_overall_scale_score, median_overall_scale_score,
  min_overall_scale_score, max_overall_scale_score,
  avg_lessons_passed, avg_time_on_task_minutes
)
SELECT 
  academic_year_int, 
  school_year, 
  subject, 
  grade_level,
  COUNT(DISTINCT student_id) as total_students, 
  COUNT(*) as total_assessments,
  COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_BELOW') as placement_three_plus_below,
  COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_BELOW') as placement_two_below,
  COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_BELOW') as placement_one_below,
  COUNT(*) FILTER (WHERE overall_placement = 'ON_GRADE_LEVEL') as placement_on_level,
  COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_ABOVE') as placement_one_above,
  COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_ABOVE') as placement_two_above,
  COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE') as placement_three_plus_above,
  AVG(overall_scale_score) as avg_overall_scale_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_scale_score) as median_overall_scale_score,
  MIN(overall_scale_score) as min_overall_scale_score, 
  MAX(overall_scale_score) as max_overall_scale_score,
  AVG(lessons_passed) as avg_lessons_passed, 
  AVG(time_on_task_minutes) as avg_time_on_task_minutes
FROM iready_diagnostic_results
WHERE academic_year_int IS NOT NULL 
  AND subject IS NOT NULL 
  AND grade_level IS NOT NULL
GROUP BY academic_year_int, school_year, subject, grade_level
ORDER BY academic_year_int DESC, subject, grade_level;

-- 3. Verification and summary
DO $$
DECLARE
  summary_count INTEGER;
  diagnostic_count INTEGER;
  years_found INTEGER[];
  subjects_found TEXT[];
BEGIN
  -- Count summary records
  SELECT COUNT(*) INTO summary_count
  FROM iready_year_summary 
  WHERE academic_year_int IS NOT NULL;
  
  -- Count diagnostic records
  SELECT COUNT(*) INTO diagnostic_count
  FROM iready_diagnostic_results
  WHERE academic_year_int IS NOT NULL;
  
  -- Get distinct years
  SELECT ARRAY_AGG(DISTINCT academic_year_int ORDER BY academic_year_int DESC) INTO years_found
  FROM iready_year_summary;
  
  -- Get distinct subjects
  SELECT ARRAY_AGG(DISTINCT subject ORDER BY subject) INTO subjects_found
  FROM iready_year_summary;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ IREADY SUMMARY DATA REGENERATED!';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '📊 Summary records created: %', summary_count;
  RAISE NOTICE '📊 Diagnostic records processed: %', diagnostic_count;
  RAISE NOTICE '📅 Academic years: %', years_found;
  RAISE NOTICE '📚 Subjects: %', subjects_found;
  RAISE NOTICE '';
END $$;

-- 4. Show sample data for verification
SELECT 
  'SAMPLE DATA' as section,
  academic_year_int,
  school_year,
  subject,
  grade_level,
  total_students,
  total_assessments,
  ROUND(avg_overall_scale_score::numeric, 1) as avg_score
FROM iready_year_summary 
ORDER BY academic_year_int DESC, subject, grade_level
LIMIT 10;

-- 5. Show summary by year
SELECT 
  'YEAR SUMMARY' as section,
  academic_year_int,
  COUNT(*) as grade_subject_combinations,
  SUM(total_students) as total_students,
  SUM(total_assessments) as total_assessments
FROM iready_year_summary 
GROUP BY academic_year_int
ORDER BY academic_year_int DESC;