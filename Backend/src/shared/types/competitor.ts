export type PageType = 'pricing' | 'features' | 'homepage' | 'blog' | 'careers';

export type Momentum = 'rising' | 'stable' | 'slowing' | 'declining' | 'insufficient-data';

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'monitor';

export interface Competitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  pagesToTrack: PageType[];
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
  momentum?: Momentum;
  momentumChangePercent?: number;
  momentumAsOf?: string;
  threatLevel?: ThreatLevel;
  threatReasoning?: string;
  threatAsOf?: string;
  derivedTags?: string[];
  derivedTagsAsOf?: string;
}
