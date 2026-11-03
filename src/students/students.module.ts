import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, JwtAuthGuard],
  exports: [StudentsService],
})
export class StudentsModule {}
