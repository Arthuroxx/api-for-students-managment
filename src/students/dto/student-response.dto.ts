import { ApiProperty } from '@nestjs/swagger';

export class StudentResponseDto {
  @ApiProperty({
    description: 'Student unique identifier',
    example: 'e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({ description: 'Student first name', example: 'Ana' })
  firstName!: string;

  @ApiProperty({ description: 'Student last name', example: 'Lopez' })
  lastName!: string;

  @ApiProperty({
    description: 'Student email address',
    example: 'ana.lopez@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Student document number',
    example: 'DOC-123456',
  })
  documentNumber!: string;

  @ApiProperty({
    description: 'Student birth date',
    example: '2000-05-10T00:00:00.000Z',
    format: 'date-time',
  })
  birthDate!: string;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-11-03T12:00:00.000Z',
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Record last update timestamp',
    example: '2026-11-03T12:00:00.000Z',
    format: 'date-time',
  })
  updatedAt!: string;
}
