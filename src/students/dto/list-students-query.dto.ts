import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const MAX_PAGE = 10_000;

function normalizeFilterValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class ListStudentsQueryDto {
  @ApiPropertyOptional({
    description:
      `Page number, starting at 1. Limited to ${MAX_PAGE} to keep offsets bounded.`,
    example: DEFAULT_PAGE,
    default: DEFAULT_PAGE,
    minimum: 1,
    maximum: MAX_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Number of students per page',
    example: DEFAULT_LIMIT,
    default: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Case-insensitive partial match on first name',
    example: 'Ana',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeFilterValue(value))
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive partial match on last name',
    example: 'Lopez',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeFilterValue(value))
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive partial match on email',
    example: 'example.com',
    maxLength: 255,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeFilterValue(value))
  @IsString()
  @MaxLength(255)
  email?: string;
}
