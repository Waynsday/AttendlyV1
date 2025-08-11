-- Comprehensive diagnosis of school data coverage
-- Run these queries to understand why some schools have no timeline data

-- 1. Check all schools and their attendance data availability
SELECT 
    s.id as school_id,
    s.school_name,
    s.school_code,
    s.is_active,
    COUNT(ar.id) as attendance_records_count,
    MIN(ar.attendance_date) as earliest_attendance_date,
    MAX(ar.attendance_date) as latest_attendance_date,
    COUNT(DISTINCT ar.student_id) as unique_students_with_attendance,
    COUNT(DISTINCT ar.attendance_date) as unique_attendance_dates
FROM schools s
LEFT JOIN attendance_records ar ON s.id = ar.school_id 
    AND ar.attendance_date >= '2024-08-15' 
    AND ar.attendance_date <= '2024-12-15'
WHERE s.is_active = true
GROUP BY s.id, s.school_name, s.school_code, s.is_active
ORDER BY s.school_name;

-- 2. Check students table for each school
SELECT 
    s.school_name,
    s.school_code,
    COUNT(st.id) as total_students_enrolled,
    COUNT(CASE WHEN st.grade_level IS NOT NULL THEN 1 END) as students_with_grade,
    COUNT(CASE WHEN st.grade_level BETWEEN 1 AND 12 THEN 1 END) as students_grade_1_12,
    STRING_AGG(DISTINCT st.grade_level::text, ', ' ORDER BY st.grade_level::text) as available_grades
FROM schools s
LEFT JOIN students st ON s.id = st.school_id
WHERE s.is_active = true
GROUP BY s.id, s.school_name, s.school_code
ORDER BY s.school_name;

-- 3. Check the JOIN condition between attendance_records and students
SELECT 
    s.school_name,
    COUNT(ar.id) as attendance_records,
    COUNT(st.id) as matching_students,
    COUNT(CASE WHEN st.id IS NULL THEN 1 END) as orphaned_attendance_records,
    COUNT(CASE WHEN ar.id IS NULL THEN 1 END) as students_without_attendance
FROM schools s
LEFT JOIN attendance_records ar ON s.id = ar.school_id 
    AND ar.attendance_date >= '2024-08-15' 
    AND ar.attendance_date <= '2024-12-15'
LEFT JOIN students st ON ar.student_id = st.id
WHERE s.is_active = true
GROUP BY s.id, s.school_name
ORDER BY s.school_name;

-- 4. Check current timeline data by school
SELECT 
    s.school_name,
    s.school_code,
    COUNT(gts.id) as timeline_records,
    MIN(gts.summary_date) as earliest_timeline_date,
    MAX(gts.summary_date) as latest_timeline_date,
    COUNT(DISTINCT gts.grade_level) as grades_in_timeline,
    STRING_AGG(DISTINCT gts.grade_level::text, ', ' ORDER BY gts.grade_level::text) as timeline_grades,
    SUM(gts.total_students) as total_students_in_timeline,
    ROUND(AVG(gts.absence_rate), 2) as avg_absence_rate
FROM schools s
LEFT JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
WHERE s.is_active = true
GROUP BY s.id, s.school_name, s.school_code
ORDER BY s.school_name;

-- 5. Specific check for Golden Valley Elementary
SELECT 
    'Golden Valley Analysis' as analysis_type,
    s.school_name,
    s.school_code,
    s.id as school_uuid
FROM schools s
WHERE s.school_name ILIKE '%golden%valley%' OR s.school_code ILIKE '%golden%'
LIMIT 5;

-- Check attendance records for Golden Valley specifically
SELECT 
    'Golden Valley Attendance Records' as check_type,
    COUNT(ar.id) as attendance_count,
    MIN(ar.attendance_date) as earliest_date,
    MAX(ar.attendance_date) as latest_date,
    COUNT(DISTINCT ar.student_id) as unique_students
