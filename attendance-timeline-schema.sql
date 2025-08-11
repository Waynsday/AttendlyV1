-- ===============================================================
-- ATTENDANCE TIMELINE DATABASE SCHEMA MODIFICATIONS
-- Run this SQL script in Supabase Dashboard > SQL Editor
-- ===============================================================
-- 
-- CRITICAL: Copy and paste this entire script into Supabase Dashboard
-- Go to: Your Project > SQL Editor > New Query > Paste this script > Run
--
-- This script will:
-- 1. Create grade_attendance_summary table for school-level timeline data
-- 2. Create district_attendance_summary table for district-wide timeline data
-- 3. Add indexes for optimal query performance
-- 4. Create helper functions for data aggregation
-- 5. Set up triggers for automatic calculations
-- ===============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================================
-- 1. CREATE GRADE_ATTENDANCE_SUMMARY TABLE
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.grade_attendance_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id VARCHAR(50) NOT NULL,
    school_code VARCHAR(10),
    school_name VARCHAR(200),
    grade_level INTEGER NOT NULL,
    summary_date DATE NOT NULL,
    total_students INTEGER NOT NULL DEFAULT 0,
    students_present INTEGER NOT NULL DEFAULT 0,
    students_absent INTEGER NOT NULL DEFAULT 0,
    daily_absences INTEGER NOT NULL DEFAULT 0,
    cumulative_absences INTEGER NOT NULL DEFAULT 0,
    excused_absences INTEGER NOT NULL DEFAULT 0,
    unexcused_absences INTEGER NOT NULL DEFAULT 0,
    tardy_count INTEGER NOT NULL DEFAULT 0,
    chronic_absent_count INTEGER NOT NULL DEFAULT 0,
    attendance_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    absence_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    school_year VARCHAR(9) NOT NULL DEFAULT '2024-2025',
    week_number INTEGER GENERATED ALWAYS AS (EXTRACT(WEEK FROM summary_date)) STORED,
    month_number INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM summary_date)) STORED,
    is_school_day BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_school_grade_date UNIQUE(school_id, grade_level, summary_date, school_year)
);

-- Add indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_grade_attendance_summary_school_date 
ON public.grade_attendance_summary(school_id, summary_date);

CREATE INDEX IF NOT EXISTS idx_grade_attendance_summary_grade_date 
ON public.grade_attendance_summary(grade_level, summary_date);

CREATE INDEX IF NOT EXISTS idx_grade_attendance_summary_school_year 
ON public.grade_attendance_summary(school_year);

CREATE INDEX IF NOT EXISTS idx_grade_attendance_summary_cumulative 
ON public.grade_attendance_summary(school_id, grade_level, cumulative_absences);

CREATE INDEX IF NOT EXISTS idx_grade_attendance_summary_week 
ON public.grade_attendance_summary(school_year, week_number);

CREATE INDEX IF NOT EXISTS idx_grade_attendance_summary_month 
ON public.grade_attendance_summary(school_year, month_number);

-- ===============================================================
-- 2. CREATE DISTRICT_ATTENDANCE_SUMMARY TABLE
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.district_attendance_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade_level INTEGER NOT NULL,
    summary_date DATE NOT NULL,
    total_students INTEGER NOT NULL DEFAULT 0,
    students_present INTEGER NOT NULL DEFAULT 0,
    students_absent INTEGER NOT NULL DEFAULT 0,
    daily_absences INTEGER NOT NULL DEFAULT 0,
    cumulative_absences INTEGER NOT NULL DEFAULT 0,
    excused_absences INTEGER NOT NULL DEFAULT 0,
    unexcused_absences INTEGER NOT NULL DEFAULT 0,
    tardy_count INTEGER NOT NULL DEFAULT 0,
    chronic_absent_count INTEGER NOT NULL DEFAULT 0,
    attendance_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    absence_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    school_year VARCHAR(9) NOT NULL DEFAULT '2024-2025',
    schools_included TEXT[] NOT NULL DEFAULT '{}',
    schools_count INTEGER NOT NULL DEFAULT 0,
    week_number INTEGER GENERATED ALWAYS AS (EXTRACT(WEEK FROM summary_date)) STORED,
    month_number INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM summary_date)) STORED,
    is_school_day BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_district_grade_date UNIQUE(grade_level, summary_date, school_year)
);

