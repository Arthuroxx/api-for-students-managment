import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Student } from '../generated/prisma/client.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { StudentsService } from './students.service.js';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createStudentDto: CreateStudentDto): Promise<Student> {
    return this.studentsService.create(createStudentDto);
  }
}
