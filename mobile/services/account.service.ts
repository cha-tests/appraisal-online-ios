import axios from 'axios';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

/** Generous: the backend runs a DB function, storage cleanup and an Admin API call in sequence. */
const DELETE_TIMEOUT_MS = 30000;

export interface DeleteMyAccountResult {
  success: boolean;
  error?: string;
}

/**
 * Account deletion, for consumers and brokers alike. The only function the
 * settings screens need to call.
 *
 * Where each part runs:
 *   - This app: sends the signed-in user's own access token to
 *     DELETE /api/account, then clears the local session once the account
 *     is gone. No user id is ever sent — the backend derives it from the
 *     token.
 *   - Backend (backend/src/services/accountDeletion.service.ts), in order:
 *       1. delete_my_account() RPC (migration 041), run AS this user —
 *          deletes/anonymizes every database row (see that migration's
 *          header for exactly what is kept for the other party and why);
 *       2. removes this user's files from the kyc-documents, broker-photos
 *          and property-documents storage buckets (service-role key);
 *       3. deletes the auth login via the Admin API (service-role key).
 *     Retry-safe: if it fails partway, calling this again finishes it.
 *
 * Callers (UI): call beginSignOut() from utils/signOutGuard.ts BEFORE
 * this, same as the normal sign-out flow, and navigate to Welcome on
 * success. On failure nothing on-device is cleared and the user is still
 * signed in, so they can simply try again.
 */
export async function deleteMyAccount(): Promise<DeleteMyAccountResult> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      return { success: false, error: 'You need to be signed in to delete your account.' };
    }

    const response = await axios.delete(`${API_URL}/api/account`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      timeout: DELETE_TIMEOUT_MS,
    });

    if (!response.data?.success) {
      return {
        success: false,
        error: response.data?.error?.message || 'Could not delete your account. Please try again.',
      };
    }

    // The login no longer exists server-side, so only clear the local
    // session — a global sign-out would just fail against a deleted user.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

    return { success: true };
  } catch (err: any) {
    const serverMessage = err?.response?.data?.error?.message;
    return {
      success: false,
      error: serverMessage || 'Could not reach the server. Please check your connection and try again.',
    };
  }
}

export const accountService = { deleteMyAccount };
