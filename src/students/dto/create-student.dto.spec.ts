import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateStudentDto } from './create-student.dto.js';

describe('CreateStudentDto validation/normalization', () => {
  it('rejects future birth dates', async () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    const dto = plainToInstance(CreateStudentDto, {
      firstName: 'Ana',
      lastName: 'Lopez',
      email: 'ana@example.com',
      documentNumber: 'DOC-1',
      birthDate: future.toISOString().slice(0, 10),
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects whitespace-only text fields', async () => {
    const dto = plainToInstance(CreateStudentDto, {
      firstName: '   ',
      lastName: 'Lopez',
      email: 'ana@example.com',
      documentNumber: 'DOC-1',
      birthDate: '2000-01-01',
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });
});
