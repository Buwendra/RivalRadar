import { putItem } from '../../shared/db/queries';
import { changePK, changeSK, gsi1ChangeKeys } from '../../shared/db/keys';
import { generateId } from '../../shared/utils/id';
import { logger } from '../../shared/utils/logger';
import { DiffResult } from '../../shared/utils/diff';

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

interface Event {
  compId: string;
  userId: string;
  name: string;
  analyzedChanges: AnalyzedChange[];
}

interface StoredChange {
  changeId: string;
  significance: number;
  pageUrl: string;
  summary: string;
}

/**
 * Step Function Lambda: Store analyzed changes in DynamoDB.
 */
export const handler = async (event: Event): Promise<{ compId: string; userId: string; name: string; storedChanges: StoredChange[] }> => {
  const storedChanges: StoredChange[] = [];
  const now = new Date().toISOString();

  for (const change of event.analyzedChanges) {
    const changeId = generateId();

    await putItem({
      PK: changePK(event.compId),
      SK: changeSK(now),
      id: changeId,
      competitorId: event.compId,
      competitorName: event.name,
      userId: event.userId,
      snapshotId: change.snapshotId,
      pageUrl: change.pageUrl,
      diffSummary: change.diff.summary,
      significance: change.aiAnalysis.significanceScore,
      aiAnalysis: change.aiAnalysis,
      detectedAt: now,
      ...gsi1ChangeKeys(event.userId, now),
    });

    storedChanges.push({
      changeId,
      significance: change.aiAnalysis.significanceScore,
      pageUrl: change.pageUrl,
      summary: change.aiAnalysis.summary,
    });
  }

  logger.info('StoreChange completed', { compId: event.compId, storedCount: storedChanges.length });
  return { compId: event.compId, userId: event.userId, name: event.name, storedChanges };
};
