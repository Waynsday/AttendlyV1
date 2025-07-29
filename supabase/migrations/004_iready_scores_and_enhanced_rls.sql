-- AP Romoland Attendance Tool - iReady Scores and Enhanced RLS
-- This migration adds the iReady diagnostic scores table and comprehensive RLS policies
-- Supports multi-year tracking (Current_Year, Current_Year-1, Current_Year-2)
-- FERPA-compliant with role-based access controls

-- Create iReady-specific types
CREATE TYPE iready_subject AS ENUM ('ELA', 'MATH');
CREATE TYPE iready_placement AS ENUM (
  'THREE_OR_MORE_GRADE_LEVELS_BELOW',
  'TWO_GRADE_LEVELS_BELOW', 
  'ONE_GRADE_LEVEL_BELOW',
  'ON_GRADE_LEVEL',
  'ONE_GRADE_LEVEL_ABOVE',
  'TWO_GRADE_LEVELS_ABOVE',
  'THREE_OR_MORE_GRADE_LEVELS_ABOVE'
);
CREATE TYPE academic_year AS ENUM ('CURRENT_YEAR', 'CURRENT_YEAR_MINUS_1', 'CURRENT_YEAR_MINUS_2');

-- Teacher assignments table for RLS policy enforcement
CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 6 AND 8),
  school_year VARCHAR(9) NOT NULL, -- Format: 2024-2025
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(teacher_id, grade_level, school_year)
);

-- iReady diagnostic scores table
-- Stores diagnostic results across multiple years for longitudinal analysis
CREATE TABLE iready_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id VARCHAR(50) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  subject iready_subject NOT NULL,
  academic_year academic_year NOT NULL,
  school_year VARCHAR(9) NOT NULL, -- Format: 2024-2025 
  diagnostic_date DATE NOT NULL,
  
  -- Overall diagnostic results
  overall_scale_score INTEGER CHECK (overall_scale_score BETWEEN 100 AND 800),
  overall_placement iready_placement NOT NULL,
  annual_typical_growth_measure INTEGER CHECK (annual_typical_growth_measure >= 0),
  percent_progress_to_annual_typical_growth DECIMAL(5,2) CHECK (percent_progress_to_annual_typical_growth >= 0),
  
  -- Domain-specific scores (ELA)
  phonological_awareness_score INTEGER CHECK (phonological_awareness_score BETWEEN 100 AND 800),
  phonics_score INTEGER CHECK (phonics_score BETWEEN 100 AND 800),
  high_frequency_words_score INTEGER CHECK (high_frequency_words_score BETWEEN 100 AND 800),
  vocabulary_score INTEGER CHECK (vocabulary_score BETWEEN 100 AND 800),
  literary_comprehension_score INTEGER CHECK (literary_comprehension_score BETWEEN 100 AND 800),
  informational_comprehension_score INTEGER CHECK (informational_comprehension_score BETWEEN 100 AND 800),
  
  -- Domain-specific scores (Math)
  number_and_operations_score INTEGER CHECK (number_and_operations_score BETWEEN 100 AND 800),
  algebra_and_algebraic_thinking_score INTEGER CHECK (algebra_and_algebraic_thinking_score BETWEEN 100 AND 800),
  measurement_and_data_score INTEGER CHECK (measurement_and_data_score BETWEEN 100 AND 800),
  geometry_score INTEGER CHECK (geometry_score BETWEEN 100 AND 800),
  
  -- Performance indicators
  lessons_passed INTEGER DEFAULT 0 CHECK (lessons_passed >= 0),
  lessons_attempted INTEGER DEFAULT 0 CHECK (lessons_attempted >= 0),
  time_on_task_minutes INTEGER DEFAULT 0 CHECK (time_on_task_minutes >= 0),
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(student_id, subject, academic_year, diagnostic_date),
  
  -- Domain-specific validation constraints
  CONSTRAINT ela_scores_check CHECK (
    subject != 'ELA' OR (
      phonological_awareness_score IS NOT NULL AND
      phonics_score IS NOT NULL AND
      high_frequency_words_score IS NOT NULL AND
      vocabulary_score IS NOT NULL AND
      literary_comprehension_score IS NOT NULL AND
      informational_comprehension_score IS NOT NULL AND
      number_and_operations_score IS NULL AND
      algebra_and_algebraic_thinking_score IS NULL AND
      measurement_and_data_score IS NULL AND
      geometry_score IS NULL
    )
  ),
  CONSTRAINT math_scores_check CHECK (
    subject != 'MATH' OR (
      number_and_operations_score IS NOT NULL AND
      algebra_and_algebraic_thinking_score IS NOT NULL AND
      measurement_and_data_score IS NOT NULL AND
      geometry_score IS NOT NULL AND
      phonological_awareness_score IS NULL AND
      phonics_score IS NULL AND
      high_frequency_words_score IS NULL AND
      vocabulary_score IS NULL AND
      literary_comprehension_score IS NULL AND
      informational_comprehension_score IS NULL
    )
  )
);

