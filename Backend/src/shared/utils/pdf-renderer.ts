/**
 * PDF rendering for the weekly briefing export (Phase 6b).
 *
 * Pure JS via PDFKit — no chromium binary, no external API. Output is a
 * structured business doc rather than a marketing brochure. The renderer
 * is a single function that takes already-aggregated input and returns a
 * Buffer; the Lambda handler is responsible for data fetching + S3 upload.
 *
 * Layout (all single PDF, multi-page):
 *   1. Cover  — Kironyx title + dateRange + "Prepared for X" + confidential stamp
 *   2. Threat-ranked competitor table
 *   3. Top changes section (top 10 by significance)
 *   4. Recommended actions section (top 5)
 *   5. Per-page footer with page number + AI disclaimer
 *
 * Swap-out path: if we later need fancier output, replace this file's
 * implementation with a Puppeteer HTML→PDF call. The exported function
 * signature stays the same.
 */

import PDFDocument from 'pdfkit';
import type { Momentum, ThreatLevel } from '../types';

interface CompetitorRow {
  name: string;
  url: string;
  threatLevel?: ThreatLevel;
  threatReasoning?: string;
  momentum?: Momentum;
  derivedTags?: string[];
}

interface ChangeRow {
  competitorName: string;
  detectedAt: string;
  changeType: string;
  significance: number;
  summary: string;
  strategicImplication?: string;
}

interface RecommendationRow {
  title: string;
  body: string;
  category: string;
  timeHorizon: string;
  confidence: number;
}

export interface RenderBriefingInput {
  user: { name: string; companyName?: string; industry?: string };
  weekRange: { start: string; end: string };
  competitors: CompetitorRow[];
  topChanges: ChangeRow[];
  recommendations: RecommendationRow[];
}

// Color palette — matches the email template + dashboard.
const COLOR = {
  brand: '#1e3a5f',
  brandLight: '#2563eb',
  textPrimary: '#0f172a',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  bgSubtle: '#f9fafb',
  significanceHigh: '#dc2626',
  significanceMid: '#d97706',
  significanceLow: '#059669',
  threatCritical: '#dc2626',
  threatHigh: '#ea580c',
  threatMedium: '#d97706',
  threatLow: '#ca8a04',
  threatMonitor: '#6b7280',
} as const;

const THREAT_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  monitor: 4,
};

const THREAT_COLOR: Record<string, string> = {
  critical: COLOR.threatCritical,
  high: COLOR.threatHigh,
  medium: COLOR.threatMedium,
  low: COLOR.threatLow,
  monitor: COLOR.threatMonitor,
};

function significanceColor(score: number): string {
  if (score >= 8) return COLOR.significanceHigh;
  if (score >= 5) return COLOR.significanceMid;
  return COLOR.significanceLow;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Draw a small colored chip with white text. Returns the right-edge X
 * coordinate so the caller can chain follow-up text.
 */
function drawChip(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  bgColor: string
): number {
  doc.fontSize(8).font('Helvetica-Bold');
  const textWidth = doc.widthOfString(text);
  const padding = 4;
  const width = textWidth + padding * 2;
  const height = 12;
  doc.save();
  doc.fillColor(bgColor).rect(x, y, width, height).fill();
  doc.fillColor('#ffffff').text(text, x + padding, y + 2, { width: textWidth + 1, lineBreak: false });
  doc.restore();
  return x + width;
}

/**
 * Per-page footer + page number. Called via PDFKit's `pageAdded` event so it
 * fires for every page (including ones added implicitly when content overflows).
 */
function drawFooter(doc: InstanceType<typeof PDFDocument>, pageNumber: number): void {
  const margin = 50;
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  const y = pageHeight - margin + 8;

  doc.save();
  doc.strokeColor(COLOR.border).lineWidth(0.5);
  doc.moveTo(margin, y - 8).lineTo(pageWidth - margin, y - 8).stroke();

  doc.fillColor(COLOR.textMuted).fontSize(7).font('Helvetica');
  doc.text(
    'AI-generated analysis. May contain errors. For internal evaluation only — not legal or financial advice.',
    margin,
    y,
    { width: pageWidth - margin * 2 - 60, lineBreak: false }
  );
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 50, y, {
    width: 50,
    align: 'right',
    lineBreak: false,
  });
  doc.restore();
}

