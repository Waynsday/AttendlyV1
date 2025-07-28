-- AP Romoland Attendance Tool - Initial Database Schema
-- This migration creates the core tables and types for the attendance tracking system
-- Follows FERPA compliance requirements for confidential student data

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types/enums
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'TARDY');
CREATE TYPE teacher_role AS ENUM ('TEACHER', 'ASSISTANT_PRINCIPAL', 'ADMINISTRATOR');
CREATE TYPE intervention_type AS ENUM (
  'PARENT_CONTACT',
  'COUNSELOR_REFERRAL', 
  'ATTENDANCE_CONTRACT',
  'SART_REFERRAL',
  'SARB_REFERRAL',
  'OTHER'
);
CREATE TYPE intervention_status AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED');

-- Students table
-- Stores student information with FERPA-compliant access controls
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 6 AND 8),
  email VARCHAR(254) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Teachers table
-- Stores teacher, assistant principal, and administrator information
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) UNIQUE NOT NULL,
  department VARCHAR(100) NOT NULL,
  role teacher_role NOT NULL DEFAULT 'TEACHER',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance records table
-- Stores daily attendance data for middle school (7 periods)
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id VARCHAR(50) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  school_year VARCHAR(9) NOT NULL, -- Format: 2024-2025
  period_1_status attendance_status NOT NULL,
  period_2_status attendance_status NOT NULL,
  period_3_status attendance_status NOT NULL,
  period_4_status attendance_status NOT NULL,
  period_5_status attendance_status NOT NULL,
  period_6_status attendance_status NOT NULL,
  period_7_status attendance_status NOT NULL,
  daily_attendance_percentage DECIMAL(5,2) NOT NULL CHECK (daily_attendance_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, date)
);

-- Interventions table
-- Stores attendance interventions and their outcomes
CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id VARCHAR(50) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  type intervention_type NOT NULL,
  description TEXT NOT NULL,
  created_by VARCHAR(50) NOT NULL REFERENCES teachers(employee_id),
  scheduled_date DATE NOT NULL,
  status intervention_status DEFAULT 'SCHEDULED',
  completed_date TIMESTAMP WITH TIME ZONE,
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
-- Student indexes
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_grade_level ON students(grade_level);
CREATE INDEX idx_students_is_active ON students(is_active);
CREATE INDEX idx_students_name ON students(last_name, first_name);

-- Teacher indexes
CREATE INDEX idx_teachers_employee_id ON teachers(employee_id);
CREATE INDEX idx_teachers_role ON teachers(role);
CREATE INDEX idx_teachers_department ON teachers(department);
CREATE INDEX idx_teachers_is_active ON teachers(is_active);

-- Attendance record indexes
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_date ON attendance_records(date);
CREATE INDEX idx_attendance_records_school_year ON attendance_records(school_year);
CREATE INDEX idx_attendance_records_student_date ON attendance_records(student_id, date);
CREATE INDEX idx_attendance_records_attendance_percentage ON attendance_records(daily_attendance_percentage);

-- Intervention indexes
CREATE INDEX idx_interventions_student_id ON interventions(student_id);
CREATE INDEX idx_interventions_type ON interventions(type);
CREATE INDEX idx_interventions_status ON interventions(status);
CREATE INDEX idx_interventions_created_by ON interventions(created_by);
CREATE INDEX idx_interventions_scheduled_date ON interventions(scheduled_date);
CREATE INDEX idx_interventions_created_at ON interventions(created_at);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interventions_updated_at BEFORE UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate daily attendance percentage
CREATE OR REPLACE FUNCTION calculate_daily_attendance_percentage(
  p1 attendance_status,
  p2 attendance_status,
  p3 attendance_status,
  p4 attendance_status,
  p5 attendance_status,
  p6 attendance_status,
  p7 attendance_status
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  present_count INTEGER := 0;
BEGIN
  -- Count present and tardy as attended
  IF p1 IN ('PRESENT', 'TARDY') THEN present_count := present_count + 1; END IF;
  IF p2 IN ('PRESENT', 'TARDY') THEN present_count := present_count + 1; END IF;
  IF p3 IN ('PRESENT', 'TARDY') THEN present_count := present_count + 1; END IF;
  IF p4 IN ('PRESENT', 'TARDY') THEN present_count := present_count + 1; END IF;
  IF p5 IN ('PRESENT', 'TARDY') THEN present_count := present_count + 1; END IF;
  IF p6 IN ('PRESENT', 'TARDY') THEN present_count := present_count + 1; END IF;
  IF p7 IN ('PRESENT', 'TARDY') THEN present_count := present_count + 1; END IF;
  
  RETURN ROUND((present_count::DECIMAL / 7.0) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to automatically calculate attendance percentage
CREATE OR REPLACE FUNCTION auto_calculate_attendance_percentage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.daily_attendance_percentage := calculate_daily_attendance_percentage(
    NEW.period_1_status,
    NEW.period_2_status,
    NEW.period_3_status,
    NEW.period_4_status,
    NEW.period_5_status,
    NEW.period_6_status,
    NEW.period_7_status
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_attendance_percentage_trigger
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION auto_calculate_attendance_percentage();

-- Comments for documentation
COMMENT ON TABLE students IS 'Stores student information with FERPA compliance';
COMMENT ON TABLE teachers IS 'Stores teacher, assistant principal, and administrator information';
COMMENT ON TABLE attendance_records IS 'Stores daily attendance data for middle school (7 periods)';
COMMENT ON TABLE interventions IS 'Stores attendance interventions and their outcomes';

COMMENT ON COLUMN students.student_id IS 'Unique student identifier from school information system';
COMMENT ON COLUMN students.grade_level IS 'Grade level (6-8 for middle school)';
COMMENT ON COLUMN teachers.employee_id IS 'Unique employee identifier (format: T followed by digits)';
COMMENT ON COLUMN attendance_records.daily_attendance_percentage IS 'Calculated percentage based on periods attended';
COMMENT ON COLUMN interventions.created_by IS 'Employee ID of teacher who created the intervention';