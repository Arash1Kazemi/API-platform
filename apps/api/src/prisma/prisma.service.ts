import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    // WAL lets reads continue while a write happens; a good default for a small SQLite server.
    await this.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  }
}
