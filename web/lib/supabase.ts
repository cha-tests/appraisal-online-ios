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
  metadata?: { first_name?: string; last_name?: string; suffix?: string; user_type?: string }
) {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: metadata?.first_name || '',
          last_name: metadata?.last_name || '',
          suffix: metadata?.suffix || '',
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
        first_name: metadata?.first_name || '',
        last_name: metadata?.last_name || '',
        suffix: metadata?.suffix || null,
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

/** Whether the signed-in user is flagged is_admin — gates web/app/admin. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return !!data?.is_admin;
  } catch {
    return false;
  }
}

export interface PendingKycRow {
  user_id: string;
  company_name: string;
  role: string;
  license_number: string | null;
  kyc_id_url: string | null;
  kyc_selfie_url: string | null;
  kyc_submitted_at: string;
  users: { email: string; first_name: string; last_name: string; suffix: string | null } | null;
}

/**
 * Brokers/salespersons awaiting a KYC decision, same query
 * scripts/review-kyc.ts uses — now reachable from the admin RLS policies
 * (migration 024) instead of only via the service-role key.
 */
export async function getPendingKyc(): Promise<{ success: boolean; rows?: PendingKycRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('broker_profiles')
      .select(
        'user_id, company_name, role, license_number, kyc_id_url, kyc_selfie_url, kyc_submitted_at, users(email, first_name, last_name, suffix)'
      )
      .eq('kyc_status', 'pending')
      .order('kyc_submitted_at', { ascending: true });

    if (error) throw error;
    return { success: true, rows: (data || []) as unknown as PendingKycRow[] };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to load pending KYC submissions' };
  }
}

const KYC_SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — just long enough to review

/** Signed URL for a private kyc-documents object (ID photo or selfie). */
export async function getKycSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .createSignedUrl(path, KYC_SIGNED_URL_TTL_SECONDS);

  if (error) return null;
  return data?.signedUrl || null;
}

/** Approve or reject a broker's KYC submission (admin only — RLS-enforced). */
export async function decideKyc(
  userId: string,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('broker_profiles')
      .update({
        kyc_status: decision,
        kyc_reviewed_at: new Date().toISOString(),
        kyc_rejection_reason: decision === 'rejected' ? reason || null : null,
      })
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || `Failed to mark as ${decision}` };
  }
}
