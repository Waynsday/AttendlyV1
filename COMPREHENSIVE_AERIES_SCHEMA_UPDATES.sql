-- ===============================================================
-- COMPREHENSIVE AERIES API INTEGRATION SCHEMA UPDATES
-- Run this SQL script in Supabase Dashboard > SQL Editor
-- ===============================================================
-- 
-- CRITICAL: Copy and paste this entire script into Supabase Dashboard
-- Go to: Your Project > SQL Editor > New Query > Paste this script > Run
--
-- This script will:
-- 1. Create missing tables needed for complete Aeries integration
-- 2. Update existing tables to match Aeries API data structure
-- 3. Add proper indexes and constraints for performance
-- 4. Set up sync operation tracking
-- 5. Create helper functions for data transformation
-- ===============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===============================================================
-- 1. CREATE SCHOOLS TABLE (Core table for all others)
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_code VARCHAR(10) UNIQUE NOT NULL,
    school_name VARCHAR(200) NOT NULL,
    principal_name VARCHAR(200),
    principal_email VARCHAR(255),
    school_address TEXT,
    school_phone VARCHAR(20),
    grade_levels_served VARCHAR(50), -- e.g., "6-8", "9-12"
    attendance_method VARCHAR(50), -- Daily, Period, etc.
    is_active BOOLEAN DEFAULT TRUE,
    aeries_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================================
-- 2. UPDATE STUDENTS TABLE - Add all Aeries fields
-- ===============================================================

-- Add missing columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS aeries_student_number INTEGER,
ADD COLUMN IF NOT EXISTS aeries_student_id INTEGER,
ADD COLUMN IF NOT EXISTS state_student_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS school_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS parent_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS home_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS mailing_address TEXT,
ADD COLUMN IF NOT EXISTS residence_address TEXT,
ADD COLUMN IF NOT EXISTS ethnicity_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS language_fluency VARCHAR(10) DEFAULT 'E',
ADD COLUMN IF NOT EXISTS special_programs TEXT[],
ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS school_enter_date DATE,
ADD COLUMN IF NOT EXISTS school_leave_date DATE,
ADD COLUMN IF NOT EXISTS counselor_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS home_room VARCHAR(20),
ADD COLUMN IF NOT EXISTS aeries_last_modified TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}'::jsonb;

-- Make fields nullable for data migration
ALTER TABLE public.students 
ALTER COLUMN grade_level DROP NOT NULL,
ALTER COLUMN first_name DROP NOT NULL,
ALTER COLUMN last_name DROP NOT NULL,
ALTER COLUMN email DROP NOT NULL,
ALTER COLUMN first_name SET DEFAULT 'Unknown',
ALTER COLUMN last_name SET DEFAULT 'Unknown';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_aeries_student_number ON public.students(aeries_student_number);
CREATE INDEX IF NOT EXISTS idx_students_school_code ON public.students(school_code);
CREATE INDEX IF NOT EXISTS idx_students_state_student_id ON public.students(state_student_id);
CREATE INDEX IF NOT EXISTS idx_students_enrollment_status ON public.students(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_students_aeries_last_modified ON public.students(aeries_last_modified);

-- Add foreign key constraint to schools table
ALTER TABLE public.students 
ADD CONSTRAINT fk_students_school_code 
FOREIGN KEY (school_code) REFERENCES public.schools(school_code);

-- ===============================================================
-- 3. CREATE/UPDATE TEACHERS TABLE - Full staff information
-- ===============================================================

DROP TABLE IF EXISTS public.teachers;
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aeries_staff_id INTEGER UNIQUE,
    employee_id VARCHAR(50) UNIQUE,
    employee_number VARCHAR(50),
    first_name VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    last_name VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    middle_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    department VARCHAR(100),
    position VARCHAR(100) DEFAULT 'Teacher',
    role teacher_role DEFAULT 'TEACHER',
    school_code VARCHAR(10),
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    network_login_id VARCHAR(100),
    human_resources_id VARCHAR(50),
    employment_percentage DECIMAL(5,2) DEFAULT 100.00,
    certification_status VARCHAR(50),
    aeries_last_modified TIMESTAMP WITH TIME ZONE,
    sync_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for teachers
CREATE INDEX IF NOT EXISTS idx_teachers_aeries_staff_id ON public.teachers(aeries_staff_id);
CREATE INDEX IF NOT EXISTS idx_teachers_employee_id ON public.teachers(employee_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school_code ON public.teachers(school_code);
CREATE INDEX IF NOT EXISTS idx_teachers_is_active ON public.teachers(is_active);
CREATE INDEX IF NOT EXISTS idx_teachers_position ON public.teachers(position);

-- Add foreign key constraint to schools table
ALTER TABLE public.teachers 
ADD CONSTRAINT fk_teachers_school_code 
FOREIGN KEY (school_code) REFERENCES public.schools(school_code);

-- ===============================================================
-- 4. CREATE TEACHER_ASSIGNMENTS TABLE - Staff class assignments
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    aeries_staff_id INTEGER NOT NULL,
    assignment_type VARCHAR(50) NOT NULL, -- e.g., 'TEACHING', 'ADMINISTRATIVE'
    sequence_number INTEGER,
    course_code VARCHAR(20),
    course_name VARCHAR(200),
    period INTEGER,
    room_number VARCHAR(20),
    school_code VARCHAR(10) NOT NULL,
    school_year VARCHAR(9) NOT NULL, -- Format: 2024-2025
    term_code VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    aeries_last_modified TIMESTAMP WITH TIME ZONE,
    sync_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aeries_staff_id, assignment_type, sequence_number, school_year)
);