-- Indexes for performance optimization
CREATE INDEX idx_teacher_assignments_teacher_id ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_grade_level ON teacher_assignments(grade_level);
CREATE INDEX idx_teacher_assignments_school_year ON teacher_assignments(school_year);
CREATE INDEX idx_teacher_assignments_active ON teacher_assignments(is_active);

CREATE INDEX idx_iready_scores_student_id ON iready_scores(student_id);
CREATE INDEX idx_iready_scores_subject ON iready_scores(subject);
CREATE INDEX idx_iready_scores_academic_year ON iready_scores(academic_year);
CREATE INDEX idx_iready_scores_school_year ON iready_scores(school_year);
CREATE INDEX idx_iready_scores_diagnostic_date ON iready_scores(diagnostic_date);
CREATE INDEX idx_iready_scores_overall_placement ON iready_scores(overall_placement);
CREATE INDEX idx_iready_scores_student_subject_year ON iready_scores(student_id, subject, academic_year);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_teacher_assignments_updated_at 
  BEFORE UPDATE ON teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iready_scores_updated_at 
  BEFORE UPDATE ON iready_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iready_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Students table
CREATE POLICY students_access_policy ON students
FOR ALL TO authenticated
USING (
  -- Teachers can only access students in their assigned grade levels
  EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN teachers t ON t.id = ta.teacher_id
    WHERE t.employee_id = auth.jwt()->>'employee_id'
    AND ta.grade_level = students.grade_level
    AND ta.is_active = true
    AND t.is_active = true
  )
  OR
  -- Administrators and Assistant Principals have broader access
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.employee_id = auth.jwt()->>'employee_id'
    AND t.role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL')
    AND t.is_active = true
  )
);

-- RLS Policies for Teachers table
CREATE POLICY teachers_access_policy ON teachers
FOR ALL TO authenticated
USING (
  -- Teachers can view their own record and colleagues in same department
  employee_id = auth.jwt()->>'employee_id'
  OR
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.employee_id = auth.jwt()->>'employee_id'
    AND t.role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL')
    AND t.is_active = true
  )
);

-- RLS Policies for Teacher Assignments table
CREATE POLICY teacher_assignments_access_policy ON teacher_assignments
FOR ALL TO authenticated
USING (
  -- Teachers can view their own assignments
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = teacher_assignments.teacher_id
    AND t.employee_id = auth.jwt()->>'employee_id'
    AND t.is_active = true
  )
  OR
  -- Administrators can view all assignments
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.employee_id = auth.jwt()->>'employee_id'
    AND t.role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL')
    AND t.is_active = true
  )
);

-- RLS Policies for Attendance Records table
CREATE POLICY attendance_records_access_policy ON attendance_records
FOR ALL TO authenticated
USING (
  -- Teachers can only access attendance for students in their assigned grade levels
  EXISTS (
    SELECT 1 FROM students s
    JOIN teacher_assignments ta ON ta.grade_level = s.grade_level
    JOIN teachers t ON t.id = ta.teacher_id
    WHERE s.student_id = attendance_records.student_id
    AND t.employee_id = auth.jwt()->>'employee_id'
    AND ta.is_active = true
    AND t.is_active = true
    AND s.is_active = true
  )
  OR
  -- Administrators have broader access
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.employee_id = auth.jwt()->>'employee_id'
    AND t.role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL')
    AND t.is_active = true
  )
);

-- RLS Policies for Interventions table
CREATE POLICY interventions_access_policy ON interventions
FOR ALL TO authenticated
USING (
  -- Teachers can access interventions they created or for students in their assigned grade levels
  created_by = auth.jwt()->>'employee_id'
  OR
  EXISTS (
    SELECT 1 FROM students s
    JOIN teacher_assignments ta ON ta.grade_level = s.grade_level
    JOIN teachers t ON t.id = ta.teacher_id
    WHERE s.student_id = interventions.student_id
    AND t.employee_id = auth.jwt()->>'employee_id'
    AND ta.is_active = true
    AND t.is_active = true
    AND s.is_active = true
  )
  OR
  -- Administrators have broader access
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.employee_id = auth.jwt()->>'employee_id'
    AND t.role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL')
    AND t.is_active = true
  )
);

-- RLS Policies for iReady Scores table
CREATE POLICY iready_scores_access_policy ON iready_scores
FOR ALL TO authenticated
USING (
  -- Teachers can only access iReady scores for students in their assigned grade levels
  EXISTS (
    SELECT 1 FROM students s
    JOIN teacher_assignments ta ON ta.grade_level = s.grade_level
    JOIN teachers t ON t.id = ta.teacher_id
    WHERE s.student_id = iready_scores.student_id
    AND t.employee_id = auth.jwt()->>'employee_id'
    AND ta.is_active = true
    AND t.is_active = true
    AND s.is_active = true
  )
  OR
  -- Administrators have broader access
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.employee_id = auth.jwt()->>'employee_id'
    AND t.role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL')
    AND t.is_active = true
  )
);

-- Audit logging table for FERPA compliance
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  operation VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE, SELECT
  user_id VARCHAR(50) NOT NULL, -- employee_id from JWT
  user_role teacher_role NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_operation ON audit_log(operation);

