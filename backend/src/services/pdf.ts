import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { formatDistance } from '../utils/formatDistance.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getReport } from './supabase.js';

const PDF_TEMP_DIR = process.env.PDF_TEMP_DIR || './tmp/pdfs';

// Ensure temp directory exists
if (!fs.existsSync(PDF_TEMP_DIR)) {
  fs.mkdirSync(PDF_TEMP_DIR, { recursive: true });
}

// PDFKit's built-in Helvetica/Times/Courier fonts only support the WinAnsi
// character set — no ₱ (Philippine Peso, U+20B1), which silently rendered
// as "±" mojibake for every PH report (PH being this app's flagship first
// market — see appraisal-online-market-direction memory). Noto Sans (OFL
// license, see assets/fonts/OFL.txt) covers it and every other currency
// symbol this app uses. It's a variable font (single file, no separate bold
// weight available through pdfkit's simple API — see the exploration that
// led here), so every doc.font() call in this file uses this one weight;
// section headers/emphasis rely on size and color for hierarchy instead of
// boldness.
const FONT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets/fonts/NotoSans-Variable.ttf');

export function registerFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont('NotoSans', FONT_PATH);
}

/**
 * Generate a PDF report from report data
 */
export async function generateReportPDF(reportId: string): Promise<Buffer> {
  try {
    // Fetch report data from database
    const report = await getReport(reportId);

    if (!report) {
      throw new Error('Report not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'letter',
        margin: 50,
      });
      registerFonts(doc);

      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(24).font('NotoSans').text('Property Valuation Report', {
        align: 'center',
      });

      doc.fontSize(12).font('NotoSans').text('Appraisal Online', {
        align: 'center',
      });

      doc.moveDown();

      // Shown when report.service.ts's Gemini call failed and silently fell
      // back to a generic placeholder valuation (see mobile's
      // generateMockValuation) — mirrors report-view.tsx's on-screen banner
      // so the PDF doesn't misrepresent a placeholder as a real estimate.
      if (report.gemini_response?.is_mock) {
        doc.fontSize(10).fillColor('#DC2626').text('! ESTIMATE UNAVAILABLE', {
          align: 'left',
          underline: true,
        });
        doc.fontSize(9).fillColor('#000000').text(
          "We couldn't reach our AI valuation service, so this is a rough placeholder, not a real " +
          'estimate. Try generating this report again.',
          { align: 'left', lineGap: 4 }
        );
        doc.moveDown();
      }

      // Client disclaimer — exact wording agreed at the Sep 1, 2026 sync-up
      // (see mobile/config/disclaimers.ts, CLIENT_DISCLAIMER_TEXT, which
      // this must be kept in sync with). Plain "!" rather than the ⚠️
      // emoji — PDFKit's default Helvetica font only supports the WinAnsi
      // character set, so the emoji renders as garbled mojibake ("& þ")
      // instead of a warning sign.
      doc.fontSize(10).fillColor('#DC2626').text('! IMPORTANT NOTICE', {
        align: 'left',
        underline: true,
      });

      doc.fontSize(9).fillColor('#000000').text(
        'Appraisal Online provides AI-generated property valuations for informational purposes only. ' +
        'This is not a licensed appraisal and should not be relied upon as one.',
        { align: 'left', lineGap: 4 }
      );
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#000000').text(
        'When you choose to connect with a broker or salesperson through this platform, please note that ' +
        'Appraisal Online does not independently verify professional licenses. We collect license information ' +
        'from brokers and salespersons as part of registration, but it is your responsibility to verify their ' +
        'credentials before engaging their services. You can verify a real estate broker or salesperson’s ' +
        'license directly through the Professional Regulation Commission (PRC) at:',
        { align: 'left', lineGap: 4 }
      );
      doc.fontSize(9).fillColor('#2563EB').text('www.prc.gov.ph', {
        align: 'left',
        link: 'https://www.prc.gov.ph',
        underline: true,
      });
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#000000').text(
        'We strongly recommend that you only engage with licensed real estate professionals for any transaction ' +
        'involving your property.',
        { align: 'left', lineGap: 4 }
      );

      doc.moveDown();

      // Property facts live on the joined `properties` row, not on `reports`
      // itself (see services/supabase.ts's getReport) — reports only stores
      // the valuation output.
      const property = report.properties || {};
      // Prefer the property's own address_components (authoritative) and
      // fall back to the country_code stashed on gemini_response at
      // report-generation time (see mobile's report.service.ts) for older
      // reports or a missing property join.
      const countryCode = property.address_components?.country_code || report.gemini_response?.country_code;

      // Property Information
      doc.fontSize(12).font('NotoSans').text('Property Information', {
        underline: true,
      });

      doc.fontSize(10).font('NotoSans');
      doc.text(`Address: ${property.address || report.address || 'N/A'}`);
      doc.text(`Bedrooms: ${property.bedrooms ?? 'N/A'}`);
      doc.text(`Bathrooms: ${property.bathrooms ?? 'N/A'}`);
      if (property.parking_spaces !== undefined && property.parking_spaces !== null) {
        doc.text(`Parking Spaces: ${property.parking_spaces}`);
      }
      doc.text(`Square Feet: ${property.square_feet ?? 'N/A'}`);
      doc.text(`Year Built: ${property.year_built ?? 'N/A'}`);
      doc.text(`Property Type: ${property.property_type || 'N/A'}`);
      doc.text(`Condition: ${property.condition || 'N/A'}`);

      doc.moveDown();

      // Valuation
      doc.fontSize(12).font('NotoSans').text('Estimated Valuation', {
        underline: true,
      });

      const estimatedValue = formatCurrency(report.estimated_value, countryCode);
      const lowEstimate = formatCurrency(report.confidence_range.low, countryCode);
      const highEstimate = formatCurrency(report.confidence_range.high, countryCode);

      doc.fontSize(16).font('NotoSans').fillColor('#2563EB').text(estimatedValue, {
        align: 'center',
      });

      doc.fontSize(10).fillColor('#000000').text(
        `Estimated Range: ${lowEstimate} - ${highEstimate}`,
        {
          align: 'center',
        }
      );

      doc.moveDown();

      // Full AI-generated narrative report (Executive Summary through
      // Disclaimer) — see report.service.ts's buildValuationPrompt on the
      // mobile side for what asks Gemini to produce this, and
      // buildMockReportMarkdown for the offline/no-key fallback. Older
      // reports created before this existed won't have the field.
      const fullReportMarkdown = report.gemini_response?.full_report_markdown;
      if (fullReportMarkdown) {
        renderNarrativeReport(doc, fullReportMarkdown);
        doc.moveDown();
      }

      // Comparable Sales
      doc.fontSize(12).font('NotoSans').text('Comparable Sales', {
        underline: true,
      });

      if (report.comparables && report.comparables.length > 0) {
        doc.fontSize(9).font('NotoSans');

        report.comparables.forEach((comp: any, index: number) => {
          doc.text(`${index + 1}. ${comp.address}`);
          doc.text(
            `   Sale Price: ${formatCurrency(comp.sale_price, countryCode)} | ` +
            `Date: ${comp.sale_date} | ` +
            `Similarity: ${(comp.similarity_score * 100).toFixed(0)}%`
          );
          doc.text(`   Distance: ${formatDistance(comp.distance_miles, countryCode)}`);
          doc.moveDown(0.3);
        });
      } else {
        doc.text('No comparable sales data available');
      }

      doc.moveDown();

      // Report Metadata
      doc.fontSize(8).fillColor('#6B7280').text(
        `Report ID: ${reportId} | Generated: ${new Date().toLocaleString()}`,
        {
          align: 'right',
        }
      );

      doc.fontSize(7).fillColor('#9CA3AF').text(
        'This report was generated by Appraisal Online. For more information, visit www.appraisalonline.com',
        {
          align: 'center',
        }
      );

      // Finalize PDF
      doc.end();
    });
  } catch (error) {
    logger.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Save PDF to temp storage
 */
export async function savePDF(reportId: string, pdfBuffer: Buffer): Promise<string> {
  try {
    const fileName = `report-${reportId}-${Date.now()}.pdf`;
    const filePath = path.join(PDF_TEMP_DIR, fileName);

    fs.writeFileSync(filePath, pdfBuffer);

    logger.info(`PDF saved: ${filePath}`);

    return filePath;
  } catch (error) {
    logger.error('Error saving PDF:', error);
    throw error;
  }
}

/**
 * Delete PDF from temp storage
 */
export function deletePDF(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`PDF deleted: ${filePath}`);
    }
  } catch (error) {
    logger.error('Error deleting PDF:', error);
  }
}

