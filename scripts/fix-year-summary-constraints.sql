-- =====================================================
-- FIX IREADY_YEAR_SUMMARY TABLE CONSTRAINTS
-- =====================================================
-- 
-- This script fixes the academic_year column constraint issue
-- and completes the migration to academic_year_int
--
-- Date: 2025-07-30
-- =====================================================

-- 1. First, drop the NOT NULL constraint on academic_year if it exists
ALTER TABLE iready_year_summary 
ALTER COLUMN academic_year DROP NOT NULL;

-- 2. Drop the old academic_year column entirely (as intended)
ALTER TABLE iready_year_summary 
DROP COLUMN IF EXISTS academic_year CASCADE;

-- 3. Make sure academic_year_int is NOT NULL
ALTER TABLE iready_year_summary 
ALTER COLUMN academic_year_int SET NOT NULL;

-- 4. Recreate the unique constraint using academic_year_int
-- First drop any existing constraints that might reference academic_year
ALTER TABLE iready_year_summary 
DROP CONSTRAINT IF EXISTS iready_year_summary_academic_year_subject_grade_level_key CASCADE;

ALTER TABLE iready_year_summary 
DROP CONSTRAINT IF EXISTS iready_year_summary_academic_year_int_subject_grade_level_key CASCADE;

-- Create the new constraint
ALTER TABLE iready_year_summary 
ADD CONSTRAINT iready_year_summary_year_subject_grade_unique 
UNIQUE(academic_year_int, subject, grade_level);

-- 5. Update indexes
DROP INDEX IF EXISTS idx_iready_summary_lookup;
DROP INDEX IF EXISTS idx_iready_summary_lookup_int;

CREATE INDEX idx_iready_year_summary_lookup
ON iready_year_summary(academic_year_int, subject, grade_level);

-- 6. Verify the table structure
DO $$
DECLARE
  col_count INTEGER;
  has_old_col BOOLEAN;
  has_new_col BOOLEAN;
BEGIN
  -- Check if old column exists
  SELECT COUNT(*) > 0 INTO has_old_col
  FROM information_schema.columns 
  WHERE table_name = 'iready_year_summary' 
    AND column_name = 'academic_year';
  
  -- Check if new column exists
  SELECT COUNT(*) > 0 INTO has_new_col
  FROM information_schema.columns 
  WHERE table_name = 'iready_year_summary' 
    AND column_name = 'academic_year_int';
  
  -- Count total columns
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'iready_year_summary';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ CONSTRAINT FIX COMPLETED!';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '📋 Table: iready_year_summary';
  RAISE NOTICE '📊 Total columns: %', col_count;
  RAISE NOTICE '🔍 Old academic_year column: %', CASE WHEN has_old_col THEN '❌ Still exists' ELSE '✅ Removed' END;
  RAISE NOTICE '🔍 New academic_year_int column: %', CASE WHEN has_new_col THEN '✅ Present' ELSE '❌ Missing' END;
  RAISE NOTICE '';
END $$;

-- 7. Show current table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'iready_year_summary'
ORDER BY ordinal_position;