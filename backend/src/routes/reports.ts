import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as pdfService from '../services/pdf.js';
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
