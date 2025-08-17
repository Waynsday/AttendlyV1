-- Modify attendance_records table to match Aeries API output
-- Based on AttendanceHistory/details endpoint structure

-- First, let's see what we currently have
SELECT 'Current table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add any missing columns that the Aeries API provides
-- Note: Only add columns if they don't already exist

-- Add columns for better Aeries integration if they don't exist
DO $$ 
BEGIN
    -- Add student_id as UUID if it doesn't exist (for future student table integration)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'student_id') THEN
        ALTER TABLE attendance_records ADD COLUMN student_id UUID;
    END IF;

    -- Ensure aeries_student_id exists and is TEXT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'aeries_student_id') THEN
        ALTER TABLE attendance_records ADD COLUMN aeries_student_id TEXT NOT NULL;
    END IF;

    -- Ensure school_code exists and is TEXT (not padded)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'school_code') THEN
        ALTER TABLE attendance_records ADD COLUMN school_code TEXT NOT NULL;
    END IF;

    -- Ensure school_id exists as UUID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'school_id') THEN
        ALTER TABLE attendance_records ADD COLUMN school_id UUID;
    END IF;

    -- Core attendance fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'attendance_date') THEN
        ALTER TABLE attendance_records ADD COLUMN attendance_date DATE NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'is_present') THEN
        ALTER TABLE attendance_records ADD COLUMN is_present BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'is_full_day_absent') THEN
        ALTER TABLE attendance_records ADD COLUMN is_full_day_absent BOOLEAN DEFAULT false;
    END IF;

    -- School year tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'school_year') THEN
        ALTER TABLE attendance_records ADD COLUMN school_year TEXT DEFAULT '2024-2025';
    END IF;

    -- Period-specific attendance status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'period_1_status') THEN
        ALTER TABLE attendance_records ADD COLUMN period_1_status TEXT DEFAULT 'PRESENT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'period_2_status') THEN
        ALTER TABLE attendance_records ADD COLUMN period_2_status TEXT DEFAULT 'PRESENT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'period_3_status') THEN
        ALTER TABLE attendance_records ADD COLUMN period_3_status TEXT DEFAULT 'PRESENT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'period_4_status') THEN
        ALTER TABLE attendance_records ADD COLUMN period_4_status TEXT DEFAULT 'PRESENT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'period_5_status') THEN
        ALTER TABLE attendance_records ADD COLUMN period_5_status TEXT DEFAULT 'PRESENT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'period_6_status') THEN
        ALTER TABLE attendance_records ADD COLUMN period_6_status TEXT DEFAULT 'PRESENT';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'period_7_status') THEN
        ALTER TABLE attendance_records ADD COLUMN period_7_status TEXT DEFAULT 'PRESENT';
    END IF;

    -- Additional tracking fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'days_enrolled') THEN
        ALTER TABLE attendance_records ADD COLUMN days_enrolled DECIMAL(4,2) DEFAULT 1.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'tardy_count') THEN
        ALTER TABLE attendance_records ADD COLUMN tardy_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'can_be_corrected') THEN
        ALTER TABLE attendance_records ADD COLUMN can_be_corrected BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'correction_deadline') THEN
        ALTER TABLE attendance_records ADD COLUMN correction_deadline DATE;
    END IF;

    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE attendance_records ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attendance_records' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE attendance_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_records_aeries_student_id 
ON attendance_records (aeries_student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_school_code 
ON attendance_records (school_code);

CREATE INDEX IF NOT EXISTS idx_attendance_records_attendance_date 
ON attendance_records (attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_school_year 
ON attendance_records (school_year);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date 
ON attendance_records (aeries_student_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_school_date 
ON attendance_records (school_code, attendance_date);

-- Add foreign key constraint to schools table if both tables exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_attendance_records_school_id') THEN
            ALTER TABLE attendance_records 
            ADD CONSTRAINT fk_attendance_records_school_id 
            FOREIGN KEY (school_id) REFERENCES schools(id);
        END IF;
    END IF;
END $$;

-- Show the updated table structure
SELECT 'Updated table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show indexes
SELECT 'Table indexes:' as info;
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'attendance_records'
ORDER BY indexname;