-- Add indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_district_attendance_summary_grade_date 
ON public.district_attendance_summary(grade_level, summary_date);

CREATE INDEX IF NOT EXISTS idx_district_attendance_summary_school_year 
ON public.district_attendance_summary(school_year);

CREATE INDEX IF NOT EXISTS idx_district_attendance_summary_cumulative 
ON public.district_attendance_summary(grade_level, cumulative_absences);

CREATE INDEX IF NOT EXISTS idx_district_attendance_summary_week 
ON public.district_attendance_summary(school_year, week_number);

CREATE INDEX IF NOT EXISTS idx_district_attendance_summary_month 
ON public.district_attendance_summary(school_year, month_number);

-- ===============================================================
-- 3. CREATE TIMELINE_CACHE TABLE FOR PERFORMANCE
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.attendance_timeline_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(200) NOT NULL UNIQUE,
    school_filter VARCHAR(50) NOT NULL, -- 'all' or specific school_id
    grade_levels INTEGER[] NOT NULL,
    date_range DATERANGE NOT NULL,
    timeline_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for cache performance
CREATE INDEX IF NOT EXISTS idx_timeline_cache_key ON public.attendance_timeline_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_timeline_cache_expires ON public.attendance_timeline_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_timeline_cache_school_filter ON public.attendance_timeline_cache(school_filter);

-- ===============================================================
-- 4. CREATE HELPER FUNCTIONS
-- ===============================================================

-- Function to get school year from date
CREATE OR REPLACE FUNCTION get_school_year_from_date(input_date DATE)
RETURNS TEXT AS $$
BEGIN
    -- School year runs August to June
    IF EXTRACT(MONTH FROM input_date) >= 8 THEN
        RETURN EXTRACT(YEAR FROM input_date)::TEXT || '-' || (EXTRACT(YEAR FROM input_date) + 1)::TEXT;
    ELSE
        RETURN (EXTRACT(YEAR FROM input_date) - 1)::TEXT || '-' || EXTRACT(YEAR FROM input_date)::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate cumulative absences
CREATE OR REPLACE FUNCTION calculate_cumulative_absences(
    p_school_id VARCHAR(50),
    p_grade_level INTEGER,
    p_end_date DATE,
    p_school_year VARCHAR(9)
)
RETURNS INTEGER AS $$
DECLARE
    cumulative_total INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(daily_absences), 0) INTO cumulative_total
    FROM public.grade_attendance_summary
    WHERE school_id = p_school_id
    AND grade_level = p_grade_level
    AND summary_date <= p_end_date
    AND school_year = p_school_year
    AND is_school_day = TRUE;
    
    RETURN cumulative_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to refresh district summary from grade summaries
