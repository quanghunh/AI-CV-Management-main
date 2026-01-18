// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://supabase.softworld.dev'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1NDUwMDAwLCJleHAiOjE5MTMyMTY0MDB9.Mpdx1os5ZzrDzI_Yq3GzVE33Hw-iALkowFrm902qlbw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)