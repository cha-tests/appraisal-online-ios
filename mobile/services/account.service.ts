import { supabase, parseSupabaseError } from './supabase';
import { withTimeout } from './withTimeout';
import { ConnectedBrokerRouting, LeadRoutingPreview } from '../types';

type Row = Record<string, unknown>;

/**
 * Shape of export_my_data() (migration 042). Every user gets the same
 * top-level shape; `broker` is null for an account with no broker profile,
 * and the `consumer` arrays are simply empty for a broker who never
 * created a report.
 *
 * Cross-user data comes only through the existing masking RPCs:
 * `broker.lead_routings` is get_my_lead_routings() verbatim (homeowner PII
 * only on claimed rows), `consumer.connected_brokers` is
 * get_my_connected_brokers() verbatim. Everything else is the caller's own
 * rows.
 */
export interface MyDataExport {
  export_version: number;
  generated_at: string;
  account_type: 'consumer' | 'broker' | string;
  user: Row;
  disclaimer_acceptances: Row[];
  consumer: {
    properties: Row[];
    reports: Row[];
    leads: Row[];
    connected_brokers: ConnectedBrokerRouting[];
    broker_contact_revocations: Row[];
    report_allowance: Row[];
  };
  broker: {
    profile: Row;
    selected_cities: { id: string; name: string; state: string | null; country: string }[];
    subscriptions: Row[];
    refunds: Row[];
    lead_routings: LeadRoutingPreview[];
  } | null;
}

// Longer than withTimeout's 12s screen-load default: this bundles every
// table the user owns in one call, which can legitimately take a while for
// a long-lived account. Still bounded so a hung request can't leave the
// UI waiting forever.
const EXPORT_TIMEOUT_MS = 30000;

/**
 * Fetches the calling user's personal-data bundle. Returns clean
 * structured data only — turning it into a downloadable file is the UI's
 * job.
 */
export async function exportMyData(): Promise<{ success: boolean; data?: MyDataExport; error?: string }> {
  try {
    const { data, error } = await withTimeout(supabase.rpc('export_my_data'), EXPORT_TIMEOUT_MS);
    if (error) throw error;
    if (!data) throw new Error('Export returned no data');
    return { success: true, data: data as MyDataExport };
  } catch (error) {
    return { success: false, error: parseSupabaseError(error).message };
  }
}

export const accountService = {
  exportMyData,
};
