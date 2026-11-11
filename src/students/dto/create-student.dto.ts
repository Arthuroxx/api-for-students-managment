import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
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

export class CreateStudentDto {
  @ApiProperty({
    description: 'Student first name',
    example: 'Ana',
    maxLength: 100,
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    description: 'Student last name',
    example: 'Lopez',
    maxLength: 100,
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    description:
      'Unique student email address (normalized: trimmed and lowercased)',
    example: 'ana.lopez@example.com',
    maxLength: 255,
  })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description:
      'Unique student document number (normalized: trimmed and uppercased)',
    example: 'DOC-123456',
    maxLength: 50,
  })
  @Transform(({ value }) => normalizeDocumentNumber(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber!: string;

  @ApiProperty({
    description: 'Birth date in ISO 8601 date format (must not be in the future)',
    example: '2000-05-10',
    format: 'date',
  })
  @IsDateString({ strict: true })
  @IsNotFutureDate()
  birthDate!: string;
}
