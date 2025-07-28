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
      students: {
        Row: {
          id: string
          student_id: string
          first_name: string
          last_name: string
          grade_level: number
          email: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          first_name: string
          last_name: string
          grade_level: number
          email: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          first_name?: string
          last_name?: string
          grade_level?: number
          email?: string
          is_active?: boolean
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
          date: string
          school_year: string
          period_1_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_2_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_3_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_4_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_5_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_6_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_7_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          daily_attendance_percentage: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          date: string
          school_year: string
          period_1_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_2_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_3_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_4_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_5_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_6_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_7_status: 'PRESENT' | 'ABSENT' | 'TARDY'
          daily_attendance_percentage?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          school_year?: string
          period_1_status?: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_2_status?: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_3_status?: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_4_status?: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_5_status?: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_6_status?: 'PRESENT' | 'ABSENT' | 'TARDY'
          period_7_status?: 'PRESENT' | 'ABSENT' | 'TARDY'
          daily_attendance_percentage?: number
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