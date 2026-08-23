import { ServerClient } from 'postmark';
import { logger } from '../utils/logger.js';

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
 */
export async function sendConsumerConfirmationEmail(
  consumerEmail: string,
  propertyAddress: string,
  estimatedValue: number
) {
  try {
    const valueFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(estimatedValue / 100);

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
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: `Your property valuation: ${valueFormatted}`,
      MessageStream: 'outbound',
      Tag: 'consumer-report',
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
