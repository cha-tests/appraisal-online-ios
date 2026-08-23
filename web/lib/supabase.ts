import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.session) throw new Error('No session created');

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError) throw userError;

    return {
      success: true,
      user: userData,
      message: 'Sign in successful',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Sign in failed',
    };
  }
}

export async function signUp(
  email: string,
  password: string,
  metadata?: { full_name?: string; user_type?: string }
) {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.full_name || '',
          user_type: metadata?.user_type || 'consumer',
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user?.id) throw new Error('User creation failed');

    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        user_type: metadata?.user_type || 'consumer',
        full_name: metadata?.full_name || '',
      })
      .select()
      .single();

    if (userError) throw userError;

    return {
      success: true,
      user: userData,
      message: 'Sign up successful. Check your email to verify.',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Sign up failed',
    };
  }
}

export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-confirm`,
    });

    if (error) throw error;

    return {
      success: true,
      message: 'Password reset email sent',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Password reset failed',
    };
  }
}

export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    return {
      success: true,
      message: 'Password updated successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Password update failed',
    };
  }
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    return null;
  }
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
