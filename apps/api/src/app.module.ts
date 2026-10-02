import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';
import { PricingModule } from './pricing/pricing.module';
import { PlansModule } from './plans/plans.module';
import { SeedService } from './seed/seed.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // No login: anyone who can reach the site can read and change data.
    // This only slows down abuse: 300 requests per minute per IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    CatalogModule,
    PricingModule,
    PlansModule,
  ],
  controllers: [HealthController],
  providers: [SeedService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
