export type PageType = 'pricing' | 'features' | 'homepage' | 'blog' | 'careers';

export type Momentum = 'rising' | 'stable' | 'slowing' | 'declining' | 'insufficient-data';

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
}
