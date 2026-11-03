import { ApiProperty } from '@nestjs/swagger';
import { StudentResponseDto } from './student-response.dto.js';

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Total number of students matching the filters',
    example: 25,
  })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({
    description: 'Number of students requested per page',
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of available pages',
    example: 3,
  })
  totalPages!: number;
}

export class PaginatedStudentsResponseDto {
  @ApiProperty({
    description: 'Students matching the filters on the current page',
    type: [StudentResponseDto],
  })
  data!: StudentResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
