export interface ValueInput {
  id: string;
  price: number;
  elo: number | null;
}

export interface ValueResult {
  /** null when the model has no score, so it cannot be judged. */
  bestValue: boolean | null;
  /** id of the highest-scoring model that is at least as cheap and at least as good. */
  beatenBy: string | null;
}

/**
 * "Best value" = no other ranked model has an equal or higher score at an equal or lower price,
 * with at least one of the two strictly better (this is called Pareto dominance).
 * Models are compared inside ONE category only, because scores are only comparable there.
 * Cost is O(n^2), which is fine for a few hundred models per category.
 */
export function computeValue(models: ValueInput[]): Map<string, ValueResult> {
  const ranked = models.filter((m) => m.elo !== null);
  const out = new Map<string, ValueResult>();
  for (const m of models) {
    if (m.elo === null) {
      out.set(m.id, { bestValue: null, beatenBy: null });
      continue;
    }
    const dominators = ranked.filter(
      (o) =>
        o.id !== m.id &&
        o.elo! >= m.elo! &&
        o.price <= m.price &&
        (o.elo! > m.elo! || o.price < m.price),
    );
    dominators.sort((a, b) => b.elo! - a.elo! || a.price - b.price);
    out.set(m.id, { bestValue: dominators.length === 0, beatenBy: dominators[0]?.id ?? null });
  }
  return out;
}
