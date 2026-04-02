import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { putItem, queryByPK } from '../../shared/db/queries';
import { snapshotPK, snapshotSK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';
import { generateId } from '../../shared/utils/id';

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME!;

interface PageData {
  pageUrl: string;
  markdown: string;
  success: boolean;
}

interface Event {
  compId: string;
  userId: string;
  name: string;
  pages: PageData[];
}

interface SnapshotInfo {
  pageUrl: string;
  currentS3Key: string;
  previousS3Key?: string;
  snapshotId: string;
}

/**
 * Step Function Lambda: Store scraped content to S3 and metadata to DynamoDB.
 * Returns current and previous S3 keys for diffing.
 */
export const handler = async (event: Event): Promise<{ compId: string; userId: string; name: string; snapshots: SnapshotInfo[] }> => {
  const now = new Date().toISOString();
  const snapshots: SnapshotInfo[] = [];

  for (const page of event.pages) {
    if (!page.success || !page.markdown) continue;

    const snapshotId = generateId();
    const s3Key = `snapshots/${event.compId}/${snapshotId}.md`;

    // Upload current content to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: page.markdown,
        ContentType: 'text/markdown',
      })
    );

    // Find previous snapshot for this page
    const { items: prevSnapshots } = await queryByPK(
      snapshotPK(event.compId),
      `SNAP#${hashPage(page.pageUrl)}`,
      { limit: 1, scanForward: false }
    );

    const previousS3Key = prevSnapshots.length > 0 ? (prevSnapshots[0].s3Key as string) : undefined;

    // Store snapshot metadata in DynamoDB
    await putItem({
      PK: snapshotPK(event.compId),
      SK: snapshotSK(page.pageUrl, now),
      id: snapshotId,
      competitorId: event.compId,
      pageUrl: page.pageUrl,
      s3Key,
      capturedAt: now,
    });

    snapshots.push({
      pageUrl: page.pageUrl,
      currentS3Key: s3Key,
      previousS3Key,
      snapshotId,
    });
  }

  logger.info('StoreSnapshots completed', { compId: event.compId, storedCount: snapshots.length });
  return { compId: event.compId, userId: event.userId, name: event.name, snapshots };
};

function hashPage(pageUrl: string): string {
  const { createHash } = require('crypto');
  return createHash('md5').update(pageUrl).digest('hex').slice(0, 8);
}
