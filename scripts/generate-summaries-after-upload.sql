-- =====================================================
-- GENERATE SUMMARIES AFTER BULK UPLOAD
-- =====================================================
-- 
-- This script generates all summary statistics after bulk upload
-- Run this AFTER the optimized upload script completes
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Clear existing summaries
TRUNCATE TABLE iready_year_summary;

-- 2. Generate school-level summaries
INSERT INTO iready_year_summary (
  academic_year_int, school_year, subject, grade_level, school_id,
  total_students, total_assessments,
  placement_three_plus_below, placement_two_below, placement_one_below,
  placement_on_level, placement_one_above, placement_two_above, placement_three_plus_above,
  avg_overall_scale_score, median_overall_scale_score, 
  min_overall_scale_score, max_overall_scale_score,
  avg_lessons_passed, avg_time_on_task_minutes
)
SELECT 
  dr.academic_year_int, dr.school_year, dr.subject, dr.grade_level, st.school_id,
  COUNT(DISTINCT dr.student_id), COUNT(*),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_BELOW'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'TWO_GRADE_LEVELS_BELOW'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'ONE_GRADE_LEVEL_BELOW'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'ON_GRADE_LEVEL'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'ONE_GRADE_LEVEL_ABOVE'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'TWO_GRADE_LEVELS_ABOVE'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'),
  AVG(dr.overall_scale_score), 
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dr.overall_scale_score),
  MIN(dr.overall_scale_score), MAX(dr.overall_scale_score),
  AVG(dr.lessons_passed), AVG(dr.time_on_task_minutes)
FROM iready_diagnostic_results dr
JOIN students st ON dr.student_id = st.id
WHERE dr.student_id IS NOT NULL
GROUP BY dr.academic_year_int, dr.school_year, dr.subject, dr.grade_level, st.school_id
ORDER BY dr.academic_year_int DESC, dr.subject, dr.grade_level;

-- 3. Generate district-wide summaries (school_id = NULL)
INSERT INTO iready_year_summary (
  academic_year_int, school_year, subject, grade_level, school_id,
  total_students, total_assessments,
  placement_three_plus_below, placement_two_below, placement_one_below,
  placement_on_level, placement_one_above, placement_two_above, placement_three_plus_above,
  avg_overall_scale_score, median_overall_scale_score, 
  min_overall_scale_score, max_overall_scale_score,
  avg_lessons_passed, avg_time_on_task_minutes
)
SELECT 
  dr.academic_year_int, dr.school_year, dr.subject, dr.grade_level, NULL,
  COUNT(DISTINCT dr.student_id), COUNT(*),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_BELOW'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'TWO_GRADE_LEVELS_BELOW'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'ONE_GRADE_LEVEL_BELOW'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'ON_GRADE_LEVEL'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'ONE_GRADE_LEVEL_ABOVE'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'TWO_GRADE_LEVELS_ABOVE'),
  COUNT(*) FILTER (WHERE dr.overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'),
  AVG(dr.overall_scale_score), 
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dr.overall_scale_score),
  MIN(dr.overall_scale_score), MAX(dr.overall_scale_score),
  AVG(dr.lessons_passed), AVG(dr.time_on_task_minutes)
FROM iready_diagnostic_results dr
WHERE dr.student_id IS NOT NULL
GROUP BY dr.academic_year_int, dr.school_year, dr.subject, dr.grade_level
ORDER BY dr.academic_year_int DESC, dr.subject, dr.grade_level;

-- 4. Verification and summary
DO $$
DECLARE
  diagnostic_count INTEGER;
  summary_count INTEGER;
  school_summaries INTEGER;
  district_summaries INTEGER;
  years_found INTEGER[];
BEGIN
  -- Count records
  SELECT COUNT(*) INTO diagnostic_count FROM iready_diagnostic_results;
  SELECT COUNT(*) INTO summary_count FROM iready_year_summary;
  SELECT COUNT(*) INTO school_summaries FROM iready_year_summary WHERE school_id IS NOT NULL;
  SELECT COUNT(*) INTO district_summaries FROM iready_year_summary WHERE school_id IS NULL;
  
  -- Get years
  SELECT ARRAY_AGG(DISTINCT academic_year_int ORDER BY academic_year_int DESC) INTO years_found
  FROM iready_year_summary;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ SUMMARY GENERATION COMPLETED!';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '📊 Diagnostic records processed: %', diagnostic_count;
  RAISE NOTICE '📊 Total summaries created: %', summary_count;
  RAISE NOTICE '🏫 School-level summaries: %', school_summaries;
  RAISE NOTICE '🌐 District-wide summaries: %', district_summaries;
  RAISE NOTICE '📅 Academic years: %', years_found;
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Ready for analytics and reporting!';
  RAISE NOTICE '';
END $$;

-- 5. Show sample summaries
SELECT 
  'SAMPLE SUMMARIES' as section,
  academic_year_int,
  school_year,
  subject,
  grade_level,
  CASE WHEN school_id IS NULL THEN 'District-wide' ELSE 'School-level' END as scope,
  total_students,
  total_assessments,
  ROUND(avg_overall_scale_score, 1) as avg_score
FROM iready_year_summary 
ORDER BY academic_year_int DESC, subject, grade_level, school_id NULLS FIRST
LIMIT 15;