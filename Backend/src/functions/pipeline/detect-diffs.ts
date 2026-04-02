import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { computeDiff, DiffResult } from '../../shared/utils/diff';
import { logger } from '../../shared/utils/logger';

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME!;

interface SnapshotInfo {
  pageUrl: string;
  currentS3Key: string;
  previousS3Key?: string;
  snapshotId: string;
}

interface Event {
  compId: string;
  userId: string;
  name: string;
  snapshots: SnapshotInfo[];
}

interface DiffInfo extends SnapshotInfo {
  hasChange: boolean;
  diff?: DiffResult;
}

/**
 * Step Function Lambda: Compare current vs previous snapshots and detect significant diffs.
 */
export const handler = async (event: Event): Promise<{ compId: string; userId: string; name: string; diffs: DiffInfo[] }> => {
  const diffs: DiffInfo[] = [];

  for (const snapshot of event.snapshots) {
    if (!snapshot.previousS3Key) {
      // First snapshot — no diff possible
      diffs.push({ ...snapshot, hasChange: false });
      continue;
    }

    const [currentContent, previousContent] = await Promise.all([
      getS3Content(snapshot.currentS3Key),
      getS3Content(snapshot.previousS3Key),
    ]);

    const diff = computeDiff(previousContent, currentContent);

    // Only flag as a change if >5% content changed
    const hasChange = diff.changePercent > 5;

    diffs.push({
      ...snapshot,
      hasChange,
      diff: hasChange ? diff : undefined,
    });

    if (hasChange) {
      logger.info('Change detected', {
        compId: event.compId,
        pageUrl: snapshot.pageUrl,
        changePercent: diff.changePercent,
      });
    }
  }

  const changesFound = diffs.filter((d) => d.hasChange).length;
  logger.info('DetectDiffs completed', { compId: event.compId, changesFound, totalPages: diffs.length });

  return { compId: event.compId, userId: event.userId, name: event.name, diffs };
};

async function getS3Content(key: string): Promise<string> {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  return (await result.Body?.transformToString()) ?? '';
}