CREATE OR REPLACE FUNCTION refresh_district_attendance_summary(
    p_summary_date DATE,
    p_school_year VARCHAR(9) DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    target_school_year VARCHAR(9);
    grade_rec RECORD;
BEGIN
    -- Default to current school year if not provided
    target_school_year := COALESCE(p_school_year, get_school_year_from_date(p_summary_date));
    
    -- Delete existing district summary for this date
    DELETE FROM public.district_attendance_summary 
    WHERE summary_date = p_summary_date 
    AND school_year = target_school_year;
    
    -- Aggregate grade summaries into district summary
    FOR grade_rec IN (
        SELECT 
            grade_level,
            SUM(total_students) as total_students,
            SUM(students_present) as students_present,
            SUM(students_absent) as students_absent,
            SUM(daily_absences) as daily_absences,
            SUM(excused_absences) as excused_absences,
            SUM(unexcused_absences) as unexcused_absences,
            SUM(tardy_count) as tardy_count,
            SUM(chronic_absent_count) as chronic_absent_count,
            ARRAY_AGG(DISTINCT school_id) as schools_included,
            COUNT(DISTINCT school_id) as schools_count,
            AVG(attendance_rate) as avg_attendance_rate,
            MAX(is_school_day) as is_school_day
        FROM public.grade_attendance_summary
        WHERE summary_date = p_summary_date
        AND school_year = target_school_year
        GROUP BY grade_level
    ) LOOP
        -- Calculate cumulative absences for district
        INSERT INTO public.district_attendance_summary (
            grade_level,
            summary_date,
            total_students,
            students_present,
            students_absent,
            daily_absences,
            cumulative_absences,
            excused_absences,
            unexcused_absences,
            tardy_count,
            chronic_absent_count,
            attendance_rate,
            absence_rate,
            school_year,
            schools_included,
            schools_count,
            is_school_day
        )
        SELECT 
            grade_rec.grade_level,
            p_summary_date,
            grade_rec.total_students,
            grade_rec.students_present,
            grade_rec.students_absent,
            grade_rec.daily_absences,
            COALESCE(SUM(das.daily_absences), 0) as cumulative_absences,
            grade_rec.excused_absences,
            grade_rec.unexcused_absences,
            grade_rec.tardy_count,
            grade_rec.chronic_absent_count,
            CASE 
                WHEN grade_rec.total_students > 0 THEN 
                    ROUND((grade_rec.students_present::DECIMAL / grade_rec.total_students::DECIMAL) * 100, 2)
                ELSE 100.00 
            END as attendance_rate,
            CASE 
                WHEN grade_rec.total_students > 0 THEN 
                    ROUND((grade_rec.students_absent::DECIMAL / grade_rec.total_students::DECIMAL) * 100, 2)
                ELSE 0.00 
            END as absence_rate,
            target_school_year,
            grade_rec.schools_included,
            grade_rec.schools_count,
            grade_rec.is_school_day
        FROM public.district_attendance_summary das
        WHERE das.grade_level = grade_rec.grade_level
        AND das.summary_date <= p_summary_date
        AND das.school_year = target_school_year
        AND das.is_school_day = TRUE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to populate grade summary from attendance records
CREATE OR REPLACE FUNCTION populate_grade_attendance_summary(
    p_summary_date DATE,
    p_school_year VARCHAR(9) DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    target_school_year VARCHAR(9);
    summary_rec RECORD;
BEGIN
    -- Default to current school year if not provided
    target_school_year := COALESCE(p_school_year, get_school_year_from_date(p_summary_date));
    
    -- Delete existing summaries for this date
    DELETE FROM public.grade_attendance_summary 
    WHERE summary_date = p_summary_date 
    AND school_year = target_school_year;
    
    -- Generate summaries from attendance records
    FOR summary_rec IN (
        SELECT 
            s.school_id,
            sch.school_code,
            sch.school_name,
            s.grade_level,
            COUNT(DISTINCT s.id) as total_students,
            COUNT(DISTINCT s.id) FILTER (WHERE ar.is_present = TRUE) as students_present,
            COUNT(DISTINCT s.id) FILTER (WHERE ar.is_full_day_absent = TRUE) as students_absent,
            COUNT(ar.id) FILTER (WHERE ar.is_full_day_absent = TRUE) as daily_absences,
            COUNT(ar.id) FILTER (WHERE ar.tardy_count > 0) as tardy_count,
            -- Estimated excused/unexcused (would need absence codes for accuracy)
            COUNT(ar.id) FILTER (WHERE ar.is_full_day_absent = TRUE) / 2 as excused_absences,
            COUNT(ar.id) FILTER (WHERE ar.is_full_day_absent = TRUE) / 2 as unexcused_absences
        FROM public.students s
        LEFT JOIN public.attendance_records ar ON s.id = ar.student_id AND ar.attendance_date = p_summary_date
        LEFT JOIN public.schools sch ON s.school_id = sch.id
        WHERE s.is_active = TRUE
        AND s.grade_level IS NOT NULL
        GROUP BY s.school_id, sch.school_code, sch.school_name, s.grade_level
        HAVING COUNT(DISTINCT s.id) > 0
    ) LOOP
        INSERT INTO public.grade_attendance_summary (
            school_id,
            school_code,
            school_name,
            grade_level,
            summary_date,
            total_students,
            students_present,
            students_absent,
            daily_absences,
            cumulative_absences,
            excused_absences,
            unexcused_absences,
            tardy_count,
            chronic_absent_count,
            attendance_rate,
            absence_rate,
            school_year,
            is_school_day
        ) VALUES (
            summary_rec.school_id,
            summary_rec.school_code,
            summary_rec.school_name,
            summary_rec.grade_level,
            p_summary_date,
            summary_rec.total_students,
            summary_rec.students_present,
            summary_rec.students_absent,
            summary_rec.daily_absences,
            calculate_cumulative_absences(
                summary_rec.school_id, 
                summary_rec.grade_level, 
                p_summary_date, 
                target_school_year
            ),
            summary_rec.excused_absences,
            summary_rec.unexcused_absences,
            summary_rec.tardy_count,
            0, -- chronic_absent_count - would need historical calculation
            CASE 
                WHEN summary_rec.total_students > 0 THEN 
                    ROUND((summary_rec.students_present::DECIMAL / summary_rec.total_students::DECIMAL) * 100, 2)
                ELSE 100.00 
            END,
            CASE 
                WHEN summary_rec.total_students > 0 THEN 
                    ROUND((summary_rec.students_absent::DECIMAL / summary_rec.total_students::DECIMAL) * 100, 2)
                ELSE 0.00 
            END,
            target_school_year,
            TRUE -- assume all dates are school days by default
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================
-- 5. CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- ===============================================================

-- Update function for timestamps
CREATE OR REPLACE FUNCTION update_attendance_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to summary tables
CREATE TRIGGER update_grade_attendance_summary_timestamp 
BEFORE UPDATE ON public.grade_attendance_summary
FOR EACH ROW EXECUTE FUNCTION update_attendance_summary_timestamp();

CREATE TRIGGER update_district_attendance_summary_timestamp 
BEFORE UPDATE ON public.district_attendance_summary
FOR EACH ROW EXECUTE FUNCTION update_attendance_summary_timestamp();

CREATE TRIGGER update_timeline_cache_timestamp 
BEFORE UPDATE ON public.attendance_timeline_cache
FOR EACH ROW EXECUTE FUNCTION update_attendance_summary_timestamp();

-- ===============================================================
-- 6. CREATE VIEWS FOR TIMELINE DATA
-- ===============================================================

-- View for timeline data by school
CREATE OR REPLACE VIEW public.school_attendance_timeline AS
SELECT 
    gas.school_id,
    gas.school_code,
    gas.school_name,
    gas.grade_level,
    gas.summary_date,
    gas.daily_absences,
    gas.cumulative_absences,
    gas.total_students,
    gas.attendance_rate,
    gas.absence_rate,
    gas.school_year,
    gas.week_number,
    gas.month_number
FROM public.grade_attendance_summary gas
WHERE gas.is_school_day = TRUE
ORDER BY gas.school_id, gas.grade_level, gas.summary_date;

-- View for district-wide timeline data
CREATE OR REPLACE VIEW public.district_attendance_timeline AS
SELECT 
    das.grade_level,
    das.summary_date,
    das.daily_absences,
    das.cumulative_absences,
    das.total_students,
    das.attendance_rate,
    das.absence_rate,
    das.school_year,
    das.schools_count,
    das.week_number,
    das.month_number
FROM public.district_attendance_summary das
WHERE das.is_school_day = TRUE
ORDER BY das.grade_level, das.summary_date;

-- ===============================================================
-- 7. SET UP ROW LEVEL SECURITY (RLS)
-- ===============================================================

-- Enable RLS on new tables
ALTER TABLE public.grade_attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_timeline_cache ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Allow authenticated users full access" ON public.grade_attendance_summary 
FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users full access" ON public.district_attendance_summary 
FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated users full access" ON public.attendance_timeline_cache 
FOR ALL TO authenticated USING (true);

-- Grant permissions to service role
GRANT ALL ON public.grade_attendance_summary TO service_role;
GRANT ALL ON public.district_attendance_summary TO service_role;
GRANT ALL ON public.attendance_timeline_cache TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_school_year_from_date(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calculate_cumulative_absences(VARCHAR(50), INTEGER, DATE, VARCHAR(9)) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_district_attendance_summary(DATE, VARCHAR(9)) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION populate_grade_attendance_summary(DATE, VARCHAR(9)) TO authenticated, service_role;

-- ===============================================================
-- 8. INITIAL DATA POPULATION (OPTIONAL)
-- ===============================================================

-- Populate summaries for the current school year (last 30 days as example)
DO $$
DECLARE
    current_date DATE := CURRENT_DATE;
    start_date DATE := CURRENT_DATE - INTERVAL '30 days';
    process_date DATE;
BEGIN
    -- Only run if we have attendance records to process
    IF EXISTS (SELECT 1 FROM public.attendance_records LIMIT 1) THEN
        RAISE NOTICE 'Populating attendance summaries for last 30 days...';
        
        process_date := start_date;
        WHILE process_date <= current_date LOOP
            -- Skip weekends (basic school day filter)
            IF EXTRACT(DOW FROM process_date) NOT IN (0, 6) THEN
                PERFORM populate_grade_attendance_summary(process_date);
                PERFORM refresh_district_attendance_summary(process_date);
            END IF;
            
            process_date := process_date + INTERVAL '1 day';
        END LOOP;
        
        RAISE NOTICE 'Attendance summaries populated successfully!';
    ELSE
        RAISE NOTICE 'No attendance records found. Skipping initial data population.';
    END IF;
END $$;

-- ===============================================================
-- 9. ANALYZE TABLES FOR PERFORMANCE
-- ===============================================================

ANALYZE public.grade_attendance_summary;
ANALYZE public.district_attendance_summary;
ANALYZE public.attendance_timeline_cache;

-- ===============================================================
-- 10. SUCCESS MESSAGE
-- ===============================================================

DO $$
BEGIN
    RAISE NOTICE '=== ATTENDANCE TIMELINE SCHEMA COMPLETED ===';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Created Tables:';
    RAISE NOTICE '   - grade_attendance_summary (school-level timeline data)';
    RAISE NOTICE '   - district_attendance_summary (district-wide timeline data)';
    RAISE NOTICE '   - attendance_timeline_cache (performance caching)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Created Views:';
    RAISE NOTICE '   - school_attendance_timeline';
    RAISE NOTICE '   - district_attendance_timeline';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Created Functions:';
    RAISE NOTICE '   - get_school_year_from_date(DATE)';
    RAISE NOTICE '   - calculate_cumulative_absences(...)';
    RAISE NOTICE '   - refresh_district_attendance_summary(...)';
    RAISE NOTICE '   - populate_grade_attendance_summary(...)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Performance: Optimized indexes created';
    RAISE NOTICE '✅ Security: RLS policies enabled';
    RAISE NOTICE '✅ Automation: Triggers for timestamp updates';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Database ready for timeline dashboard!';
    RAISE NOTICE '📋 Next: Implement timeline API and components';
    RAISE NOTICE '';
    RAISE NOTICE '=== END TIMELINE SCHEMA ===';
END $$;

-- ===============================================================
-- END OF ATTENDANCE TIMELINE SCHEMA MODIFICATIONS
-- ===============================================================