import { describe, expect, it } from 'vitest';
import { capabilitiesFor, hasCapability } from './capability';

describe('capabilitiesFor', () => {
  it('defaults to scout when the user is undefined', () => {
    const caps = capabilitiesFor(undefined);
    expect(caps.pdfExports).toBe(false);
    expect(caps.recommendations.maxVisible).toBe(3);
    expect(caps.seats.max).toBe(1);
  });

  it('returns the tier matrix for each plan', () => {
    expect(capabilitiesFor({ plan: 'scout' }).apiAccess).toBe(false);
    expect(capabilitiesFor({ plan: 'strategist' }).apiAccess).toBe(true);
    expect(capabilitiesFor({ plan: 'command' }).customRecommendationCategories).toBe(true);
  });

  it('exposes numeric capacity flags per tier', () => {
    expect(capabilitiesFor({ plan: 'scout' }).savedViews.max).toBe(0);
    expect(capabilitiesFor({ plan: 'strategist' }).recommendations.maxVisible).toBe(10);
    expect(capabilitiesFor({ plan: 'command' }).recommendations.maxVisible).toBe(-1); // unlimited
    expect(capabilitiesFor({ plan: 'command' }).apiKeys.max).toBe(25);
  });
});

describe('hasCapability', () => {
  it('gates Strategist+ features off on scout', () => {
    expect(hasCapability({ plan: 'scout' }, 'pdfExports')).toBe(false);
    expect(hasCapability({ plan: 'scout' }, 'csvExports')).toBe(false);
    expect(hasCapability({ plan: 'scout' }, 'slackIntegration')).toBe(false);
    expect(hasCapability({ plan: 'scout' }, 'apiAccess')).toBe(false);
    expect(hasCapability({ plan: 'scout' }, 'audioBriefing')).toBe(false);
    expect(hasCapability({ plan: 'scout' }, 'comparatorMatrix')).toBe(false);
  });

  it('opens Strategist+ features on strategist', () => {
    expect(hasCapability({ plan: 'strategist' }, 'pdfExports')).toBe(true);
    expect(hasCapability({ plan: 'strategist' }, 'slackIntegration')).toBe(true);
    expect(hasCapability({ plan: 'strategist' }, 'audioBriefing')).toBe(true);
  });

  it('reserves Command-only features for command', () => {
    expect(hasCapability({ plan: 'strategist' }, 'customRecommendationCategories')).toBe(false);
    expect(hasCapability({ plan: 'strategist' }, 'scheduledReports')).toBe(false);
    expect(hasCapability({ plan: 'command' }, 'customRecommendationCategories')).toBe(true);
    expect(hasCapability({ plan: 'command' }, 'scheduledReports')).toBe(true);
  });

  it('treats all-tier features as available everywhere (incl. undefined user)', () => {
    expect(hasCapability(undefined, 'brandPulse')).toBe(true);
    expect(hasCapability({ plan: 'scout' }, 'brandPulse')).toBe(true);
    expect(hasCapability({ plan: 'scout' }, 'predictedMoves')).toBe(true);
  });
});
