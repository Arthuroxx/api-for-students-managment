import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { CreateStudentDto } from './create-student.dto.js';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @ApiPropertyOptional({
    description: 'Student first name',
    example: 'Ana',
    maxLength: 100,
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Student last name',
    example: 'Lopez',
    maxLength: 100,
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Unique student email address',
    example: 'ana.lopez@example.com',
    maxLength: 255,
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Unique student document number',
    example: 'DOC-123456',
    maxLength: 50,
  })
  documentNumber?: string;

  @ApiPropertyOptional({
    description: 'Birth date in ISO 8601 date format',
    example: '2000-05-10',
    format: 'date',
  })
  birthDate?: string;
}
