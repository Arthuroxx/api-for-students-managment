import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Overall application health',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status!: 'ok' | 'error';

  @ApiProperty({
    description: 'PostgreSQL connection status',
    enum: ['up', 'down'],
    example: 'up',
  })
  database!: 'up' | 'down';

  @ApiProperty({
    description: 'Process uptime in seconds',
    example: 123.45,
  })
  uptimeSeconds!: number;

  @ApiProperty({
    description: 'Health check timestamp in ISO 8601 format',
    example: '2026-11-04T12:00:00.000Z',
  })
  timestamp!: string;
}
