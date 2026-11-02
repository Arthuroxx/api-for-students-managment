import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Student } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(this.buildDuplicateMessage(error.meta));
      }

      throw error;
    }
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
