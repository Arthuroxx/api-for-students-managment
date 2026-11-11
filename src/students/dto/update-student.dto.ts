import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsNotFutureDate } from '../validators/is-not-future-date.validator.js';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function normalizeDocumentNumber(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/**
 * Only validate the property when it is present in the request body.
 *
 * `PartialType` uses `@IsOptional`, which also skips validation for `null`.
 * A `PATCH` with `null` must fail instead of silently turning a date into
 * `1970-01-01` or writing `null` to a required column.
 */
function isProvided(_object: object, value: unknown): boolean {
  return value !== undefined;
}

export class UpdateStudentDto {
  @ApiPropertyOptional({
    description: 'Student first name',
    example: 'Ana',
    maxLength: 100,
  })
  @ValidateIf(isProvided)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Student last name',
    example: 'Lopez',
    maxLength: 100,
  })
  @ValidateIf(isProvided)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description:
      'Unique student email address (normalized: trimmed and lowercased)',
    example: 'ana.lopez@example.com',
    maxLength: 255,
  })
  @ValidateIf(isProvided)
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description:
      'Unique student document number (normalized: trimmed and uppercased)',
    example: 'DOC-123456',
    maxLength: 50,
  })
  @ValidateIf(isProvided)
  @Transform(({ value }) => normalizeDocumentNumber(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber?: string;

  @ApiPropertyOptional({
    description: 'Birth date in ISO 8601 date format (must not be in the future)',
    example: '2000-05-10',
    format: 'date',
  })
  @ValidateIf(isProvided)
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  birthDate?: string;
}
