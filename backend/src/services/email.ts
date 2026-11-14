import { ServerClient } from 'postmark';
import { logger } from '../utils/logger.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const client = new ServerClient(process.env.POSTMARK_API_KEY || '');

interface EmailTemplate {
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

/**
 * Send welcome email after broker payment
 */
export async function sendBrokerWelcomeEmail(
  brokerEmail: string,
  brokerName: string,
  tier: string,
  refundDays: number
) {
  try {
    const subject = `Welcome to Appraisal Online - ${tier} Membership`;

    const htmlBody = `
      <h1>Welcome, ${brokerName}!</h1>
      <p>Your ${tier} membership is now active. You can now start receiving qualified real estate leads.</p>

      <h2>What's Next?</h2>
      <ul>
        <li>Complete your broker profile</li>
        <li>Set your notification preferences</li>
        <li>Start receiving leads in real-time</li>
      </ul>

      <h2>Refund Window</h2>
      <p>You have ${refundDays} days to request a refund if you're not satisfied.</p>

      <p><a href="https://appraisalonline.com">Log in to your account</a></p>

      <p>Questions? Contact support@appraisalonline.com</p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: brokerEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `Welcome to Appraisal Online! Your ${tier} membership is now active.`,
      MessageStream: 'outbound',
      Tag: 'broker-welcome',
    });

    logger.info(`Welcome email sent to ${brokerEmail}`);
  } catch (error) {
    logger.error('Error sending welcome email:', error);
    throw error;
  }
}

/**
 * Send consumer confirmation email after report generation
 *
 * pdfAttachment is optional so this still works for the existing
 * /api/emails/confirmation route, which has no PDF to attach — only the
 * new auto-send-on-report-creation path (routes/reports.ts) passes one.
 * countryCode is likewise optional (falls back to USD in formatCurrency) for
 * that same older route, which doesn't have the property on hand.
 */
export async function sendConsumerConfirmationEmail(
  consumerEmail: string,
  propertyAddress: string,
  estimatedValue: number,
  pdfAttachment?: { fileName: string; buffer: Buffer },
  countryCode?: string | null
) {
  try {
    const valueFormatted = formatCurrency(estimatedValue, countryCode);

    const subject = `Your Property Valuation Report for ${propertyAddress}`;

    const htmlBody = `
      <h1>Your Property Valuation Report</h1>
      <p>We've generated an AI-powered valuation for your property:</p>

      <h2>Property: ${propertyAddress}</h2>
      <h2 style="color: #2563EB;">Estimated Value: ${valueFormatted}</h2>

      <h3>Important Disclaimer</h3>
      <p style="color: #DC2626;">
        This is a computer estimate. It is NOT a licensed appraisal. Banks, courts, and government agencies
        do NOT accept this as a formal valuation.
      </p>

      <h3>Next Steps</h3>
      <p>You can now:</p>
      <ul>
        <li>Download your full PDF report with comparable sales</li>
        <li>Optionally connect with local real estate professionals</li>
        <li>Generate up to 3 free reports per month</li>
      </ul>

      <p><a href="https://appraisalonline.com/app">View Your Report</a></p>

      <p>Questions? Contact support@appraisalonline.com</p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: consumerEmail,
      Bcc: 'support@appraisalonline.ai',
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `Your property valuation: ${valueFormatted}`,
      MessageStream: 'outbound',
      Tag: 'consumer-report',
      Attachments: pdfAttachment
        ? [
            {
              Name: pdfAttachment.fileName,
              Content: pdfAttachment.buffer.toString('base64'),
              ContentType: 'application/pdf',
              // Postmark's type requires this even for a normal (non-inline)
              // attachment; an empty string is what a plain attachment uses.
              ContentID: '',
            },
          ]
        : undefined,
    });

    logger.info(`Confirmation email sent to ${consumerEmail}`);
  } catch (error) {
    logger.error('Error sending confirmation email:', error);
    throw error;
  }
}

/**
 * Send lead notification to broker
 */
