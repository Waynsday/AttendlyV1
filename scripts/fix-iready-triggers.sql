-- =====================================================
-- FIX IREADY TRIGGERS FOR ACADEMIC_YEAR_INT
-- =====================================================
-- 
-- This script updates any triggers on iready_diagnostic_results
-- to use academic_year_int instead of academic_year
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Check existing triggers
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 CHECKING TRIGGERS ON iready_diagnostic_results:';
  RAISE NOTICE '=====================================';
  
  FOR trigger_record IN 
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers 
    WHERE event_object_table = 'iready_diagnostic_results'
  LOOP
    RAISE NOTICE '   • %: % %', trigger_record.trigger_name, trigger_record.action_timing, trigger_record.event_manipulation;
  END LOOP;
  RAISE NOTICE '';
END $$;

-- 2. Drop and recreate the summary update trigger with correct column references
DROP TRIGGER IF EXISTS update_iready_summary_trigger ON iready_diagnostic_results;
DROP FUNCTION IF EXISTS update_iready_summary_stats();

-- 3. Create updated trigger function that uses academic_year_int
CREATE OR REPLACE FUNCTION update_iready_summary_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing summary for this combination
  DELETE FROM iready_year_summary 
  WHERE academic_year_int = NEW.academic_year_int 
    AND subject = NEW.subject 
    AND grade_level = NEW.grade_level;
  
  -- Recalculate and insert updated summary
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
  GROUP BY academic_year_int, school_year, subject, grade_level;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger
CREATE TRIGGER update_iready_summary_trigger
  AFTER INSERT OR UPDATE ON iready_diagnostic_results
  FOR EACH ROW
  EXECUTE FUNCTION update_iready_summary_stats();

-- 5. Verify the trigger was created
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ UPDATED TRIGGERS ON iready_diagnostic_results:';
  RAISE NOTICE '=====================================';
  
  FOR trigger_record IN 
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers 
    WHERE event_object_table = 'iready_diagnostic_results'
  LOOP
    RAISE NOTICE '   • %: % %', trigger_record.trigger_name, trigger_record.action_timing, trigger_record.event_manipulation;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Triggers updated to use academic_year_int!';
  RAISE NOTICE '✅ Ready for iReady data upload';
  RAISE NOTICE '';
END $$;