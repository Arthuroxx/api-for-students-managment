import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { Student } from '../generated/prisma/client.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { PaginatedStudentsResponseDto } from './dto/paginated-students-response.dto.js';
import { StudentResponseDto } from './dto/student-response.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentResponse } from './students.select.js';
import { PaginatedStudentsResponse } from './students.types.js';
import { StudentsService } from './students.service.js';

const studentIdParam = {
  name: 'id',
  description: 'Student unique identifier',
  format: 'uuid',
  example: 'e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11',
};

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List students',
    description:
      'Returns a paginated list of students with optional case-insensitive partial filters.',
  })
  @ApiOkResponse({
    description: 'Paginated list of students',
    type: PaginatedStudentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or filter values',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token',
    type: ErrorResponseDto,
  })
  findAll(
    @Query() query: ListStudentsQueryDto,
  ): Promise<PaginatedStudentsResponse> {
    return this.studentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a student by ID' })
  @ApiParam(studentIdParam)
  @ApiOkResponse({
    description: 'Student found',
    type: StudentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid student ID',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Student not found',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token',
    type: ErrorResponseDto,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<StudentResponse> {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Partially update a student',
    description:
      'Updates only the provided student fields. Internal fields cannot be modified.',
  })
  @ApiParam(studentIdParam)
  @ApiOkResponse({
    description: 'Student updated',
    type: StudentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid student ID or input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Student not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email or document number already in use',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token',
    type: ErrorResponseDto,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ): Promise<StudentResponse> {
    return this.studentsService.update(id, updateStudentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a student' })
  @ApiParam(studentIdParam)
  @ApiNoContentResponse({ description: 'Student deleted' })
  @ApiBadRequestResponse({
    description: 'Invalid student ID',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Student not found',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.studentsService.remove(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a student' })
  @ApiCreatedResponse({
    description: 'Student created',
    type: StudentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email or document number already in use',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired access token',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createStudentDto: CreateStudentDto): Promise<Student> {
    return this.studentsService.create(createStudentDto);
  }
}
