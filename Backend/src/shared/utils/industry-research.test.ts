import { describe, expect, it } from 'vitest';
import { getIndustryConfig, INDUSTRY_RESEARCH_CONFIGS } from './industry-research';

// The frontend defines the source-of-truth list of industries; keep this
// inline mirror in sync if it ever changes. A drift test below catches the
// case where the backend has configs for industries the frontend doesn't
// offer (or vice versa).
const FRONTEND_INDUSTRIES = [
  'SaaS / Software',
  'E-commerce / Retail',
  'Fintech',
  'Healthcare',
  'Education',
  'Marketing / Advertising',
  'Media / Entertainment',
  'Real Estate',
  'Travel / Hospitality',
  'Other',
] as const;

describe('industry-research config', () => {
  it('every key in INDUSTRY_RESEARCH_CONFIGS exists in the frontend INDUSTRIES list', () => {
    const frontendSet = new Set<string>(FRONTEND_INDUSTRIES);
    for (const key of Object.keys(INDUSTRY_RESEARCH_CONFIGS)) {
      expect(frontendSet.has(key)).toBe(true);
    }
  });

  it('every non-Other frontend industry has a config', () => {
    for (const industry of FRONTEND_INDUSTRIES) {
      if (industry === 'Other') continue;
      expect(INDUSTRY_RESEARCH_CONFIGS[industry]).toBeDefined();
    }
  });

  it('Fintech config carries the regulatory label', () => {
    const cfg = getIndustryConfig('Fintech');
    expect(cfg).not.toBeNull();
    expect(cfg!.label).toBe('Regulatory & Compliance');
    expect(cfg!.contextGuidance.length).toBeGreaterThan(100);
  });

  it('Healthcare config carries the clinical label', () => {
    const cfg = getIndustryConfig('Healthcare');
    expect(cfg).not.toBeNull();
    expect(cfg!.label).toBe('Clinical & Regulatory');
  });

  it("getIndustryConfig returns null for 'Other'", () => {
    expect(getIndustryConfig('Other')).toBeNull();
  });

  it('getIndustryConfig returns null for undefined / empty', () => {
    expect(getIndustryConfig(undefined)).toBeNull();
    expect(getIndustryConfig('')).toBeNull();
  });

  it('getIndustryConfig returns null for an unknown industry string', () => {
    expect(getIndustryConfig('Cattle Farming')).toBeNull();
  });

  it('every config has a non-empty label, contextGuidance, and at least one perCategoryGuidance entry', () => {
    for (const [industry, cfg] of Object.entries(INDUSTRY_RESEARCH_CONFIGS)) {
      expect(cfg.label.length, `${industry} label`).toBeGreaterThan(0);
      expect(cfg.contextGuidance.length, `${industry} contextGuidance`).toBeGreaterThan(20);
      expect(Object.keys(cfg.perCategoryGuidance).length, `${industry} perCategoryGuidance`).toBeGreaterThan(0);
    }
  });
});
