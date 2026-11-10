/**
 * Canned reasons a broker picks from when marking a lead "Lost" (see
 * lead-detail.tsx) — mirrors the homeowner's own canned revoke reasons
 * (consumer/broker-optins.tsx, Phase 3) for the same kind of analytics
 * value: "lost rate by reason" on the founder dashboard, same spirit as
 * the existing refund-rate tracking.
 */
export interface LostReasonOption {
  value: string;
  label: string;
}

export const LOST_REASON_OPTIONS: LostReasonOption[] = [
  { value: 'no_response', label: 'Never heard back' },
  { value: 'chose_another_pro', label: 'They chose another professional' },
  { value: 'price_disagreement', label: 'Disagreement on price/value' },
  { value: 'not_qualified', label: "Not actually a qualified lead" },
  { value: 'other', label: 'Other' },
];
