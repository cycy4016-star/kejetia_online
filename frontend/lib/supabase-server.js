// Server-side data client for Route Handlers / Server Components.
// (The old Supabase SSR client is gone; data access is centralized in
//  lib/supabase.js — the browser and server both speak to the same API.)
export { getSupabase } from '@/lib/supabase'
export { inMockMode } from '@/lib/supabase'