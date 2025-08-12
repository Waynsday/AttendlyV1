#!/usr/bin/env node

/**
 * Generate complete attendance data for all 1,000+ students
 * Aug 15, 2024 - Jun 12, 2025
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class AttendanceGenerator {
  constructor() {
    this.stats = {
      studentsProcessed: 0,
      recordsGenerated: 0,
      startTime: Date.now()
    };
  }

  async generateCompleteAttendance() {
    console.log('📅 Generating Complete Attendance Data');
    console.log('='.repeat(50));
    
    try {
      // Get all active students
      const { data: allStudents, error } = await supabase
        .from('students')
        .select('id, school_id, district_student_id, first_name, last_name, grade_level, schools(school_code)')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to fetch students: ${error.message}`);
      }

      console.log(`👥 Students to process: ${allStudents.length}`);
      
      // Generate school days (194 days for SY 2024-2025)
      const schoolDays = this.generateSchoolCalendar();
      console.log(`📅 School days: ${schoolDays.length}`);
      console.log(`📊 Total records: ${allStudents.length * schoolDays.length}`);

      // Process in batches to manage memory
      const batchSize = 25; // Students per batch
      
      for (let i = 0; i < allStudents.length; i += batchSize) {
        const batch = allStudents.slice(i, i + batchSize);
        console.log(`\n📊 Processing batch ${Math.floor(i/batchSize) + 1}: Students ${i + 1}-${i + batch.length}`);
        
        await this.processBatch(batch, schoolDays);
        
        console.log(`   ✅ Batch complete - Total records: ${this.stats.recordsGenerated}`);
      }

      console.log('\n' + '='.repeat(50));
      console.log('🎉 ATTENDANCE GENERATION COMPLETE!');
      console.log('='.repeat(50));
      console.log(`👥 Students processed: ${this.stats.studentsProcessed}`);
      console.log(`📅 Records generated: ${this.stats.recordsGenerated}`);
      console.log(`⏱️  Duration: ${Math.round((Date.now() - this.stats.startTime) / 1000)}s`);
      console.log(`📊 Average: ${Math.round(this.stats.recordsGenerated / this.stats.studentsProcessed)} records per student`);

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  async processBatch(students, schoolDays) {
    const attendanceData = [];

    for (const student of students) {
      this.stats.studentsProcessed++;
      
      for (const schoolDay of schoolDays) {
        attendanceData.push(this.createAttendanceRecord(student, schoolDay));
      }
    }

    // Insert batch
    const { error } = await supabase
      .from('attendance_records')
      .upsert(attendanceData, { onConflict: 'student_id,attendance_date' });

    if (error) {
      console.error(`   ❌ Batch insert error: ${error.message}`);
    } else {
      this.stats.recordsGenerated += attendanceData.length;
    }
  }

  createAttendanceRecord(student, schoolDay) {
    // Realistic California school attendance patterns
    const rand = Math.random();
    
    // Base attendance rates by grade
    let presentRate = 0.96; // 96% default
    if (student.grade_level <= 2) presentRate = 0.94; // K-2: slightly lower
    if (student.grade_level >= 6) presentRate = 0.97; // Middle school: better
    
    // Day of week effects
    const date = new Date(schoolDay);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 1 || dayOfWeek === 5) presentRate -= 0.02; // Monday/Friday effect
    
    // Seasonal effects
    const month = date.getMonth();
    if (month === 0 || month === 1) presentRate -= 0.03; // January/February flu season
    if (month === 4 || month === 9) presentRate -= 0.01; // May/October variations
    
    const isPresent = rand < presentRate;
    const isAbsent = !isPresent && rand < (presentRate + 0.03); // Most non-present are absent
    const isTardy = !isPresent && !isAbsent; // Rest are tardy
    
    const status = isPresent ? 'PRESENT' : (isAbsent ? 'ABSENT' : 'TARDY');
    
    // 7-day correction window
    const today = new Date();
    const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    const canCorrect = daysAgo <= 7;
    
    const correctionDeadline = new Date(date);
    correctionDeadline.setDate(correctionDeadline.getDate() + 7);
    
    return {
      student_id: student.id,
      school_id: student.school_id,
      attendance_date: schoolDay,
      is_present: isPresent,
      is_full_day_absent: isAbsent,
      days_enrolled: 1.0,
      
      // Period-by-period (7 periods for middle school)
      period_1_status: status,
      period_2_status: status,
      period_3_status: status,
      period_4_status: status,
      period_5_status: status,
      period_6_status: status,
      period_7_status: student.grade_level >= 6 ? status : 'PRESENT',
      
      tardy_count: isTardy ? 1 : 0,
      can_be_corrected: canCorrect,
      correction_deadline: correctionDeadline.toISOString().split('T')[0]
    };
  }

  generateSchoolCalendar() {
    const start = new Date('2024-08-15');
    const end = new Date('2025-06-12');
    const days = [];
    
    // California school holidays (approximate)
    const holidays = new Set([
      // Labor Day
      '2024-09-02',
      // Veterans Day  
      '2024-11-11',
      // Thanksgiving week
      '2024-11-28', '2024-11-29',
      // Winter break
      '2024-12-23', '2024-12-24', '2024-12-25', '2024-12-26', '2024-12-27', '2024-12-30', '2024-12-31',
      '2025-01-01', '2025-01-02', '2025-01-03',
      // MLK Day
      '2025-01-20',
      // Presidents Day
      '2025-02-17',
      // Spring break (approximate)
      '2025-03-31', '2025-04-01', '2025-04-02', '2025-04-03', '2025-04-04',
      // Memorial Day
      '2025-05-26'
    ]);

    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      
      // Include Monday-Friday, exclude holidays
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidays.has(dateStr)) {
        days.push(dateStr);
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }
}

async function main() {
  const generator = new AttendanceGenerator();
  await generator.generateCompleteAttendance();
}

main().catch(console.error);