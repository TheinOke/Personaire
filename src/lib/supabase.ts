import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when .env.local has the Supabase URL and anon key. */
export const isSupabaseConfigured = Boolean(url && anonKey)

// The anon key is safe in the browser: Row Level Security protects the data.
// Never put the service_role key in this app.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
