export type DiscountGame = {
  id: number;
  name: string;
  image: string;
  release: string;
  rating: number | null;
  win: boolean;
  mac: boolean;
  linux: boolean;
  genres?: string[];
  discount: number;
  final: number;
  original: number;
};

export type DiscountListPayload = {
  updatedAt: string;
  count: number;
  games: DiscountGame[];
};

export type MetaPayload = {
  updatedAt: string;
  source: string;
  games: number;
  chunks: number;
};
