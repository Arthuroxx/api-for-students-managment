import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentResponse, studentPublicSelect } from './students.select.js';
import { PaginatedStudentsResponse } from './students.types.js';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListStudentsQueryDto,
  ): Promise<PaginatedStudentsResponse> {
    const { page, limit, firstName, lastName, email } = query;
    const where: Prisma.StudentWhereInput = {};

    if (firstName) {
      where.firstName = { contains: firstName, mode: 'insensitive' };
    }

    if (lastName) {
      where.lastName = { contains: lastName, mode: 'insensitive' };
    }

    if (email) {
      where.email = { contains: email, mode: 'insensitive' };
    }

    const data = await this.prisma.student.findMany({
      where,
      select: studentPublicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await this.resolveTotal(where, page, limit, data.length);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.student.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  async create(createStudentDto: CreateStudentDto): Promise<StudentResponse> {
    try {
      return await this.prisma.student.create({
        data: {
          firstName: createStudentDto.firstName,
          lastName: createStudentDto.lastName,
          email: createStudentDto.email,
          documentNumber: createStudentDto.documentNumber,
          birthDate: new Date(createStudentDto.birthDate),
        },
        select: studentPublicSelect,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  /**
   * Returns the total number of matching students without always issuing a
   * COUNT query. A partial page already tells us the exact total, so COUNT is
   * only needed for a full page or an empty page after the first one.
   */
  private resolveTotal(
    where: Prisma.StudentWhereInput,
    page: number,
    limit: number,
    pageSize: number,
  ): Promise<number> | number {
    const isPartialPage = pageSize < limit;

    if (isPartialPage && (page === 1 || pageSize > 0)) {
      return (page - 1) * limit + pageSize;
    }

    return this.prisma.student.count({ where });
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
