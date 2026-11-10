/**
 * Canned reasons a homeowner picks from when revoking a specific broker
 * (consumer/settings.tsx) — mirrors the broker's own canned lost-reasons
 * (config/lostReasons.ts) for the same kind of analytics value: a
 * revoke-rate-by-reason view on the founder dashboard, same spirit as the
 * existing refund-rate tracking. Values match
 * broker_contact_revocations.reason's CHECK constraint (migration 037)
 * exactly — don't add a value here without a matching migration.
 */
export interface RevokeReasonOption {
  value: string;
  label: string;
}

export const REVOKE_REASON_OPTIONS: RevokeReasonOption[] = [
  { value: 'decided_not_to_sell', label: "I've decided not to sell/proceed" },
  { value: 'changed_mind', label: 'I changed my mind about connecting' },
  { value: 'not_satisfied_with_appraisal', label: 'Not satisfied with the appraisal' },
  { value: 'found_own_professional', label: 'I already found my own professional' },
  { value: 'other', label: 'Other' },
];
