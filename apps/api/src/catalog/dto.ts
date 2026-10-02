import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SLUG_MSG = 'use lowercase letters, numbers and dashes only';

export class TierDto {
  @IsString() @MaxLength(120) label: string;
  @IsNumber() @Min(0) price: number;
}

export class CreateModelDto {
  @Matches(SLUG, { message: `id: ${SLUG_MSG}` }) @MaxLength(80) id: string;
  @IsString() @MaxLength(40) categoryId: string;
  @IsOptional() @IsString() @MaxLength(40) provider?: string;
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(80) maker: string;
  @IsString() @MaxLength(200) endpoint: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() @MaxLength(200) basis?: string;
  @IsOptional() @IsBoolean() approx?: boolean;
  @IsOptional() @IsInt() elo?: number | null;
  @IsOptional() @IsInt() @Min(0) ci?: number | null;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  /** If given, `price` must equal one of these prices. If left out, one tier is made from `basis`. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => TierDto) tiers?: TierDto[];
}

// The id never changes after creation, so it is not part of an update.
export class UpdateModelDto extends PartialType(OmitType(CreateModelDto, ['id'] as const)) {}

export class CreateCategoryDto {
  @Matches(SLUG, { message: `id: ${SLUG_MSG}` }) @MaxLength(40) id: string;
  @IsString() @MaxLength(80) name: string;
  @IsString() @MaxLength(80) unit: string;
  @IsOptional() @IsNumber() @Min(0) chartFactor?: number;
  @IsOptional() @IsString() @MaxLength(120) chartUnit?: string;
  @IsOptional() @IsString() @MaxLength(200) board?: string;
  @IsOptional() @IsString() @MaxLength(200) anchor?: string;
  @IsOptional() @IsString() @MaxLength(2000) footnote?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateCategoryDto extends PartialType(OmitType(CreateCategoryDto, ['id'] as const)) {}

export class ModelQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() maker?: string;
  @IsOptional() @IsString() q?: string;
  /** Show only models that have a score. */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() ranked?: boolean;
  /** Show only models on the best-value line. */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() bestValue?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() minElo?: number;
}

export class ExportQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['csv', 'json']) format?: 'csv' | 'json';
}
