-- =====================================================
-- UPDATE IREADY_YEAR_SUMMARY TABLE FOR INTEGER ACADEMIC YEARS
-- =====================================================
-- 
-- This script modifies the iready_year_summary table to use 
-- academic_year_int instead of the old enum-based academic_year
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Add the new academic_year_int column to summary table
ALTER TABLE iready_year_summary 
ADD COLUMN IF NOT EXISTS academic_year_int INTEGER;

-- 2. Populate the new column based on school_year
UPDATE iready_year_summary 
SET academic_year_int = CASE
  WHEN school_year = '2024-2025' THEN 2024
  WHEN school_year = '2023-2024' THEN 2023
  WHEN school_year = '2022-2023' THEN 2022
  ELSE CAST(LEFT(school_year, 4) AS INTEGER)
END
WHERE academic_year_int IS NULL;

-- 3. Update the unique constraint to use the new column
-- First, drop the old constraint
ALTER TABLE iready_year_summary 
DROP CONSTRAINT IF EXISTS iready_year_summary_academic_year_subject_grade_level_key;

-- Add new constraint with academic_year_int
ALTER TABLE iready_year_summary 
ADD CONSTRAINT iready_year_summary_academic_year_int_subject_grade_level_key 
UNIQUE(academic_year_int, subject, grade_level);

-- 4. Update indexes to use the new column
DROP INDEX IF EXISTS idx_iready_summary_lookup;

CREATE INDEX IF NOT EXISTS idx_iready_summary_lookup_int
ON iready_year_summary(academic_year_int, subject, grade_level);

-- 5. Update the trigger function to use academic_year_int
CREATE OR REPLACE FUNCTION update_iready_summary_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate summary for the affected year/subject/grade using academic_year_int
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
    NEW.academic_year_int, NEW.school_year, NEW.subject, NEW.grade_level,
    COUNT(DISTINCT student_id), COUNT(*),
    COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_BELOW'),
    COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_BELOW'),
    COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_BELOW'),
    COUNT(*) FILTER (WHERE overall_placement = 'ON_GRADE_LEVEL'),
    COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_ABOVE'),
    COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_ABOVE'),
    COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'),
    AVG(overall_scale_score), 
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_scale_score),
    MIN(overall_scale_score), MAX(overall_scale_score),
    AVG(lessons_passed), AVG(time_on_task_minutes)
  FROM iready_diagnostic_results
  WHERE academic_year_int = NEW.academic_year_int 
    AND subject = NEW.subject 
    AND grade_level = NEW.grade_level
  GROUP BY academic_year_int, school_year, subject, grade_level
  ON CONFLICT (academic_year_int, subject, grade_level) 
  DO UPDATE SET
    total_students = EXCLUDED.total_students,
    total_assessments = EXCLUDED.total_assessments,
    placement_three_plus_below = EXCLUDED.placement_three_plus_below,
    placement_two_below = EXCLUDED.placement_two_below,
    placement_one_below = EXCLUDED.placement_one_below,
    placement_on_level = EXCLUDED.placement_on_level,
    placement_one_above = EXCLUDED.placement_one_above,
    placement_two_above = EXCLUDED.placement_two_above,
    placement_three_plus_above = EXCLUDED.placement_three_plus_above,
    avg_overall_scale_score = EXCLUDED.avg_overall_scale_score,
    median_overall_scale_score = EXCLUDED.median_overall_scale_score,
    min_overall_scale_score = EXCLUDED.min_overall_scale_score,
    max_overall_scale_score = EXCLUDED.max_overall_scale_score,
    avg_lessons_passed = EXCLUDED.avg_lessons_passed,
    avg_time_on_task_minutes = EXCLUDED.avg_time_on_task_minutes,
    last_updated = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Clear existing summary data to force regeneration with new structure
TRUNCATE TABLE iready_year_summary;

-- 7. Regenerate summary statistics from current data
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
  academic_year_int, school_year, subject, grade_level,
  COUNT(DISTINCT student_id), COUNT(*),
  COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_BELOW'),
  COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_BELOW'),
  COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_BELOW'),
  COUNT(*) FILTER (WHERE overall_placement = 'ON_GRADE_LEVEL'),
  COUNT(*) FILTER (WHERE overall_placement = 'ONE_GRADE_LEVEL_ABOVE'),
  COUNT(*) FILTER (WHERE overall_placement = 'TWO_GRADE_LEVELS_ABOVE'),
  COUNT(*) FILTER (WHERE overall_placement = 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'),
  AVG(overall_scale_score),
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_scale_score),
  MIN(overall_scale_score), MAX(overall_scale_score),
  AVG(lessons_passed), AVG(time_on_task_minutes)
FROM iready_diagnostic_results
WHERE academic_year_int IS NOT NULL
GROUP BY academic_year_int, school_year, subject, grade_level
ORDER BY academic_year_int DESC, subject, grade_level;

-- 8. Verification
DO $$
DECLARE
  summary_count INTEGER;
  years_found INTEGER[];
BEGIN
  -- Count summary records
  SELECT COUNT(*) INTO summary_count
  FROM iready_year_summary 
  WHERE academic_year_int IS NOT NULL;
  
  -- Get distinct years
  SELECT ARRAY_AGG(DISTINCT academic_year_int ORDER BY academic_year_int DESC) INTO years_found
  FROM iready_year_summary;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ IREADY YEAR SUMMARY TABLE UPDATED!';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '📊 Summary records created: %', summary_count;
  RAISE NOTICE '📅 Academic years found: %', years_found;
  RAISE NOTICE '✅ Unique constraint updated to use academic_year_int';
  RAISE NOTICE '✅ Indexes updated for performance';
  RAISE NOTICE '✅ Triggers updated to use new column';
  RAISE NOTICE '';
END $$;

-- 9. Show sample data
SELECT 
  academic_year_int,
  school_year,
  subject,
  grade_level,
  total_students,
  total_assessments,
  ROUND(avg_overall_scale_score, 1) as avg_score
FROM iready_year_summary 
ORDER BY academic_year_int DESC, subject, grade_level
LIMIT 10;