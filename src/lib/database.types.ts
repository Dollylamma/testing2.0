export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string
          name: string
          date: string
          time: string
          location: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          date: string
          time: string
          location: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          date?: string
          time?: string
          location?: string
          user_id?: string
          created_at?: string
        }
      }
      volunteer_positions: {
        Row: {
          id: string
          event_id: string
          name: string
          needed: number
          filled: number
          description: string | null
          skill_level: string | null
          latitude: number
          longitude: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          needed: number
          filled?: number
          description?: string | null
          skill_level?: string | null
          latitude: number
          longitude: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          needed?: number
          filled?: number
          description?: string | null
          skill_level?: string | null
          latitude?: number
          longitude?: number
          user_id?: string
          created_at?: string
        }
      }
      volunteer_signups: {
        Row: {
          id: string
          position_id: string
          volunteer_name: string
          phone_number: string
          start_time: string
          end_time: string
          arrived: boolean
          created_at: string
        }
        Insert: {
          id?: string
          position_id: string
          volunteer_name: string
          phone_number: string
          start_time: string
          end_time: string
          arrived?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          position_id?: string
          volunteer_name?: string
          phone_number?: string
          start_time?: string
          end_time?: string
          arrived?: boolean
          created_at?: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}