// ============================================================
// NARRATIVE MARKDOWN RENDERING
//
// Renders the AI's 10-section markdown report into the PDF. This is a
// deliberately small parser (headers, bullets, numbered lists, **bold**
// spans, and pipe tables) matched to what the prompt in the mobile app's
// report.service.ts actually asks Gemini to produce — not a general
// markdown-to-PDF library.
// ============================================================

function stripBold(text: string): string {
  return text.replace(/\*\*/g, '');
}

/** Renders one line of text, honoring inline **bold** spans. */
function renderInlineText(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: { fontSize?: number; indent?: number; color?: string } = {}
): void {
  const fontSize = opts.fontSize ?? 10;
  const color = opts.color ?? '#000000';
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter((s) => s.length > 0);

  doc.fontSize(fontSize).fillColor(color);
  if (segments.length === 0) {
    doc.text('', { indent: opts.indent });
    return;
  }
  segments.forEach((segment, i) => {
    const isBold = segment.startsWith('**') && segment.endsWith('**');
    const content = isBold ? segment.slice(2, -2) : segment;
    // Both branches use the same font — see FONT_PATH's comment above on
    // why a true bold weight isn't available here. **bold** markers are
    // still stripped so the asterisks themselves don't print.
    doc.font('NotoSans').text(content, {
      continued: i < segments.length - 1,
      indent: i === 0 ? opts.indent : undefined,
    });
  });
}

