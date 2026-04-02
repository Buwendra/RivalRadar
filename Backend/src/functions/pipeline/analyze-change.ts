import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { analyzeChange } from '../../shared/services/anthropic';
import { logger } from '../../shared/utils/logger';
import { DiffResult } from '../../shared/utils/diff';

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME!;

interface DiffInfo {
  pageUrl: string;
  currentS3Key: string;
  previousS3Key?: string;
  snapshotId: string;
  hasChange: boolean;
  diff?: DiffResult;
}

interface Event {
  compId: string;
  userId: string;
  name: string;
  diffs: DiffInfo[];
}

interface AnalyzedChange {
  pageUrl: string;
  snapshotId: string;
  diff: DiffResult;
  aiAnalysis: {
    changeType: string;
    summary: string;
    significanceScore: number;
    strategicImplication: string;
    recommendedAction: string;
  };
}

/**
 * Step Function Lambda: Run Claude Haiku AI analysis on detected changes.
 */
export const handler = async (event: Event): Promise<{ compId: string; userId: string; name: string; analyzedChanges: AnalyzedChange[] }> => {
  const analyzedChanges: AnalyzedChange[] = [];

  const changesWithDiffs = event.diffs.filter((d) => d.hasChange && d.diff);

  for (const change of changesWithDiffs) {
    try {
      // Fetch content for context
      const [currentContent, previousContent] = await Promise.all([
        getS3Content(change.currentS3Key),
        change.previousS3Key ? getS3Content(change.previousS3Key) : Promise.resolve(''),
      ]);

      const analysis = await analyzeChange(
        event.name,
        change.pageUrl,
        previousContent,
        currentContent,
        change.diff!.patch
      );

      analyzedChanges.push({
        pageUrl: change.pageUrl,
        snapshotId: change.snapshotId,
        diff: change.diff!,
        aiAnalysis: analysis,
      });

      logger.info('Change analyzed', {
        compId: event.compId,
        pageUrl: change.pageUrl,
        significance: analysis.significanceScore,
        changeType: analysis.changeType,
      });
    } catch (err) {
      logger.error('AI analysis failed', { compId: event.compId, pageUrl: change.pageUrl, error: String(err) });
    }
  }

  return { compId: event.compId, userId: event.userId, name: event.name, analyzedChanges };
};

async function getS3Content(key: string): Promise<string> {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  return (await result.Body?.transformToString()) ?? '';
}
