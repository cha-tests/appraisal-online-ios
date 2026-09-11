import { Report, Property } from '../types';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDistance, getMarketConfig, sqftToSqm } from '../config/marketConfig';
import { CLIENT_DISCLAIMER_TEXT, PRC_VERIFICATION_URL } from '../config/disclaimers';

/**
 * PDF generation service. Renders the report entirely on-device (via
 * expo-print, which turns an HTML string into a real PDF locally) rather
 * than asking a backend server to build one.
 *
 * This used to call a backend endpoint (`GET /api/reports/:id/pdf`), which
 * meant the phone had to reach whatever machine was running the Express
 * server — fine on the same Wi-Fi as a dev machine, but a hard stall (no
 * error, no timeout, just a spinner forever) for anyone testing over
 * TestFlight from their own network, since that backend was never deployed
 * anywhere public. Generating locally removes that dependency entirely: the
 * report data is already fetched from Supabase by the time the user is on
 * this screen, so there's nothing left to fetch.
 */
export const pdfService = {
  /**
   * Generate a PDF, save it to Documents, then hand it to the OS share
   * sheet so the user can actually get it out of the app's sandbox — saved
   * to Files, AirDropped, emailed, etc. On iOS there's no user-visible
   * "Downloads" folder for a sandboxed app's Documents directory, so
   * writing the file alone would leave it reachable only from inside this
   * app.
   */
  async downloadReportPDF(
    report: Report,
    property: Property | null,
    propertyAddress: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const fileUri = await generateLocalPdf(report, property, propertyAddress);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      }

      return { success: true, filePath: fileUri };
    } catch (error: any) {
      console.error('PDF download error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to generate PDF report',
      };
    }
  },

  /**
   * Share a PDF report via system share sheet — same generation path as
   * downloadReportPDF, kept as a separate entry point for a future "Share
   * PDF" affordance distinct from the plain-text share already on the
   * report screen.
   */
  async shareReportPDF(
    report: Report,
    property: Property | null,
    propertyAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      const fileUri = await generateLocalPdf(report, property, propertyAddress);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });

      return { success: true };
    } catch (error: any) {
      console.error('PDF share error:', error);
      return { success: false, error: error?.message || 'Failed to share PDF' };
    }
  },
};

