import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { hashKey } from './auth.guard';
import { AdminOnly } from './public.decorator';

class CreateKeyDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsOptional() @IsBoolean() canWrite?: boolean;
}

@AdminOnly()
@Controller('keys')
export class KeysController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.apiKey.findMany({
      where: { revokedAt: null },
      select: { id: true, name: true, prefix: true, canWrite: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The full key is returned only here, once. Only its hash is stored. */
  @Post()
  async create(@Body() dto: CreateKeyDto) {
    const key = `ap_${randomBytes(24).toString('hex')}`;
    const row = await this.prisma.apiKey.create({
      data: { name: dto.name, canWrite: dto.canWrite ?? false, prefix: key.slice(0, 9), hash: hashKey(key) },
    });
    return { id: row.id, name: row.name, canWrite: row.canWrite, key };
  }

  @Delete(':id')
  async revoke(@Param('id') id: string) {
    const res = await this.prisma.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!res.count) throw new NotFoundException();
    return { ok: true };
  }
}