export async function renderBriefingPdf(input: RenderBriefingInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: 'Kironyx Weekly Briefing',
          Author: 'Kironyx',
          Subject: 'Competitive Intelligence Briefing',
          Creator: 'Kironyx',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let pageNumber = 1;
      // Footer on first page (drawn at the end after content)
      doc.on('pageAdded', () => {
        pageNumber += 1;
        drawFooter(doc, pageNumber);
      });

      // ─── Cover ───
      doc
        .fillColor(COLOR.brand)
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('Kironyx', 50, 80);
      doc
        .fillColor(COLOR.textMuted)
        .fontSize(12)
        .font('Helvetica')
        .text('Weekly Competitive Briefing', 50, 115);

      doc.moveTo(50, 145).lineTo(560, 145).strokeColor(COLOR.border).lineWidth(0.5).stroke();

      const dateRange = `${formatDate(input.weekRange.start)} — ${formatDate(input.weekRange.end)}`;
      doc.fillColor(COLOR.textPrimary).fontSize(11).font('Helvetica').text(dateRange, 50, 165);

      if (input.user.companyName) {
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(10)
          .text(
            `Prepared for ${input.user.companyName}${input.user.industry ? ` · ${input.user.industry}` : ''}`,
            50,
            185
          );
      }

      doc
        .fillColor(COLOR.textMuted)
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text('CONFIDENTIAL — INTERNAL EVALUATION ONLY', 50, 210);

      // ─── Section 1: Threat-ranked competitors ───
      doc.moveDown(3);
      sectionHeader(doc, 'Competitor Portfolio');

      const sortedCompetitors = [...input.competitors].sort(
        (a, b) =>
          (THREAT_RANK[a.threatLevel ?? ''] ?? 99) -
          (THREAT_RANK[b.threatLevel ?? ''] ?? 99)
      );

      if (sortedCompetitors.length === 0) {
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text('No competitors tracked yet.', 50, doc.y + 6);
      } else {
        // Manual table — PDFKit has no table widget. Layout: name (col 1, ~150px),
        // threat (col 2, ~80px), momentum (col 3, ~80px), tags (col 4, fill).
        const rowHeight = 22;
        const startX = 50;
        const cols = [
          { x: 50, w: 150, label: 'Competitor' },
          { x: 210, w: 80, label: 'Threat' },
          { x: 300, w: 80, label: 'Momentum' },
          { x: 390, w: 170, label: 'Tags' },
        ];

        let cursorY = doc.y + 8;
        // Header row
        doc.save();
        doc.fillColor(COLOR.bgSubtle).rect(startX, cursorY, 510, rowHeight).fill();
        doc.restore();
        for (const col of cols) {
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica-Bold')
            .text(col.label.toUpperCase(), col.x + 4, cursorY + 7, {
              width: col.w - 8,
              lineBreak: false,
            });
        }
        cursorY += rowHeight;

        // Data rows
        for (const c of sortedCompetitors) {
          // Page break check — leave room for footer
          if (cursorY + rowHeight > 720) {
            doc.addPage();
            cursorY = 70;
          }

          doc
            .strokeColor(COLOR.border)
            .lineWidth(0.5)
            .moveTo(startX, cursorY)
            .lineTo(startX + 510, cursorY)
            .stroke();

          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(c.name, cols[0].x + 4, cursorY + 6, {
              width: cols[0].w - 8,
              lineBreak: false,
              ellipsis: true,
            });

          if (c.threatLevel) {
            drawChip(
              doc,
              c.threatLevel.toUpperCase(),
              cols[1].x + 4,
              cursorY + 5,
              THREAT_COLOR[c.threatLevel] ?? COLOR.threatMonitor
            );
          } else {
            doc
              .fillColor(COLOR.textMuted)
              .fontSize(9)
              .font('Helvetica')
              .text('—', cols[1].x + 4, cursorY + 6);
          }

          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(9)
            .font('Helvetica')
            .text(c.momentum ?? '—', cols[2].x + 4, cursorY + 6, {
              width: cols[2].w - 8,
              lineBreak: false,
            });

          const tagText = (c.derivedTags ?? []).slice(0, 3).join(', ') || '—';
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica')
            .text(tagText, cols[3].x + 4, cursorY + 7, {
              width: cols[3].w - 8,
              lineBreak: false,
              ellipsis: true,
            });

          cursorY += rowHeight;
        }
        doc
          .strokeColor(COLOR.border)
          .lineWidth(0.5)
          .moveTo(startX, cursorY)
          .lineTo(startX + 510, cursorY)
          .stroke();
        doc.y = cursorY + 8;
      }

      // ─── Section 2: Top changes ───
      doc.moveDown(2);
      ensureRoom(doc, 100);
      sectionHeader(doc, 'Top Changes This Week');

      const top10 = [...input.topChanges]
        .sort((a, b) => b.significance - a.significance)
        .slice(0, 10);

      if (top10.length === 0) {
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text('No significant changes detected this week.', 50, doc.y + 6);
      } else {
        for (const c of top10) {
          ensureRoom(doc, 80);
          const yStart = doc.y + 8;

          // Significance score chip
          drawChip(doc, `${c.significance}/10`, 50, yStart, significanceColor(c.significance));
          // Change type chip
          drawChip(doc, c.changeType.toUpperCase(), 90, yStart, COLOR.brandLight);
          // Date
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica')
            .text(formatDate(c.detectedAt), 450, yStart + 2, {
              width: 110,
              align: 'right',
              lineBreak: false,
            });

          // Title row: competitor name (bold) + summary
          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(c.competitorName, 50, yStart + 18, { lineBreak: false });

          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(10)
            .font('Helvetica')
            .text(c.summary, 50, yStart + 33, { width: 510 });

          if (c.strategicImplication) {
            doc
              .fillColor(COLOR.textMuted)
              .fontSize(9)
              .font('Helvetica-Oblique')
              .text(`Implication: ${c.strategicImplication}`, 50, doc.y + 4, {
                width: 510,
              });
          }

          // Divider after each entry
          doc
            .strokeColor(COLOR.border)
            .lineWidth(0.5)
            .moveTo(50, doc.y + 8)
            .lineTo(560, doc.y + 8)
            .stroke();
          doc.y += 16;
        }
      }

      // ─── Section 3: Recommended actions ───
      doc.moveDown(2);
      ensureRoom(doc, 100);
      sectionHeader(doc, 'Recommended Actions');

      const top5 = input.recommendations.slice(0, 5);

      if (top5.length === 0) {
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text(
            'No active recommendations. New ones generate weekly with the digest.',
            50,
            doc.y + 6
          );
      } else {
        for (let i = 0; i < top5.length; i++) {
          const r = top5[i];
          ensureRoom(doc, 80);
          const yStart = doc.y + 6;

          // Number + title
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`${i + 1}.`, 50, yStart, { lineBreak: false });
          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(r.title, 70, yStart, { width: 490 });

          // Metadata line
          const metaY = doc.y + 2;
          drawChip(doc, r.category.toUpperCase(), 70, metaY, COLOR.brandLight);
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica')
            .text(
              `   ·   ${r.timeHorizon}   ·   ${Math.round(r.confidence * 100)}% confidence`,
              130,
              metaY + 2,
              { lineBreak: false }
            );

          doc.y = metaY + 18;
          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(10)
            .font('Helvetica')
            .text(r.body, 70, doc.y, { width: 490 });

          doc
            .strokeColor(COLOR.border)
            .lineWidth(0.5)
            .moveTo(70, doc.y + 6)
            .lineTo(560, doc.y + 6)
            .stroke();
          doc.y += 16;
        }
      }

      // Footer on the first page (subsequent pages auto-handled by `pageAdded`)
      drawFooter(doc, 1);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Section header with the brand-colored band on the left + bold heading text.
 * Advances doc.y to just below the heading so callers can text() right after.
 */
function sectionHeader(doc: InstanceType<typeof PDFDocument>, title: string): void {
  const x = 50;
  const y = doc.y;
  doc.save();
  doc.fillColor(COLOR.brand).rect(x, y, 4, 18).fill();
  doc
    .fillColor(COLOR.brand)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(title, x + 12, y + 1, { lineBreak: false });
  doc.restore();
  doc.y = y + 22;
}

/**
 * Insert a page break if the remaining vertical space is less than `needed`.
 * Used before each block of variable height (table row, change entry, rec).
 */
function ensureRoom(doc: InstanceType<typeof PDFDocument>, needed: number): void {
  const pageBottom = doc.page.height - 70; // leave room for footer
  if (doc.y + needed > pageBottom) {
    doc.addPage();
    doc.y = 60;
  }
}
