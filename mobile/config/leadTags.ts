/**
 * Lightweight lead-tagging (synthetic user report item #9) — a visible
 * signal on a lead for a specialized broker niche (foreclosure, financing,
 * OFW/overseas owner), not a routing input. Captured as an optional
 * multi-select at broker opt-in (broker-optins.tsx) and shown as badges on
 * the broker side (lead-inbox.tsx, lead-detail.tsx). Single source of truth
 * for the tag values and their display labels so the two sides never drift.
 */
export interface LeadTagOption {
  value: string;
  label: string;
}

export const LEAD_TAG_OPTIONS: LeadTagOption[] = [
  { value: 'foreclosure', label: 'Facing foreclosure or financial difficulty' },
  { value: 'financing', label: 'Need financing or mortgage advice' },
  { value: 'ofw', label: 'Managing remotely from overseas' },
];

const LEAD_TAG_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_TAG_OPTIONS.map((o) => [o.value, o.label])
);

/** Short badge text for a tag value — falls back to the raw value for one
 * that isn't in the current list, so an older lead with a retired tag still
 * shows something rather than nothing. */
export function leadTagBadgeLabel(value: string): string {
  const BADGE_LABELS: Record<string, string> = {
    foreclosure: 'Foreclosure',
    financing: 'Financing help',
    ofw: 'Overseas owner',
  };
  return BADGE_LABELS[value] || LEAD_TAG_LABELS[value] || value;
}
