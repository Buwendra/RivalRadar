/**
 * Simple line-based diff utility for comparing snapshot content.
 * Returns the diff summary and a change percentage.
 */
export interface DiffResult {
  changePercent: number;
  addedLines: number;
  removedLines: number;
  summary: string;
  patch: string;
}

export function computeDiff(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const added: string[] = [];
  const removed: string[] = [];

  for (const line of newLines) {
    if (!oldSet.has(line) && line.trim()) added.push(line);
  }
  for (const line of oldLines) {
    if (!newSet.has(line) && line.trim()) removed.push(line);
  }

  const totalLines = Math.max(oldLines.length, newLines.length, 1);
  const changedLines = added.length + removed.length;
  const changePercent = Math.round((changedLines / totalLines) * 100);

  const patchLines: string[] = [];
  for (const line of removed.slice(0, 50)) patchLines.push(`- ${line}`);
  for (const line of added.slice(0, 50)) patchLines.push(`+ ${line}`);

  return {
    changePercent,
    addedLines: added.length,
    removedLines: removed.length,
    summary: `${added.length} lines added, ${removed.length} lines removed (${changePercent}% change)`,
    patch: patchLines.join('\n'),
  };
}
