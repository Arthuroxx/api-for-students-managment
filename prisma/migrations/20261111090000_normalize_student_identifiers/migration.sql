-- Normalize existing student identifiers and prevent collisions before applying
-- canonical values.
--
-- Canonical forms:
--   email          = lower(trim(email))
--   documentNumber = upper(trim(documentNumber))
--
-- If applying these forms would create duplicates, this migration aborts and
-- leaves data unchanged. Resolve reported collisions manually, then re-run.

DO $$
DECLARE
  email_collisions integer;
  document_collisions integer;
BEGIN
  SELECT count(*) INTO email_collisions
  FROM (
    SELECT lower(btrim(email)) AS normalized_email
    FROM "students"
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) c;

  IF email_collisions > 0 THEN
    RAISE EXCEPTION
      'Cannot normalize student emails: % normalized email collision group(s) found. Resolve duplicates manually before re-running migrations.',
      email_collisions;
  END IF;

  SELECT count(*) INTO document_collisions
  FROM (
    SELECT upper(btrim("documentNumber")) AS normalized_document
    FROM "students"
    GROUP BY upper(btrim("documentNumber"))
    HAVING count(*) > 1
  ) c;

  IF document_collisions > 0 THEN
    RAISE EXCEPTION
      'Cannot normalize student document numbers: % normalized document number collision group(s) found. Resolve duplicates manually before re-running migrations.',
      document_collisions;
  END IF;
END $$;

UPDATE "students"
SET
  "email" = lower(btrim("email")),
  "documentNumber" = upper(btrim("documentNumber"))
WHERE
  "email" <> lower(btrim("email"))
  OR "documentNumber" <> upper(btrim("documentNumber"));