function renderTable(doc: PDFKit.PDFDocument, tableLines: string[]): void {
  const parseRow = (line: string) =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));

  let dataStart = 1;
  if (tableLines[1] && tableLines[1].includes('---')) dataStart = 2;

  const headers = parseRow(tableLines[0]);
  const rows = tableLines.slice(dataStart).map(parseRow).filter((r) => r.length > 0);
  if (headers.length === 0) return;

  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / headers.length;
  const rowHeight = 20;

  doc.moveDown(0.3);
  let y = doc.y;

  doc.rect(startX, y, usableWidth, rowHeight).fill('#2563EB');
  doc.fillColor('#FFFFFF').fontSize(8).font('NotoSans');
  headers.forEach((h, i) => {
    doc.text(stripBold(h), startX + i * colWidth + 4, y + 6, { width: colWidth - 8 });
  });
  y += rowHeight;

  doc.font('NotoSans').fontSize(8);
  rows.forEach((row, rIdx) => {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.rect(startX, y, usableWidth, rowHeight).fill(rIdx % 2 === 1 ? '#F5F5F5' : '#FFFFFF');
    doc.fillColor('#000000');
    row.forEach((cell, i) => {
      doc.text(stripBold(cell), startX + i * colWidth + 4, y + 6, { width: colWidth - 8 });
    });
    y += rowHeight;
  });

  doc.y = y + 8;
  doc.x = startX;
}

export function renderNarrativeReport(doc: PDFKit.PDFDocument, markdown: string): void {
  doc.fontSize(12).font('NotoSans').fillColor('#000000').text('Detailed Valuation Report', {
    underline: true,
  });
  doc.moveDown(0.3);

  const lines = markdown.split('\n');
  let tableLines: string[] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableLines.length >= 2) renderTable(doc, tableLines);
    tableLines = [];
    inTable = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      tableLines.push(line);
      inTable = true;
      continue;
    }
    if (inTable) flushTable();

    if (line.trim() === '') continue;

    if (/^###\s/.test(line)) {
      doc.moveDown(0.3);
      renderInlineText(doc, stripBold(line.replace(/^###\s*/, '')), { fontSize: 11, color: '#1F2937' });
      continue;
    }
    if (/^##\s/.test(line)) {
      doc.moveDown(0.5);
      doc.fontSize(13).font('NotoSans').fillColor('#2563EB').text(stripBold(line.replace(/^##\s*/, '')));
      continue;
    }
    if (/^#\s/.test(line)) {
      doc.moveDown(0.5);
      doc.fontSize(15).font('NotoSans').fillColor('#2563EB').text(stripBold(line.replace(/^#\s*/, '')));
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      renderInlineText(doc, `•  ${line.replace(/^\s*[-*]\s/, '')}`, { fontSize: 10, indent: 12 });
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      renderInlineText(doc, line.trim(), { fontSize: 10, indent: 12 });
      continue;
    }

    renderInlineText(doc, line, { fontSize: 10 });
  }
  flushTable();
}
