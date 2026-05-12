/**
 * Per-competitor battlecard PDF (Phase 20).
 *
 * One A4-letter page summarising a single competitor for a sales-call
 * handoff. Reads only data already loaded by `GET /competitors/{id}` —
 * no fresh Claude calls. Sister of `pdf-renderer.ts` (Phase 6b weekly
 * briefing); shares the color palette + chip helper but keeps a separate
 * file so layout drift doesn't break either output.
 */

import PDFDocument from 'pdfkit';
import type {
  Momentum,
  ThreatLevel,
  DerivedState,
  PredictedMove,
  WinAgainstTactic,
  WinAgainstImpact,
} from '../types';

interface BattlecardChange {
  detectedAt: string;
  significance: number;
  changeType?: string;
  summary?: string;
  pageUrl?: string;
}

interface BattlecardCitation {
  url: string;
  title?: string;
}

export interface RenderBattlecardInput {
  competitor: {
    name: string;
    url: string;
    threatLevel?: ThreatLevel;
    threatReasoning?: string;
    momentum?: Momentum;
    momentumChangePercent?: number;
    derivedTags?: string[];
    predictedMoves?: PredictedMove[];
    winAgainstTactics?: WinAgainstTactic[];
  };
  recentChanges: BattlecardChange[];
  derivedState?: DerivedState;
  citations: BattlecardCitation[];
  latestResearchAt?: string;
  generatedAt: string;
  /** Workspace name shown in the header — `undefined` for personal workspaces. */
  workspaceName?: string;
}

