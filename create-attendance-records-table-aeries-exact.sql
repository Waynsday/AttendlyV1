-- Drop and recreate attendance_records table to match Aeries API exactly
-- Based on /schools/{SchoolCode}/attendance/{StudentID} endpoint

-- Drop existing table (be careful!)
DROP TABLE IF EXISTS attendance_records CASCADE;

-- Create table matching Aeries API structure exactly
CREATE TABLE attendance_records (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Aeries identifiers (required for lookups)
    aeries_student_id TEXT NOT NULL,
    school_code TEXT NOT NULL,
    
    -- Core Aeries API fields from attendance endpoint
    calendar_date DATE NOT NULL,
    all_day_attendance_code TEXT, -- Can be NULL if only period-specific attendance
    
    -- Period-specific attendance (from Classes array)
    -- Each period can have its own attendance code
    period_1_code TEXT,
    period_2_code TEXT,
    period_3_code TEXT,
    period_4_code TEXT,
    period_5_code TEXT,
    period_6_code TEXT,
    period_7_code TEXT,
    period_8_code TEXT,
    period_9_code TEXT,
    
    -- Optional: Store section numbers for each period (if needed)
    period_1_section TEXT,
    period_2_section TEXT,
    period_3_section TEXT,
    period_4_section TEXT,
    period_5_section TEXT,
    period_6_section TEXT,
    period_7_section TEXT,
    period_8_section TEXT,
    period_9_section TEXT,
    
    -- School year for filtering
    school_year TEXT NOT NULL DEFAULT '2024-2025',
    
    -- Reference to schools table (for joins)
    school_id UUID,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_attendance_aeries_student_id ON attendance_records (aeries_student_id);
CREATE INDEX idx_attendance_school_code ON attendance_records (school_code);
CREATE INDEX idx_attendance_calendar_date ON attendance_records (calendar_date);
CREATE INDEX idx_attendance_school_year ON attendance_records (school_year);
CREATE INDEX idx_attendance_student_date ON attendance_records (aeries_student_id, calendar_date);
CREATE INDEX idx_attendance_school_date ON attendance_records (school_code, calendar_date);

-- Add foreign key to schools table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
        ALTER TABLE attendance_records 
        ADD CONSTRAINT fk_attendance_records_school_id 
        FOREIGN KEY (school_id) REFERENCES schools(id);
    END IF;
END $$;

-- Add unique constraint to prevent duplicate records
ALTER TABLE attendance_records 
ADD CONSTRAINT unique_student_date_school 
UNIQUE (aeries_student_id, calendar_date, school_code);

-- Show the new table structure
SELECT 'New attendance_records table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
AND table_schema = 'public'
ORDER BY ordinal_position;