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
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { UserRole } from '../generated/prisma/enums.js';
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'List students',
    description:
      'Requires the ADMIN or USER role. Returns a paginated list of students with optional case-insensitive partial filters.',
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
  @ApiForbiddenResponse({
    description: 'Insufficient role permissions (ADMIN or USER required)',
    type: ErrorResponseDto,
  })
  findAll(
    @Query() query: ListStudentsQueryDto,
  ): Promise<PaginatedStudentsResponse> {
    return this.studentsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({
    summary: 'Get a student by ID',
    description: 'Requires the ADMIN or USER role.',
  })
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
  @ApiForbiddenResponse({
    description: 'Insufficient role permissions (ADMIN or USER required)',
    type: ErrorResponseDto,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<StudentResponse> {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Partially update a student',
    description:
      'Requires the ADMIN role. Updates only the provided student fields. Internal fields cannot be modified.',
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
  @ApiForbiddenResponse({
    description: 'Insufficient role permissions (ADMIN required)',
    type: ErrorResponseDto,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ): Promise<StudentResponse> {
    return this.studentsService.update(id, updateStudentDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a student',
    description: 'Requires the ADMIN role.',
  })
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
  @ApiForbiddenResponse({
    description: 'Insufficient role permissions (ADMIN required)',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.studentsService.remove(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a student',
    description: 'Requires the ADMIN role.',
  })
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
  @ApiForbiddenResponse({
    description: 'Insufficient role permissions (ADMIN required)',
    type: ErrorResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createStudentDto: CreateStudentDto): Promise<StudentResponse> {
    return this.studentsService.create(createStudentDto);
  }
}
