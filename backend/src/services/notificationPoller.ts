import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';
import {
  sendBrokerInviteEmail,
  sendBrokerMissedLeadEmail,
  sendBrokerStopContactEmail,
  sendConsumerCheckInEmail,
} from './email.js';

/**
 * Drains notification_queue (migration 040), sending each row's email via
 * the matching function in email.ts and marking it sent/failed. This is
 * the only mechanism that actually sends these four notification types —
 * everything that queues one (the lead_routings triggers, and
 * queue_consumer_check_ins() on its own daily pg_cron schedule) runs
 * entirely in Postgres with no live client involved, so nothing else in
 * this codebase could dispatch them. See migration 040's header comment
 * for why this is a poller rather than pg_net calling the backend
 * directly: no pg_net usage exists anywhere in this project, and this
 * server is already a plain always-on process with nothing to gate on.
 *
 * Best-effort, no retry loop — a row that fails once is marked 'failed'
 * and left there rather than retried indefinitely, matching
 * lead_routings.delivery_status's existing pending/sent/failed/bounced
 * pattern (migration 001) that this project already uses for the same
 * kind of "fire once, don't loop forever on a bad address" case.
 */

const BATCH_SIZE = 25;

interface QueuedNotification {
  id: string;
  notification_type: 'broker_invite' | 'broker_missed_lead' | 'broker_stop_contact' | 'consumer_check_in';
  recipient_user_id: string;
  payload: Record<string, any> | null;
}

async function sendOne(notification: QueuedNotification, recipientEmail: string, recipientName: string) {
  const payload = notification.payload || {};

  switch (notification.notification_type) {
    case 'broker_invite':
      return sendBrokerInviteEmail(recipientEmail, recipientName, payload);
    case 'broker_missed_lead':
      return sendBrokerMissedLeadEmail(recipientEmail, recipientName, payload);
    case 'broker_stop_contact':
      return sendBrokerStopContactEmail(recipientEmail, recipientName, payload);
    case 'consumer_check_in':
      return sendConsumerCheckInEmail(recipientEmail, payload);
    default:
      throw new Error(`Unknown notification_type: ${notification.notification_type}`);
  }
}

export async function pollAndSendNotifications(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const { data: pending, error } = await supabase
    .from('notification_queue')
    .select('id, notification_type, recipient_user_id, payload')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error('Error fetching pending notifications:', error);
    return { sent, failed };
  }

  for (const notification of (pending || []) as QueuedNotification[]) {
    try {
      const { data: recipient, error: recipientError } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', notification.recipient_user_id)
        .single();

      if (recipientError || !recipient?.email) {
        throw recipientError || new Error('Recipient has no email on file');
      }

      await sendOne(notification, recipient.email, recipient.first_name || 'there');

      await supabase
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id);
      sent++;
    } catch (err: any) {
      logger.error(`Failed to send notification ${notification.id}:`, err);
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', error: err?.message || String(err) })
        .eq('id', notification.id);
      failed++;
    }
  }

  if (sent || failed) {
    logger.info(`Notification poll: ${sent} sent, ${failed} failed`);
  }

  return { sent, failed };
}

const POLL_INTERVAL_MS = 2 * 60 * 1000;

/** Started once from index.ts alongside app.listen — not awaited there, it
 * just runs for the life of the process, same as any other background
 * interval in a plain Express server. */
export function startNotificationPoller(): void {
  setInterval(() => {
    pollAndSendNotifications().catch((err) => logger.error('Notification poller crashed:', err));
  }, POLL_INTERVAL_MS);
  logger.info(`Notification poller started (every ${POLL_INTERVAL_MS / 1000}s)`);
}
