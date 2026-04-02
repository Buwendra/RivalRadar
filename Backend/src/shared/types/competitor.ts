export type PageType = 'pricing' | 'features' | 'homepage' | 'blog' | 'careers';

export interface Competitor {
  id: string;
  userId: string;
  name: string;
  url: string;
  pagesToTrack: PageType[];
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}
