import { Report, ComparableSale } from '../types';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';

interface PDFGenerationParams {
  report: Report;
  comparables: ComparableSale[];
  propertyAddress: string;
}

/**
 * PDF generation service for creating downloadable reports
 * Uses server-side PDF generation for security and reliability
 */
export const pdfService = {
  /**
   * Generate a PDF report from valuation data
   * The actual PDF generation happens on the backend
   */
  async generateReportPDF(
    userId: string,
    reportId: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const fileName = `appraisal-report-${reportId}-${Date.now()}.pdf`;
      const fileUri = await downloadPDFToDocuments(reportId, fileName);

      return {
        success: true,
        url: fileUri,
      };
    } catch (error: any) {
      console.error('PDF generation error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to generate PDF report',
      };
    }
  },

  /**
   * Download a PDF report to device storage, then hand it to the OS share
   * sheet so the user can actually get it out of the app's sandbox — saved
   * to Files, AirDropped, emailed, etc. On iOS there's no user-visible
   * "Downloads" folder for a sandboxed app's Documents directory, so writing
   * the file alone would leave it reachable only from inside this app.
   */
  async downloadReportPDF(
    userId: string,
    reportId: string,
    propertyAddress: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const cleanAddress = propertyAddress
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 40);

      const fileName = `appraisal-${cleanAddress}-${new Date().getFullYear()}.pdf`;
      const fileUri = await downloadPDFToDocuments(reportId, fileName);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      }

      return {
        success: true,
        filePath: fileUri,
      };
    } catch (error: any) {
      console.error('PDF download error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to download PDF report',
      };
    }
  },

  /**
   * Share a PDF report via system share sheet
   */
  async shareReportPDF(
    userId: string,
    reportId: string,
    propertyAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      const cleanAddress = propertyAddress
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 40);

      const fileName = `appraisal-${cleanAddress}-${new Date().getFullYear()}.pdf`;
      const fileUri = await downloadPDFToDocuments(reportId, fileName);

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });

      return { success: true };
    } catch (error: any) {
      console.error('PDF share error:', error);
      return {
        success: false,
        error: 'Failed to share PDF',
      };
    }
  },

  /**
   * Get download URL for a report PDF
   * Returns a signed URL that can be used for sharing or opening in browser
   */
  async getReportPDFURL(
    userId: string,
    reportId: string
  ): Promise<{ success: boolean; url?: string; expiresIn?: number; error?: string }> {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/reports/${reportId}/pdf-url`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
          },
        }
      );

      return {
        success: true,
        url: response.data.url,
        expiresIn: response.data.expiresIn,
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Failed to get PDF URL',
      };
    }
  },

  /**
   * Check if a PDF report is already cached locally
   */
  async getCachedPDF(reportId: string): Promise<string | null> {
    try {
      // Implementation would check local file system
      // For now, return null to indicate no cache
      return null;
    } catch (error) {
      return null;
    }
  },
};

/**
 * Download a report's PDF from the backend straight to a named file in the
 * app's Documents directory. `FileSystem.downloadAsync` streams the response
 * to disk itself (with the auth header attached), so there's no intermediate
 * blob/base64 conversion to manage.
 */
async function downloadPDFToDocuments(reportId: string, fileName: string): Promise<string> {
  const token = await getAuthToken();
  const url = `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/reports/${reportId}/pdf`;
  const destination = `${FileSystem.documentDirectory}${fileName}`;

  const { uri } = await FileSystem.downloadAsync(url, destination, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return uri;
}

/**
 * Get the current authentication token for API requests
 *
 * The backend's authMiddleware validates this as a Supabase JWT via
 * supabase.auth.getUser(token) (see backend/src/middleware/auth.ts), so this
 * must be a live Supabase access_token.
 *
 * This reads directly from the Supabase client rather than auth.store's
 * `session` field: that field is only ever set once, at the moment of
 * login (see auth.service.ts), and app/_layout.tsx's rehydration on app
 * launch restores `user` but never calls setSession — so after any reload
 * or restart, session_token is null even though the user is clearly still
 * logged in. supabase.auth.getSession() reads the client's own persisted,
 * auto-refreshed session (see services/supabase.ts's `persistSession` /
 * `autoRefreshToken` config), so it always reflects a currently-valid token.
 */
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
}
