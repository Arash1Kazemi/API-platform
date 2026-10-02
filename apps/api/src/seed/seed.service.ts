import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

interface SeedModel {
  id: string;
  name: string;
  maker: string;
  endpoint: string;
  price: number;
  approx: boolean;
  basis: string;
  tiers: { label: string; price: number }[];
  elo: number | null;
  ci: number | null;
  note: string;
}

const VIDEO_NOTE =
  'Price per minute is the per-second price times 60, at the setting that matches the price Artificial Analysis lists (usually the default resolution). Lower resolutions cost less but were not ranked. Veo and Kling prices include generated audio, as Artificial Analysis lists them. fal’s H3 Max page does not mention audio, so check that if your app needs sound.';

// Category settings carried over from the first research (the "fal Value Map", checked 2026-10-02).
const CATEGORIES = [
  {
    id: 't2i', file: 'data_t2i.json', name: 'Text to image', unit: 'USD per image', chartFactor: 1,
    chartUnit: 'Price per image (USD)', board: 'Artificial Analysis text-to-image', anchor: 'FLUX.2 [dev] is fixed at 1000',
    footnote: 'Prices are for about one megapixel (1024 x 1024). Models billed per megapixel are rounded up. Models without a score are in the table but not on the chart.',
  },
  {
    id: 'edit', file: 'data_edit.json', name: 'Image editing', unit: 'USD per edit', chartFactor: 1,
    chartUnit: 'Price per edited image (USD)', board: 'Artificial Analysis image editing', anchor: '',
    footnote: 'Prices are for one edited image at about 1K. Grok Imagine adds $0.01 for each input image and the price shown includes one.',
  },
  {
    id: 't2v', file: 'data_t2v.json', name: 'Text to video', unit: 'USD per second', chartFactor: 60,
    chartUnit: 'Price per minute of video (USD)', board: 'Artificial Analysis text-to-video', anchor: 'Kling 3.0 Pro is fixed at 1000',
    footnote: VIDEO_NOTE,
  },
  {
    id: 'i2v', file: 'data_i2v.json', name: 'Image to video', unit: 'USD per second', chartFactor: 60,
    chartUnit: 'Price per minute of video (USD)', board: 'Artificial Analysis image-to-video', anchor: '',
    footnote: VIDEO_NOTE,
  },
  {
    id: 'tts', file: 'data_tts.json', name: 'Text to speech', unit: 'USD per 1,000 characters', chartFactor: 1,
    chartUnit: 'Price per 1,000 characters (USD)', board: 'Artificial Analysis text-to-speech', anchor: '',
    footnote: '1,000 characters is roughly one minute of speech. Gemini TTS costs less on Google’s own API than on fal.',
  },
];

const CHECKED = new Date('2026-10-02T00:00:00Z');

/** On first start (empty database) load the 60 models from the first research. Later starts do nothing. */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger('Seed');
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    if ((await this.prisma.category.count()) > 0) return;
    let count = 0;
    for (const [i, { file, ...cat }] of CATEGORIES.entries()) {
      const models = JSON.parse(readFileSync(join(process.cwd(), 'seed', file), 'utf-8')) as SeedModel[];
      await this.prisma.category.create({
        data: {
          ...cat,
          sortOrder: i,
          models: {
            create: models.map((m) => ({
              id: m.id, provider: 'fal', name: m.name, maker: m.maker, endpoint: m.endpoint,
              price: m.price, basis: m.basis, approx: m.approx, elo: m.elo, ci: m.ci, note: m.note,
              checkedAt: CHECKED,
              tiers: { create: m.tiers },
              history: { create: { price: m.price, source: 'seed', at: CHECKED } },
            })),
          },
        },
      });
      count += models.length;
    }
    this.log.log(`Loaded ${count} models in ${CATEGORIES.length} categories.`);
  }
}
