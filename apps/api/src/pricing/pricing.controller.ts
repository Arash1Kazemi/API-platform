import { Controller, HttpCode, Post, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** POST /pricing/refresh-fal            -> dry run, shows differences only
   *  POST /pricing/refresh-fal?apply=true -> also writes the safe ones */
  @HttpCode(200)
  @Post('refresh-fal')
  refreshFal(@Query('apply') apply?: string) {
    return this.pricing.refreshFal(apply === 'true');
  }
}