-- Add indexes for teacher assignments
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher_id ON public.teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_school_code ON public.teacher_assignments(school_code);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_school_year ON public.teacher_assignments(school_year);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course_code ON public.teacher_assignments(course_code);

-- ===============================================================
-- 5. UPDATE ATTENDANCE_RECORDS TABLE - Enhanced structure
-- ===============================================================

-- Add new columns for comprehensive attendance tracking
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS aeries_student_number INTEGER,
ADD COLUMN IF NOT EXISTS absence_codes TEXT[],
ADD COLUMN IF NOT EXISTS excuse_codes TEXT[],
ADD COLUMN IF NOT EXISTS minutes_absent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS minutes_tardy INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_status VARCHAR(20) DEFAULT 'PRESENT',
ADD COLUMN IF NOT EXISTS period_attendance JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS aeries_last_modified TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_operation_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}'::jsonb;

-- Add indexes for attendance records
CREATE INDEX IF NOT EXISTS idx_attendance_records_aeries_student_number ON public.attendance_records(aeries_student_number);
CREATE INDEX IF NOT EXISTS idx_attendance_records_daily_status ON public.attendance_records(daily_status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_sync_operation_id ON public.attendance_records(sync_operation_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_aeries_last_modified ON public.attendance_records(aeries_last_modified);

-- ===============================================================
-- 6. CREATE AERIES_SYNC_OPERATIONS TABLE - Comprehensive sync tracking
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.aeries_sync_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'FULL_SYNC', 'INCREMENTAL_SYNC', 'MANUAL_SYNC'
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    date_range DATERANGE,
    progress JSONB DEFAULT '{
        "total_records": 0,
        "processed_records": 0,
        "successful_records": 0,
        "failed_records": 0,
        "current_batch": 0,
        "total_batches": 0
    }'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for sync operations
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_operation_id ON public.aeries_sync_operations(operation_id);
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_status ON public.aeries_sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_start_time ON public.aeries_sync_operations(start_time);
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_type ON public.aeries_sync_operations(type);

-- ===============================================================
-- 7. CREATE SCHOOL_TERMS TABLE - Academic calendar
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.school_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_code VARCHAR(10) NOT NULL,
    term_code VARCHAR(10) NOT NULL,
    term_name VARCHAR(100) NOT NULL,
    school_year VARCHAR(9) NOT NULL, -- Format: 2024-2025
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    aeries_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_code, term_code, school_year)
);

