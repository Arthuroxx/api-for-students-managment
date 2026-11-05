import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Check application and database health',
    description:
      'Returns 200 when the API and its PostgreSQL connection are healthy, or 503 when the database is unavailable.',
  })
  @ApiOkResponse({
    description: 'Application and database are healthy',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Application or database is unhealthy',
    type: HealthResponseDto,
  })
  check(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }
}
