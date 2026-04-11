import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

/** Eyni env yoxlaması `supabaseUserProgress` ilə uyğun: URL/key yoxdursa `null`. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key || url.includes('YOUR_PROJECT') || url.includes('placeholder')) {
      cached = null;
      return null;
    }
    cached = createClient(url.replace(/\/$/, ''), key);
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
