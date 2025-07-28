-- AP Romoland Attendance Tool - Database Functions and Views
-- This migration adds useful functions and views for attendance analytics and reporting

-- Function to calculate attendance percentage for a student over a date range
CREATE OR REPLACE FUNCTION calculate_student_attendance_percentage(
  p_student_id VARCHAR(50),
  p_start_date DATE,
  p_end_date DATE
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_days INTEGER;
  total_periods INTEGER;
  present_periods INTEGER;
BEGIN
  -- Count total school days in the range
  SELECT COUNT(*) INTO total_days
  FROM attendance_records
  WHERE student_id = p_student_id
    AND date BETWEEN p_start_date AND p_end_date;
  
  IF total_days = 0 THEN
    RETURN 0;
  END IF;
  
  total_periods := total_days * 7; -- 7 periods per day
  
  -- Count present periods (including tardy)
  SELECT 
    (CASE WHEN period_1_status IN ('PRESENT', 'TARDY') THEN 1 ELSE 0 END +
     CASE WHEN period_2_status IN ('PRESENT', 'TARDY') THEN 1 ELSE 0 END +
     CASE WHEN period_3_status IN ('PRESENT', 'TARDY') THEN 1 ELSE 0 END +
     CASE WHEN period_4_status IN ('PRESENT', 'TARDY') THEN 1 ELSE 0 END +
     CASE WHEN period_5_status IN ('PRESENT', 'TARDY') THEN 1 ELSE 0 END +
     CASE WHEN period_6_status IN ('PRESENT', 'TARDY') THEN 1 ELSE 0 END +
     CASE WHEN period_7_status IN ('PRESENT', 'TARDY') THEN 1 ELSE 0 END)
  INTO present_periods
  FROM attendance_records
  WHERE student_id = p_student_id
    AND date BETWEEN p_start_date AND p_end_date;
  
  RETURN ROUND((present_periods::DECIMAL / total_periods::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get students with low attendance
CREATE OR REPLACE FUNCTION get_students_with_low_attendance(
  p_threshold DECIMAL(5,2) DEFAULT 90.0,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  student_id VARCHAR(50),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  grade_level INTEGER,
  attendance_percentage DECIMAL(5,2),
  total_days INTEGER,
  absent_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.student_id,
    s.first_name,
    s.last_name,
    s.grade_level,
    calculate_student_attendance_percentage(s.student_id, p_start_date, p_end_date) as attendance_percentage,
    COUNT(ar.date)::INTEGER as total_days,
    COUNT(CASE WHEN ar.daily_attendance_percentage = 0 THEN 1 END)::INTEGER as absent_days
  FROM students s
  LEFT JOIN attendance_records ar ON s.student_id = ar.student_id
    AND ar.date BETWEEN p_start_date AND p_end_date
  WHERE s.is_active = true
  GROUP BY s.student_id, s.first_name, s.last_name, s.grade_level
  HAVING calculate_student_attendance_percentage(s.student_id, p_start_date, p_end_date) < p_threshold
  ORDER BY attendance_percentage ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get daily attendance summary
CREATE OR REPLACE FUNCTION get_daily_attendance_summary(p_date DATE)
RETURNS TABLE (
  date DATE,
  total_students INTEGER,
  present_students INTEGER,
  absent_students INTEGER,
  tardy_students INTEGER,
  attendance_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p_date as date,
    COUNT(*)::INTEGER as total_students,
    COUNT(CASE WHEN ar.daily_attendance_percentage > 0 THEN 1 END)::INTEGER as present_students,
    COUNT(CASE WHEN ar.daily_attendance_percentage = 0 THEN 1 END)::INTEGER as absent_students,
    COUNT(CASE WHEN (
      ar.period_1_status = 'TARDY' OR ar.period_2_status = 'TARDY' OR
      ar.period_3_status = 'TARDY' OR ar.period_4_status = 'TARDY' OR
      ar.period_5_status = 'TARDY' OR ar.period_6_status = 'TARDY' OR
      ar.period_7_status = 'TARDY'
    ) THEN 1 END)::INTEGER as tardy_students,
    ROUND(AVG(ar.daily_attendance_percentage), 2) as attendance_rate
  FROM attendance_records ar
  WHERE ar.date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get attendance trends for a student
CREATE OR REPLACE FUNCTION get_student_attendance_trend(
  p_student_id VARCHAR(50),
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  date DATE,
  daily_percentage DECIMAL(5,2),
  periods_present INTEGER,
  periods_absent INTEGER,
  periods_tardy INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.date,
    ar.daily_attendance_percentage,
    (CASE WHEN ar.period_1_status = 'PRESENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_2_status = 'PRESENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_3_status = 'PRESENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_4_status = 'PRESENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_5_status = 'PRESENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_6_status = 'PRESENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_7_status = 'PRESENT' THEN 1 ELSE 0 END)::INTEGER as periods_present,
    (CASE WHEN ar.period_1_status = 'ABSENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_2_status = 'ABSENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_3_status = 'ABSENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_4_status = 'ABSENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_5_status = 'ABSENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_6_status = 'ABSENT' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_7_status = 'ABSENT' THEN 1 ELSE 0 END)::INTEGER as periods_absent,
    (CASE WHEN ar.period_1_status = 'TARDY' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_2_status = 'TARDY' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_3_status = 'TARDY' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_4_status = 'TARDY' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_5_status = 'TARDY' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_6_status = 'TARDY' THEN 1 ELSE 0 END +
     CASE WHEN ar.period_7_status = 'TARDY' THEN 1 ELSE 0 END)::INTEGER as periods_tardy
  FROM attendance_records ar
  WHERE ar.student_id = p_student_id
    AND ar.date >= CURRENT_DATE - INTERVAL '1 day' * p_days
  ORDER BY ar.date DESC;
END;
$$ LANGUAGE plpgsql;

-- View for attendance dashboard summary
CREATE VIEW attendance_dashboard_summary AS
SELECT 
  ar.date,
  ar.school_year,
  COUNT(DISTINCT ar.student_id) as total_students,
  COUNT(CASE WHEN ar.daily_attendance_percentage > 0 THEN 1 END) as students_present,
  COUNT(CASE WHEN ar.daily_attendance_percentage = 0 THEN 1 END) as students_absent,
  ROUND(AVG(ar.daily_attendance_percentage), 2) as average_attendance_rate,
  COUNT(CASE WHEN ar.daily_attendance_percentage < 90 THEN 1 END) as students_below_90_percent
FROM attendance_records ar
WHERE ar.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ar.date, ar.school_year
ORDER BY ar.date DESC;

-- View for student attendance summary
CREATE VIEW student_attendance_summary AS
SELECT 
  s.student_id,
  s.first_name,
  s.last_name,
  s.grade_level,
  COUNT(ar.date) as total_days_recorded,
  COUNT(CASE WHEN ar.daily_attendance_percentage = 100 THEN 1 END) as perfect_attendance_days,
  COUNT(CASE WHEN ar.daily_attendance_percentage = 0 THEN 1 END) as full_day_absences,
  ROUND(AVG(ar.daily_attendance_percentage), 2) as average_attendance_percentage,
  MAX(ar.date) as last_attendance_date
FROM students s
LEFT JOIN attendance_records ar ON s.student_id = ar.student_id
  AND ar.date >= CURRENT_DATE - INTERVAL '90 days'
WHERE s.is_active = true
GROUP BY s.student_id, s.first_name, s.last_name, s.grade_level
ORDER BY average_attendance_percentage ASC;

-- View for intervention summary
CREATE VIEW intervention_summary AS
SELECT 
  i.student_id,
  s.first_name,
  s.last_name,
  s.grade_level,
  COUNT(*) as total_interventions,
  COUNT(CASE WHEN i.status = 'COMPLETED' THEN 1 END) as completed_interventions,
  COUNT(CASE WHEN i.status = 'SCHEDULED' THEN 1 END) as scheduled_interventions,
  COUNT(CASE WHEN i.status = 'CANCELED' THEN 1 END) as canceled_interventions,
  COUNT(CASE WHEN i.status = 'SCHEDULED' AND i.scheduled_date < CURRENT_DATE THEN 1 END) as overdue_interventions,
  MAX(i.created_at) as last_intervention_date
FROM interventions i
JOIN students s ON i.student_id = s.student_id
WHERE s.is_active = true
  AND i.created_at >= CURRENT_DATE - INTERVAL '180 days'
GROUP BY i.student_id, s.first_name, s.last_name, s.grade_level
ORDER BY total_interventions DESC;

-- RLS policies for views (inherit from base tables)
ALTER VIEW attendance_dashboard_summary SET (security_barrier = true);
ALTER VIEW student_attendance_summary SET (security_barrier = true);
ALTER VIEW intervention_summary SET (security_barrier = true);

-- Function to check for students needing interventions
CREATE OR REPLACE FUNCTION identify_students_needing_interventions()
RETURNS TABLE (
  student_id VARCHAR(50),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  grade_level INTEGER,
  attendance_percentage DECIMAL(5,2),
  consecutive_absences INTEGER,
  days_since_last_intervention INTEGER,
  risk_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH student_stats AS (
    SELECT 
      s.student_id,
      s.first_name,
      s.last_name,
      s.grade_level,
      calculate_student_attendance_percentage(s.student_id, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE) as attendance_pct,
      -- Calculate consecutive absences (simplified - counts recent full-day absences)
      (SELECT COUNT(*) 
       FROM attendance_records ar2 
       WHERE ar2.student_id = s.student_id 
         AND ar2.date >= CURRENT_DATE - INTERVAL '7 days'
         AND ar2.daily_attendance_percentage = 0) as recent_absences,
      -- Days since last intervention
      COALESCE(
        EXTRACT(DAY FROM CURRENT_DATE - MAX(i.created_at::DATE))::INTEGER,
        999
      ) as days_since_intervention
    FROM students s
    LEFT JOIN interventions i ON s.student_id = i.student_id
    WHERE s.is_active = true
    GROUP BY s.student_id, s.first_name, s.last_name, s.grade_level
  )
  SELECT 
    ss.student_id,
    ss.first_name,
    ss.last_name,
    ss.grade_level,
    ss.attendance_pct,
    ss.recent_absences,
    ss.days_since_intervention,
    CASE 
      WHEN ss.attendance_pct < 80 OR ss.recent_absences >= 3 THEN 'HIGH'
      WHEN ss.attendance_pct < 90 OR ss.recent_absences >= 2 THEN 'MEDIUM'
      WHEN ss.attendance_pct < 95 OR ss.recent_absences >= 1 THEN 'LOW'
      ELSE 'NONE'
    END as risk_level
  FROM student_stats ss
  WHERE (ss.attendance_pct < 95 OR ss.recent_absences > 0)
    AND ss.days_since_intervention > 7  -- Don't suggest if recent intervention exists
  ORDER BY 
    CASE 
      WHEN ss.attendance_pct < 80 OR ss.recent_absences >= 3 THEN 1
      WHEN ss.attendance_pct < 90 OR ss.recent_absences >= 2 THEN 2
      WHEN ss.attendance_pct < 95 OR ss.recent_absences >= 1 THEN 3
      ELSE 4
    END,
    ss.attendance_pct ASC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION calculate_student_attendance_percentage IS 'Calculates attendance percentage for a student over a date range';
COMMENT ON FUNCTION get_students_with_low_attendance IS 'Returns students with attendance below specified threshold';
COMMENT ON FUNCTION get_daily_attendance_summary IS 'Provides daily attendance statistics';
COMMENT ON FUNCTION get_student_attendance_trend IS 'Shows attendance trend for individual student';
COMMENT ON FUNCTION identify_students_needing_interventions IS 'Identifies students who may need attendance interventions';

COMMENT ON VIEW attendance_dashboard_summary IS 'Dashboard view showing daily attendance summaries';
COMMENT ON VIEW student_attendance_summary IS 'Individual student attendance statistics';
COMMENT ON VIEW intervention_summary IS 'Summary of interventions by student';