/**
 * Exact disclaimer text agreed at the Sep 1, 2026 sync-up (see
 * Appraisal_Online_Disclaimers.pdf). Both are versioned so that a future
 * wording change can force re-acceptance from existing users without
 * losing the record of what they originally agreed to — see
 * disclaimer_acceptances in migration 014.
 */

export const PRC_VERIFICATION_URL = 'https://www.prc.gov.ph';

/**
 * The AI-valuation-accuracy disclaimer mandated (exact wording, see
 * CLAUDE.md's "Critical business rules") for all three required
 * placements: in-app report view, email body, and PDF. This is a
 * different concern from CLIENT_DISCLAIMER_TEXT below (which covers
 * broker-license verification, agreed separately at the Sep 1, 2026
 * sync-up) — the two coexist, neither replaces the other.
 *
 * This sentence was present everywhere up through Aug 2026, but was
 * accidentally dropped from the in-app report view and both PDF
 * generators during the Sep 9, 2026 redesign/PDF-rewrite commit, which
 * wired in CLIENT_DISCLAIMER_TEXT as the only notice shown in those three
 * spots. It survived untouched in the email template and the public
 * Sample Report page the whole time. Restored here rather than merged
 * into CLIENT_DISCLAIMER_TEXT, since that constant has its own version
 * tracking (disclaimer_acceptances, migration 014) tied to the broker-
 * verification wording specifically.
 */
export const AI_ESTIMATE_DISCLAIMER_TEXT =
  'This is a computer estimate. It is not a licensed appraisal. Banks, courts, and government agencies ' +
  'do not accept this as a formal valuation.';

export const CLIENT_DISCLAIMER_VERSION = '2026-09-02';

export const CLIENT_DISCLAIMER_TEXT =
  'Appraisal Online provides AI-generated property valuations for informational purposes only. ' +
  'This is not a licensed appraisal and should not be relied upon as one.\n\n' +
  'When you choose to connect with a broker or salesperson through this platform, please note that ' +
  'Appraisal Online does not independently verify professional licenses. We collect license information ' +
  "from brokers and salespersons as part of registration, but it is your responsibility to verify their " +
  'credentials before engaging their services. You can verify a real estate broker or salesperson’s license ' +
  'directly through the Professional Regulation Commission (PRC) at www.prc.gov.ph.\n\n' +
  'We strongly recommend that you only engage with licensed real estate professionals for any transaction ' +
  'involving your property.';

export const BROKER_DISCLAIMER_VERSION = '2026-09-02';

export const BROKER_DISCLAIMER_TEXT =
  'Appraisal Online collects property title information and related documents from users as an optional ' +
  'step to help signal serious, motivated sellers. Appraisal Online does not verify the authenticity, ' +
  'accuracy, or validity of any title or property document submitted by users.\n\n' +
  'A "verified title" indicator (green check) on a listing means only that a document was submitted by the ' +
  'user — it does not mean Appraisal Online has confirmed its authenticity. You are responsible for ' +
  'independently verifying any property title, document, or ownership claim before proceeding with any ' +
  'transaction or engagement with a lead.\n\n' +
  'Appraisal Online is not liable for any loss, damage, or dispute arising from reliance on unverified ' +
  'information provided by users.';
