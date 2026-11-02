import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Student } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentResponse, studentPublicSelect } from './students.select.js';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<StudentResponse[]> {
    return this.prisma.student.findMany({
      select: studentPublicSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<StudentResponse> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: studentPublicSelect,
    });

    if (!student) {
      throw new NotFoundException(`Student with id "${id}" not found`);
    }

    return student;
  }

  async update(
    id: string,
    updateStudentDto: UpdateStudentDto,
  ): Promise<StudentResponse> {
    const data = this.buildUpdateData(updateStudentDto);

    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }

    try {
      return await this.prisma.student.update({
        where: { id },
        data,
        select: studentPublicSelect,
      });
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    try {
      return await this.prisma.student.create({
        data: {
          firstName: createStudentDto.firstName,
          lastName: createStudentDto.lastName,
          email: createStudentDto.email,
          documentNumber: createStudentDto.documentNumber,
          birthDate: new Date(createStudentDto.birthDate),
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private buildUpdateData(
    updateStudentDto: UpdateStudentDto,
  ): Prisma.StudentUpdateInput {
    const data: Prisma.StudentUpdateInput = {};

    if (updateStudentDto.firstName !== undefined) {
      data.firstName = updateStudentDto.firstName;
    }

    if (updateStudentDto.lastName !== undefined) {
      data.lastName = updateStudentDto.lastName;
    }

    if (updateStudentDto.email !== undefined) {
      data.email = updateStudentDto.email;
    }

    if (updateStudentDto.documentNumber !== undefined) {
      data.documentNumber = updateStudentDto.documentNumber;
    }

    if (updateStudentDto.birthDate !== undefined) {
      data.birthDate = new Date(updateStudentDto.birthDate);
    }

    return data;
  }

  private handlePrismaError(error: unknown, missingStudentId?: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025' && missingStudentId) {
        throw new NotFoundException(
          `Student with id "${missingStudentId}" not found`,
        );
      }

      if (error.code === 'P2002') {
        throw new ConflictException(this.buildDuplicateMessage(error.meta));
      }
    }

    throw error;
  }

  private buildDuplicateMessage(
    meta: Record<string, unknown> | undefined,
  ): string {
    const constraint = this.getUniqueConstraint(meta) ?? '';

    if (constraint.includes('email')) {
      return 'A student with this email already exists';
    }

    if (constraint.includes('documentNumber')) {
      return 'A student with this document number already exists';
    }

    return 'A student with the same unique data already exists';
  }

  private getUniqueConstraint(
    meta: Record<string, unknown> | undefined,
  ): string | undefined {
    const target = meta?.target;

    if (typeof target === 'string') {
      return target;
    }

    if (Array.isArray(target)) {
      return target
        .filter((field): field is string => typeof field === 'string')
        .join(',');
    }

    const cause = (
      meta?.driverAdapterError as
        { cause?: { constraint?: { index?: unknown } } } | undefined
    )?.cause;

    return typeof cause?.constraint?.index === 'string'
      ? cause.constraint.index
      : undefined;
  }
}