const COLOR = {
  brand: '#1e3a5f',
  brandLight: '#2563eb',
  textPrimary: '#0f172a',
  textMuted: '#6b7280',
  textSubtle: '#94a3b8',
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

function impactColor(impact: WinAgainstImpact): string {
  if (impact === 'high') return COLOR.brand;
  if (impact === 'medium') return COLOR.brandLight;
  return COLOR.textMuted;
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

function humanize(value: string | undefined): string {
  if (!value || value === 'unknown') return '—';
  return value
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Char-level pre-truncation guard for long Claude-generated text fields.
 * Belt-and-braces with PDFKit's `height` clip on the text() call: even
 * if the height-clip misbehaves on an unusually narrow column, the input
 * is already bounded.
 */
function truncate(value: string | undefined, max: number): string {
  if (!value) return '';
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + '…';
}

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
  doc
    .fillColor('#ffffff')
    .text(text, x + padding, y + 2, { width: textWidth + 1, lineBreak: false });
  doc.restore();
  return x + width;
}

export async function renderBattlecardPdf(
  input: RenderBattlecardInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `RivalScan Battlecard — ${input.competitor.name}`,
          Author: 'RivalScan',
          Subject: `Competitor battlecard: ${input.competitor.name}`,
          Creator: 'RivalScan',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;

      // ─── Header strip ───
      doc
        .fillColor(COLOR.brand)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('RIVALSCAN BATTLECARD', margin, 50);

      doc
        .fillColor(COLOR.textMuted)
        .fontSize(8)
        .font('Helvetica')
        .text(
          `Generated ${formatDate(input.generatedAt)}${
            input.workspaceName ? ` · ${input.workspaceName}` : ''
          }`,
          margin,
          64
        );

      doc
        .fillColor(COLOR.textPrimary)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(input.competitor.name, margin, 84);

      doc
        .fillColor(COLOR.brandLight)
        .fontSize(10)
        .font('Helvetica')
        .text(input.competitor.url, margin, 114, { link: input.competitor.url });

      // Threat-level chip, top right. The reasoning is intentionally not
      // rendered in the header — it can be 200-400 chars (Claude output)
      // and a narrow column overflows down through every section below.
      // The threat level chip + the dashboard's ThreatCard cover the rest.
      if (input.competitor.threatLevel) {
        const chipColor =
          THREAT_COLOR[input.competitor.threatLevel] ?? COLOR.threatMonitor;
        const chipText = `${input.competitor.threatLevel.toUpperCase()} THREAT`;
        const chipX = pageWidth - margin - 150;
        drawChip(doc, chipText, chipX, 50, chipColor);
      }

      doc
        .moveTo(margin, 132)
        .lineTo(pageWidth - margin, 132)
        .strokeColor(COLOR.border)
        .lineWidth(0.5)
        .stroke();

      // ─── At-a-glance row ───
      const glanceY = 145;
      const glanceCols = [
        {
          label: 'MOMENTUM',
          value: humanize(input.competitor.momentum),
          extra:
            typeof input.competitor.momentumChangePercent === 'number'
              ? `${
                  input.competitor.momentumChangePercent > 0 ? '+' : ''
                }${input.competitor.momentumChangePercent}%`
              : undefined,
        },
        {
          label: 'RECENT ACTIVITY',
          value: `${input.recentChanges.length} change${
            input.recentChanges.length === 1 ? '' : 's'
          }`,
          extra: 'past 30 days',
        },
        {
          label: 'LAST RESEARCH',
          value: input.latestResearchAt
            ? formatDate(input.latestResearchAt)
            : 'No research yet',
        },
      ];
      const glanceColWidth = contentWidth / glanceCols.length;
      glanceCols.forEach((col, i) => {
        const x = margin + i * glanceColWidth;
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(7)
          .font('Helvetica-Bold')
          .text(col.label, x, glanceY, { width: glanceColWidth });
        doc
          .fillColor(COLOR.textPrimary)
          .fontSize(13)
          .font('Helvetica-Bold')
          .text(col.value, x, glanceY + 11, { width: glanceColWidth });
        if (col.extra) {
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica')
            .text(col.extra, x, glanceY + 28, { width: glanceColWidth });
        }
      });

      // Tags row
      const tagsY = 195;
      if (input.competitor.derivedTags && input.competitor.derivedTags.length > 0) {
        let chipX = margin;
        for (const tag of input.competitor.derivedTags.slice(0, 6)) {
          chipX = drawChip(doc, tag.toUpperCase(), chipX, tagsY, COLOR.brandLight) + 6;
        }
      }

      // ─── Derived state grid ───
      const stateY = 225;
      sectionHeader(doc, 'Strategic snapshot', margin, stateY);

      const stateCells: Array<{ label: string; value: string }> = [
        { label: 'Stage', value: humanize(input.derivedState?.stage) },
        { label: 'Funding', value: humanize(input.derivedState?.fundingState) },
        { label: 'Hiring', value: humanize(input.derivedState?.hiringState) },
        {
          label: 'Direction',
          value: humanize(input.derivedState?.strategicDirection),
        },
        { label: 'Tech', value: humanize(input.derivedState?.techPositioning) },
        { label: 'Pacing', value: humanize(input.derivedState?.pacing) },
      ];
      const gridStartY = stateY + 28;
      const gridCols = 3;
      const gridCellW = contentWidth / gridCols;
      const gridCellH = 36;
      stateCells.forEach((cell, i) => {
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const x = margin + col * gridCellW;
        const y = gridStartY + row * gridCellH;
        doc
          .strokeColor(COLOR.border)
          .lineWidth(0.5)
          .rect(x, y, gridCellW, gridCellH)
          .stroke();
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(7)
          .font('Helvetica-Bold')
          .text(cell.label.toUpperCase(), x + 8, y + 6, { width: gridCellW - 16 });
        doc
          .fillColor(COLOR.textPrimary)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(cell.value, x + 8, y + 18, { width: gridCellW - 16 });
      });

      // ─── Recent activity ───
      const activityY = gridStartY + 2 * gridCellH + 18;
      sectionHeader(doc, 'Recent activity', margin, activityY);

      let cursorY = activityY + 28;
      const top5 = [...input.recentChanges]
        .sort((a, b) => (b.significance ?? 0) - (a.significance ?? 0))
        .slice(0, 5);

      if (top5.length === 0) {
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text('No tracked changes yet.', margin, cursorY);
        cursorY += 18;
      } else {
        for (const c of top5) {
          // Each row: header strip (12px) + summary clipped to 2 lines (~22px) + 4px gap.
          if (cursorY + 38 > 700) break;
          drawChip(
            doc,
            `${c.significance}/10`,
            margin,
            cursorY,
            significanceColor(c.significance)
          );
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica')
            .text(formatDate(c.detectedAt), margin + 50, cursorY + 2, {
              width: 80,
              lineBreak: false,
            });
          if (c.changeType) {
            drawChip(doc, c.changeType.toUpperCase(), margin + 130, cursorY, COLOR.brandLight);
          }
          // Summary: wraps within contentWidth, clipped to 22px (~2 lines at 9pt)
          // so a long Claude summary can't push subsequent rows off-page.
          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(9)
            .font('Helvetica')
            .text(truncate(c.summary ?? '(no summary)', 180), margin, cursorY + 16, {
              width: contentWidth,
              height: 22,
              ellipsis: true,
            });
          cursorY += 38;
        }
      }

      // ─── Predicted moves ───
      const movesY = cursorY + 8;
      sectionHeader(doc, 'Predicted moves', margin, movesY);
      cursorY = movesY + 28;

      // Trimmed from 4 → 3 in Phase 21 to make room for the win-against
      // tactics section while keeping the battlecard one A4 page.
      const moves = (input.competitor.predictedMoves ?? []).slice(0, 3);
      if (moves.length === 0) {
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text('No predictions yet — predictions appear after the next research run.', margin, cursorY);
        cursorY += 16;
      } else {
        for (const m of moves) {
          // Header (12px) + reasoning clipped to 2 lines (~20px) + 4px gap.
          if (cursorY + 36 > 720) break;
          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(`• ${m.move}`, margin, cursorY, {
              width: contentWidth - 90,
              lineBreak: false,
              ellipsis: true,
            });
          drawChip(
            doc,
            `${Math.round(m.probability * 100)}% · ${m.timeHorizon}`,
            pageWidth - margin - 90,
            cursorY,
            COLOR.brand
          );
          // Reasoning: pre-truncate at the char level so we never hand
          // PDFKit text that would overflow the 2-line height clip.
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica-Oblique')
            .text(truncate(m.reasoning, 200), margin + 10, cursorY + 12, {
              width: contentWidth - 20,
              height: 20,
              ellipsis: true,
            });
          cursorY += 36;
        }
      }

      // ─── Win-against tactics (Phase 21) ───
      const tacticsY = cursorY + 8;
      sectionHeader(doc, 'Win-against tactics', margin, tacticsY);
      cursorY = tacticsY + 28;

      const tactics = (input.competitor.winAgainstTactics ?? []).slice(0, 3);
      if (tactics.length === 0) {
        doc
          .fillColor(COLOR.textMuted)
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text(
            'Tactics will populate after the next research cycle. Regenerate this battlecard to refresh.',
            margin,
            cursorY,
            { width: contentWidth }
          );
        cursorY += 16;
      } else {
        for (const t of tactics) {
          // Header (12px) + reasoning clipped to 2 lines (~20px) + 4px gap.
          if (cursorY + 36 > 720) break;
          // Tactic line + impact chip on the right
          doc
            .fillColor(COLOR.textPrimary)
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(`▸ ${t.tactic}`, margin, cursorY, {
              width: contentWidth - 90,
              lineBreak: false,
              ellipsis: true,
            });
          drawChip(
            doc,
            `${t.impact.toUpperCase()} · ${t.difficulty.toUpperCase()}`,
            pageWidth - margin - 90,
            cursorY,
            impactColor(t.impact)
          );
          // Reasoning: same truncation pattern as predicted moves.
          doc
            .fillColor(COLOR.textMuted)
            .fontSize(8)
            .font('Helvetica-Oblique')
            .text(truncate(t.reasoning, 200), margin + 10, cursorY + 12, {
              width: contentWidth - 20,
              height: 20,
              ellipsis: true,
            });
          cursorY += 36;
        }
      }

      // ─── Citations ───
      const citationY = Math.max(cursorY + 6, 690);
      doc
        .strokeColor(COLOR.border)
        .lineWidth(0.5)
        .moveTo(margin, citationY)
        .lineTo(pageWidth - margin, citationY)
        .stroke();
      doc
        .fillColor(COLOR.textMuted)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('SOURCES', margin, citationY + 6);
      const seen = new Set<string>();
      const uniqueCitations = input.citations.filter((c) => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      });
      doc
        .fillColor(COLOR.textSubtle)
        .fontSize(7)
        .font('Helvetica')
        .text(
          uniqueCitations.slice(0, 6).map((c) => c.url).join(' · ') ||
            'No citations available.',
          margin,
          citationY + 18,
          { width: contentWidth }
        );

      // ─── Footer ───
      const footerY = doc.page.height - margin + 8;
      doc
        .fillColor(COLOR.textMuted)
        .fontSize(7)
        .font('Helvetica-Oblique')
        .text(
          'AI-generated analysis. May contain errors. For internal evaluation only — not legal or financial advice.',
          margin,
          footerY,
          { width: contentWidth - 60, lineBreak: false }
        );
      doc
        .fillColor(COLOR.brand)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('rivalscan.com', pageWidth - margin - 60, footerY, {
          width: 60,
          align: 'right',
          lineBreak: false,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sectionHeader(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  x: number,
  y: number
): void {
  doc.save();
  doc.fillColor(COLOR.brand).rect(x, y, 3, 16).fill();
  doc
    .fillColor(COLOR.brand)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(title, x + 10, y + 1, { lineBreak: false });
  doc.restore();
}
