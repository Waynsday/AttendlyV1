-- =====================================================
-- ISOLATED IREADY DATABASE SCHEMA
-- =====================================================
-- 
-- This schema creates isolated iReady-specific tables that are completely
-- separate from the existing academic_performance table structure.
-- Designed for multi-year iReady diagnostic data (2022-2025)
-- Maintains strict table isolation as requested.
--
-- Date: 2025-07-30
-- Purpose: QA Education Data Tester - Isolated iReady Layer
-- =====================================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- IREADY-SPECIFIC ENUMS AND TYPES
-- =====================================================

-- iReady academic years
DO $$ BEGIN
  CREATE TYPE iready_academic_year AS ENUM (
    'CURRENT_YEAR',      -- 2024-2025
    'CURRENT_YEAR_MINUS_1', -- 2023-2024  
    'CURRENT_YEAR_MINUS_2'  -- 2022-2023
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- iReady subjects
DO $$ BEGIN
  CREATE TYPE iready_subject AS ENUM (
    'ELA',
    'MATH'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- iReady placement levels
DO $$ BEGIN
  CREATE TYPE iready_placement AS ENUM (
    'THREE_OR_MORE_GRADE_LEVELS_BELOW',
    'TWO_GRADE_LEVELS_BELOW', 
    'ONE_GRADE_LEVEL_BELOW',
    'ON_GRADE_LEVEL',
    'ONE_GRADE_LEVEL_ABOVE',
    'TWO_GRADE_LEVELS_ABOVE',
    'THREE_OR_MORE_GRADE_LEVELS_ABOVE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- ISOLATED IREADY TABLES
-- =====================================================

-- Main iReady diagnostic results table
CREATE TABLE IF NOT EXISTS iready_diagnostic_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Student identification (flexible linking to existing students table)
  student_id UUID REFERENCES students(id) ON DELETE CASCADE, -- NULL allowed for unmatched students
  district_student_id VARCHAR(50) NOT NULL, -- Primary key for CSV matching
  student_name VARCHAR(200) NOT NULL, -- From CSV for validation and fallback
  
  -- Assessment metadata
  academic_year iready_academic_year NOT NULL,
  school_year VARCHAR(9) NOT NULL, -- e.g., "2024-2025"
  subject iready_subject NOT NULL,
  diagnostic_date DATE NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN -1 AND 12),
  
  -- Overall performance
  overall_scale_score INTEGER,
  overall_placement iready_placement,
  
  -- ELA-specific domain scores (NULL for Math records)
  phonological_awareness_score INTEGER,
  phonics_score INTEGER,
  high_frequency_words_score INTEGER,
  vocabulary_score INTEGER,
  literary_comprehension_score INTEGER,
  informational_comprehension_score INTEGER,
  
  -- Math-specific domain scores (NULL for ELA records)
  number_and_operations_score INTEGER,
  algebra_and_algebraic_thinking_score INTEGER,
  measurement_and_data_score INTEGER,
  geometry_score INTEGER,
  
  -- Performance indicators
  lessons_passed INTEGER DEFAULT 0,
  lessons_attempted INTEGER DEFAULT 0,
  time_on_task_minutes INTEGER DEFAULT 0,
  
  -- Teacher information (flexible linking to existing teachers table)
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL, -- NULL allowed for unmatched teachers
  teacher_name TEXT, -- Using TEXT to handle comma issues and as fallback
  
  -- Data source tracking
  csv_file_source VARCHAR(500), -- Track which CSV file this came from
  import_batch_id UUID, -- Track batch imports
  data_quality_score DECIMAL(3,2) DEFAULT 1.0, -- 0-1 score for data quality
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(district_student_id, subject, academic_year, diagnostic_date),
  
  -- Data validation constraints
  CONSTRAINT valid_scale_scores CHECK (
    overall_scale_score IS NULL OR 
    (overall_scale_score >= 100 AND overall_scale_score <= 800)
  ),
  CONSTRAINT valid_domain_scores CHECK (
    (phonological_awareness_score IS NULL OR (phonological_awareness_score >= 100 AND phonological_awareness_score <= 800)) AND
    (phonics_score IS NULL OR (phonics_score >= 100 AND phonics_score <= 800)) AND
    (high_frequency_words_score IS NULL OR (high_frequency_words_score >= 100 AND high_frequency_words_score <= 800)) AND
    (vocabulary_score IS NULL OR (vocabulary_score >= 100 AND vocabulary_score <= 800)) AND
    (literary_comprehension_score IS NULL OR (literary_comprehension_score >= 100 AND literary_comprehension_score <= 800)) AND
    (informational_comprehension_score IS NULL OR (informational_comprehension_score >= 100 AND informational_comprehension_score <= 800)) AND
    (number_and_operations_score IS NULL OR (number_and_operations_score >= 100 AND number_and_operations_score <= 800)) AND
    (algebra_and_algebraic_thinking_score IS NULL OR (algebra_and_algebraic_thinking_score >= 100 AND algebra_and_algebraic_thinking_score <= 800)) AND
    (measurement_and_data_score IS NULL OR (measurement_and_data_score >= 100 AND measurement_and_data_score <= 800)) AND
    (geometry_score IS NULL OR (geometry_score >= 100 AND geometry_score <= 800))
  ),
  CONSTRAINT subject_specific_scores CHECK (
    (subject = 'ELA' AND 
     number_and_operations_score IS NULL AND 
     algebra_and_algebraic_thinking_score IS NULL AND 
     measurement_and_data_score IS NULL AND 
     geometry_score IS NULL) OR
    (subject = 'MATH' AND 
     phonological_awareness_score IS NULL AND 
     phonics_score IS NULL AND 
     high_frequency_words_score IS NULL AND 
     vocabulary_score IS NULL AND 
     literary_comprehension_score IS NULL AND 
     informational_comprehension_score IS NULL)
  )
);

-- Data quality tracking table
CREATE TABLE IF NOT EXISTS iready_data_quality_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagnostic_result_id UUID REFERENCES iready_diagnostic_results(id) ON DELETE CASCADE,
  
  -- Quality issues found
  issue_type VARCHAR(100) NOT NULL, -- e.g., 'TEACHER_NAME_COMMA', 'MISSING_SCORE', 'INVALID_DATE'
  issue_description TEXT,
  severity VARCHAR(20) DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
  
  -- Resolution tracking
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ETL operation tracking (isolated from main aeries_sync_operations)
CREATE TABLE IF NOT EXISTS iready_etl_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Operation details
  operation_type VARCHAR(50) NOT NULL, -- 'CSV_IMPORT', 'DATA_VALIDATION', 'CLEANUP'
  academic_year iready_academic_year NOT NULL,
  subject iready_subject,
  
  -- File information
  csv_file_path VARCHAR(500),
  csv_file_size_bytes BIGINT,
  csv_record_count INTEGER,
  
  -- Processing results
  operation_status VARCHAR(50) NOT NULL DEFAULT 'STARTED', -- STARTED, COMPLETED, FAILED, PARTIAL
  start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP WITH TIME ZONE,
  
  -- Data processed
  total_records_processed INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  duplicate_records INTEGER DEFAULT 0,
  
  -- Quality metrics
  data_quality_issues INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  
  -- Error tracking
  error_summary JSONB, -- Store structured error information
  
  -- Performance metrics
  processing_time_seconds INTEGER,
  records_per_second DECIMAL(10,2),
  
  -- Metadata
  initiated_by VARCHAR(100), -- User or system process
  batch_id UUID, -- Group related operations
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Year-based summary statistics (for quick dashboard queries)
CREATE TABLE IF NOT EXISTS iready_year_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Summary dimensions
  academic_year iready_academic_year NOT NULL,
  school_year VARCHAR(9) NOT NULL,
  subject iready_subject NOT NULL,
  grade_level INTEGER,
  
  -- Counts
  total_students INTEGER DEFAULT 0,
  total_assessments INTEGER DEFAULT 0,
  
  -- Performance distribution
  placement_three_plus_below INTEGER DEFAULT 0,
  placement_two_below INTEGER DEFAULT 0,
  placement_one_below INTEGER DEFAULT 0,
  placement_on_level INTEGER DEFAULT 0,
  placement_one_above INTEGER DEFAULT 0,
  placement_two_above INTEGER DEFAULT 0,
  placement_three_plus_above INTEGER DEFAULT 0,
  
  -- Score statistics
  avg_overall_scale_score DECIMAL(6,2),
  median_overall_scale_score INTEGER,
  min_overall_scale_score INTEGER,
  max_overall_scale_score INTEGER,
  
  -- Performance indicators
  avg_lessons_passed DECIMAL(6,2),
  avg_time_on_task_minutes DECIMAL(8,2),
  
  -- Data quality
  data_quality_score DECIMAL(3,2) DEFAULT 1.0,
  records_with_issues INTEGER DEFAULT 0,
  
  -- Timestamps
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(academic_year, subject, grade_level)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_iready_results_student_year_subject 
ON iready_diagnostic_results(student_id, academic_year, subject);

CREATE INDEX IF NOT EXISTS idx_iready_results_district_student_lookup
ON iready_diagnostic_results(district_student_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_iready_results_grade_performance
ON iready_diagnostic_results(grade_level, subject, overall_placement, academic_year);

CREATE INDEX IF NOT EXISTS idx_iready_results_diagnostic_date
ON iready_diagnostic_results(diagnostic_date DESC);

CREATE INDEX IF NOT EXISTS idx_iready_results_teacher_lookup
ON iready_diagnostic_results(teacher_id) WHERE teacher_id IS NOT NULL;

-- ETL and data quality indexes
CREATE INDEX IF NOT EXISTS idx_iready_etl_operations_batch
ON iready_etl_operations(batch_id, operation_status);

CREATE INDEX IF NOT EXISTS idx_iready_quality_unresolved
ON iready_data_quality_log(resolved, severity) WHERE resolved = false;

-- Summary table indexes
CREATE INDEX IF NOT EXISTS idx_iready_summary_lookup
ON iready_year_summary(academic_year, subject, grade_level);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE iready_diagnostic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE iready_data_quality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE iready_etl_operations ENABLE ROW LEVEL SECURITY;

-- RLS policies - only users in same district can access iReady data
CREATE POLICY district_isolation_iready_results ON iready_diagnostic_results
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM students s 
    JOIN users u ON s.district_id = u.district_id 
    WHERE s.id = iready_diagnostic_results.student_id AND u.id = auth.uid()
  )
);