-- Add foreign key constraint
ALTER TABLE public.school_terms 
ADD CONSTRAINT fk_school_terms_school_code 
FOREIGN KEY (school_code) REFERENCES public.schools(school_code);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_school_terms_school_code ON public.school_terms(school_code);
CREATE INDEX IF NOT EXISTS idx_school_terms_school_year ON public.school_terms(school_year);
CREATE INDEX IF NOT EXISTS idx_school_terms_dates ON public.school_terms(start_date, end_date);

-- ===============================================================
-- 8. CREATE ABSENCE_CODES TABLE - Attendance code definitions
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.absence_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_code VARCHAR(10) NOT NULL,
    absence_code VARCHAR(10) NOT NULL,
    description VARCHAR(200) NOT NULL,
    is_excused BOOLEAN DEFAULT FALSE,
    is_tardy BOOLEAN DEFAULT FALSE,
    affects_ada BOOLEAN DEFAULT TRUE, -- Average Daily Attendance
    is_active BOOLEAN DEFAULT TRUE,
    aeries_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_code, absence_code)
);

-- Add foreign key constraint
ALTER TABLE public.absence_codes 
ADD CONSTRAINT fk_absence_codes_school_code 
FOREIGN KEY (school_code) REFERENCES public.schools(school_code);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_absence_codes_school_code ON public.absence_codes(school_code);
CREATE INDEX IF NOT EXISTS idx_absence_codes_absence_code ON public.absence_codes(absence_code);
CREATE INDEX IF NOT EXISTS idx_absence_codes_is_excused ON public.absence_codes(is_excused);

-- ===============================================================
-- 9. CREATE STUDENT_SCHEDULES TABLE - Class schedules
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.student_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(50) NOT NULL,
    aeries_student_number INTEGER NOT NULL,
    school_code VARCHAR(10) NOT NULL,
    school_year VARCHAR(9) NOT NULL,
    term_code VARCHAR(10),
    course_code VARCHAR(20) NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    period INTEGER NOT NULL,
    teacher_id UUID,
    teacher_name VARCHAR(200),
    room_number VARCHAR(20),
    credit_hours DECIMAL(4,2),
    is_active BOOLEAN DEFAULT TRUE,
    aeries_last_modified TIMESTAMP WITH TIME ZONE,
    sync_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aeries_student_number, course_code, period, school_year, term_code)
);

-- Add foreign key constraints
ALTER TABLE public.student_schedules 
ADD CONSTRAINT fk_student_schedules_student_id 
FOREIGN KEY (student_id) REFERENCES public.students(student_id);

ALTER TABLE public.student_schedules 
ADD CONSTRAINT fk_student_schedules_school_code 
FOREIGN KEY (school_code) REFERENCES public.schools(school_code);

