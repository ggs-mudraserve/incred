import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database, Constants } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const globalForSupabase = globalThis as unknown as {
  supabase: SupabaseClient<Database> | undefined
}

export const supabase = globalForSupabase.supabase ?? createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Automatically refresh the session 30 seconds before expiry
    refreshTokenMarginSeconds: 30
  },
  global: {
    headers: {
      'X-Client-Info': 'incred-app'
    }
  },
  db: {
    schema: 'public'
  }
})

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase
}

// Export Constants
export { Constants }

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type Application = Database['public']['Tables']['applications']['Row']
export type LeadNote = Database['public']['Tables']['lead_notes']['Row']
export type StatusEnum = Database['public']['Enums']['status_enum']
export type ApplicationStage = Database['public']['Enums']['application_stage']
export type UserRole = Database['public']['Enums']['user_role']
export type FinalStatusEnum = Database['public']['Enums']['final_status_enum']

// Extended types with relations
export type LeadWithProfile = Lead & {
  profiles: Profile
}

export type LeadWithNotes = Lead & {
  lead_notes: LeadNote[]
}

export type ApplicationWithLead = Application & {
  leads: LeadWithProfile
}
