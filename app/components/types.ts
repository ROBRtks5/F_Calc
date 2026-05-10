export type TradePeriod = 'morning' | 'evening';
export type PositionType = 'Long' | 'Short';

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  period: TradePeriod;
  type: PositionType;
  price: string;
  priceMode?: 'points' | 'rubles';
  lots: number;
}