export async function sendBrokerLeadNotification(
  brokerEmail: string,
  brokerName: string,
  propertyAddress: string,
  propertyValue: number,
  consumerEmail: string
) {
  try {
    const valueFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(propertyValue / 100);

    const subject = `New Lead: ${propertyAddress} - ${valueFormatted}`;

    const htmlBody = `
      <h1>New Lead Available</h1>
      <p>Hi ${brokerName},</p>

      <h2>Property Details</h2>
      <ul>
        <li><strong>Address:</strong> ${propertyAddress}</li>
        <li><strong>Estimated Value:</strong> ${valueFormatted}</li>
        <li><strong>Contact:</strong> ${consumerEmail}</li>
      </ul>

      <p><a href="https://appraisalonline.com/dashboard">View All Leads</a></p>

      <p>This lead was generated because the homeowner opted in to connect with professionals.</p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: brokerEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `New lead: ${propertyAddress} - ${valueFormatted}`,
      MessageStream: 'outbound',
      Tag: 'broker-lead',
    });

    logger.info(`Lead notification sent to ${brokerEmail}`);
  } catch (error) {
    logger.error('Error sending lead notification:', error);
    throw error;
  }
}

/**
 * Send weekly digest of leads
 */
export async function sendWeeklyDigest(
  brokerEmail: string,
  brokerName: string,
  leads: any[]
) {
  try {
    if (leads.length === 0) {
      logger.info(`No leads for digest for ${brokerName}`);
      return;
    }

    const leadsList = leads
      .map(
        (lead) =>
          `<li>${lead.address} - ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(lead.value / 100)}</li>`
      )
      .join('');

    const subject = `Weekly Digest: ${leads.length} New Leads`;

    const htmlBody = `
      <h1>Your Weekly Lead Digest</h1>
      <p>Hi ${brokerName},</p>

      <p>Here are the leads generated this week:</p>
      <ul>${leadsList}</ul>

      <p><a href="https://appraisalonline.com/dashboard">View All Leads</a></p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: brokerEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `Your weekly digest: ${leads.length} leads`,
      MessageStream: 'outbound',
      Tag: 'weekly-digest',
    });

    logger.info(`Weekly digest sent to ${brokerEmail}`);
  } catch (error) {
    logger.error('Error sending weekly digest:', error);
    throw error;
  }
}

/**
 * Phase 4 notification emails — sent by the notification poller
 * (services/notificationPoller.ts) draining notification_queue
 * (migration 040), not called directly from any route. Each payload
 * shape mirrors exactly what that migration's triggers pre-compute, so
 * these functions only ever format and send, never query anything
 * themselves.
 */

interface BrokerInvitePayload {
  property_type?: string;
  condition?: string;
  city_name?: string;
  city_state?: string;
  city_country?: string;
  estimated_value_low?: number;
  estimated_value_high?: number;
  lead_tags?: string[];
}

/**
 * A broker was just routed (or added via escalation) to a lead — masked
 * preview only, same fields their in-app inbox shows pre-claim. Never
 * include the homeowner's name/email/phone/exact address here; they
 * haven't claimed yet.
 */
export async function sendBrokerInviteEmail(
  brokerEmail: string,
  brokerName: string,
  payload: BrokerInvitePayload
) {
  try {
    const location = [payload.city_name, payload.city_state].filter(Boolean).join(', ');
    const priceRange =
      payload.estimated_value_low != null && payload.estimated_value_high != null
        ? `${formatCurrency(payload.estimated_value_low, payload.city_country)} - ${formatCurrency(payload.estimated_value_high, payload.city_country)}`
        : null;

    const subject = `New Lead${location ? ` in ${location}` : ''}`;

    const htmlBody = `
      <h1>New Lead Available</h1>
      <p>Hi ${brokerName},</p>
      <p>A homeowner${location ? ` in ${location}` : ''} is looking to connect with a professional.</p>
      <ul>
        <li><strong>Property:</strong> ${payload.property_type || 'Property'}${payload.condition ? ` (${payload.condition} condition)` : ''}</li>
        ${priceRange ? `<li><strong>Estimated range:</strong> ${priceRange}</li>` : ''}
      </ul>
      <p>Tap "I Want This Lead" in your app to see their full contact details.</p>
      <p><a href="https://appraisalonline.com/broker/lead-inbox">Open Your Leads</a></p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: brokerEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `New lead available${location ? ` in ${location}` : ''}. Open your app to view and claim it.`,
      MessageStream: 'outbound',
      Tag: 'broker-invite',
    });

    logger.info(`Invite notification sent to ${brokerEmail}`);
  } catch (error) {
    logger.error('Error sending invite notification:', error);
    throw error;
  }
}

/**
 * This broker never claimed, and the lead has since been fully connected
 * with enough other professionals — lets them know it's no longer
 * available rather than leaving them wondering why it vanished.
 */
export async function sendBrokerMissedLeadEmail(
  brokerEmail: string,
  brokerName: string,
  payload: { property_type?: string; city_name?: string }
) {
  try {
    const location = payload.city_name ? ` in ${payload.city_name}` : '';
    const subject = 'That lead has been connected';

    const htmlBody = `
      <h1>This Lead Is No Longer Available</h1>
      <p>Hi ${brokerName},</p>
      <p>The ${payload.property_type || 'property'}${location} lead you were invited to has already connected
      with enough professionals. There's nothing more to do here.</p>
      <p><a href="https://appraisalonline.com/broker/lead-inbox">Check your inbox for new leads</a></p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: brokerEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: 'That lead has already connected with enough professionals. Check your inbox for new leads.',
      MessageStream: 'outbound',
      Tag: 'broker-missed-lead',
    });

    logger.info(`Missed-lead notification sent to ${brokerEmail}`);
  } catch (error) {
    logger.error('Error sending missed-lead notification:', error);
    throw error;
  }
}

