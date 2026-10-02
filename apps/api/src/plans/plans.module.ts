import { Body, Controller, Delete, Get, Module, NotFoundException, Param, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class LineDto {
  @IsString() @MaxLength(80) modelId: string;
  @IsNumber() @Min(0) perMonth: number;
}

class PlanDto {
  @IsString() @MaxLength(80) name: string;
  @IsNumber() @Min(0) budget: number;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
}

const out = (p: { id: string; name: string; budget: number; lines: string; updatedAt: Date }) => ({
  ...p,
  lines: JSON.parse(p.lines) as LineDto[],
});

/** Saved cost-planner scenarios: "what would my app cost per month with these models and volumes". */
@Controller('plans')
class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return (await this.prisma.plan.findMany({ orderBy: { updatedAt: 'desc' } })).map(out);
  }

  /** Create with a new id, or replace an existing plan. */
  @Put(':id')
  async save(@Param('id') id: string, @Body() dto: PlanDto) {
    const data = { name: dto.name, budget: dto.budget, lines: JSON.stringify(dto.lines) };
    return out(await this.prisma.plan.upsert({ where: { id }, create: { id, ...data }, update: data }));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const res = await this.prisma.plan.deleteMany({ where: { id } });
    if (!res.count) throw new NotFoundException();
    return { ok: true };
  }
}

@Module({ controllers: [PlansController] })
export class PlansModule {}
