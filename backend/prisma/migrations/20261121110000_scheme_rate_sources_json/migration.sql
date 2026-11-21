-- Scheme.rateSources: an enum array becomes a JSON array of the same values,
-- so the one data model also runs on MySQL / MariaDB (no array columns).
ALTER TABLE "Scheme" DROP CONSTRAINT "Scheme_rate_sources_check";
ALTER TABLE "Scheme" ALTER COLUMN "rateSources" TYPE JSONB USING to_jsonb("rateSources");
ALTER TABLE "Scheme" ALTER COLUMN "rateSources" SET NOT NULL;
ALTER TABLE "Scheme" ADD CONSTRAINT "Scheme_rate_sources_check" CHECK (
  CASE WHEN jsonb_typeof("rateSources") = 'array' THEN jsonb_array_length("rateSources") >= 1 ELSE false END
);