-- Function to log data access for FERPA compliance
CREATE OR REPLACE FUNCTION log_data_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name,
    record_id,
    operation,
    user_id,
    user_role,
    old_values,
    new_values
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.jwt()->>'employee_id',
    (SELECT role FROM teachers WHERE employee_id = auth.jwt()->>'employee_id'),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_students_trigger
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION log_data_access();

CREATE TRIGGER audit_attendance_records_trigger
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION log_data_access();

CREATE TRIGGER audit_iready_scores_trigger
  AFTER INSERT OR UPDATE OR DELETE ON iready_scores
  FOR EACH ROW EXECUTE FUNCTION log_data_access();

CREATE TRIGGER audit_interventions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON interventions
  FOR EACH ROW EXECUTE FUNCTION log_data_access();

-- Views for common queries and performance optimization

-- Student summary view with latest iReady scores and attendance metrics
CREATE VIEW student_summary AS
SELECT 
  s.id,
  s.student_id,
  s.first_name,
  s.last_name,
  s.grade_level,
  s.email,
  s.is_active,
  
  -- Latest attendance metrics (last 30 days)
  COALESCE(
    ROUND(
      AVG(ar.daily_attendance_percentage) 
      FILTER (WHERE ar.date >= CURRENT_DATE - INTERVAL '30 days')
    , 2)
  , 0) as attendance_percentage_30_days,
  
  -- Total absences in current school year
  COALESCE(
    COUNT(ar.id) FILTER (
      WHERE ar.daily_attendance_percentage < 100 
      AND ar.school_year = (
        SELECT CASE 
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 8 
          THEN EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text
          ELSE (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::text || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::text
        END
      )
    )
  , 0) as total_absences_current_year,
  
  -- Chronic absenteeism flag (>10% absent)
  CASE 
    WHEN COALESCE(
      ROUND(
        AVG(ar.daily_attendance_percentage) 
        FILTER (WHERE ar.date >= CURRENT_DATE - INTERVAL '30 days')
      , 2)
    , 0) < 90 
    THEN 'TIER_3'
    WHEN COALESCE(
      COUNT(ar.id) FILTER (
        WHERE ar.daily_attendance_percentage < 100 
        AND ar.date >= CURRENT_DATE - INTERVAL '30 days'
      )
    , 0) BETWEEN 3 AND 9 
    THEN 'TIER_2'
    WHEN COALESCE(
      COUNT(ar.id) FILTER (
        WHERE ar.daily_attendance_percentage < 100 
        AND ar.date >= CURRENT_DATE - INTERVAL '7 days'
      )
    , 0) BETWEEN 1 AND 2 
    THEN 'TIER_1'
    ELSE 'NO_RISK'
  END as risk_tier,
  
  -- Latest iReady ELA score
  (
    SELECT irs.overall_scale_score 
    FROM iready_scores irs 
    WHERE irs.student_id = s.student_id 
    AND irs.subject = 'ELA'
    AND irs.academic_year = 'CURRENT_YEAR'
    ORDER BY irs.diagnostic_date DESC 
    LIMIT 1
  ) as latest_ela_score,
  
  -- Latest iReady Math score
  (
    SELECT irs.overall_scale_score 
    FROM iready_scores irs 
    WHERE irs.student_id = s.student_id 
    AND irs.subject = 'MATH'
    AND irs.academic_year = 'CURRENT_YEAR'
    ORDER BY irs.diagnostic_date DESC 
    LIMIT 1
  ) as latest_math_score,
  
  -- Active interventions count
  (
    SELECT COUNT(*) 
    FROM interventions i 
    WHERE i.student_id = s.student_id 
    AND i.status IN ('SCHEDULED', 'COMPLETED')
    AND i.scheduled_date >= CURRENT_DATE - INTERVAL '90 days'
  ) as active_interventions_count

FROM students s
LEFT JOIN attendance_records ar ON ar.student_id = s.student_id
WHERE s.is_active = true
GROUP BY s.id, s.student_id, s.first_name, s.last_name, s.grade_level, s.email, s.is_active;

-- Grant appropriate permissions
GRANT SELECT ON student_summary TO authenticated;

-- Comments for documentation
COMMENT ON TABLE teacher_assignments IS 'Maps teachers to grade levels for RLS policy enforcement';
COMMENT ON TABLE iready_scores IS 'Stores iReady diagnostic scores with multi-year support';
COMMENT ON TABLE audit_log IS 'FERPA-compliant audit trail for all student data access';
COMMENT ON VIEW student_summary IS 'Optimized view combining attendance, iReady, and intervention data';

COMMENT ON COLUMN iready_scores.academic_year IS 'Relative year classification for longitudinal analysis';
COMMENT ON COLUMN iready_scores.overall_placement IS 'Grade-level placement based on diagnostic results';
COMMENT ON COLUMN audit_log.user_id IS 'Employee ID from JWT token for audit trail';

-- Grant RLS bypass to service role for data imports
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER TABLE students FORCE ROW LEVEL SECURITY;
ALTER TABLE teachers FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE attendance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE interventions FORCE ROW LEVEL SECURITY;
ALTER TABLE iready_scores FORCE ROW LEVEL SECURITY;