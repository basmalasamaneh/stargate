export enum ArtworkCategory {
  PAINTINGS = 'لوحات فنية',
  EMBROIDERY = 'تطريز فلسطيني',
  POTTERY = 'خزف وفخار',
  CALLIGRAPHY = 'خط عربي',
  PHOTOGRAPHY = 'تصوير فوتوغرافي',
  SCULPTURE = 'نحت ومجسمات',
}

export const ARTWORK_CATEGORIES = Object.values(ArtworkCategory);
export const isValidCategory = (value: string): value is ArtworkCategory => {
  return Object.values(ArtworkCategory).includes(value as ArtworkCategory);
};