async function generateLocalPdf(
  report: Report,
  property: Property | null,
  propertyAddress: string
): Promise<string> {
  const html = buildReportHtml(report, property, propertyAddress);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    // Android-only: its print pipeline has its own page margins (default 0),
    // separate from the HTML's own CSS body padding below — iOS has no such
    // option and relies on that padding alone, so both need to agree for the
    // margin to look the same on both platforms. Top is smaller than the
    // other sides — this margin and the body's own padding-top (see the
    // <style> block) both add space above the title on the first page, and
    // together at 40px each left an oversized gap there.
    margins: { left: 40, top: 16, right: 40, bottom: 40 },
  });

  const cleanAddress = propertyAddress
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  const fileName = `appraisal-${cleanAddress}-${new Date().getFullYear()}.pdf`;
  const destination = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts the constrained markdown subset the AI valuation prompt asks
 * Gemini to produce (headers, bullets, numbered lists, **bold**, pipe
 * tables — see report.service.ts's buildValuationPrompt) into HTML. Not a
 * general markdown renderer, deliberately — it only needs to cover what
 * that prompt actually generates, mirroring the backend's PDFKit-based
 * renderNarrativeReport (backend/src/services/pdf.ts) which covers the
 * same subset.
 */
function renderNarrativeHtml(markdown: string): string {
  const lines = markdown.split('\n');
  let html = '';
  let tableLines: string[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const inline = (text: string) =>
    escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const flushList = () => {
    if (!listBuffer) return;
    const tag = listBuffer.type;
    html += `<${tag}>${listBuffer.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`;
    listBuffer = null;
  };

  const flushTable = () => {
    if (tableLines.length < 2) {
      tableLines = [];
      return;
    }
    const parseRow = (line: string) =>
      line
        .split('|')
        .map((c) => c.trim())
        .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));

    const dataStart = tableLines[1]?.includes('---') ? 2 : 1;
    const headers = parseRow(tableLines[0]);
    const rows = tableLines.slice(dataStart).map(parseRow).filter((r) => r.length > 0);

    html += '<table class="comp-table"><thead><tr>';
    headers.forEach((h) => (html += `<th>${inline(h)}</th>`));
    html += '</tr></thead><tbody>';
    rows.forEach((row) => {
      html += '<tr>';
      row.forEach((cell) => (html += `<td>${inline(cell)}</td>`));
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine;
    if (line.trim().startsWith('|')) {
      tableLines.push(line);
      continue;
    }
    if (tableLines.length) flushTable();

    if (line.trim() === '') continue;

    if (/^###\s/.test(line)) {
      flushList();
      html += `<h4>${inline(line.replace(/^###\s*/, ''))}</h4>`;
      continue;
    }
    if (/^##\s/.test(line)) {
      flushList();
      html += `<h3>${inline(line.replace(/^##\s*/, ''))}</h3>`;
      continue;
    }
    if (/^#\s/.test(line)) {
      flushList();
      html += `<h2>${inline(line.replace(/^#\s*/, ''))}</h2>`;
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      if (listBuffer?.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(line.replace(/^\s*[-*]\s/, ''));
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      if (listBuffer?.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(line.replace(/^\s*\d+\.\s/, ''));
      continue;
    }

    flushList();
    html += `<p>${inline(line)}</p>`;
  }
  flushList();
  flushTable();

  return html;
}

function buildReportHtml(report: Report, property: Property | null, propertyAddress: string): string {
  const countryCode =
    property?.address_components?.country_code ?? (report.gemini_response as any)?.country_code;

  const valueFormatted = formatCurrency(report.estimated_value, countryCode);
  const lowFormatted = formatCurrency(report.confidence_range.low, countryCode);
  const highFormatted = formatCurrency(report.confidence_range.high, countryCode);

  // Sizes are always stored in sqft (see property-details.tsx) — display in
  // whichever unit this property's market actually measures in, the same
  // sqft<->sqm conversion "Tell us about the property" itself uses, so a PH
  // report doesn't show sq ft when the homeowner entered sq m.
  const { sizeUnit } = getMarketConfig(countryCode);
  const formatArea = (sqft: number | undefined | null): string => {
    if (sqft === undefined || sqft === null) return 'N/A';
    const value = sizeUnit === 'sqm' ? sqftToSqm(sqft) : sqft;
    return `${Math.round(value).toLocaleString()} ${sizeUnit === 'sqm' ? 'sq m' : 'sq ft'}`;
  };
  const fullReportMarkdown = (report.gemini_response as any)?.full_report_markdown as string | undefined;
  const isMock = (report.gemini_response as any)?.is_mock === true;

  const comparablesHtml = (report.comparables || [])
    .map(
      (c, i) => `
        <div class="comp-card">
          <div class="comp-header">
            <span class="comp-address">${i + 1}. ${escapeHtml(c.address)}</span>
            <span class="comp-distance">${escapeHtml(formatDistance(c.distance_miles, countryCode))} away</span>
          </div>
          <div class="comp-details">
            <span>Sale Price: <strong>${escapeHtml(formatCurrency(c.sale_price, countryCode))}</strong></span>
            <span>Date: ${escapeHtml(c.sale_date)}</span>
            <span>Similarity: ${(c.similarity_score * 100).toFixed(0)}%</span>
          </div>
        </div>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1F2937; padding: 16px 40px 40px 40px; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  .brand { text-align: center; color: #6B7280; font-size: 12px; margin-bottom: 20px; }
  .disclaimer { border: 1px solid #FCD34D; background: #FEF3C7; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
  .disclaimer h2 { color: #92400E; font-size: 13px; margin: 0 0 8px; }
  .disclaimer p { color: #78350F; font-size: 11px; line-height: 1.6; margin: 0 0 8px; white-space: pre-line; }
  .disclaimer a { color: #2563EB; }
  h3.section { font-size: 15px; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; margin-top: 24px; }
  .facts { display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 12px; margin-top: 8px; }
  .facts span b { color: #1F2937; }
  .valuation { text-align: center; background: #F0F9FF; border-radius: 10px; padding: 20px; margin-top: 16px; }
  .valuation .amount { font-size: 28px; font-weight: 700; color: #2563EB; }
  .valuation .range { font-size: 12px; color: #6B7280; margin-top: 6px; }
  .comp-card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 14px; margin-top: 10px; }
  .comp-header { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; }
  .comp-details { display: flex; gap: 16px; font-size: 11px; color: #4B5563; margin-top: 4px; }
  .narrative h2 { font-size: 16px; color: #2563EB; margin-top: 20px; }
  .narrative h3 { font-size: 14px; color: #2563EB; margin-top: 16px; }
  .narrative h4 { font-size: 12px; color: #1F2937; margin-top: 12px; }
  .narrative p, .narrative li { font-size: 11px; line-height: 1.6; color: #1F2937; }
  .comp-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
  .comp-table th { background: #2563EB; color: #fff; padding: 6px 8px; text-align: left; }
  .comp-table td { border-bottom: 1px solid #E5E7EB; padding: 6px 8px; }
  .footer { margin-top: 28px; text-align: center; font-size: 9px; color: #9CA3AF; }
</style>
</head>
<body>
  <h1>Property Valuation Report</h1>
  <div class="brand">Appraisal Online</div>

  ${isMock ? `<div class="disclaimer">
    <h2>&#9888; Estimate Unavailable</h2>
    <p>We couldn't reach our AI valuation service, so this is a rough placeholder, not a real estimate. Try generating this report again.</p>
  </div>` : ''}

  <div class="disclaimer">
    <h2>&#9888; Important Notice</h2>
    <p>${escapeHtml(CLIENT_DISCLAIMER_TEXT).replace(
      'www.prc.gov.ph',
      `<a href="${PRC_VERIFICATION_URL}">www.prc.gov.ph</a>`
    )}</p>
  </div>

  <h3 class="section">Property Information</h3>
  <div class="facts">
    <span><b>Address:</b> ${escapeHtml(property?.address || propertyAddress)}</span>
    <span><b>Type:</b> ${escapeHtml(property?.property_type || 'N/A')}</span>
    <span><b>Bedroom(s):</b> ${property?.bedrooms ?? 'N/A'}</span>
    <span><b>Bathroom(s):</b> ${property?.bathrooms ?? 'N/A'}</span>
    ${property?.parking_spaces !== undefined && property?.parking_spaces !== null ? `<span><b>Parking:</b> ${property.parking_spaces}</span>` : ''}
    ${property?.lot_size !== undefined && property?.lot_size !== null ? `<span><b>Lot Area:</b> ${formatArea(property.lot_size)}</span>` : ''}
    <span><b>Floor Area:</b> ${formatArea(property?.square_feet)}</span>
    <span><b>Condition:</b> ${escapeHtml(property?.condition || 'N/A')}</span>
    <span><b>Year Built:</b> ${property?.year_built ? property.year_built : 'N/A'}</span>
  </div>

  <div class="valuation">
    <div class="amount">${escapeHtml(valueFormatted)}</div>
    <div class="range">Estimated Range: ${escapeHtml(lowFormatted)} &ndash; ${escapeHtml(highFormatted)}</div>
  </div>

  ${fullReportMarkdown ? `<div class="narrative">${renderNarrativeHtml(fullReportMarkdown)}</div>` : ''}

  <h3 class="section">Comparable Sales</h3>
  ${comparablesHtml || '<p>No comparable sales data available</p>'}

  <div class="footer">
    Report ID: ${escapeHtml(report.id)} | Generated: ${escapeHtml(new Date().toLocaleString())}<br/>
    This report was generated by Appraisal Online.
  </div>
</body>
</html>`;
}
