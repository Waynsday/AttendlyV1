-- =====================================================
-- Supabase Table Modifications for Real Attendance Data
-- =====================================================
-- Run these commands in the Supabase SQL Editor

-- 1. Add columns to existing attendance_records table for real Aeries data
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS aeries_student_id TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS school_code TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS school_year TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_enrolled INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_present INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_absent INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_excused INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_unexcused INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_tardy INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_truancy INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS days_suspension INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS attendance_rate DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS sync_timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'aeries_api';

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_aeries_student_id ON attendance_records(aeries_student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school_code ON attendance_records(school_code);
CREATE INDEX IF NOT EXISTS idx_attendance_school_year ON attendance_records(school_year);
CREATE INDEX IF NOT EXISTS idx_attendance_rate ON attendance_records(attendance_rate);
CREATE INDEX IF NOT EXISTS idx_attendance_sync_timestamp ON attendance_records(sync_timestamp);

-- 3. Add unique constraint for preventing duplicates
ALTER TABLE attendance_records ADD CONSTRAINT unique_aeries_student_school_year 
  UNIQUE (aeries_student_id, school_year);

-- 4. Alternative: Create new summary table if preferred (OPTIONAL)
CREATE TABLE IF NOT EXISTS attendance_summary_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  aeries_student_id TEXT NOT NULL,
  school_code TEXT NOT NULL,
  school_year TEXT NOT NULL,
  days_enrolled INTEGER DEFAULT 0,
  days_present INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  days_excused INTEGER DEFAULT 0,
  days_unexcused INTEGER DEFAULT 0,
  days_tardy INTEGER DEFAULT 0,
  days_truancy INTEGER DEFAULT 0,
  days_suspension INTEGER DEFAULT 0,
  attendance_rate DECIMAL(5,2) DEFAULT 0.00,
  sync_timestamp TIMESTAMPTZ DEFAULT NOW(),
  data_source TEXT DEFAULT 'aeries_api',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(aeries_student_id, school_year)
);

-- 5. Indexes for summary table
CREATE INDEX IF NOT EXISTS idx_summary_aeries_student_id ON attendance_summary_records(aeries_student_id);
CREATE INDEX IF NOT EXISTS idx_summary_school_code ON attendance_summary_records(school_code);
CREATE INDEX IF NOT EXISTS idx_summary_school_year ON attendance_summary_records(school_year);
CREATE INDEX IF NOT EXISTS idx_summary_attendance_rate ON attendance_summary_records(attendance_rate);

-- 6. Enable Row Level Security (RLS) - OPTIONAL but recommended
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summary_records ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for data access
CREATE POLICY "Enable read access for authenticated users" ON attendance_records
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON attendance_records
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON attendance_records
    FOR UPDATE USING (auth.role() = 'service_role');

-- Same policies for summary table
CREATE POLICY "Enable read access for authenticated users" ON attendance_summary_records
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON attendance_summary_records
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role" ON attendance_summary_records
    FOR UPDATE USING (auth.role() = 'service_role');

-- 8. Create function to update attendance rate automatically
CREATE OR REPLACE FUNCTION calculate_attendance_rate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.attendance_rate = CASE 
    WHEN NEW.days_enrolled > 0 THEN 
      ROUND((NEW.days_present::DECIMAL / NEW.days_enrolled::DECIMAL) * 100, 2)
    ELSE 0.00
  END;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create triggers for automatic calculations
CREATE TRIGGER trigger_calculate_attendance_rate
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION calculate_attendance_rate();

CREATE TRIGGER trigger_calculate_attendance_rate_summary
  BEFORE INSERT OR UPDATE ON attendance_summary_records
  FOR EACH ROW EXECUTE FUNCTION calculate_attendance_rate();

-- 10. Create view for easy reporting
CREATE OR REPLACE VIEW attendance_report AS
SELECT 
  ar.aeries_student_id,
  ar.school_code,
  ar.school_year,
  ar.days_enrolled,
  ar.days_present,
  ar.days_absent,
  ar.days_tardy,
  ar.attendance_rate,
  CASE 
    WHEN ar.attendance_rate >= 95 THEN 'Excellent'
    WHEN ar.attendance_rate >= 90 THEN 'Good'
    WHEN ar.attendance_rate >= 80 THEN 'At Risk'
    ELSE 'Chronic Absenteeism'
  END as attendance_category,
  ar.sync_timestamp,
  s.first_name,
  s.last_name
FROM attendance_records ar
LEFT JOIN students s ON s.aeries_student_id = ar.aeries_student_id
WHERE ar.school_year = '2024-2025'
ORDER BY ar.attendance_rate DESC;

-- =====================================================
-- INSTRUCTIONS FOR SUPABASE DASHBOARD:
-- =====================================================
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste the above SQL commands
-- 3. Run each section individually or all at once
-- 4. Verify tables are created with: SELECT * FROM attendance_records LIMIT 1;
-- 5. Check indexes with: \d attendance_records (if using psql)
-- 
-- RECOMMENDATION: Use the existing attendance_records table with added columns
-- This maintains compatibility with existing code while adding new fields.
-- =====================================================