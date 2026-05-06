
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aeotpgcvonuoosztjlfa.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlb3RwZ2N2b251b29zenRqbGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTQxNzYsImV4cCI6MjA4ODU5MDE3Nn0.AvFOtybDTVDgdGRMxUirgH9yU2ZA6fPc6s-12KI-mWQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)