import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({
    description: 'Student first name',
    example: 'Ana',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    description: 'Student last name',
    example: 'Lopez',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    description: 'Unique student email address',
    example: 'ana.lopez@example.com',
    maxLength: 255,
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description: 'Unique student document number',
    example: 'DOC-123456',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber!: string;

  @ApiProperty({
    description: 'Birth date in ISO 8601 date format',
    example: '2000-05-10',
    format: 'date',
  })
  @IsDateString({ strict: true })
  birthDate!: string;
}
