import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthResponseDto } from './dto/health-response.dto.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.buildResponse('ok', 'up');
    } catch {
      throw new ServiceUnavailableException(
        this.buildResponse('error', 'down'),
      );
    }
  }

  private buildResponse(
    status: HealthResponseDto['status'],
    database: HealthResponseDto['database'],
  ): HealthResponseDto {
    return {
      status,
      database,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }
}
