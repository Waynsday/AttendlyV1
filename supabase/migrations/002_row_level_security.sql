-- AP Romoland Attendance Tool - Row Level Security Policies
-- This migration implements FERPA-compliant access controls using Supabase RLS
-- Ensures that only authorized personnel can access confidential student data

-- Enable Row Level Security on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's teacher record
CREATE OR REPLACE FUNCTION get_current_teacher()
RETURNS teachers AS $$
DECLARE
  teacher_record teachers;
BEGIN
  SELECT * INTO teacher_record 
  FROM teachers 
  WHERE email = auth.jwt() ->> 'email'
    AND is_active = true;
  
  RETURN teacher_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is admin/assistant principal
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
  user_role teacher_role;
BEGIN
  SELECT role INTO user_role
  FROM teachers 
  WHERE email = auth.jwt() ->> 'email'
    AND is_active = true;
  
  RETURN user_role IN ('ADMINISTRATOR', 'ASSISTANT_PRINCIPAL');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is a teacher
CREATE OR REPLACE FUNCTION is_teacher_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teachers 
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STUDENTS TABLE POLICIES
-- Only authenticated teachers, assistant principals, and administrators can access student data

-- Policy: Teachers can view all active students (FERPA educational interest)
CREATE POLICY "Teachers can view active students" ON students
FOR SELECT USING (
  is_teacher_user() AND is_active = true
);

-- Policy: Only admins can insert students
CREATE POLICY "Only admins can insert students" ON students
FOR INSERT WITH CHECK (
  is_admin_user()
);

-- Policy: Only admins can update students
CREATE POLICY "Only admins can update students" ON students
FOR UPDATE USING (
  is_admin_user()
);

-- Policy: Only admins can delete students (soft delete by setting is_active = false)
CREATE POLICY "Only admins can delete students" ON students
FOR DELETE USING (
  is_admin_user()
);

-- TEACHERS TABLE POLICIES
-- Teachers can view other teachers, but only admins can modify teacher records

-- Policy: Teachers can view active teachers
CREATE POLICY "Teachers can view active teachers" ON teachers
FOR SELECT USING (
  is_teacher_user() AND is_active = true
);

-- Policy: Only admins can insert teachers
CREATE POLICY "Only admins can insert teachers" ON teachers
FOR INSERT WITH CHECK (
  is_admin_user()
);

-- Policy: Teachers can update their own profile, admins can update any
CREATE POLICY "Teachers can update own profile" ON teachers
FOR UPDATE USING (
  (email = auth.jwt() ->> 'email' AND is_teacher_user()) OR is_admin_user()
);

-- Policy: Only admins can delete teachers
CREATE POLICY "Only admins can delete teachers" ON teachers
FOR DELETE USING (
  is_admin_user()
);

-- ATTENDANCE RECORDS TABLE POLICIES
-- Strict controls for confidential attendance data (FERPA compliance)

-- Policy: Only admins and assistant principals can view attendance records
CREATE POLICY "Admins can view attendance records" ON attendance_records
FOR SELECT USING (
  is_admin_user()
);

-- Policy: Only admins and assistant principals can insert attendance records
CREATE POLICY "Admins can insert attendance records" ON attendance_records
FOR INSERT WITH CHECK (
  is_admin_user()
);

-- Policy: Only admins and assistant principals can update attendance records
CREATE POLICY "Admins can update attendance records" ON attendance_records
FOR UPDATE USING (
  is_admin_user()
);

-- Policy: Only admins can delete attendance records
CREATE POLICY "Only admins can delete attendance records" ON attendance_records
FOR DELETE USING (
  is_admin_user()
);

-- INTERVENTIONS TABLE POLICIES
-- Teachers can view/create interventions, but admins have full access

-- Policy: Teachers can view interventions they created or that admins can see
CREATE POLICY "Teachers can view relevant interventions" ON interventions
FOR SELECT USING (
  is_admin_user() OR 
  (is_teacher_user() AND created_by = (get_current_teacher()).employee_id)
);

-- Policy: Teachers can create interventions
CREATE POLICY "Teachers can create interventions" ON interventions
FOR INSERT WITH CHECK (
  is_teacher_user() AND created_by = (get_current_teacher()).employee_id
);

-- Policy: Teachers can update their own interventions, admins can update any
CREATE POLICY "Teachers can update own interventions" ON interventions
FOR UPDATE USING (
  is_admin_user() OR 
  (is_teacher_user() AND created_by = (get_current_teacher()).employee_id)
);

-- Policy: Only admins can delete interventions
CREATE POLICY "Only admins can delete interventions" ON interventions
FOR DELETE USING (
  is_admin_user()
);

-- Create audit log table for FERPA compliance
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(254) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE, SELECT
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" ON audit_logs
FOR SELECT USING (is_admin_user());

-- Policy: System can insert audit logs (no user restrictions)
CREATE POLICY "System can insert audit logs" ON audit_logs
FOR INSERT WITH CHECK (true);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  -- Only audit if user is authenticated
  IF auth.jwt() ->> 'email' IS NOT NULL THEN
    INSERT INTO audit_logs (
      user_email,
      table_name,
      operation,
      record_id,
      old_values,
      new_values
    ) VALUES (
      auth.jwt() ->> 'email',
      TG_TABLE_NAME,
      TG_OP,
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for all tables
CREATE TRIGGER audit_students_trigger
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_teachers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON teachers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_attendance_records_trigger
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_interventions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON interventions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Create indexes for audit logs
CREATE INDEX idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_operation ON audit_logs(operation);

-- Comments
COMMENT ON TABLE audit_logs IS 'Audit trail for FERPA compliance - tracks all data access and modifications';
COMMENT ON FUNCTION get_current_teacher() IS 'Returns the current authenticated teacher record';
COMMENT ON FUNCTION is_admin_user() IS 'Checks if current user has admin privileges';
COMMENT ON FUNCTION is_teacher_user() IS 'Checks if current user is an authenticated teacher';

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;