-- =====================================================
-- SAFELY REGENERATE IREADY YEAR SUMMARY DATA
-- =====================================================
-- 
-- This script safely regenerates summary data handling both
-- the old academic_year column and new academic_year_int
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Clear existing summary data
TRUNCATE TABLE iready_year_summary;

-- 2. Check if old academic_year column exists and handle accordingly
DO $$
DECLARE
  has_old_column BOOLEAN;
  has_new_column BOOLEAN;
BEGIN
  -- Check column existence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'iready_year_summary' 
    AND column_name = 'academic_year'
  ) INTO has_old_column;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'iready_year_summary' 
    AND column_name = 'academic_year_int'
  ) INTO has_new_column;
  
  -- Insert data based on table structure
  IF has_old_column AND has_new_column THEN
    -- Both columns exist - populate both
    INSERT INTO iready_year_summary (
      academic_year, academic_year_int, school_year, subject, grade_level,
      total_students, total_assessments,
      placement_three_plus_below, placement_two_below, placement_one_below,
      placement_on_level, placement_one_above, placement_two_above, placement_three_plus_above,
      avg_overall_scale_score, median_overall_scale_score,
      min_overall_scale_score, max_overall_scale_score,
      avg_lessons_passed, avg_time_on_task_minutes
    )
    SELECT 
      CASE 
        WHEN academic_year_int = 2024 THEN 'CURRENT_YEAR'::iready_academic_year
        WHEN academic_year_int = 2023 THEN 'CURRENT_YEAR_MINUS_1'::iready_academic_year
        WHEN academic_year_int = 2022 THEN 'CURRENT_YEAR_MINUS_2'::iready_academic_year
      END as academic_year,
      academic_year_int, 
      school_year, 
      subject, 
      grade_level,
      COUNT(DISTINCT student_id), 
      COUNT(*),
      COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_BELOW'),
      COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_BELOW'),
      COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_BELOW'),
      COUNT(*) FILTER (WHERE overall_placement = 'ON_GRADE_LEVEL'),
      COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_ABOVE'),
      COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_ABOVE'),
      COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'),
      AVG(overall_scale_score),
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_scale_score),
      MIN(overall_scale_score), 
      MAX(overall_scale_score),
      AVG(lessons_passed), 
      AVG(time_on_task_minutes)
    FROM iready_diagnostic_results
    WHERE academic_year_int IS NOT NULL 
      AND subject IS NOT NULL 
      AND grade_level IS NOT NULL
    GROUP BY academic_year_int, school_year, subject, grade_level;
    
  ELSIF has_new_column AND NOT has_old_column THEN
    -- Only new column exists (desired state)
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
      COUNT(DISTINCT student_id), 
      COUNT(*),
      COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_BELOW'),
      COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_BELOW'),
      COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_BELOW'),
      COUNT(*) FILTER (WHERE overall_placement = 'ON_GRADE_LEVEL'),
      COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_ABOVE'),
      COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_ABOVE'),
      COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'),
      AVG(overall_scale_score),
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_scale_score),
      MIN(overall_scale_score), 
      MAX(overall_scale_score),
      AVG(lessons_passed), 
      AVG(time_on_task_minutes)
    FROM iready_diagnostic_results
    WHERE academic_year_int IS NOT NULL 
      AND subject IS NOT NULL 
      AND grade_level IS NOT NULL
    GROUP BY academic_year_int, school_year, subject, grade_level;
    
  ELSE
    RAISE EXCEPTION 'Table structure issue: has_old=%, has_new=%', has_old_column, has_new_column;
  END IF;
END $$;

-- 3. Verification
DO $$
DECLARE
  summary_count INTEGER;
  diagnostic_count INTEGER;
  years_found INTEGER[];
  subjects_found TEXT[];
BEGIN
  -- Count summary records
  SELECT COUNT(*) INTO summary_count
  FROM iready_year_summary;
  
  -- Count diagnostic records  
  SELECT COUNT(*) INTO diagnostic_count
  FROM iready_diagnostic_results
  WHERE academic_year_int IS NOT NULL;
  
  -- Get distinct years
  SELECT ARRAY_AGG(DISTINCT academic_year_int ORDER BY academic_year_int DESC) INTO years_found
  FROM iready_year_summary
  WHERE academic_year_int IS NOT NULL;
  
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

-- 4. Show sample data
SELECT 
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