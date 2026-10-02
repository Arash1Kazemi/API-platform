export interface Category {
  id: string;
  name: string;
  unit: string;
  chartFactor: number;
  chartUnit: string;
  board: string;
  anchor: string;
  footnote: string;
  sortOrder: number;
  modelCount: number;
  rankedCount: number;
  bestValueIds: string[];
  oldestCheck: string | null;
}

export interface Tier {
  label: string;
  price: number;
}

export interface Model {
  id: string;
  categoryId: string;
  provider: string;
  name: string;
  maker: string;
  endpoint: string;
  price: number;
  chartPrice: number;
  basis: string;
  approx: boolean;
  elo: number | null;
  ci: number | null;
  note: string;
  checkedAt: string;
  tiers: Tier[];
  bestValue: boolean | null;
  beatenBy: string | null;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  canWrite: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PlanLine {
  modelId: string;
  perMonth: number;
}

export interface Plan {
  id: string;
  name: string;
  budget: number;
  lines: PlanLine[];
}
