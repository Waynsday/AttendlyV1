-- =====================================================
-- RE-ENABLE TRIGGERS AFTER BULK UPLOAD
-- =====================================================
-- 
-- This script re-enables triggers after bulk upload completes
-- Run this AFTER generating summaries
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Recreate the summary update trigger function
CREATE OR REPLACE FUNCTION update_iready_summary_stats()
RETURNS TRIGGER AS $$
DECLARE
  school_record RECORD;
BEGIN
  -- Get the school information for this student
  SELECT s.id as school_id, s.school_code, s.district_id
  INTO school_record
  FROM students st
  JOIN schools s ON st.school_id = s.id
  WHERE st.id = NEW.student_id;

  -- Delete existing summaries for this combination
  DELETE FROM iready_year_summary 
  WHERE academic_year_int = NEW.academic_year_int 
    AND subject = NEW.subject 
    AND grade_level = NEW.grade_level
    AND (school_id = school_record.school_id OR school_id IS NULL);
  
  -- 1. Create school-level summary (if student has a school)
  IF school_record.school_id IS NOT NULL THEN
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
      NEW.academic_year_int, NEW.school_year, NEW.subject, NEW.grade_level, school_record.school_id,
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
    WHERE dr.academic_year_int = NEW.academic_year_int 
      AND dr.subject = NEW.subject 
      AND dr.grade_level = NEW.grade_level
      AND st.school_id = school_record.school_id
    GROUP BY dr.academic_year_int, dr.school_year, dr.subject, dr.grade_level;
  END IF;
  
  -- 2. Create district-wide summary (school_id = NULL)
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
    NEW.academic_year_int, NEW.school_year, NEW.subject, NEW.grade_level, NULL,
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
  WHERE dr.academic_year_int = NEW.academic_year_int 
    AND dr.subject = NEW.subject 
    AND dr.grade_level = NEW.grade_level
  GROUP BY dr.academic_year_int, dr.school_year, dr.subject, dr.grade_level;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
CREATE TRIGGER update_iready_summary_trigger
  AFTER INSERT OR UPDATE ON iready_diagnostic_results
  FOR EACH ROW
  EXECUTE FUNCTION update_iready_summary_stats();

-- 3. Verification
DO $$
DECLARE
  trigger_count INTEGER;
  function_exists BOOLEAN;
BEGIN
  -- Check trigger
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers 
  WHERE event_object_table = 'iready_diagnostic_results'
    AND trigger_name = 'update_iready_summary_trigger';
  
  -- Check function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE p.proname = 'update_iready_summary_stats'
      AND n.nspname = 'public'
  ) INTO function_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔄 TRIGGERS RE-ENABLED';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '📝 Trigger active: %', CASE WHEN trigger_count > 0 THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '📝 Function exists: %', CASE WHEN function_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '';
  
  IF trigger_count > 0 AND function_exists THEN
    RAISE NOTICE '✅ Triggers successfully re-enabled';
    RAISE NOTICE '🎯 Future iReady record changes will auto-update summaries';
  ELSE
    RAISE NOTICE '⚠️  Issue with trigger setup - check configuration';
  END IF;
  
  RAISE NOTICE '';
END $$;