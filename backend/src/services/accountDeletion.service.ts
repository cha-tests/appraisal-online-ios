import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Real account deletion, for both consumers and brokers. Three steps, in
 * this order:
 *
 *   1. delete_my_account() (migration 041) — every database row. Called
 *      with the user's OWN access token, not the service-role key, so the
 *      function's auth.uid() is the caller and the database itself
 *      guarantees nobody can delete anyone but themselves. See the
 *      migration's header comment for exactly what is hard-deleted vs.
 *      anonymized in place (and why public.users stays as a scrubbed
 *      tombstone rather than being deleted).
 *   2. Storage objects under `<user_id>/` in every per-user bucket (KYC ID
 *      + selfie, broker profile photo, land-title uploads). Needs the
 *      service-role key — an in-database function can't remove objects
 *      through Supabase's storage API.
 *   3. The auth.users login, via the Admin API — also service-role only.
 *      After this the user's email is free to sign up fresh.
 *
 * Why this order: step 1 is the one that matters most and is idempotent,
 * so if step 2 or 3 fails the whole call can simply be retried — the
 * user's token still works (auth isn't deleted until the very end) and
 * re-running delete_my_account() on an already-scrubbed account is a
 * no-op. Deleting auth first would strand the database rows with no way
 * for the user to retry.
 */

/** Every bucket whose paths are keyed `<user_id>/...` (migrations 014, 017, 025). */
const USER_STORAGE_BUCKETS = ['kyc-documents', 'broker-photos', 'property-documents'] as const;

const LIST_PAGE_SIZE = 100;

export interface DeleteMyAccountDbResult {
  success: boolean;
  user_id: string;
  properties_deleted: number;
  leads_anonymized: number;
  lead_routings_deleted: number;
  lead_routings_anonymized: number;
  broker_profile_deleted: boolean;
  subscriptions_cancelled: number;
}

export interface AccountDeletionResult {
  database: DeleteMyAccountDbResult;
  storageObjectsDeleted: number;
}

/**
 * A Supabase client that acts AS the user (their JWT in Authorization), so
 * PostgREST runs the RPC with role `authenticated` and auth.uid() = them.
 * The apikey is only the project-routing key; the user JWT decides who
 * the request is.
 */
function clientAsUser(userAccessToken: string) {
  const url = process.env.SUPABASE_URL || '';
  const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  return createClient(url, apiKey, {
    global: { headers: { Authorization: `Bearer ${userAccessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Step 1 — scrub/delete every database row for the token's owner. */
export async function deleteAccountData(userAccessToken: string): Promise<DeleteMyAccountDbResult> {
  const { data, error } = await clientAsUser(userAccessToken).rpc('delete_my_account');
  if (error) throw error;
  return data as DeleteMyAccountDbResult;
}

/**
 * Recursively lists every object path under `prefix` in `bucket`.
 * Supabase's list() is one folder level at a time; sub-folders come back
 * as entries with a null id (e.g. property-documents' <user_id>/<report_id>/).
 */
async function listObjectPaths(bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const fullPath = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        paths.push(...(await listObjectPaths(bucket, fullPath)));
      } else {
        paths.push(fullPath);
      }
    }

    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  return paths;
}

/** Step 2 — remove every stored file under `<userId>/` in each per-user bucket. */
export async function deleteUserStorage(userId: string): Promise<number> {
  let deleted = 0;

  for (const bucket of USER_STORAGE_BUCKETS) {
    const paths = await listObjectPaths(bucket, userId);
    if (paths.length === 0) continue;

    const { data, error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
    deleted += data?.length ?? 0;
  }

  return deleted;
}

/** Step 3 — delete the auth.users login. Not-found counts as success (retry-safe). */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw error;
}

/**
 * Runs all three steps for the user who owns `userAccessToken`. `userId`
 * must be the id the auth middleware already verified from that same
 * token — never anything taken from the request body.
 */
export async function deleteAccount(userId: string, userAccessToken: string): Promise<AccountDeletionResult> {
  const database = await deleteAccountData(userAccessToken);

  if (database.user_id !== userId) {
    // Should be impossible (both come from the same token) — refuse to
    // touch storage/auth for a different id if it ever happens.
    throw new Error('delete_my_account() acted on a different user than the verified token');
  }

  const storageObjectsDeleted = await deleteUserStorage(userId);
  await deleteAuthUser(userId);

  logger.info(
    `Account deleted: ${userId} (properties deleted: ${database.properties_deleted}, ` +
      `leads anonymized: ${database.leads_anonymized}, routings deleted: ${database.lead_routings_deleted}, ` +
      `routings anonymized: ${database.lead_routings_anonymized}, storage objects: ${storageObjectsDeleted})`
  );

  return { database, storageObjectsDeleted };
}
