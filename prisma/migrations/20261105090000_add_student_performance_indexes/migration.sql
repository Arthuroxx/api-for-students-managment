-- Enable trigram indexes used by the case-insensitive partial filters on students.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Match the default listing order (createdAt DESC, id ASC) used by pagination.
CREATE INDEX "students_createdAt_id_idx" ON "students" ("createdAt" DESC, "id" ASC);

-- Accelerate ILIKE '%term%' filters on the searchable student fields.
CREATE INDEX "students_firstName_trgm_idx" ON "students" USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX "students_lastName_trgm_idx" ON "students" USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX "students_email_trgm_idx" ON "students" USING GIN ("email" gin_trgm_ops);
