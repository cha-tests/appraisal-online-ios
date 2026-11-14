import { LeadRoutingClaimStatus, LeadRoutingStatus } from '../types';

/**
 * Display labels for lead_routings.status (migration 037) — shared by
 * lead-inbox.tsx, lead-detail.tsx, and dashboard.tsx's Recent Leads preview
 * so the three broker-side screens never drift on how a status reads.
 */
export const LEAD_ROUTING_STATUS_LABELS: Record<LeadRoutingStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  in_talks: 'In Talks',
  converted: 'Converted',
  lost: 'Lost',
  revoked: 'Revoked',
};

/**
 * Plain-language status for the homeowner side (consumer/settings.tsx) —
 * never the raw broker-pipeline terms above. claim_status takes priority:
 * an invited-but-unclaimed row has nothing more specific to say yet
 * regardless of its (always 'new') status.
 */
export function consumerLeadStatusLabel(
  claimStatus: LeadRoutingClaimStatus,
  status: LeadRoutingStatus
): string {
  if (claimStatus === 'invited') return 'Waiting to hear back';

  switch (status) {
    case 'new':
      return "Connected — they'll reach out soon";
    case 'contacted':
      return "They've reached out to you";
    case 'in_talks':
      return 'In active discussion';
    case 'converted':
      return 'Transaction underway';
    case 'lost':
      return 'No longer pursuing this';
    case 'revoked':
      return 'You stopped contact with this professional';
    default:
      return status;
  }
}