CREATE POLICY district_isolation_iready_quality ON iready_data_quality_log
FOR ALL TO authenticated  
USING (
  EXISTS (
    SELECT 1 FROM iready_diagnostic_results idr
    JOIN students s ON idr.student_id = s.id
    JOIN users u ON s.district_id = u.district_id
    WHERE idr.id = iready_data_quality_log.diagnostic_result_id AND u.id = auth.uid()
  )
);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE TRIGGER update_iready_results_updated_at 
BEFORE UPDATE ON iready_diagnostic_results
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update summary statistics trigger
CREATE OR REPLACE FUNCTION update_iready_summary_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate summary for the affected year/subject/grade
  INSERT INTO iready_year_summary (
    academic_year, school_year, subject, grade_level,
    total_students, total_assessments,
    placement_three_plus_below, placement_two_below, placement_one_below,
    placement_on_level, placement_one_above, placement_two_above, placement_three_plus_above,
    avg_overall_scale_score, median_overall_scale_score, 
    min_overall_scale_score, max_overall_scale_score,
    avg_lessons_passed, avg_time_on_task_minutes
  )
  SELECT 
    NEW.academic_year, NEW.school_year, NEW.subject, NEW.grade_level,
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
  WHERE academic_year = NEW.academic_year 
    AND subject = NEW.subject 
    AND grade_level = NEW.grade_level
  GROUP BY academic_year, school_year, subject, grade_level
  ON CONFLICT (academic_year, subject, grade_level) 
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

CREATE TRIGGER trigger_update_iready_summary
AFTER INSERT OR UPDATE ON iready_diagnostic_results
FOR EACH ROW EXECUTE FUNCTION update_iready_summary_stats();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  -- Count new iReady tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name LIKE 'iready_%'
  AND table_type = 'BASE TABLE';
  
  RAISE NOTICE '✅ iReady Isolated Schema Created Successfully!';
  RAISE NOTICE '📊 iReady tables created: %', table_count;
  RAISE NOTICE '🔐 Row Level Security enabled for data protection';
  RAISE NOTICE '📈 Summary statistics and triggers configured';
  RAISE NOTICE '🎯 Ready for CSV import operations!';
END $$;