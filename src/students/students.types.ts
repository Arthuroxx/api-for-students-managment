import { StudentResponse } from './students.select.js';

export interface StudentsPageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedStudentsResponse {
  data: StudentResponse[];
  meta: StudentsPageMeta;
}
