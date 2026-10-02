import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, CreateModelDto, ModelQueryDto, TierDto, UpdateCategoryDto, UpdateModelDto } from './dto';
import { computeValue } from './value';

type ModelRow = Prisma.ModelGetPayload<{ include: { tiers: true; category: true } }>;

const EPS = 1e-9;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- categories ----------

  async listCategories() {
    const [cats, models] = await Promise.all([
      this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.model.findMany({ select: { id: true, categoryId: true, price: true, elo: true, checkedAt: true } }),
    ]);
    return cats.map((c) => {
      const mine = models.filter((m) => m.categoryId === c.id);
      const value = computeValue(mine.map((m) => ({ id: m.id, price: m.price * c.chartFactor, elo: m.elo })));
      return {
        ...c,
        modelCount: mine.length,
        rankedCount: mine.filter((m) => m.elo !== null).length,
        bestValueIds: mine.filter((m) => value.get(m.id)?.bestValue).map((m) => m.id),
        oldestCheck: mine.length ? new Date(Math.min(...mine.map((m) => m.checkedAt.getTime()))) : null,
      };
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    if (await this.prisma.category.findUnique({ where: { id: dto.id } })) {
      throw new ConflictException(`Category "${dto.id}" already exists`);
    }
    return this.prisma.category.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.mustCategory(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    await this.mustCategory(id);
    // Deleting a category deletes its models (cascade). The web app asks you to confirm first.
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- models ----------

  /** Filters apply to what you get back; best-value is always judged against ALL models of the category. */
  async listModels(q: ModelQueryDto = {}) {
    const rows = await this.prisma.model.findMany({
      include: { tiers: true, category: true },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
    });
    const needle = q.q?.toLowerCase();
    const shaped = this.shape(rows);
    return shaped.filter(
      (m) =>
        (!q.category || m.categoryId === q.category) &&
        (!q.provider || m.provider === q.provider) &&
        (!q.maker || m.maker.toLowerCase() === q.maker.toLowerCase()) &&
        (!needle || `${m.name} ${m.maker} ${m.endpoint} ${m.note}`.toLowerCase().includes(needle)) &&
        (!q.ranked || m.elo !== null) &&
        (!q.bestValue || m.bestValue === true) &&
        (q.maxPrice === undefined || m.chartPrice <= q.maxPrice) &&
        (q.minElo === undefined || (m.elo !== null && m.elo >= q.minElo)),
    );
  }

  async getModel(id: string) {
    const found = await this.prisma.model.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`Model "${id}" not found`);
    return (await this.listModels({ category: found.categoryId })).find((m) => m.id === id)!;
  }

  async priceHistory(id: string) {
    await this.mustModel(id);
    return this.prisma.priceHistory.findMany({ where: { modelId: id }, orderBy: { at: 'asc' } });
  }

  async createModel(dto: CreateModelDto) {
    if (await this.prisma.model.findUnique({ where: { id: dto.id } })) throw new ConflictException(`Model "${dto.id}" already exists`);
    await this.mustCategory(dto.categoryId);
    const tiers = this.tiersFor(dto.price, dto.basis ?? '', dto.tiers);
    await this.prisma.model.create({
      data: {
        id: dto.id,
        categoryId: dto.categoryId,
        provider: dto.provider ?? 'fal',
        name: dto.name,
        maker: dto.maker,
        endpoint: dto.endpoint,
        price: dto.price,
        basis: dto.basis ?? '',
        approx: dto.approx ?? false,
        elo: dto.elo ?? null,
        ci: dto.ci ?? null,
        note: dto.note ?? '',
        tiers: { create: tiers },
        history: { create: { price: dto.price, source: 'manual' } },
      },
    });
    return this.getModel(dto.id);
  }

  async updateModel(id: string, dto: UpdateModelDto) {
    const current = await this.prisma.model.findUnique({ where: { id }, include: { tiers: true } });
    if (!current) throw new NotFoundException(`Model "${id}" not found`);
    if (dto.categoryId) await this.mustCategory(dto.categoryId);

    const price = dto.price ?? current.price;
    const touchesPrice = dto.price !== undefined || dto.tiers !== undefined;
    // If the price changed but no tiers were sent, keep tiers consistent: move the old default tier along.
    let tiers: TierDto[] | undefined = dto.tiers;
    if (!tiers && dto.price !== undefined && Math.abs(dto.price - current.price) > EPS) {
      tiers = current.tiers.map((t) => ({ label: t.label, price: Math.abs(t.price - current.price) < EPS ? dto.price! : t.price }));
    }
    if (tiers) this.tiersFor(price, dto.basis ?? current.basis, tiers); // validates

    await this.prisma.$transaction(async (tx) => {
      await tx.model.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          provider: dto.provider,
          name: dto.name,
          maker: dto.maker,
          endpoint: dto.endpoint,
          price: dto.price,
          basis: dto.basis,
          approx: dto.approx,
          elo: dto.elo,
          ci: dto.ci,
          note: dto.note,
          checkedAt: touchesPrice ? new Date() : undefined,
        },
      });
      if (tiers) {
        await tx.priceTier.deleteMany({ where: { modelId: id } });
        await tx.priceTier.createMany({ data: tiers.map((t) => ({ modelId: id, label: t.label, price: t.price })) });
      }
      if (dto.price !== undefined && Math.abs(dto.price - current.price) > EPS) {
        await tx.priceHistory.create({ data: { modelId: id, price: dto.price, source: 'manual' } });
      }
    });
    return this.getModel(id);
  }

  async deleteModel(id: string) {
    await this.mustModel(id);
    await this.prisma.model.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- export ----------

  async export(category: string | undefined, format: 'csv' | 'json' = 'json') {
    const models = await this.listModels({ category });
    const cats = await this.prisma.category.findMany();
    const catName = new Map(cats.map((c) => [c.id, c]));
    const name = new Map(models.map((m) => [m.id, m.name]));
    if (format === 'json') return { body: JSON.stringify({ exportedAt: new Date().toISOString(), currency: 'USD', models }, null, 2), type: 'application/json' };

    const head = ['category', 'model', 'maker', 'provider', 'endpoint_id', 'chart_price_usd', 'price_unit', 'price_per_minute_usd', 'price_basis', 'price_is_estimate', 'all_published_prices', 'quality_elo', 'elo_ci95', 'best_value', 'beaten_by', 'quality_board', 'note', 'checked'];
    const rows = models.map((m) => {
      const c = catName.get(m.categoryId)!;
      return [
        c.name, m.name, m.maker, m.provider, m.endpoint, m.price, c.unit,
        c.chartFactor === 60 ? round(m.price * 60) : '',
        m.basis, m.approx ? 'yes' : 'no',
        m.tiers.map((t) => `${t.label}: ${t.price}`).join('; '),
        m.elo ?? '', m.ci ?? '',
        m.bestValue === null ? '' : m.bestValue ? 'yes' : 'no',
        m.beatenBy ? name.get(m.beatenBy) ?? m.beatenBy : '',
        c.board, m.note, m.checkedAt.toISOString().slice(0, 10),
      ];
    });
    const body = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    return { body, type: 'text/csv; charset=utf-8' };
  }

  // ---------- helpers ----------

  /** Adds chartPrice, bestValue and beatenBy. Value is computed per category on the chart price. */
  private shape(rows: ModelRow[]) {
    const byCat = new Map<string, ModelRow[]>();
    for (const r of rows) byCat.set(r.categoryId, [...(byCat.get(r.categoryId) ?? []), r]);
    const verdict = new Map<string, { bestValue: boolean | null; beatenBy: string | null }>();
    for (const list of byCat.values()) {
      const f = list[0].category.chartFactor;
      for (const [id, v] of computeValue(list.map((m) => ({ id: m.id, price: m.price * f, elo: m.elo })))) verdict.set(id, v);
    }
    return rows.map(({ category, ...m }) => ({
      ...m,
      chartPrice: round(m.price * category.chartFactor),
      ...verdict.get(m.id)!,
    }));
  }

  private tiersFor(price: number, basis: string, tiers?: TierDto[]): TierDto[] {
    if (!tiers || tiers.length === 0) return [{ label: basis || 'default', price }];
    if (!tiers.some((t) => Math.abs(t.price - price) < EPS)) {
      throw new BadRequestException('price must equal the price of one of the tiers');
    }
    return tiers;
  }

  private async mustCategory(id: string) {
    if (!(await this.prisma.category.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException(`Category "${id}" not found`);
    }
  }

  private async mustModel(id: string) {
    if (!(await this.prisma.model.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException(`Model "${id}" not found`);
    }
  }
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Quote a value for CSV; the leading-character check stops spreadsheets from running "=..." as a formula. */
function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
