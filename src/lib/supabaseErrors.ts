import { supabase } from './supabase';

export async function handleSupabaseAuthError(error: any) {
  if (error?.status === 401 || error?.statusCode === 401 || error?.code === 'PGRST301') {
    console.warn('[Auth] Token expired or invalid. Signing out...');
    await supabase.auth.signOut();
  }
}
