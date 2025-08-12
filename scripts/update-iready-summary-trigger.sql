-- =====================================================
-- UPDATE IREADY SUMMARY TRIGGER FOR SCHOOL-BASED SUMMARIES
-- =====================================================
-- 
-- This script updates the trigger to create:
-- 1. School-level summaries (one per school)
-- 2. District-wide summary (aggregated across all schools)
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Drop existing trigger and function
DROP TRIGGER IF EXISTS update_iready_summary_trigger ON iready_diagnostic_results;
DROP FUNCTION IF EXISTS update_iready_summary_stats() CASCADE;

-- 2. Create updated trigger function with school-based summaries
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

  -- Delete existing summaries for this combination (school-level)
  DELETE FROM iready_year_summary 
  WHERE academic_year_int = NEW.academic_year_int 
    AND subject = NEW.subject 
    AND grade_level = NEW.grade_level
    AND (school_id = school_record.school_id OR school_id IS NULL);
  
  -- 1. Create school-level summary
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
  
  -- 2. Create district-wide summary (school_id = NULL for district summary)
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
    NEW.academic_year_int, NEW.school_year, NEW.subject, NEW.grade_level, NULL, -- NULL = district summary
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
  GROUP BY dr.academic_year_int, dr.school_year, dr.subject, dr.grade_level;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
CREATE TRIGGER update_iready_summary_trigger
  AFTER INSERT OR UPDATE ON iready_diagnostic_results
  FOR EACH ROW
  EXECUTE FUNCTION update_iready_summary_stats();

-- 4. Update the unique constraint to include school_id
ALTER TABLE iready_year_summary 
DROP CONSTRAINT IF EXISTS iready_year_summary_year_subject_grade_unique;

ALTER TABLE iready_year_summary 
ADD CONSTRAINT iready_year_summary_school_year_subject_grade_unique 
UNIQUE(academic_year_int, subject, grade_level, school_id);

-- 5. Add school_id column if it doesn't exist
ALTER TABLE iready_year_summary 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- 6. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_iready_summary_school_lookup
ON iready_year_summary(academic_year_int, subject, grade_level, school_id);

-- 7. Verify setup
DO $$
DECLARE
  trigger_count INTEGER;
  constraint_count INTEGER;
BEGIN
  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers 
  WHERE event_object_table = 'iready_diagnostic_results'
    AND trigger_name = 'update_iready_summary_trigger';
  
  -- Count constraints
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints 
  WHERE table_name = 'iready_year_summary'
    AND constraint_name = 'iready_year_summary_school_year_subject_grade_unique';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ SCHOOL-BASED SUMMARY SETUP COMPLETE!';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '📝 Trigger created: %', CASE WHEN trigger_count > 0 THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '📝 Unique constraint updated: %', CASE WHEN constraint_count > 0 THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE '📝 Summary structure:';
  RAISE NOTICE '   • School-level summaries (school_id = specific school)';
  RAISE NOTICE '   • District summary (school_id = NULL)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Ready for iReady data upload with school-based summaries!';
  RAISE NOTICE '';
END $$;