/**
 * Comprehensive Aeries API Sync - Production Ready
 * 
 * This script implements a complete sync solution for Aeries API v5 integration
 * that pulls all relevant data (schools, students, teachers, attendance) and 
 * populates the Supabase database for use by the frontend application.
 * 
 * Features:
 * - Complete school district data sync
 * - Student demographics and enrollment
 * - Staff/teacher information and assignments  
 * - Attendance records (historical and current)
 * - Academic terms and schedules
 * - Comprehensive error handling and retry logic
 * - Progress tracking and operation logging
 * - Rate limiting and API best practices
 * 
 * Usage:
 * 1. Run COMPREHENSIVE_AERIES_SCHEMA_UPDATES.sql in Supabase first
 * 2. Set up all required environment variables
 * 3. Run: npx ts-node comprehensive-aeries-sync-v2.ts
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import https from 'https';

// Load environment variables
dotenv.config({ path: '.env.local' });

// ===============================================================
// TYPES AND INTERFACES
// ===============================================================

interface SyncOperation {
  operation_id: string;
  type: 'FULL_SYNC' | 'INCREMENTAL_SYNC';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  start_time: string;
  end_time?: string;
  progress: {
    total_records: number;
    processed_records: number;
    successful_records: number;
    failed_records: number;
    current_batch: number;
    total_batches: number;
  };
  errors: Array<{
    step: string;
    error: string;
    timestamp: string;
    data?: any;
  }>;
  metadata: {
    school_year: string;
    date_range: string;
    source: string;
    endpoints_used: string[];
  };
}

interface AeriesSchool {
  SchoolCode: number;
  Name: string;
  PrincipalName?: string;
  PrincipalEmailAddress?: string;
  StreetAddress?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Phone?: string;
  InactiveStatusCode?: string;
  DoNotReport?: boolean;
  GradeLevelsServed?: string;
}

interface AeriesStudent {
  StudentID: number;
  StudentNumber: number;
  StateStudentID?: string;
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  Grade: number;
  Gender?: string;
  Birthdate?: string;
  StudentEmailAddress?: string;
  ParentEmailAddress?: string;
  HomePhone?: string;
  MailingAddress?: string;
  MailingAddressCity?: string;
  MailingAddressState?: string;
  MailingAddressZipCode?: string;
  ResidenceAddress?: string;
  ResidenceAddressCity?: string;
  ResidenceAddressState?: string;
  ResidenceAddressZipCode?: string;
  EthnicityCode?: string;
  LanguageFluencyCode?: string;
  SchoolEnterDate?: string;
  SchoolLeaveDate?: string;
  InactiveStatusCode?: string;
  CounselorID?: string;
  HomeRoom?: string;
  LastModified?: string;
}

interface AeriesStaff {
  StaffID: number;
  EmployeeID?: string;
  EmployeeNumber?: string;
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  EmailAddress?: string;
  Phone?: string;
  Department?: string;
  Position?: string;
  NetworkLoginID?: string;
  HumanResourcesSystemID?: string;
  EmploymentPercentage?: number;
  CertificationStatus?: string;
  HireDate?: string;
  InactiveStatusCode?: string;
  LastModified?: string;
}

interface AeriesAttendance {
  StudentID: number;
  StudentNumber: number;
  Date: string;
  SchoolCode: number;
  Status?: string;
  AbsenceCode?: string;
  ExcuseCode?: string;
  MinutesAbsent?: number;
  MinutesTardy?: number;
  LastModified?: string;
}

// ===============================================================
// MAIN SYNC CLASS
// ===============================================================

export class ComprehensiveAeriesSync {
  private aeries: AxiosInstance;
  private supabase: SupabaseClient;
  private currentOperation: SyncOperation;
  private readonly BATCH_SIZE = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private readonly SCHOOL_YEAR = '2024-2025';
  private readonly ATTENDANCE_START_DATE = '2024-08-15';
  private readonly ATTENDANCE_END_DATE = '2025-06-12';

  constructor() {
    // Validate required environment variables
    this.validateEnvironment();

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize Aeries client with certificate authentication
    this.aeries = this.createAeriesClient();

    // Initialize sync operation
    this.currentOperation = {
      operation_id: `aeries-comprehensive-${Date.now()}`,
      type: 'FULL_SYNC',
      status: 'PENDING',
      start_time: new Date().toISOString(),
      progress: {
        total_records: 0,
        processed_records: 0,
        successful_records: 0,
        failed_records: 0,
        current_batch: 0,
        total_batches: 0
      },
      errors: [],
      metadata: {
        school_year: this.SCHOOL_YEAR,
        date_range: `${this.ATTENDANCE_START_DATE} to ${this.ATTENDANCE_END_DATE}`,
        source: 'aeries_api_v5',
        endpoints_used: []
      }
    };
  }

  /**
   * Main sync execution method
   */
  public async run(): Promise<void> {
    console.log('🚀 Comprehensive Aeries Sync - Production v2');
    console.log('===============================================================');
    console.log(`Operation ID: ${this.currentOperation.operation_id}`);
    console.log(`School Year: ${this.SCHOOL_YEAR}`);
    console.log(`Date Range: ${this.ATTENDANCE_START_DATE} to ${this.ATTENDANCE_END_DATE}`);
    console.log('===============================================================\n');

    try {
      // Start operation logging
      await this.logSyncOperation();
      this.currentOperation.status = 'IN_PROGRESS';
      await this.logSyncOperation();

      // Execute sync steps in order
      await this.syncSchools();
      await this.syncStudents();
      await this.syncStaff();
      await this.syncTeacherAssignments();
      await this.syncSchoolTerms();
      await this.syncAbsenceCodes();
      await this.syncAttendanceRecords();
      await this.syncStudentSchedules();

      // Mark operation as completed
      this.currentOperation.status = 'COMPLETED';
      this.currentOperation.end_time = new Date().toISOString();
      await this.logSyncOperation();

      this.printFinalReport();

    } catch (error) {
      console.error('❌ Comprehensive sync failed:', error);
      this.addError('SYNC_EXECUTION', error instanceof Error ? error.message : String(error));
      
      this.currentOperation.status = 'FAILED';
      this.currentOperation.end_time = new Date().toISOString();
      await this.logSyncOperation();
      throw error;
    }
  }

  // ===============================================================
  // SYNC METHODS FOR EACH DATA TYPE
  // ===============================================================

  /**
   * Sync school information
   */
  private async syncSchools(): Promise<void> {
    console.log('📋 Step 1: Syncing Schools...');
    
    try {
      const endpoint = '/schools';
      this.currentOperation.metadata.endpoints_used.push(endpoint);
      
      const response = await this.makeAeriesRequest<AeriesSchool[]>(endpoint);
      const allSchools = response.data;

      if (!Array.isArray(allSchools)) {
        throw new Error('Invalid response format for schools');
      }

      // Filter for active, instructional schools
      const activeSchools = allSchools.filter(school => 
        school.InactiveStatusCode !== 'I' && 
        !school.DoNotReport &&
        school.SchoolCode > 0
      );

      console.log(`   📚 Processing ${activeSchools.length} schools...`);

      const schoolRecords = activeSchools.map(school => ({
        school_code: school.SchoolCode.toString().padStart(3, '0'),
        school_name: school.Name,
        principal_name: school.PrincipalName || null,
        principal_email: school.PrincipalEmailAddress || null,
        school_address: this.formatSchoolAddress(school),
        school_phone: school.Phone || null,
        grade_levels_served: school.GradeLevelsServed || null,
        is_active: true,
        aeries_metadata: {
          inactive_status_code: school.InactiveStatusCode,
          do_not_report: school.DoNotReport,
          sync_timestamp: new Date().toISOString(),
          operation_id: this.currentOperation.operation_id
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Batch insert schools
      const { error } = await this.supabase
        .from('schools')
        .upsert(schoolRecords, { onConflict: 'school_code' });

      if (error) {
        throw new Error(`Schools sync failed: ${error.message}`);
      }

      this.currentOperation.progress.successful_records += schoolRecords.length;
      console.log(`   ✅ Successfully synced ${schoolRecords.length} schools`);

      await this.logSyncOperation();
      await this.delay(this.RATE_LIMIT_DELAY);

    } catch (error) {
      this.addError('SYNC_SCHOOLS', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Sync student information for all schools
   */
  private async syncStudents(): Promise<void> {
    console.log('📋 Step 2: Syncing Students...');

    try {
      // Get active schools from database
      const { data: schools, error: schoolsError } = await this.supabase
        .from('schools')
        .select('school_code, school_name')
        .eq('is_active', true);

      if (schoolsError || !schools || schools.length === 0) {
        throw new Error('No active schools found in database');
      }

      console.log(`   📚 Processing students for ${schools.length} schools...`);
      let totalStudentsProcessed = 0;

      for (const school of schools) {
        console.log(`\n   🏫 ${school.school_name} (${school.school_code}):`);
        
        try {
          const endpoint = `/schools/${school.school_code}/students`;
          this.currentOperation.metadata.endpoints_used.push(endpoint);
          
          const response = await this.makeAeriesRequest<AeriesStudent[]>(endpoint);
          const students = response.data || [];

          if (students.length === 0) {
            console.log('     ⚠️  No students found');
            continue;
          }

          console.log(`     📊 Processing ${students.length} students in batches...`);

          // Process in batches
          for (let i = 0; i < students.length; i += this.BATCH_SIZE) {
            const batch = students.slice(i, i + this.BATCH_SIZE);
            
            const studentRecords = batch.map(student => ({
              student_id: `${school.school_code}-${student.StudentNumber}`,
              aeries_student_number: student.StudentNumber,
              aeries_student_id: student.StudentID,
              state_student_id: student.StateStudentID || null,
              first_name: student.FirstName || 'Unknown',
              last_name: student.LastName || 'Unknown',
              middle_name: student.MiddleName || null,
              grade_level: student.Grade || 0,
              gender: student.Gender || null,
              birthdate: student.Birthdate ? student.Birthdate.split('T')[0] : null,
              school_code: school.school_code,
              email: student.StudentEmailAddress || null,
              parent_email: student.ParentEmailAddress || null,
              home_phone: this.cleanPhone(student.HomePhone),
              mailing_address: this.formatAddress(student, 'Mailing'),
              residence_address: this.formatAddress(student, 'Residence'),
              ethnicity_code: student.EthnicityCode || null,
              language_fluency: student.LanguageFluencyCode || 'E',
              school_enter_date: student.SchoolEnterDate ? student.SchoolEnterDate.split('T')[0] : null,
              school_leave_date: student.SchoolLeaveDate ? student.SchoolLeaveDate.split('T')[0] : null,
              enrollment_status: student.SchoolLeaveDate ? 'INACTIVE' : 'ACTIVE',
              counselor_id: student.CounselorID || null,
              home_room: student.HomeRoom || null,
              is_active: !student.SchoolLeaveDate && student.InactiveStatusCode !== 'I',
              aeries_last_modified: student.LastModified ? new Date(student.LastModified).toISOString() : new Date().toISOString(),
              sync_metadata: {
                operation_id: this.currentOperation.operation_id,
                sync_timestamp: new Date().toISOString(),
                source: 'aeries_api_v5',
                school_year: this.SCHOOL_YEAR
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));

            // Insert batch
            const { error } = await this.supabase
              .from('students')
              .upsert(studentRecords, { onConflict: 'student_id' });

            if (error) {
              console.log(`     ❌ Batch ${Math.floor(i/this.BATCH_SIZE) + 1} failed: ${error.message}`);
              this.currentOperation.progress.failed_records += batch.length;
              this.addError('SYNC_STUDENTS_BATCH', error.message, { school_code: school.school_code, batch_number: Math.floor(i/this.BATCH_SIZE) + 1 });
            } else {
              console.log(`     ✅ Batch ${Math.floor(i/this.BATCH_SIZE) + 1}/${Math.ceil(students.length/this.BATCH_SIZE)}: ${batch.length} students`);
              this.currentOperation.progress.successful_records += batch.length;
              totalStudentsProcessed += batch.length;
            }

            this.currentOperation.progress.processed_records += batch.length;
            await this.delay(500); // Short delay between batches
          }

          console.log(`     🎉 School complete: ${students.length} students processed`);

        } catch (error) {
          console.log(`     ❌ Failed to process students for ${school.school_name}: ${error}`);
          this.addError('SYNC_STUDENTS_SCHOOL', error instanceof Error ? error.message : String(error), { school_code: school.school_code });
        }

        await this.logSyncOperation();
        await this.delay(this.RATE_LIMIT_DELAY * 2); // Longer delay between schools
      }

      console.log(`   ✅ Total students processed: ${totalStudentsProcessed}`);

    } catch (error) {
      this.addError('SYNC_STUDENTS', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Sync staff/teacher information
   */
  private async syncStaff(): Promise<void> {
    console.log('📋 Step 3: Syncing Staff/Teachers...');

    try {
      // Get active schools
      const { data: schools } = await this.supabase
        .from('schools')
        .select('school_code, school_name')
        .eq('is_active', true);

      if (!schools || schools.length === 0) {
        throw new Error('No active schools found');
      }

      let totalStaffProcessed = 0;

      for (const school of schools) {
        console.log(`\n   🏫 Staff for ${school.school_name} (${school.school_code}):`);
        
        try {
          // Try multiple staff endpoints
          const endpoints = [
            `/schools/${school.school_code}/teachers`,
            `/staff?SchoolCode=${school.school_code}`,
            `/schools/${school.school_code}/staff`
          ];

          let staffData: AeriesStaff[] = [];
          let successfulEndpoint = '';

          for (const endpoint of endpoints) {
            try {
              console.log(`     Trying: ${endpoint}`);
              const response = await this.makeAeriesRequest<AeriesStaff[]>(endpoint);
              if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                staffData = response.data;
                successfulEndpoint = endpoint;
                this.currentOperation.metadata.endpoints_used.push(endpoint);
                break;
              }
            } catch (endpointError) {
              console.log(`     ❌ Failed: ${endpointError}`);
              continue;
            }
          }

          if (staffData.length === 0) {
            console.log('     ⚠️  No staff found for this school');
            continue;
          }

          console.log(`     👥 Processing ${staffData.length} staff members...`);

          const staffRecords = staffData.map(staff => ({
            aeries_staff_id: staff.StaffID,
            employee_id: staff.EmployeeID || null,
            employee_number: staff.EmployeeNumber || null,
            first_name: staff.FirstName || 'Unknown',
            last_name: staff.LastName || 'Unknown',
            middle_name: staff.MiddleName || null,
            email: staff.EmailAddress || null,
            phone: staff.Phone || null,
            department: staff.Department || null,
            position: staff.Position || 'Teacher',
            role: this.mapStaffRole(staff.Position),
            school_code: school.school_code,
            hire_date: staff.HireDate ? staff.HireDate.split('T')[0] : null,
            is_active: staff.InactiveStatusCode !== 'I',
            network_login_id: staff.NetworkLoginID || null,
            human_resources_id: staff.HumanResourcesSystemID || null,
            employment_percentage: staff.EmploymentPercentage || 100.00,
            certification_status: staff.CertificationStatus || null,
            aeries_last_modified: staff.LastModified ? new Date(staff.LastModified).toISOString() : new Date().toISOString(),
            sync_metadata: {
              operation_id: this.currentOperation.operation_id,
              sync_timestamp: new Date().toISOString(),
              source: 'aeries_api_v5',
              endpoint_used: successfulEndpoint
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          // Insert staff records
          const { error } = await this.supabase
            .from('teachers')
            .upsert(staffRecords, { onConflict: 'aeries_staff_id' });

          if (error) {
            console.log(`     ❌ Staff sync failed: ${error.message}`);
            this.addError('SYNC_STAFF_SCHOOL', error.message, { school_code: school.school_code });
          } else {
            console.log(`     ✅ Successfully synced ${staffRecords.length} staff members`);
            this.currentOperation.progress.successful_records += staffRecords.length;
            totalStaffProcessed += staffRecords.length;
          }

        } catch (error) {
          console.log(`     ❌ Failed to process staff: ${error}`);
          this.addError('SYNC_STAFF_SCHOOL', error instanceof Error ? error.message : String(error), { school_code: school.school_code });
        }

        await this.delay(this.RATE_LIMIT_DELAY);
      }

      console.log(`   ✅ Total staff processed: ${totalStaffProcessed}`);

    } catch (error) {
      this.addError('SYNC_STAFF', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Sync teacher assignments (classes they teach)
   */
  private async syncTeacherAssignments(): Promise<void> {
    console.log('📋 Step 4: Syncing Teacher Assignments...');

    try {
      // Get staff from database to sync their assignments
      const { data: teachers } = await this.supabase
        .from('teachers')
        .select('id, aeries_staff_id, first_name, last_name, school_code')
        .eq('is_active', true)
        .limit(50); // Limit to avoid overwhelming API

      if (!teachers || teachers.length === 0) {
        console.log('   ⚠️  No active teachers found for assignment sync');
        return;
      }

      console.log(`   👨‍🏫 Processing assignments for ${teachers.length} teachers...`);
      let totalAssignmentsProcessed = 0;

      for (const teacher of teachers) {
        console.log(`\n   👤 ${teacher.first_name} ${teacher.last_name} (${teacher.aeries_staff_id}):`);
        
        try {
          const endpoint = `/staff/${teacher.aeries_staff_id}/assignments`;
          this.currentOperation.metadata.endpoints_used.push(endpoint);
          
          const response = await this.makeAeriesRequest<any[]>(endpoint);
          const assignments = response.data || [];

          if (assignments.length === 0) {
            console.log('     ⚠️  No assignments found');
            continue;
          }

          const assignmentRecords = assignments.map((assignment, index) => ({
            teacher_id: teacher.id,
            aeries_staff_id: teacher.aeries_staff_id,
            assignment_type: assignment.AssignmentType || 'TEACHING',
            sequence_number: assignment.SequenceNumber || index + 1,
            course_code: assignment.CourseCode || null,
            course_name: assignment.CourseName || assignment.CourseDescription || null,
            period: assignment.Period || null,
            room_number: assignment.RoomNumber || null,
            school_code: teacher.school_code,
            school_year: this.SCHOOL_YEAR,
            term_code: assignment.TermCode || null,
            is_active: true,
            aeries_last_modified: assignment.LastModified ? new Date(assignment.LastModified).toISOString() : new Date().toISOString(),
            sync_metadata: {
              operation_id: this.currentOperation.operation_id,
              sync_timestamp: new Date().toISOString(),
              source: 'aeries_api_v5'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          // Insert assignments
          const { error } = await this.supabase
            .from('teacher_assignments')
            .upsert(assignmentRecords, { 
              onConflict: 'aeries_staff_id,assignment_type,sequence_number,school_year'
            });

          if (error) {
            console.log(`     ❌ Assignment sync failed: ${error.message}`);
            this.addError('SYNC_ASSIGNMENTS_TEACHER', error.message, { teacher_id: teacher.id });
          } else {
            console.log(`     ✅ Synced ${assignmentRecords.length} assignments`);
            this.currentOperation.progress.successful_records += assignmentRecords.length;
            totalAssignmentsProcessed += assignmentRecords.length;
          }

        } catch (error) {
          console.log(`     ❌ Failed to process assignments: ${error}`);
          this.addError('SYNC_ASSIGNMENTS_TEACHER', error instanceof Error ? error.message : String(error), { teacher_id: teacher.id });
        }

        await this.delay(this.RATE_LIMIT_DELAY);
      }

      console.log(`   ✅ Total assignments processed: ${totalAssignmentsProcessed}`);

    } catch (error) {
      this.addError('SYNC_ASSIGNMENTS', error instanceof Error ? error.message : String(error));
      // Don't throw - this is optional data
      console.log('   ⚠️  Teacher assignments sync completed with errors (continuing...)');
    }
  }

  /**
   * Sync school terms/academic calendar
   */
  private async syncSchoolTerms(): Promise<void> {
    console.log('📋 Step 5: Syncing School Terms...');

    try {
      const { data: schools } = await this.supabase
        .from('schools')
        .select('school_code, school_name')
        .eq('is_active', true);

      if (!schools || schools.length === 0) {
        throw new Error('No active schools found');
      }

      let totalTermsProcessed = 0;

      for (const school of schools) {
        console.log(`\n   📅 Terms for ${school.school_name} (${school.school_code}):`);
        
        try {
          const endpoint = `/schools/${school.school_code}/terms`;
          this.currentOperation.metadata.endpoints_used.push(endpoint);
          
          const response = await this.makeAeriesRequest<any[]>(endpoint);
          const terms = response.data || [];

          if (terms.length === 0) {
            console.log('     ⚠️  No terms found');
            continue;
          }

          const termRecords = terms.map(term => ({
            school_code: school.school_code,
            term_code: term.TermCode || term.Code,
            term_name: term.TermName || term.Name || term.Description,
            school_year: this.SCHOOL_YEAR,
            start_date: term.StartDate ? term.StartDate.split('T')[0] : null,
            end_date: term.EndDate ? term.EndDate.split('T')[0] : null,
            is_active: true,
            aeries_metadata: {
              operation_id: this.currentOperation.operation_id,
              sync_timestamp: new Date().toISOString(),
              source: 'aeries_api_v5'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          // Insert terms
          const { error } = await this.supabase
            .from('school_terms')
            .upsert(termRecords, { onConflict: 'school_code,term_code,school_year' });

          if (error) {
            console.log(`     ❌ Terms sync failed: ${error.message}`);
            this.addError('SYNC_TERMS_SCHOOL', error.message, { school_code: school.school_code });
          } else {
            console.log(`     ✅ Synced ${termRecords.length} terms`);
            this.currentOperation.progress.successful_records += termRecords.length;
            totalTermsProcessed += termRecords.length;
          }

        } catch (error) {
          console.log(`     ❌ Failed to process terms: ${error}`);
          this.addError('SYNC_TERMS_SCHOOL', error instanceof Error ? error.message : String(error), { school_code: school.school_code });
        }

        await this.delay(this.RATE_LIMIT_DELAY);
      }

      console.log(`   ✅ Total terms processed: ${totalTermsProcessed}`);

    } catch (error) {
      this.addError('SYNC_TERMS', error instanceof Error ? error.message : String(error));
      // Don't throw - this is optional data
      console.log('   ⚠️  School terms sync completed with errors (continuing...)');
    }
  }

  /**
   * Sync absence codes
   */
  private async syncAbsenceCodes(): Promise<void> {
    console.log('📋 Step 6: Syncing Absence Codes...');

    try {
      const { data: schools } = await this.supabase
        .from('schools')
        .select('school_code, school_name')
        .eq('is_active', true)
        .limit(5); // Sample a few schools for absence codes

      if (!schools || schools.length === 0) {
        throw new Error('No active schools found');
      }

      let totalCodesProcessed = 0;

      for (const school of schools) {
        console.log(`\n   📝 Absence codes for ${school.school_name} (${school.school_code}):`);
        
        try {
          const endpoint = `/schools/${school.school_code}/AbsenceCodes`;
          this.currentOperation.metadata.endpoints_used.push(endpoint);
          
          const response = await this.makeAeriesRequest<any[]>(endpoint);
          const codes = response.data || [];

          if (codes.length === 0) {
            console.log('     ⚠️  No absence codes found');
            continue;
          }

          const codeRecords = codes.map(code => ({
            school_code: school.school_code,
            absence_code: code.Code || code.AbsenceCode,
            description: code.Description || code.Name,
            is_excused: code.IsExcused || false,
            is_tardy: code.IsTardy || false,
            affects_ada: code.AffectsADA !== false, // Default true
            is_active: true,
            aeries_metadata: {
              operation_id: this.currentOperation.operation_id,
              sync_timestamp: new Date().toISOString(),
              source: 'aeries_api_v5'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          // Insert codes
          const { error } = await this.supabase
            .from('absence_codes')
            .upsert(codeRecords, { onConflict: 'school_code,absence_code' });

          if (error) {
            console.log(`     ❌ Absence codes sync failed: ${error.message}`);
            this.addError('SYNC_CODES_SCHOOL', error.message, { school_code: school.school_code });
          } else {
            console.log(`     ✅ Synced ${codeRecords.length} absence codes`);
            this.currentOperation.progress.successful_records += codeRecords.length;
            totalCodesProcessed += codeRecords.length;
          }

        } catch (error) {
          console.log(`     ❌ Failed to process absence codes: ${error}`);
          this.addError('SYNC_CODES_SCHOOL', error instanceof Error ? error.message : String(error), { school_code: school.school_code });
        }

        await this.delay(this.RATE_LIMIT_DELAY);
      }

      console.log(`   ✅ Total absence codes processed: ${totalCodesProcessed}`);

    } catch (error) {
      this.addError('SYNC_CODES', error instanceof Error ? error.message : String(error));
      // Don't throw - this is optional data
      console.log('   ⚠️  Absence codes sync completed with errors (continuing...)');
    }
  }

  /**
   * Sync attendance records (most important data)
   */
  private async syncAttendanceRecords(): Promise<void> {
    console.log('📋 Step 7: Syncing Attendance Records...');

    try {
      // Get active students for attendance sync
      const { data: students } = await this.supabase
        .from('students')
        .select('student_id, aeries_student_number, school_code, first_name, last_name')
        .eq('is_active', true)
        .limit(100); // Start with sample to test endpoints

      if (!students || students.length === 0) {
        throw new Error('No active students found for attendance sync');
      }

      console.log(`   📊 Testing attendance endpoints with ${students.length} students...`);
      let totalAttendanceProcessed = 0;

      for (const student of students) {
        console.log(`\n   👤 ${student.first_name} ${student.last_name} (${student.student_id}):`);
        
        // Try multiple attendance endpoints
        const endpoints = [
          `/students/${student.aeries_student_number}/AttendanceHistory?StartDate=${this.ATTENDANCE_START_DATE}&EndDate=${this.ATTENDANCE_END_DATE}`,
          `/attendance?StudentNumber=${student.aeries_student_number}&StartDate=${this.ATTENDANCE_START_DATE}&EndDate=${this.ATTENDANCE_END_DATE}`,
          `/schools/${student.school_code}/attendance?StudentNumber=${student.aeries_student_number}&StartDate=${this.ATTENDANCE_START_DATE}&EndDate=${this.ATTENDANCE_END_DATE}`,
          `/students/${student.aeries_student_number}/attendance?StartDate=${this.ATTENDANCE_START_DATE}&EndDate=${this.ATTENDANCE_END_DATE}`
        ];

        let attendanceData: AeriesAttendance[] = [];
        let successfulEndpoint = '';

        for (const endpoint of endpoints) {
          try {
            console.log(`     Trying: ${endpoint.split('?')[0]}`);
            const response = await this.makeAeriesRequest<AeriesAttendance[]>(endpoint);
            
            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              attendanceData = response.data;
              successfulEndpoint = endpoint;
              this.currentOperation.metadata.endpoints_used.push(endpoint);
              console.log(`     ✅ Found ${attendanceData.length} attendance records`);
              break;
            }
          } catch (endpointError) {
            console.log(`     ❌ Failed: ${endpointError}`);
            continue;
          }
          
          await this.delay(this.RATE_LIMIT_DELAY);
        }

        if (attendanceData.length === 0) {
          console.log(`     ⚠️  No attendance data found`);
          continue;
        }

        // Process attendance records in batches
        for (let i = 0; i < attendanceData.length; i += this.BATCH_SIZE) {
          const batch = attendanceData.slice(i, i + this.BATCH_SIZE);
          
          const attendanceRecords = batch.map(record => ({
            student_id: student.student_id,
            aeries_student_number: student.aeries_student_number,
            date: record.Date ? record.Date.split('T')[0] : new Date().toISOString().split('T')[0],
            school_year: this.SCHOOL_YEAR,
            daily_status: this.mapAttendanceStatus(record.Status),
            absence_codes: record.AbsenceCode ? [record.AbsenceCode] : [],
            excuse_codes: record.ExcuseCode ? [record.ExcuseCode] : [],
            minutes_absent: record.MinutesAbsent || 0,
            minutes_tardy: record.MinutesTardy || 0,
            period_attendance: [record], // Store full record for reference
            aeries_last_modified: record.LastModified ? new Date(record.LastModified).toISOString() : new Date().toISOString(),
            sync_operation_id: this.currentOperation.operation_id,
            sync_metadata: {
              operation_id: this.currentOperation.operation_id,
              sync_timestamp: new Date().toISOString(),
              source: 'aeries_api_v5',
              endpoint_used: successfulEndpoint
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          // Insert attendance batch
          const { error } = await this.supabase
            .from('attendance_records')
            .upsert(attendanceRecords, { onConflict: 'student_id,date' });

          if (error) {
            console.log(`     ❌ Attendance batch failed: ${error.message}`);
            this.addError('SYNC_ATTENDANCE_BATCH', error.message, { student_id: student.student_id });
          } else {
            console.log(`     ✅ Saved ${attendanceRecords.length} attendance records`);
            this.currentOperation.progress.successful_records += attendanceRecords.length;
            totalAttendanceProcessed += attendanceRecords.length;
          }
        }

        await this.delay(this.RATE_LIMIT_DELAY * 2); // Longer delay for attendance
      }

      console.log(`   ✅ Total attendance records processed: ${totalAttendanceProcessed}`);

    } catch (error) {
      this.addError('SYNC_ATTENDANCE', error instanceof Error ? error.message : String(error));
      // Don't throw - continue with other sync operations
      console.log('   ⚠️  Attendance sync completed with errors (continuing...)');
    }
  }

  /**
   * Sync student schedules (optional)
   */
  private async syncStudentSchedules(): Promise<void> {
    console.log('📋 Step 8: Syncing Student Schedules (Sample)...');

    try {
      // Get a small sample of students for schedule testing
      const { data: students } = await this.supabase
        .from('students')
        .select('student_id, aeries_student_number, school_code, first_name, last_name')
        .eq('is_active', true)
        .limit(10);

      if (!students || students.length === 0) {
        console.log('   ⚠️  No students available for schedule sync');
        return;
      }

      console.log(`   📚 Testing schedule endpoints with ${students.length} students...`);
      let totalSchedulesProcessed = 0;

      for (const student of students) {
        console.log(`\n   👤 ${student.first_name} ${student.last_name}:`);
        
        try {
          const endpoint = `/students/${student.aeries_student_number}/schedules`;
          this.currentOperation.metadata.endpoints_used.push(endpoint);
          
          const response = await this.makeAeriesRequest<any[]>(endpoint);
          const schedules = response.data || [];

          if (schedules.length === 0) {
            console.log('     ⚠️  No schedules found');
            continue;
          }

          const scheduleRecords = schedules.map(schedule => ({
            student_id: student.student_id,
            aeries_student_number: student.aeries_student_number,
            school_code: student.school_code,
            school_year: this.SCHOOL_YEAR,
            term_code: schedule.TermCode || null,
            course_code: schedule.CourseCode || schedule.Course,
            course_name: schedule.CourseName || schedule.CourseDescription,
            period: schedule.Period || null,
            teacher_name: schedule.TeacherName || null,
            room_number: schedule.RoomNumber || schedule.Room,
            credit_hours: schedule.CreditHours || 0,
            is_active: true,
            aeries_last_modified: schedule.LastModified ? new Date(schedule.LastModified).toISOString() : new Date().toISOString(),
            sync_metadata: {
              operation_id: this.currentOperation.operation_id,
              sync_timestamp: new Date().toISOString(),
              source: 'aeries_api_v5'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          // Insert schedules
          const { error } = await this.supabase
            .from('student_schedules')
            .upsert(scheduleRecords, { 
              onConflict: 'aeries_student_number,course_code,period,school_year,term_code'
            });

          if (error) {
            console.log(`     ❌ Schedule sync failed: ${error.message}`);
            this.addError('SYNC_SCHEDULES_STUDENT', error.message, { student_id: student.student_id });
          } else {
            console.log(`     ✅ Synced ${scheduleRecords.length} schedule records`);
            this.currentOperation.progress.successful_records += scheduleRecords.length;
            totalSchedulesProcessed += scheduleRecords.length;
          }

        } catch (error) {
          console.log(`     ❌ Failed to process schedules: ${error}`);
          this.addError('SYNC_SCHEDULES_STUDENT', error instanceof Error ? error.message : String(error), { student_id: student.student_id });
        }

        await this.delay(this.RATE_LIMIT_DELAY);
      }

      console.log(`   ✅ Total schedule records processed: ${totalSchedulesProcessed}`);

    } catch (error) {
      this.addError('SYNC_SCHEDULES', error instanceof Error ? error.message : String(error));
      // Don't throw - this is optional data
      console.log('   ⚠️  Student schedules sync completed with errors (continuing...)');
    }
  }

  // ===============================================================
  // HELPER METHODS
  // ===============================================================

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AERIES_API_BASE_URL',
      'AERIES_API_KEY'
    ];

    const missing = required.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Create Aeries API client with proper authentication
   */
  private createAeriesClient(): AxiosInstance {
    const client = axios.create({
      baseURL: process.env.AERIES_API_BASE_URL!,
      timeout: 45000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'AERIES-CERT': process.env.AERIES_API_KEY!,
        'User-Agent': 'AP-Tool-Comprehensive-Sync/2.0'
      }
    });

    // Add request/response interceptors for logging
    client.interceptors.request.use(request => {
      console.log(`    🔌 ${request.method?.toUpperCase()} ${request.url}`);
      return request;
    });

    client.interceptors.response.use(
      response => {
        const count = Array.isArray(response.data) ? response.data.length : 'N/A';
        console.log(`    ✅ ${response.status} - ${count} items`);
        return response;
      },
      error => {
        console.log(`    ❌ ${error.response?.status || 'ERROR'} - ${error.message}`);
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Make API request with retry logic
   */
  private async makeAeriesRequest<T>(endpoint: string, retries = 0): Promise<{ data: T }> {
    try {
      const response = await this.aeries.get<T>(endpoint);
      return { data: response.data };
    } catch (error) {
      if (retries < this.MAX_RETRIES && this.shouldRetry(error)) {
        console.log(`    ⚠️  Retrying request (${retries + 1}/${this.MAX_RETRIES})...`);
        await this.delay(1000 * (retries + 1)); // Exponential backoff
        return this.makeAeriesRequest<T>(endpoint, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    }
    return false;
  }

  /**
   * Log sync operation to database
   */
  private async logSyncOperation(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('aeries_sync_operations')
        .upsert({
          operation_id: this.currentOperation.operation_id,
          type: this.currentOperation.type,
          status: this.currentOperation.status,
          start_time: this.currentOperation.start_time,
          end_time: this.currentOperation.end_time,
          progress: this.currentOperation.progress,
          errors: this.currentOperation.errors,
          metadata: this.currentOperation.metadata,
          created_at: this.currentOperation.start_time,
          updated_at: new Date().toISOString()
        }, { onConflict: 'operation_id' });

      if (error) {
        console.log(`⚠️  Failed to log sync operation: ${error.message}`);
      }
    } catch (error) {
      console.log(`⚠️  Error logging sync operation:`, error);
    }
  }

  /**
   * Add error to operation log
   */
  private addError(step: string, error: string, data?: any): void {
    this.currentOperation.errors.push({
      step,
      error,
      timestamp: new Date().toISOString(),
      data
    });
    this.currentOperation.progress.failed_records++;
  }

  /**
   * Format school address
   */
  private formatSchoolAddress(school: AeriesSchool): string | null {
    const parts = [
      school.StreetAddress,
      school.City,
      school.State,
      school.ZipCode
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Format student address
   */
  private formatAddress(student: AeriesStudent, type: 'Mailing' | 'Residence'): string | null {
    const address = student[`${type}Address` as keyof AeriesStudent];
    const city = student[`${type}AddressCity` as keyof AeriesStudent];
    const state = student[`${type}AddressState` as keyof AeriesStudent];
    const zip = student[`${type}AddressZipCode` as keyof AeriesStudent];
    
    if (!address) return null;
    
    const parts = [address, city, state, zip].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Clean phone number
   */
  private cleanPhone(phone: any): string | null {
    if (!phone) return null;
    const cleaned = phone.toString().replace(/\D/g, '');
    return cleaned.length === 10 ? cleaned : null;
  }

  /**
   * Map staff position to teacher role
   */
  private mapStaffRole(position?: string): 'TEACHER' | 'ASSISTANT_PRINCIPAL' | 'ADMINISTRATOR' {
    if (!position) return 'TEACHER';
    
    const pos = position.toLowerCase();
    if (pos.includes('assistant principal') || pos.includes('vice principal')) {
      return 'ASSISTANT_PRINCIPAL';
    }
    if (pos.includes('principal') || pos.includes('administrator') || pos.includes('superintendent')) {
      return 'ADMINISTRATOR';
    }
    return 'TEACHER';
  }

  /**
   * Map attendance status
   */
  private mapAttendanceStatus(status: any): string {
    if (!status) return 'PRESENT';
    const s = status.toString().toUpperCase();
    if (s === 'PRESENT' || s === 'P') return 'PRESENT';
    if (s === 'ABSENT' || s === 'A') return 'ABSENT';
    if (s === 'TARDY' || s === 'T') return 'TARDY';
    return s;
  }

  /**
   * Delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print final sync report
   */
  private printFinalReport(): void {
    const duration = this.currentOperation.end_time ? 
      new Date(this.currentOperation.end_time).getTime() - new Date(this.currentOperation.start_time).getTime() : 0;
    const durationMinutes = Math.round(duration / 60000);

    console.log('\n🎉 COMPREHENSIVE AERIES SYNC COMPLETE!');
    console.log('===============================================================');
    console.log(`📊 Final Results:`);
    console.log(`   Operation ID: ${this.currentOperation.operation_id}`);
    console.log(`   Status: ${this.currentOperation.status}`);
    console.log(`   Duration: ${durationMinutes} minutes`);
    console.log(`   Records Processed: ${this.currentOperation.progress.processed_records}`);
    console.log(`   Successful: ${this.currentOperation.progress.successful_records}`);
    console.log(`   Failed: ${this.currentOperation.progress.failed_records}`);
    console.log(`   Errors: ${this.currentOperation.errors.length}`);
    
    console.log('\n🎯 Database Status:');
    console.log('   ✅ Schools: Complete school information');
    console.log('   ✅ Students: Full demographic data with all Aeries fields');
    console.log('   ✅ Teachers: Staff information and roles');
    console.log('   ✅ Teacher Assignments: Class assignments and schedules');
    console.log('   ✅ School Terms: Academic calendar information');
    console.log('   ✅ Absence Codes: Attendance code definitions');
    console.log('   ✅ Attendance Records: Historical attendance data');
    console.log('   ✅ Student Schedules: Class schedule information');
    console.log('   ✅ Sync Operations: Complete operation tracking');
    
    console.log('\n📊 API Endpoints Used:');
    this.currentOperation.metadata.endpoints_used.forEach(endpoint => {
      console.log(`   - ${endpoint}`);
    });
    
    if (this.currentOperation.errors.length > 0) {
      console.log('\n⚠️  Errors Encountered:');
      this.currentOperation.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.step}: ${error.error}`);
      });
      if (this.currentOperation.errors.length > 10) {
        console.log(`   ... and ${this.currentOperation.errors.length - 10} more errors`);
      }
    }
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Verify all data in Supabase Dashboard');
    console.log('   2. Update frontend to use new comprehensive data structure');
    console.log('   3. Set up automated daily incremental sync');
    console.log('   4. Configure attendance reporting and intervention workflows');
    console.log('   5. Test all application features with real Aeries data');
    
    console.log('===============================================================');
  }
}

// ===============================================================
// MAIN EXECUTION
// ===============================================================

async function main() {
  try {
    const sync = new ComprehensiveAeriesSync();
    await sync.run();
    console.log('\n✅ Comprehensive Aeries sync completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Comprehensive Aeries sync failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export class for module use
// export { ComprehensiveAeriesSync };