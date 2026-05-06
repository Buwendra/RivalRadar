/**
 * Scheduled Lambda — runs weekly (Saturday 7am UTC) to detect drift in the
 * OFAC SDN list (Phase 9b).
 *
 * The OFAC SDN list is a list of sanctioned individuals + entities. Our
 * `Backend/src/shared/utils/sanctions.ts` carries a hand-curated subset of
 * known sanctioned-domain hostnames; the official list is much larger and
 * doesn't always include website domains.
 *
 * Strategy: download the SDN XML, sha256 it, compare to the prior hash. On
 * change, publish an SNS message to the alerts topic so a human reviews +
 * curates `sanctions.ts`. We do NOT auto-mutate the hardcoded list — a
 * naive merge against the SDN XML would produce false positives (the list
 * names individuals, not domains).
 *
 * Persistence: single row at PK=OFAC_SDN, SK=META. Stores `lastHash`,
 * `previousHash`, `lastFetchedAt`, `bytes` for forensic context.
 */

import { createHash } from 'crypto';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { getItem, putItem } from '../../shared/db/queries';
import { ofacSdnPK, ofacSdnSK } from '../../shared/db/keys';
import { logger } from '../../shared/utils/logger';

const SDN_URL = 'https://www.treasury.gov/ofac/downloads/sdn.xml';
const sns = new SNSClient({});

interface OfacSdnRow {
  lastFetchedAt: string;
  lastHash: string;
  previousHash?: string;
  bytes: number;
}

interface Result {
  fetchedBytes: number;
  changed: boolean;
  alertedSns: boolean;
}

export const handler = async (): Promise<Result> => {
  const alertsTopicArn = process.env.ALERTS_TOPIC_ARN;
  if (!alertsTopicArn) {
    logger.warn('refresh-ofac-sdn: ALERTS_TOPIC_ARN not set — drift will be detected but not alerted');
  }

  // Fetch the SDN XML. treasury.gov is generally fast + uncached but the
  // file is ~10 MB; fetch() with default timeouts is fine.
  let body: string;
  try {
    const resp = await fetch(SDN_URL, {
      headers: { 'User-Agent': 'RivalScan-OFAC-SDN-Drift-Detector/1.0' },
    });
    if (!resp.ok) {
      throw new Error(`OFAC SDN fetch returned HTTP ${resp.status}`);
    }
    body = await resp.text();
  } catch (err) {
    logger.error('refresh-ofac-sdn: fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err; // propagate so the Phase 1 any-error alarm pages
  }

  const bytes = Buffer.byteLength(body, 'utf8');
  const hash = createHash('sha256').update(body).digest('hex');

  // Read prior row
  const prior = await getItem<OfacSdnRow>(ofacSdnPK(), ofacSdnSK());
  const priorHash = prior?.lastHash;

  if (priorHash && priorHash === hash) {
    logger.info('ofac_sdn_unchanged', { bytes, hash: hash.slice(0, 16) });
    return { fetchedBytes: bytes, changed: false, alertedSns: false };
  }

  const now = new Date().toISOString();
  const row: OfacSdnRow = {
    lastFetchedAt: now,
    lastHash: hash,
    ...(priorHash ? { previousHash: priorHash } : {}),
    bytes,
  };
  await putItem({
    PK: ofacSdnPK(),
    SK: ofacSdnSK(),
    ...row,
  });

  // First-run case: no prior hash → log baseline but don't alert (avoid
  // a noise alert on the very first deploy).
  const isFirstRun = !priorHash;
  if (isFirstRun) {
    logger.info('ofac_sdn_baseline_recorded', { bytes, hash: hash.slice(0, 16) });
    return { fetchedBytes: bytes, changed: true, alertedSns: false };
  }

  logger.info('ofac_sdn_drift_detected', {
    bytes,
    priorHash: priorHash.slice(0, 16),
    newHash: hash.slice(0, 16),
  });

  // Publish to the alerts topic for human review
  let alertedSns = false;
  if (alertsTopicArn) {
    try {
      await sns.send(
        new PublishCommand({
          TopicArn: alertsTopicArn,
          Subject: 'OFAC SDN list changed — review sanctions.ts',
          Message:
            'The OFAC SDN list at https://www.treasury.gov/ofac/downloads/sdn.xml has changed.\n\n' +
            `Prior hash: ${priorHash}\n` +
            `New hash:   ${hash}\n` +
            `New size:   ${bytes} bytes\n` +
            `Detected:   ${now}\n\n` +
            'Please review Backend/src/shared/utils/sanctions.ts and update the hardcoded ' +
            'SANCTIONED_DOMAINS list if any newly-sanctioned entities have a website not yet covered.',
        })
      );
      alertedSns = true;
    } catch (err) {
      logger.warn('refresh-ofac-sdn: SNS publish failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { fetchedBytes: bytes, changed: true, alertedSns };
};