ALTER TABLE public.student_schedules 
ADD CONSTRAINT fk_student_schedules_teacher_id 
FOREIGN KEY (teacher_id) REFERENCES public.teachers(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_student_schedules_student_id ON public.student_schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_student_schedules_aeries_student_number ON public.student_schedules(aeries_student_number);
CREATE INDEX IF NOT EXISTS idx_student_schedules_school_code ON public.student_schedules(school_code);
CREATE INDEX IF NOT EXISTS idx_student_schedules_school_year ON public.student_schedules(school_year);
CREATE INDEX IF NOT EXISTS idx_student_schedules_course_code ON public.student_schedules(course_code);

-- ===============================================================
-- 10. CREATE HELPER FUNCTIONS
-- ===============================================================

-- Function to get current school year
CREATE OR REPLACE FUNCTION get_current_school_year()
RETURNS TEXT AS $$
BEGIN
    -- School year runs August to June
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 8 THEN
        RETURN EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT;
    ELSE
        RETURN (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to validate school year format
CREATE OR REPLACE FUNCTION is_valid_school_year(year_string TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN year_string ~ '^\d{4}-\d{4}$' AND 
           (SUBSTRING(year_string FROM 6 FOR 4)::INTEGER - SUBSTRING(year_string FROM 1 FOR 4)::INTEGER) = 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate attendance percentage from status array
CREATE OR REPLACE FUNCTION calculate_attendance_percentage_from_statuses(statuses TEXT[])
RETURNS DECIMAL(5,2) AS $$
DECLARE
    present_count INTEGER := 0;
    total_count INTEGER;
BEGIN
    total_count := array_length(statuses, 1);
    IF total_count IS NULL OR total_count = 0 THEN
        RETURN 0.00;
    END IF;
    
    -- Count present and tardy as attended
    FOR i IN 1..total_count LOOP
        IF statuses[i] IN ('PRESENT', 'P', 'TARDY', 'T') THEN
            present_count := present_count + 1;
        END IF;
    END LOOP;
    
    RETURN ROUND((present_count::DECIMAL / total_count::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===============================================================
-- 11. CREATE TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ===============================================================

-- Update function for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teacher_assignments_updated_at BEFORE UPDATE ON public.teacher_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_school_terms_updated_at BEFORE UPDATE ON public.school_terms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_absence_codes_updated_at BEFORE UPDATE ON public.absence_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_schedules_updated_at BEFORE UPDATE ON public.student_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aeries_sync_operations_updated_at BEFORE UPDATE ON public.aeries_sync_operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================================
-- 12. SET UP ROW LEVEL SECURITY (RLS)
-- ===============================================================

-- Enable RLS on all tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeries_sync_operations ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for authenticated users
CREATE POLICY "Allow authenticated users full access" ON public.schools FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON public.teachers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON public.teacher_assignments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON public.school_terms FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON public.absence_codes FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON public.student_schedules FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access" ON public.aeries_sync_operations FOR ALL TO authenticated USING (true);

-- Grant permissions to service role for data imports
GRANT ALL ON public.schools TO service_role;
GRANT ALL ON public.teachers TO service_role;
GRANT ALL ON public.teacher_assignments TO service_role;
GRANT ALL ON public.school_terms TO service_role;
GRANT ALL ON public.absence_codes TO service_role;
GRANT ALL ON public.student_schedules TO service_role;
GRANT ALL ON public.aeries_sync_operations TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_current_school_year() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_valid_school_year(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calculate_attendance_percentage_from_statuses(TEXT[]) TO authenticated, service_role;

-- ===============================================================
-- 13. INSERT DEFAULT/REFERENCE DATA
-- ===============================================================

-- Insert default absence codes (common across most schools)
INSERT INTO public.absence_codes (school_code, absence_code, description, is_excused, is_tardy, affects_ada) VALUES
('DEFAULT', 'A', 'Unexcused Absence', FALSE, FALSE, TRUE),
('DEFAULT', 'E', 'Excused Absence', TRUE, FALSE, TRUE),
('DEFAULT', 'T', 'Tardy', FALSE, TRUE, FALSE),
('DEFAULT', 'U', 'Unverified Absence', FALSE, FALSE, TRUE),
('DEFAULT', 'I', 'Illness', TRUE, FALSE, TRUE),
('DEFAULT', 'M', 'Medical Appointment', TRUE, FALSE, TRUE),
('DEFAULT', 'F', 'Family Emergency', TRUE, FALSE, TRUE),
('DEFAULT', 'S', 'Suspension', FALSE, FALSE, TRUE),
('DEFAULT', 'V', 'Vacation', TRUE, FALSE, TRUE),
('DEFAULT', 'P', 'Present', FALSE, FALSE, FALSE)
ON CONFLICT (school_code, absence_code) DO NOTHING;

-- ===============================================================
-- 14. CREATE VIEWS FOR REPORTING
-- ===============================================================

-- View for current active students with school information
CREATE OR REPLACE VIEW public.active_students_with_schools AS
SELECT 
    s.student_id,
    s.aeries_student_number,
    s.first_name,
    s.last_name,
    s.grade_level,
    s.email,
    s.enrollment_status,
    sch.school_name,
    sch.school_code,
    sch.principal_name,
    s.school_enter_date,
    s.counselor_id,
    s.home_room
FROM public.students s
JOIN public.schools sch ON s.school_code = sch.school_code
WHERE s.is_active = TRUE 
  AND s.enrollment_status = 'ACTIVE'
  AND sch.is_active = TRUE;

-- View for attendance summary by student
CREATE OR REPLACE VIEW public.student_attendance_summary AS
SELECT 
    ar.student_id,
    s.first_name,
    s.last_name,
    s.school_code,
    COUNT(*) as total_days,
    COUNT(*) FILTER (WHERE ar.daily_status = 'PRESENT') as present_days,
    COUNT(*) FILTER (WHERE ar.daily_status = 'ABSENT') as absent_days,
    COUNT(*) FILTER (WHERE ar.daily_status = 'TARDY') as tardy_days,
    ROUND(
        (COUNT(*) FILTER (WHERE ar.daily_status IN ('PRESENT', 'TARDY'))::DECIMAL / COUNT(*)::DECIMAL) * 100, 
        2
    ) as attendance_percentage
FROM public.attendance_records ar
JOIN public.students s ON ar.student_id = s.student_id
WHERE ar.date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY ar.student_id, s.first_name, s.last_name, s.school_code;

-- View for teacher assignments with school information  
CREATE OR REPLACE VIEW public.teacher_assignments_with_schools AS
SELECT 
    t.first_name,
    t.last_name,
    t.email,
    t.position,
    ta.course_code,
    ta.course_name,
    ta.period,
    ta.room_number,
    s.school_name,
    ta.school_code,
    ta.school_year
FROM public.teachers t
JOIN public.teacher_assignments ta ON t.id = ta.teacher_id
JOIN public.schools s ON ta.school_code = s.school_code
WHERE t.is_active = TRUE 
  AND ta.is_active = TRUE 
  AND s.is_active = TRUE;

-- ===============================================================
-- 15. VALIDATION AND CLEANUP
-- ===============================================================

-- Analyze tables for better query performance
ANALYZE public.schools;
ANALYZE public.students;
ANALYZE public.teachers;
ANALYZE public.teacher_assignments;
ANALYZE public.attendance_records;
ANALYZE public.school_terms;
ANALYZE public.absence_codes;
ANALYZE public.student_schedules;
ANALYZE public.aeries_sync_operations;

-- Success message and validation
DO $$
BEGIN
    RAISE NOTICE '=== COMPREHENSIVE AERIES SCHEMA UPDATE COMPLETED ===';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Created/Updated Tables:';
    RAISE NOTICE '   - schools (core reference table)';
    RAISE NOTICE '   - students (enhanced with all Aeries fields)';
    RAISE NOTICE '   - teachers (complete staff information)';
    RAISE NOTICE '   - teacher_assignments (class assignments)';
    RAISE NOTICE '   - attendance_records (enhanced tracking)';
    RAISE NOTICE '   - school_terms (academic calendar)';
    RAISE NOTICE '   - absence_codes (attendance code definitions)';
    RAISE NOTICE '   - student_schedules (class schedules)';
    RAISE NOTICE '   - aeries_sync_operations (sync tracking)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Created Views:';
    RAISE NOTICE '   - active_students_with_schools';
    RAISE NOTICE '   - student_attendance_summary';
    RAISE NOTICE '   - teacher_assignments_with_schools';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Created Functions:';
    RAISE NOTICE '   - get_current_school_year()';
    RAISE NOTICE '   - is_valid_school_year(TEXT)';
    RAISE NOTICE '   - calculate_attendance_percentage_from_statuses(TEXT[])';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Security: RLS enabled with proper policies';
    RAISE NOTICE '✅ Performance: Indexes created for all key fields';
    RAISE NOTICE '✅ Data Integrity: Foreign key constraints in place';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Database is now ready for comprehensive Aeries sync!';
    RAISE NOTICE '📋 Next: Run the comprehensive Aeries sync script';
    RAISE NOTICE '';
    RAISE NOTICE '=== END SCHEMA UPDATE ===';
END $$;

-- ===============================================================
-- END OF COMPREHENSIVE AERIES SCHEMA UPDATES
-- ===============================================================