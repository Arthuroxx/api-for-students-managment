import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Error message or list of validation errors',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Bad Request',
  })
  message!: string | string[];

  @ApiProperty({
    description: 'Short error description',
    example: 'Bad Request',
  })
  error!: string;
}