FROM schools s
JOIN attendance_records ar ON s.id = ar.school_id
WHERE s.school_name ILIKE '%golden%valley%'
    AND ar.attendance_date >= '2024-08-15';

-- Check students for Golden Valley specifically  
SELECT 
    'Golden Valley Students' as check_type,
    COUNT(st.id) as student_count,
    COUNT(CASE WHEN st.grade_level IS NOT NULL THEN 1 END) as students_with_grades,
    STRING_AGG(DISTINCT st.grade_level::text, ', ' ORDER BY st.grade_level::text) as grades_available
FROM schools s
JOIN students st ON s.id = st.school_id
WHERE s.school_name ILIKE '%golden%valley%';

-- 6. Check for data relationship issues
SELECT 
    'Data Relationship Check' as analysis_type,
    COUNT(*) as total_attendance_records,
    COUNT(CASE WHEN st.id IS NULL THEN 1 END) as attendance_without_student_record,
    COUNT(CASE WHEN st.grade_level IS NULL THEN 1 END) as students_without_grade,
    COUNT(CASE WHEN s.id IS NULL THEN 1 END) as attendance_without_school,
    ROUND(
        COUNT(CASE WHEN st.id IS NULL THEN 1 END)::DECIMAL / COUNT(*) * 100, 2
    ) as percent_orphaned_attendance
FROM attendance_records ar
LEFT JOIN students st ON ar.student_id = st.id
LEFT JOIN schools s ON ar.school_id = s.id
WHERE ar.attendance_date >= '2024-08-15'
    AND ar.attendance_date <= '2024-12-15';

-- 7. Sample data for schools with no timeline data
SELECT 
    'Schools Missing Timeline Data' as issue_type,
    s.school_name,
    s.school_code,
    'Reason: ' || 
    CASE 
        WHEN COUNT(ar.id) = 0 THEN 'No attendance records'
        WHEN COUNT(st.id) = 0 THEN 'No students in students table'
        WHEN COUNT(CASE WHEN st.grade_level IS NOT NULL THEN 1 END) = 0 THEN 'Students have no grade_level'
        ELSE 'Unknown issue'
    END as likely_reason,
    COUNT(ar.id) as attendance_records,
    COUNT(st.id) as student_records,
    COUNT(CASE WHEN st.grade_level IS NOT NULL THEN 1 END) as students_with_grade
FROM schools s
LEFT JOIN attendance_records ar ON s.id = ar.school_id 
    AND ar.attendance_date >= '2024-08-15'
LEFT JOIN students st ON ar.student_id = st.id
LEFT JOIN grade_attendance_timeline_summary gts ON s.id = gts.school_id
WHERE s.is_active = true
    AND gts.id IS NULL  -- Schools with no timeline data
GROUP BY s.id, s.school_name, s.school_code
ORDER BY s.school_name;

-- 8. Check the exact query our timeline rebuild script uses
SELECT 
    'Timeline Rebuild Query Test' as test_type,
    s.school_name,
    st.grade_level,
    ar.attendance_date,
    COUNT(*) as students_for_this_day_grade,
    COUNT(CASE WHEN ar.is_present = true THEN 1 END) as present_count,
    COUNT(CASE WHEN ar.is_present = false THEN 1 END) as absent_count
FROM attendance_records ar
JOIN students st ON ar.student_id = st.id
JOIN schools s ON ar.school_id = s.id
WHERE ar.attendance_date >= '2024-08-15' 
    AND ar.attendance_date <= '2024-08-20'  -- Small date range for testing
    AND s.is_active = true
    AND st.grade_level IS NOT NULL
    AND st.grade_level BETWEEN 1 AND 12
    AND EXTRACT(DOW FROM ar.attendance_date) NOT IN (0, 6)
    AND s.school_name ILIKE '%golden%valley%'  -- Focus on Golden Valley
GROUP BY s.school_name, st.grade_level, ar.attendance_date, s.id
ORDER BY s.school_name, ar.attendance_date, st.grade_level
LIMIT 20;