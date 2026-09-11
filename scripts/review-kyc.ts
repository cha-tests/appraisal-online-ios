/**
 * Lists brokers/salespersons with pending KYC (selfie + valid ID submitted,
 * awaiting a human decision — see migration 014), and lets an admin
 * approve or reject one from the command line. There's no in-app admin
 * panel yet, so this is the review queue for now.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/review-kyc.ts                          # list pending
 *   npx tsx scripts/review-kyc.ts approve <user_id>
 *   npx tsx scripts/review-kyc.ts reject <user_id> "reason shown to no one yet, but kept on file"
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — just long enough to review

async function listPending() {
  const { data, error } = await supabase
    .from('broker_profiles')
    .select('user_id, company_name, role, license_number, kyc_id_url, kyc_selfie_url, kyc_submitted_at, users(email, first_name, last_name)')
    .eq('kyc_status', 'pending')
    .order('kyc_submitted_at', { ascending: true });

  if (error) throw error;

  if (!data || data.length === 0) {
    console.log('No pending KYC submissions.');
    return;
  }

  console.log(`${data.length} pending submission(s):\n`);

  for (const row of data as any[]) {
    console.log(`user_id:   ${row.user_id}`);
    const name = [row.users?.first_name, row.users?.last_name].filter(Boolean).join(' ');
    console.log(`name:      ${name || '(none)'} <${row.users?.email}>`);
    console.log(`role:      ${row.role}`);
    console.log(`company:   ${row.company_name}`);
    console.log(`license#:  ${row.license_number || '(none given)'}`);
    console.log(`submitted: ${row.kyc_submitted_at}`);

    if (row.kyc_id_url) {
      const { data: idUrl } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(row.kyc_id_url, SIGNED_URL_TTL_SECONDS);
      console.log(`ID photo:  ${idUrl?.signedUrl || '(failed to sign)'}`);
    }
    if (row.kyc_selfie_url) {
      const { data: selfieUrl } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(row.kyc_selfie_url, SIGNED_URL_TTL_SECONDS);
      console.log(`Selfie:    ${selfieUrl?.signedUrl || '(failed to sign)'}`);
    }
    console.log(`\nTo decide: npx tsx scripts/review-kyc.ts approve ${row.user_id}`);
    console.log(`       or: npx tsx scripts/review-kyc.ts reject ${row.user_id} "reason"\n`);
    console.log('-'.repeat(60));
  }
}

async function decide(decision: 'approved' | 'rejected', userId: string, reason?: string) {
  const { error } = await supabase
    .from('broker_profiles')
    .update({
      kyc_status: decision,
      kyc_reviewed_at: new Date().toISOString(),
      kyc_rejection_reason: decision === 'rejected' ? reason || null : null,
    })
    .eq('user_id', userId);

  if (error) throw error;
  console.log(`Marked ${userId} as ${decision}.`);
}

async function main() {
  const [action, userId, reason] = process.argv.slice(2);

  if (!action) {
    await listPending();
    return;
  }

  if (action === 'approve' && userId) {
    await decide('approved', userId);
    return;
  }

  if (action === 'reject' && userId) {
    await decide('rejected', userId, reason);
    return;
  }

  console.error('Usage: npx tsx scripts/review-kyc.ts [approve|reject] <user_id> ["reason"]');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
