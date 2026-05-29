export type PositionType = 'Long' | 'Short';

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  type: PositionType;
  price: string;
  priceMode?: 'points' | 'rubles';
  lots: number;
}
