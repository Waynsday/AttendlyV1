-- ===============================================================
-- MANUAL SUPABASE SCHEMA UPDATES
-- Run this SQL script in Supabase Dashboard > SQL Editor
-- ===============================================================
-- 
-- CRITICAL: Copy and paste this entire script into Supabase Dashboard
-- Go to: Your Project > SQL Editor > New Query > Paste this script > Run
--
-- This script will:
-- 1. Add missing columns to students table
-- 2. Modify constraints to allow proper data insertion
-- 3. Add missing columns to teachers table
-- 4. Update aeries_sync_operations table structure
-- 5. Clean up duplicate aeries_schools table
-- ===============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================================
-- 1. UPDATE STUDENTS TABLE
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
ADD COLUMN IF NOT EXISTS school_enter_date DATE,
ADD COLUMN IF NOT EXISTS school_leave_date DATE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}'::jsonb;

-- Modify grade_level to allow NULL temporarily for data migration
ALTER TABLE public.students 
ALTER COLUMN grade_level DROP NOT NULL;

-- Make first_name and last_name nullable with default values for migration
ALTER TABLE public.students 
ALTER COLUMN first_name DROP NOT NULL,
ALTER COLUMN last_name DROP NOT NULL,
ALTER COLUMN first_name SET DEFAULT 'Unknown',
ALTER COLUMN last_name SET DEFAULT 'Unknown';

-- Remove email NOT NULL constraint if it exists
ALTER TABLE public.students 
ALTER COLUMN email DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_aeries_student_number ON public.students(aeries_student_number);
CREATE INDEX IF NOT EXISTS idx_students_school_code ON public.students(school_code);
CREATE INDEX IF NOT EXISTS idx_students_state_student_id ON public.students(state_student_id);
CREATE INDEX IF NOT EXISTS idx_students_is_active ON public.students(is_active);

-- Add foreign key constraint to schools table
ALTER TABLE public.students 
ADD CONSTRAINT fk_students_school_code 
FOREIGN KEY (school_code) REFERENCES public.schools(school_code);

-- ===============================================================
-- 2. UPDATE TEACHERS TABLE
-- ===============================================================

-- Add missing columns to teachers table
ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS school_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS position VARCHAR(100) DEFAULT 'Teacher',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}'::jsonb;

-- Make first_name and last_name nullable with defaults
ALTER TABLE public.teachers 
ALTER COLUMN first_name DROP NOT NULL,
ALTER COLUMN last_name DROP NOT NULL,
ALTER COLUMN first_name SET DEFAULT 'Unknown',
ALTER COLUMN last_name SET DEFAULT 'Unknown';

-- Remove email NOT NULL constraint if it exists
ALTER TABLE public.teachers 
ALTER COLUMN email DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_teachers_employee_id ON public.teachers(employee_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school_code ON public.teachers(school_code);
CREATE INDEX IF NOT EXISTS idx_teachers_is_active ON public.teachers(is_active);

-- Add foreign key constraint to schools table
ALTER TABLE public.teachers 
ADD CONSTRAINT fk_teachers_school_code 
FOREIGN KEY (school_code) REFERENCES public.schools(school_code);

-- ===============================================================
-- 3. UPDATE AERIES_SYNC_OPERATIONS TABLE
-- ===============================================================

-- Ensure aeries_sync_operations has all required fields
ALTER TABLE public.aeries_sync_operations 
ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Make date_range and errors nullable
ALTER TABLE public.aeries_sync_operations 
ALTER COLUMN date_range DROP NOT NULL,
ALTER COLUMN errors DROP NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_status ON public.aeries_sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_start_time ON public.aeries_sync_operations(start_time);

-- ===============================================================
-- 4. CLEAN UP DUPLICATE AERIES_SCHOOLS TABLE
-- ===============================================================

-- If you want to keep data from aeries_schools, migrate it first:
-- (Run this only if aeries_schools has data you want to preserve)
/*
INSERT INTO public.schools (school_code, school_name, is_active, created_at, updated_at)
SELECT 
    school_code,
    school_name,
    COALESCE(is_active, TRUE),
    COALESCE(created_at, NOW()),
    NOW()
FROM public.aeries_schools
WHERE school_code NOT IN (SELECT school_code FROM public.schools)
ON CONFLICT (school_code) DO NOTHING;
*/

-- Drop the duplicate aeries_schools table (UNCOMMENT TO EXECUTE)
-- DROP TABLE IF EXISTS public.aeries_schools;

-- ===============================================================
-- 5. UPDATE RLS POLICIES (Row Level Security)
-- ===============================================================

-- Enable RLS on tables if not already enabled
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for authenticated users
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.students;
CREATE POLICY "Allow authenticated users full access" 
ON public.students FOR ALL 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.teachers;
CREATE POLICY "Allow authenticated users full access" 
ON public.teachers FOR ALL 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.attendance_records;
CREATE POLICY "Allow authenticated users full access" 
ON public.attendance_records FOR ALL 
TO authenticated 
USING (true);

-- Grant permissions to service role for data imports
GRANT ALL ON public.students TO service_role;
GRANT ALL ON public.teachers TO service_role;
GRANT ALL ON public.attendance_records TO service_role;
GRANT ALL ON public.aeries_sync_operations TO service_role;

-- ===============================================================
-- 6. CREATE HELPER FUNCTION FOR SCHOOL YEAR
-- ===============================================================

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_current_school_year() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_school_year() TO service_role;

-- ===============================================================
-- 7. VALIDATION QUERIES
-- ===============================================================

-- Check that all modifications were successful
DO $$
BEGIN
    RAISE NOTICE '=== VALIDATION RESULTS ===';
    
    -- Check students table columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'students' 
        AND column_name = 'aeries_student_id'
    ) THEN
        RAISE NOTICE '✅ Students table: aeries_student_id column added';
    ELSE
        RAISE NOTICE '❌ Students table: aeries_student_id column missing';
    END IF;
    
    -- Check teachers table columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teachers' 
        AND column_name = 'employee_id'
    ) THEN
        RAISE NOTICE '✅ Teachers table: employee_id column added';
    ELSE
        RAISE NOTICE '❌ Teachers table: employee_id column missing';
    END IF;
    
    -- Check function exists
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'get_current_school_year'
    ) THEN
        RAISE NOTICE '✅ Helper function: get_current_school_year created';
    ELSE
        RAISE NOTICE '❌ Helper function: get_current_school_year missing';
    END IF;
    
    RAISE NOTICE '=== END VALIDATION ===';
END $$;

-- ===============================================================
-- 8. FINAL CLEANUP AND OPTIMIZATION
-- ===============================================================

-- Analyze tables for better query performance
ANALYZE public.students;
ANALYZE public.teachers;
ANALYZE public.schools;
ANALYZE public.attendance_records;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 SCHEMA UPDATE COMPLETED SUCCESSFULLY! 🎉';
    RAISE NOTICE 'Database is now ready for Aeries data sync.';
    RAISE NOTICE 'You can now run the production-aeries-sync.ts script.';
END $$;

-- ===============================================================
-- END OF SCRIPT
-- ===============================================================