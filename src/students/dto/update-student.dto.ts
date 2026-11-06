import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

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
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Unique student email address',
    example: 'ana.lopez@example.com',
    maxLength: 255,
  })
  @ValidateIf(isProvided)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'Unique student document number',
    example: 'DOC-123456',
    maxLength: 50,
  })
  @ValidateIf(isProvided)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber?: string;

  @ApiPropertyOptional({
    description: 'Birth date in ISO 8601 date format',
    example: '2000-05-10',
    format: 'date',
  })
  @ValidateIf(isProvided)
  @IsDateString({ strict: true })
  birthDate?: string;
}
