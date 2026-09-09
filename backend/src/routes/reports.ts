import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as pdfService from '../services/pdf.js';
import * as emailService from '../services/email.js';
import * as supabaseService from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/reports/:reportId/pdf
 * Generate and download a PDF report
 */
router.get('/:reportId/pdf', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    // Verify user owns this report
    const report = await supabaseService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found',
        },
      });
    }

    // Check authorization - only consumer who created report can download
    if (report.user_id !== req.user?.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this report',
        },
      });
    }

    // Generate PDF
    const pdfBuffer = await pdfService.generateReportPDF(reportId);

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="appraisal-report-${reportId}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

    logger.info(`PDF downloaded: ${reportId} by user ${req.user?.id}`);
  } catch (error) {
    logger.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PDF_ERROR',
        message: 'Failed to generate PDF',
      },
    });
  }
});

/**
 * GET /api/reports/:reportId/pdf-url
 * Get a signed URL for sharing the PDF
 */
router.get('/:reportId/pdf-url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    // Verify user owns this report
    const report = await supabaseService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found',
        },
      });
    }

    // Check authorization
    if (report.user_id !== req.user?.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this report',
        },
      });
    }

    // Generate signed URL (valid for 24 hours)
    const signedUrl = `${process.env.API_URL}/api/reports/${reportId}/pdf`;
    // In production, use Supabase storage signed URLs or implement JWT signing

    res.json({
      success: true,
      url: signedUrl,
      expiresIn: 86400, // 24 hours
    });
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'URL_ERROR',
        message: 'Failed to generate URL',
      },
    });
  }
});

/**
 * POST /api/reports/:reportId/deliver
 * Generate the PDF and email it to the consumer as an attachment — the
 * app's equivalent of the old Apps Script's onFormSubmit -> sendReport
 * flow, triggered by the mobile app right after it creates a report
 * (see mobile/app/consumer/loading.tsx) rather than by a form webhook.
 */
router.post('/:reportId/deliver', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await supabaseService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: { code: 'REPORT_NOT_FOUND', message: 'Report not found' },
      });
    }

    if (report.user_id !== req.user?.id) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this report' },
      });
    }

    const user = await supabaseService.getUser(report.user_id);
    if (!user?.email) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'No email on file for this user' },
      });
    }

    const pdfBuffer = await pdfService.generateReportPDF(reportId);
    const address = report.properties?.address || 'your property';
    const fileName = `Appraisal_Report_${address.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const countryCode = report.properties?.address_components?.country_code || report.gemini_response?.country_code;

    await emailService.sendConsumerConfirmationEmail(
      user.email,
      address,
      report.estimated_value,
      { fileName, buffer: pdfBuffer },
      countryCode
    );

    res.json({ success: true, message: 'Report emailed' });
    logger.info(`Report ${reportId} emailed to ${user.email}`);
  } catch (error) {
    // Deliberately a 500 with a plain message rather than surfacing the
    // underlying error (e.g. Postmark auth failure) — the caller (mobile
    // loading.tsx) treats this as best-effort and shouldn't block the
    // consumer from seeing their report over an email delivery problem.
    logger.error('Error delivering report email:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DELIVERY_ERROR', message: 'Failed to email report' },
    });
  }
});

/**
 * GET /api/reports/:reportId
 * Get report details
 */
router.get('/:reportId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await supabaseService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found',
        },
      });
    }

    // Check authorization - consumer can access own, broker can access if consumer opted in
    if (report.user_id !== req.user?.id && report.broker_id !== req.user?.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this report',
        },
      });
    }

    res.json({
      success: true,
      report: {
        id: report.id,
        address: report.address,
        estimated_value: report.estimated_value,
        confidence_range: report.confidence_range,
        comparables: report.comparables || [],
        created_at: report.created_at,
      },
    });
  } catch (error) {
    logger.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch report',
      },
    });
  }
});

export default router;
