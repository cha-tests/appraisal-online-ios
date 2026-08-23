import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper to handle Supabase errors
export function parseSupabaseError(error: any): { message: string; code?: string } {
  if (error?.message) {
    return { message: error.message, code: error.code };
  }
  if (error?.error_description) {
    return { message: error.error_description };
  }
  return { message: 'An error occurred' };
}

// Helper to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

// Helper to get current user
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    return null;
  }
}

// Helper to sign out
export async function signOut() {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (error) {
    return { success: false, error: parseSupabaseError(error) };
  }
}

// Realtime subscription helper
export function subscribeToTable<T>(
  table: string,
  callback: (payload: any) => void,
  filter?: string
) {
  return supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      callback
    )
    .subscribe();
}

export function unsubscribeFromTable(subscription: any) {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
}
