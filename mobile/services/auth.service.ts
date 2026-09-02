import { supabase, parseSupabaseError } from './supabase';
import { User, AuthSession, AuthCredentials, BrokerProfile } from '../types';

export const authService = {
  // Sign up with email
  async signup(
    email: string,
    password: string,
    metadata?: { full_name?: string; user_type?: string; phone?: string }
  ) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: metadata?.full_name || '',
            user_type: metadata?.user_type || 'consumer',
            // Captured once here so a consumer never has to re-enter it when
            // opting in for professional contact later — see the phone
            // comment on the User type for the actual sharing rule.
            phone: metadata?.phone || null,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user?.id) throw new Error('User creation failed');

      // The public.users row is created automatically by the
      // on_auth_user_created DB trigger (see 005_auto_create_user_on_signup.sql
      // and 013_add_user_phone.sql, which extended it to also capture phone).
      // Inserting it here too would race the trigger and fail (RLS rejects the
      // insert before email confirmation grants a session; duplicate-key error after).
      return {
        success: true,
        user: {
          id: authData.user.id,
          email,
          user_type: metadata?.user_type || 'consumer',
          phone: metadata?.phone || undefined,
          created_at: authData.user.created_at,
          updated_at: authData.user.updated_at || authData.user.created_at,
        } as User,
        needsEmailConfirmation: !authData.session,
        message: authData.session
          ? 'Signup successful.'
          : 'Signup successful. Check your email to verify your account.',
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Sign in with email and password
  async signin(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.session) throw new Error('No session created');

      // Fetch user record and broker profile if applicable
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError) throw userError;

      let brokerProfile: BrokerProfile | undefined;
      if (userData.user_type === 'broker') {
        const { data: brokerData } = await supabase
          .from('broker_profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        brokerProfile = brokerData || undefined;
      }

      return {
        success: true,
        user: userData,
        session: {
          user: userData,
          session_token: data.session.access_token,
          expires_at: data.session.expires_at,
          broker_profile: brokerProfile,
        } as AuthSession,
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Sign in with OAuth (Google)
  async signinWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'appraisalonline://auth/callback',
        },
      });

      if (error) throw error;

      return {
        success: true,
        url: data?.url,
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Handle OAuth callback
  async handleOAuthCallback(url: string) {
    try {
      const { data, error } = await supabase.auth.getSessionFromUrl(url);

      if (error) throw error;
      if (!data.session) throw new Error('No session from OAuth');

      return {
        success: true,
        session: data.session,
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Resend the signup confirmation email
  async resendConfirmationEmail(email: string) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Confirmation email resent',
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Request password reset
  async requestPasswordReset(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'appraisalonline://auth/reset-password',
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset email sent',
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Update password
  async updatePassword(newPassword: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Verify email with OTP
  async verifyOTP(email: string, token: string) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      if (error) throw error;

      return {
        success: true,
        session: data.session,
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get current session
  async getSession() {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch (error) {
      return null;
    }
  },

  // Refresh session
  async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      return null;
    }
  },

  // Sign out
  async signout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<User>) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        user: data,
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },
};
