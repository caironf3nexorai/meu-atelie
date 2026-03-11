import { supabase } from '../supabase';

// Reexporta a factory function para retrocompatibilidade com hooks
export function createClient() {
    return supabase;
}
