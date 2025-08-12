-- =====================================================
-- FIX IREADY SUMMARY TABLE SCHEMA
-- =====================================================
-- 
-- This script adds the school_id column and updates constraints properly
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Check current table structure
DO $$
DECLARE
  column_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 CURRENT iready_year_summary COLUMNS:';
  RAISE NOTICE '=====================================';
  
  FOR column_record IN 
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'iready_year_summary'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '   • %: % (%)', column_record.column_name, column_record.data_type, 
      CASE WHEN column_record.is_nullable = 'YES' THEN 'nullable' ELSE 'not null' END;
  END LOOP;
  RAISE NOTICE '';
END $$;

-- 2. Add school_id column if it doesn't exist
ALTER TABLE iready_year_summary 
ADD COLUMN IF NOT EXISTS school_id UUID;

-- 3. Add foreign key constraint to schools table
DO $$
BEGIN
  -- Only add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'iready_year_summary_school_id_fkey'
      AND table_name = 'iready_year_summary'
  ) THEN
    ALTER TABLE iready_year_summary 
    ADD CONSTRAINT iready_year_summary_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES schools(id);
    
    RAISE NOTICE '✅ Added foreign key constraint for school_id';
  ELSE
    RAISE NOTICE '📝 Foreign key constraint already exists';
  END IF;
END $$;

-- 4. Drop old unique constraints
ALTER TABLE iready_year_summary 
DROP CONSTRAINT IF EXISTS iready_year_summary_year_subject_grade_unique CASCADE;

ALTER TABLE iready_year_summary 
DROP CONSTRAINT IF EXISTS iready_year_summary_unique_record CASCADE;

-- 5. Add new unique constraint that includes school_id
ALTER TABLE iready_year_summary 
ADD CONSTRAINT iready_year_summary_school_year_subject_grade_unique 
UNIQUE(academic_year_int, subject, grade_level, school_id);

-- 6. Create performance indexes
DROP INDEX IF EXISTS idx_iready_summary_lookup;
DROP INDEX IF EXISTS idx_iready_summary_lookup_int;

CREATE INDEX IF NOT EXISTS idx_iready_summary_school_lookup
ON iready_year_summary(academic_year_int, subject, grade_level, school_id);

CREATE INDEX IF NOT EXISTS idx_iready_summary_district_lookup
ON iready_year_summary(academic_year_int, subject, grade_level) 
WHERE school_id IS NULL;

-- 7. Now create the updated trigger function
DROP TRIGGER IF EXISTS update_iready_summary_trigger ON iready_diagnostic_results;
DROP FUNCTION IF EXISTS update_iready_summary_stats() CASCADE;

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

-- 8. Create the trigger
CREATE TRIGGER update_iready_summary_trigger
  AFTER INSERT OR UPDATE ON iready_diagnostic_results
  FOR EACH ROW
  EXECUTE FUNCTION update_iready_summary_stats();

-- 9. Final verification
DO $$
DECLARE
  column_record RECORD;
  constraint_record RECORD;
  trigger_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ UPDATED iready_year_summary STRUCTURE:';
  RAISE NOTICE '=====================================';
  
  -- Show columns
  FOR column_record IN 
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'iready_year_summary'
      AND column_name IN ('academic_year_int', 'school_id', 'subject', 'grade_level')
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '   📝 %: % (%)', column_record.column_name, column_record.data_type,
      CASE WHEN column_record.is_nullable = 'YES' THEN 'nullable' ELSE 'not null' END;
  END LOOP;
  
  -- Show constraints
  FOR constraint_record IN 
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints 
    WHERE table_name = 'iready_year_summary'
      AND constraint_type IN ('UNIQUE', 'FOREIGN KEY')
  LOOP
    RAISE NOTICE '   📝 %: %', constraint_record.constraint_name, constraint_record.constraint_type;
  END LOOP;
  
  -- Show trigger
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers 
  WHERE event_object_table = 'iready_diagnostic_results'
    AND trigger_name = 'update_iready_summary_trigger';
  
  RAISE NOTICE '   📝 Trigger: %', CASE WHEN trigger_count > 0 THEN 'Active' ELSE 'Missing' END;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 SCHOOL-BASED SUMMARY SETUP COMPLETE!';
  RAISE NOTICE '✅ Ready for iReady data upload!';
  RAISE NOTICE '';
END $$;