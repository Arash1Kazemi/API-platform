import { BadRequestException, BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const FAL_PRICING_URL = 'https://api.fal.ai/v1/models/pricing';
const BATCH = 50; // fal accepts at most 50 endpoint ids per call
const EPS = 1e-9;

interface FalPrice {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency: string;
}

export type RefreshStatus = 'same' | 'changed' | 'applied' | 'review' | 'missing';

export interface RefreshRow {
  id: string;
  name: string;
  endpoint: string;
  stored: number;
  live: number | null;
  unit: string | null;
  status: RefreshStatus;
  reason?: string;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  /**
   * Compare stored fal prices with fal's live prices.
   * With apply=false (default) nothing is written. With apply=true, prices are updated only where
   * the change is unambiguous: the model has a single price tier and its price is not an estimate.
   * Everything else is reported as "review" so you decide by hand.
   */
  async refreshFal(apply: boolean): Promise<{ checked: number; changed: number; applied: number; rows: RefreshRow[] }> {
    const key = this.config.get<string>('FAL_KEY');
    if (!key) throw new BadRequestException('FAL_KEY is not set on the server. Add it to .env and restart.');

    const models = await this.prisma.model.findMany({ where: { provider: 'fal' }, include: { tiers: true } });
    const live = await this.fetchLive(key, [...new Set(models.map((m) => m.endpoint))]);

    const rows: RefreshRow[] = [];
    let applied = 0;
    for (const m of models) {
      const p = live.get(m.endpoint);
      const base = { id: m.id, name: m.name, endpoint: m.endpoint, stored: m.price };
      if (!p) {
        rows.push({ ...base, live: null, unit: null, status: 'missing', reason: 'fal returned no price for this endpoint' });
        continue;
      }
      const row: RefreshRow = { ...base, live: p.unit_price, unit: p.unit, status: 'same' };
      rows.push(row);
      if (Math.abs(p.unit_price - m.price) < EPS) continue;

      row.status = 'changed';
      if (m.approx || m.tiers.length !== 1) {
        row.status = 'review';
        row.reason = m.approx ? 'stored price is an estimate' : 'model has several price tiers, so fal\'s single number is ambiguous';
        continue;
      }
      if (!apply) continue;

      await this.prisma.$transaction([
        this.prisma.model.update({ where: { id: m.id }, data: { price: p.unit_price, checkedAt: new Date() } }),
        this.prisma.priceTier.update({ where: { id: m.tiers[0].id }, data: { price: p.unit_price } }),
        this.prisma.priceHistory.create({ data: { modelId: m.id, price: p.unit_price, source: 'fal-api' } }),
      ]);
      row.status = 'applied';
      applied++;
    }
    return { checked: models.length, changed: rows.filter((r) => r.status !== 'same' && r.status !== 'missing').length, applied, rows };
  }

  private async fetchLive(key: string, endpoints: string[]): Promise<Map<string, FalPrice>> {
    const out = new Map<string, FalPrice>();
    for (let i = 0; i < endpoints.length; i += BATCH) {
      const url = new URL(FAL_PRICING_URL);
      for (const e of endpoints.slice(i, i + BATCH)) url.searchParams.append('endpoint_id', e);
      let res: Response;
      try {
        res = await fetch(url, { headers: { Authorization: `Key ${key}` }, signal: AbortSignal.timeout(20_000) });
      } catch (err) {
        throw new BadGatewayException(`Could not reach fal: ${(err as Error).message}`);
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new BadGatewayException(`fal answered ${res.status}: ${text.slice(0, 300)}`);
      }
      const json = (await res.json()) as { prices?: FalPrice[] };
      for (const p of json.prices ?? []) out.set(p.endpoint_id, p);
    }
    return out;
  }
}
