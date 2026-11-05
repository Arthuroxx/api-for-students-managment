import { PrismaService } from '../prisma/prisma.service.js';
import { StudentsService } from './students.service.js';
import { StudentResponse } from './students.select.js';

function buildStudent(index: number): StudentResponse {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    firstName: `Student ${index}`,
    lastName: 'Test',
    email: `student-${index}@example.com`,
    documentNumber: `DOC-${index}`,
    birthDate: new Date('2000-01-01'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('StudentsService', () => {
  let service: StudentsService;
  let findMany: ReturnType<typeof vi.fn>;
  let count: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findMany = vi.fn();
    count = vi.fn();

    service = new StudentsService({
      student: { findMany, count },
    } as unknown as PrismaService);
  });

  it('skips the count query when the first page is partial', async () => {
    const student = buildStudent(1);
    findMany.mockResolvedValue([student]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(count).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: [student],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
  });

  it('skips the count query when the last page is partial', async () => {
    findMany.mockResolvedValue([buildStudent(11), buildStudent(12)]);

    const result = await service.findAll({ page: 2, limit: 10 });

    expect(count).not.toHaveBeenCalled();
    expect(result.meta).toEqual({
      total: 12,
      page: 2,
      limit: 10,
      totalPages: 2,
    });
  });

  it('counts when a page is full and more rows may exist', async () => {
    findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => buildStudent(index + 1)),
    );
    count.mockResolvedValue(25);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(count).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith({ where: {} });
    expect(result.meta).toEqual({
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
    });
  });

  it('counts when an empty page is requested after the first one', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(12);

    const result = await service.findAll({ page: 5, limit: 10 });

    expect(count).toHaveBeenCalledOnce();
    expect(result.meta).toEqual({
      total: 12,
      page: 5,
      limit: 10,
      totalPages: 2,
    });
  });

  it('builds case-insensitive filters and applies the stable pagination order', async () => {
    findMany.mockResolvedValue([]);

    await service.findAll({
      page: 2,
      limit: 5,
      firstName: 'ana',
      lastName: 'lopez',
      email: 'example',
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        firstName: { contains: 'ana', mode: 'insensitive' },
        lastName: { contains: 'lopez', mode: 'insensitive' },
        email: { contains: 'example', mode: 'insensitive' },
      },
      select: expect.any(Object),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: 5,
      take: 5,
    });
  });
});
