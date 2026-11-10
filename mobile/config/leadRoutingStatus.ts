import { LeadRoutingStatus } from '../types';

/**
 * Display labels for lead_routings.status (migration 037) — shared by
 * lead-inbox.tsx, lead-detail.tsx, and dashboard.tsx's Recent Leads preview
 * so the three screens never drift on how a status reads.
 */
export const LEAD_ROUTING_STATUS_LABELS: Record<LeadRoutingStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  in_talks: 'In Talks',
  converted: 'Converted',
  lost: 'Lost',
  revoked: 'Revoked',
};
