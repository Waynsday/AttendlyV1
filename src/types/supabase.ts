/**
 * Supabase Database Types
 * 
 * This file contains TypeScript types generated from the Supabase database schema
 * for the AP Romoland attendance tracking system. These types ensure type safety
 * when interacting with the database and help catch errors at compile time.
 * 
 * @note This file should be generated using the Supabase CLI:
 * `supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > src/types/supabase.ts`
 */

export interface Database {
  public: {
    Tables: {
      districts: {
        Row: {
          id: string
          district_code: string
          district_name: string
          state: string
          county: string | null
          superintendent_name: string | null
          phone: string | null
          aeries_api_base_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          district_code: string
          district_name: string
          state?: string
          county?: string | null
          superintendent_name?: string | null
          phone?: string | null
          aeries_api_base_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          district_code?: string
          district_name?: string
          state?: string
          county?: string | null
          superintendent_name?: string | null
          phone?: string | null
          aeries_api_base_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      schools: {
        Row: {
          id: string
          district_id: string
          school_code: string
          school_name: string
          school_type: string
          address: string | null
          phone: string | null
          principal_name: string | null
          grade_levels_served: number[]
          enrollment_capacity: number | null
          current_enrollment: number
          periods_per_day: number
          instructional_minutes_per_day: number
          aeries_school_code: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          district_id: string
          school_code: string
          school_name: string
          school_type: string
          address?: string | null
          phone?: string | null
          principal_name?: string | null
          grade_levels_served: number[]
          enrollment_capacity?: number | null
          current_enrollment?: number
          periods_per_day?: number
          instructional_minutes_per_day?: number
          aeries_school_code?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          district_id?: string
          school_code?: string
          school_name?: string
          school_type?: string
          address?: string | null
          phone?: string | null
          principal_name?: string | null
          grade_levels_served?: number[]
          enrollment_capacity?: number | null
          current_enrollment?: number
          periods_per_day?: number
          instructional_minutes_per_day?: number
          aeries_school_code?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      students: {
        Row: {
          id: string
          district_id: string
          school_id: string
          district_student_id: string
          aeries_student_id: string | null
          first_name: string
          last_name: string
          date_of_birth: string | null
          grade_level: number
          gender: string | null
          language_preference: string
          iep_status: boolean
          section_504_status: boolean
          elpac_level: string | null
          foster_status: boolean
          primary_phone: string | null
          email: string | null
          address_line1: string | null
          city: string | null
          state: string
          zip_code: string | null
          current_homeroom_teacher: string | null
          enrollment_date: string | null
          is_active: boolean
          aeries_last_sync: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          district_id: string
          school_id: string
          district_student_id: string
          aeries_student_id?: string | null
          first_name: string
          last_name: string
          date_of_birth?: string | null
          grade_level: number
          gender?: string | null
          language_preference?: string
          iep_status?: boolean
          section_504_status?: boolean
          elpac_level?: string | null
          foster_status?: boolean
          primary_phone?: string | null
          email?: string | null
          address_line1?: string | null
          city?: string | null
          state?: string
          zip_code?: string | null
          current_homeroom_teacher?: string | null
          enrollment_date?: string | null
          is_active?: boolean
          aeries_last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          district_id?: string
          school_id?: string
          district_student_id?: string
          aeries_student_id?: string | null
          first_name?: string
          last_name?: string
          date_of_birth?: string | null
          grade_level?: number
          gender?: string | null
          language_preference?: string
          iep_status?: boolean
          section_504_status?: boolean
          elpac_level?: string | null
          foster_status?: boolean
          primary_phone?: string | null
          email?: string | null
          address_line1?: string | null
          city?: string | null
          state?: string
          zip_code?: string | null
          current_homeroom_teacher?: string | null
          enrollment_date?: string | null
          is_active?: boolean
          aeries_last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teachers: {
        Row: {
          id: string
          employee_id: string
          first_name: string
          last_name: string
          email: string
          department: string
          role: 'TEACHER' | 'ASSISTANT_PRINCIPAL' | 'ADMINISTRATOR'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          first_name: string
          last_name: string
          email: string
          department: string
          role: 'TEACHER' | 'ASSISTANT_PRINCIPAL' | 'ADMINISTRATOR'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          first_name?: string
          last_name?: string
          email?: string
          department?: string
          role?: 'TEACHER' | 'ASSISTANT_PRINCIPAL' | 'ADMINISTRATOR'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      attendance_records: {
        Row: {
          id: string
          student_id: string
          school_id: string
          attendance_date: string
          is_present: boolean
          is_full_day_absent: boolean
          days_enrolled: number
          period_1_status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_2_status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_3_status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_4_status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_5_status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_6_status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_7_status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          tardy_count: number
          can_be_corrected: boolean
          correction_deadline: string | null
          corrected_by: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          school_id: string
          attendance_date: string
          is_present?: boolean
          is_full_day_absent?: boolean
          days_enrolled?: number
          period_1_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_2_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_3_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_4_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_5_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_6_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_7_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          tardy_count?: number
          can_be_corrected?: boolean
          correction_deadline?: string | null
          corrected_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          school_id?: string
          attendance_date?: string
          is_present?: boolean
          is_full_day_absent?: boolean
          days_enrolled?: number
          period_1_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_2_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_3_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_4_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_5_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_6_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          period_7_status?: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED_ABSENT' | 'UNEXCUSED_ABSENT' | 'PARTIAL_DAY' | 'SUSPENDED'
          tardy_count?: number
          can_be_corrected?: boolean
          correction_deadline?: string | null
          corrected_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      interventions: {
        Row: {
          id: string
          student_id: string
          type: 'PARENT_CONTACT' | 'COUNSELOR_REFERRAL' | 'ATTENDANCE_CONTRACT' | 'SART_REFERRAL' | 'SARB_REFERRAL' | 'OTHER'
          description: string
          created_by: string
          scheduled_date: string
          status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED'
          completed_date: string | null
          outcome: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          type: 'PARENT_CONTACT' | 'COUNSELOR_REFERRAL' | 'ATTENDANCE_CONTRACT' | 'SART_REFERRAL' | 'SARB_REFERRAL' | 'OTHER'
          description: string
          created_by: string
          scheduled_date: string
          status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELED'
          completed_date?: string | null
          outcome?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          type?: 'PARENT_CONTACT' | 'COUNSELOR_REFERRAL' | 'ATTENDANCE_CONTRACT' | 'SART_REFERRAL' | 'SARB_REFERRAL' | 'OTHER'
          description?: string
          created_by?: string
          scheduled_date?: string
          status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELED'
          completed_date?: string | null
          outcome?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attendance_status: 'PRESENT' | 'ABSENT' | 'TARDY'
      teacher_role: 'TEACHER' | 'ASSISTANT_PRINCIPAL' | 'ADMINISTRATOR'
      intervention_type: 'PARENT_CONTACT' | 'COUNSELOR_REFERRAL' | 'ATTENDANCE_CONTRACT' | 'SART_REFERRAL' | 'SARB_REFERRAL' | 'OTHER'
      intervention_status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for cleaner usage
export type Student = Database['public']['Tables']['students']['Row']
export type StudentInsert = Database['public']['Tables']['students']['Insert']
export type StudentUpdate = Database['public']['Tables']['students']['Update']

export type Teacher = Database['public']['Tables']['teachers']['Row']
export type TeacherInsert = Database['public']['Tables']['teachers']['Insert']
export type TeacherUpdate = Database['public']['Tables']['teachers']['Update']

export type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row']
export type AttendanceRecordInsert = Database['public']['Tables']['attendance_records']['Insert']
export type AttendanceRecordUpdate = Database['public']['Tables']['attendance_records']['Update']

export type Intervention = Database['public']['Tables']['interventions']['Row']
export type InterventionInsert = Database['public']['Tables']['interventions']['Insert']
export type InterventionUpdate = Database['public']['Tables']['interventions']['Update']

// Enum types
export type AttendanceStatus = Database['public']['Enums']['attendance_status']
export type TeacherRole = Database['public']['Enums']['teacher_role']
export type InterventionType = Database['public']['Enums']['intervention_type']
export type InterventionStatus = Database['public']['Enums']['intervention_status']