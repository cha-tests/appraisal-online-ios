import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import * as emailService from '../services/email.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Schema validation
const SendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  htmlBody: z.string(),
  textBody: z.string().optional(),
  tag: z.string().optional(),
});

const SendWelcomeSchema = z.object({
  brokerEmail: z.string().email(),
  brokerName: z.string(),
  tier: z.enum(['Founder Lifetime', 'Premium Annual', 'Basic Annual']),
  refundDays: z.number().int().min(14).max(30),
});

const SendConfirmationSchema = z.object({
  consumerEmail: z.string().email(),
  propertyAddress: z.string(),
  estimatedValue: z.number().int().positive(),
});

const SendLeadNotificationSchema = z.object({
  brokerEmail: z.string().email(),
  brokerName: z.string(),
  propertyAddress: z.string(),
  propertyValue: z.number().int().positive(),
  consumerEmail: z.string().email(),
});

/**
 * POST /api/emails/send
 * Send a generic email (admin only)
 */
router.post('/send', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validated = SendEmailSchema.parse(req.body);

    await emailService.sendEmail(
      validated.to,
      validated.subject,
      validated.htmlBody,
      validated.textBody,
      validated.tag
    );

    res.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
        },
      });
    }

    logger.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_ERROR',
        message: 'Failed to send email',
      },
    });
  }
});

/**
 * POST /api/emails/welcome
 * Send broker welcome email
 */
router.post('/welcome', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validated = SendWelcomeSchema.parse(req.body);

    await emailService.sendBrokerWelcomeEmail(
      validated.brokerEmail,
      validated.brokerName,
      validated.tier,
      validated.refundDays
    );

    res.json({
      success: true,
      message: 'Welcome email sent',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
        },
      });
    }

    logger.error('Error sending welcome email:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_ERROR',
        message: 'Failed to send email',
      },
    });
  }
});

/**
 * POST /api/emails/confirmation
 * Send consumer confirmation email
 */
router.post('/confirmation', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validated = SendConfirmationSchema.parse(req.body);

    await emailService.sendConsumerConfirmationEmail(
      validated.consumerEmail,
      validated.propertyAddress,
      validated.estimatedValue
    );

    res.json({
      success: true,
      message: 'Confirmation email sent',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
        },
      });
    }

    logger.error('Error sending confirmation email:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_ERROR',
        message: 'Failed to send email',
      },
    });
  }
});

/**
 * POST /api/emails/lead-notification
 * Send broker lead notification
 */
router.post('/lead-notification', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validated = SendLeadNotificationSchema.parse(req.body);

    await emailService.sendBrokerLeadNotification(
      validated.brokerEmail,
      validated.brokerName,
      validated.propertyAddress,
      validated.propertyValue,
      validated.consumerEmail
    );

    res.json({
      success: true,
      message: 'Lead notification sent',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
        },
      });
    }

    logger.error('Error sending lead notification:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_ERROR',
        message: 'Failed to send notification',
      },
    });
  }
});

export default router;
