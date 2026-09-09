import { supabase } from './supabase';

export const disclaimerService = {
  /**
   * Logs that a user has read and accepted a disclaimer. RLS only allows a
   * user to insert their own row (see migration 014), so this is safe to
   * call directly from the client without a backend round-trip.
   */
  async acceptDisclaimer(
    userId: string,
    disclaimerType: 'client' | 'broker',
    version: string,
    context?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('disclaimer_acceptances').insert({
        user_id: userId,
        disclaimer_type: disclaimerType,
        version,
        context: context ?? null,
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error logging disclaimer acceptance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log disclaimer acceptance',
      };
    }
  },
};