/**
 * The homeowner has revoked a broker who already had their contact
 * info (see migration 037's revoke_broker_contact — this is the
 * post-claim case only). This can't force the broker to stop — nothing
 * can, once contact info is shared — so the real teeth is naming the
 * ToS consequence, not just asking nicely.
 */
export async function sendBrokerStopContactEmail(
  brokerEmail: string,
  brokerName: string,
  payload: { property_address?: string }
) {
  try {
    const subject = 'A homeowner has asked you to stop contacting them';

    const htmlBody = `
      <h1>Please Stop Contacting This Homeowner</h1>
      <p>Hi ${brokerName},</p>
      <p>The homeowner at <strong>${payload.property_address || 'this property'}</strong> has withdrawn their
      request to connect with you specifically, and asked not to be contacted further about it.</p>
      <p style="color: #DC2626;">
        Continuing to contact them about this property is a violation of your broker agreement with
        Appraisal Online, and may result in your account being reviewed or suspended.
      </p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: brokerEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `The homeowner at ${payload.property_address || 'this property'} has asked you to stop contacting them about it. Continuing to do so violates your broker agreement.`,
      MessageStream: 'outbound',
      Tag: 'broker-stop-contact',
    });

    logger.info(`Stop-contact notice sent to ${brokerEmail}`);
  } catch (error) {
    logger.error('Error sending stop-contact notice:', error);
    throw error;
  }
}

/**
 * Nobody has claimed this homeowner's lead after CHECK_IN_DAYS (5) days —
 * the email equivalent of consumer/settings.tsx's in-app check-in banner.
 * Points them at Settings to decide for themselves rather than deciding
 * for them.
 */
export async function sendConsumerCheckInEmail(
  consumerEmail: string,
  payload: { property_address?: string; days_waiting?: number }
) {
  try {
    const subject = 'Still waiting to hear from a professional?';

    const htmlBody = `
      <h1>Still Waiting to Connect</h1>
      <p>It's been ${payload.days_waiting ?? 'a few'} days since you asked to connect with a professional about
      <strong>${payload.property_address || 'your property'}</strong>, and nobody has reached out yet.</p>
      <p>We're still trying more professionals in the background. If you'd rather not wait, you can cancel the
      request anytime from your account.</p>
      <p><a href="https://appraisalonline.com/app/consumer/settings">Manage This Request</a></p>
    `;

    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: consumerEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `Still waiting to hear from a professional about ${payload.property_address || 'your property'}? Manage this request from your account settings.`,
      MessageStream: 'outbound',
      Tag: 'consumer-check-in',
    });

    logger.info(`Check-in reminder sent to ${consumerEmail}`);
  } catch (error) {
    logger.error('Error sending check-in reminder:', error);
    throw error;
  }
}

/**
 * Send generic email
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string,
  tag?: string
) {
  try {
    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@appraisalonline.com',
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody || subject,
      MessageStream: 'outbound',
      Tag: tag || 'transactional',
    });

    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
}
