import { Report, ComparableSale } from '../types';
import axios from 'axios';

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
      // Request PDF generation from backend
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/reports/${reportId}/pdf`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
          },
          responseType: 'blob',
        }
      );

      // Convert blob to file:// URL for local storage
      const fileName = `appraisal-report-${reportId}-${Date.now()}.pdf`;
      const fileUri = await savePDFFile(response.data, fileName);

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
   * Download a PDF report to device storage
   * Saves to Documents folder on iOS
   */
  async downloadReportPDF(
    userId: string,
    reportId: string,
    propertyAddress: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Get PDF from backend
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/reports/${reportId}/pdf`,
        {
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
          },
          responseType: 'blob',
        }
      );

      // Generate clean filename from address
      const cleanAddress = propertyAddress
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 40);

      const fileName = `appraisal-${cleanAddress}-${new Date().getFullYear()}.pdf`;
      const filePath = await savePDFFile(response.data, fileName);

      return {
        success: true,
        filePath,
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
      // For now, return that sharing needs platform-specific implementation
      // In a real app, use react-native-share or expo-sharing
      return {
        success: false,
        error: 'Share functionality requires platform implementation',
      };
    } catch (error: any) {
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
 * Save PDF blob to local file system
 * Platform-specific implementation needed
 */
async function savePDFFile(blob: Blob, fileName: string): Promise<string> {
  // In a real implementation, use expo-file-system or react-native-file-system
  // to save the blob to the device's Documents folder
  // This is a placeholder that would need platform-specific code
  throw new Error('PDF file system operations require platform-specific implementation');
}

/**
 * Get the current authentication token for API requests
 */
async function getAuthToken(): Promise<string> {
  // This would retrieve the stored auth token from secure storage
  // Using a placeholder for now
  return '';
}

/**
 * Create a PDF from HTML content
 * Alternative approach using HTML-to-PDF conversion
 */
async function createPDFFromHTML(
  htmlContent: string,
  fileName: string
): Promise<string> {
  // Could use html2pdf or similar library
  throw new Error('HTML-to-PDF conversion requires additional library');
}
