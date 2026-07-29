-- Sprint 4.1 — documentos privados, auditáveis e independentes da OpenAI.
-- A migration é exclusivamente aditiva. Documentos antigos continuam
-- acessíveis por `openai_file_id` até uma migração explícita e aprovada.

CREATE TYPE "DocumentStorageProvider" AS ENUM ('S3', 'LOCAL_DEVELOPMENT', 'LEGACY_OPENAI');
CREATE TYPE "DocumentStorageStatus" AS ENUM ('PENDING_UPLOAD', 'AVAILABLE', 'UPLOAD_FAILED', 'QUARANTINED', 'MIGRATION_PENDING', 'MIGRATION_FAILED', 'ARCHIVED');
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED', 'NOT_CONFIGURED');
CREATE TYPE "DocumentAnalysisStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');
CREATE TYPE "DocumentAnalysisJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TYPE "DocumentImportProposalStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_REVIEW';
ALTER TYPE "DocumentImportProposalStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "DocumentImportProposalStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';
ALTER TYPE "DocumentImportProposalStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "DocumentImportProposalStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "stored_documents"
  ADD COLUMN "display_name" TEXT,
  ADD COLUMN "detected_mime_type" TEXT,
  ADD COLUMN "extension" TEXT,
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "storage_provider" "DocumentStorageProvider",
  ADD COLUMN "storage_status" "DocumentStorageStatus" NOT NULL DEFAULT 'MIGRATION_PENDING',
  ADD COLUMN "storage_key" TEXT,
  ADD COLUMN "scan_status" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scan_details" JSONB,
  ADD COLUMN "analysis_status" "DocumentAnalysisStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "analysis_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "analysis_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "analysis_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "analysis_completed_at" TIMESTAMPTZ(3),
  ADD COLUMN "analysis_error_code" TEXT,
  ADD COLUMN "analysis_error_message" TEXT,
  ADD COLUMN "folder" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "stored_documents" ALTER COLUMN "openai_file_id" DROP NOT NULL;
CREATE UNIQUE INDEX "stored_documents_storage_key_key" ON "stored_documents"("storage_key") WHERE "storage_key" IS NOT NULL;
CREATE INDEX "stored_documents_user_id_archived_at_created_at_idx" ON "stored_documents"("user_id", "archived_at", "created_at");
CREATE UNIQUE INDEX "stored_documents_user_id_sha256_key" ON "stored_documents"("user_id", "sha256");
CREATE INDEX "stored_documents_analysis_status_created_at_idx" ON "stored_documents"("analysis_status", "created_at");

UPDATE "stored_documents"
SET "storage_provider" = 'LEGACY_OPENAI',
    "storage_status" = 'MIGRATION_PENDING',
    "scan_status" = 'NOT_CONFIGURED'
WHERE "openai_file_id" IS NOT NULL;

ALTER TABLE "document_import_proposals"
  ADD COLUMN "analysis_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "validation_warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "analysis_error_code" TEXT,
  ADD COLUMN "analysis_error_message" TEXT,
  ADD COLUMN "expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "discarded_at" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "document_import_proposals_idempotency_key_key" ON "document_import_proposals"("idempotency_key") WHERE "idempotency_key" IS NOT NULL;

CREATE TABLE "document_analysis_jobs" (
  "id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "analysis_version" INTEGER NOT NULL,
  "status" "DocumentAnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "run_after" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "locked_by" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "document_analysis_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_analysis_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "stored_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "document_analysis_jobs_document_id_analysis_version_key" ON "document_analysis_jobs"("document_id", "analysis_version");
CREATE INDEX "document_analysis_jobs_status_run_after_idx" ON "document_analysis_jobs"("status", "run_after");

CREATE TABLE "document_audit_events" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "document_id" UUID,
  "proposal_id" UUID,
  "operation" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "correlation_id" UUID,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_audit_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "stored_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "document_audit_events_user_id_created_at_idx" ON "document_audit_events"("user_id", "created_at");
CREATE INDEX "document_audit_events_document_id_created_at_idx" ON "document_audit_events"("document_id", "created_at");
CREATE INDEX "document_audit_events_correlation_id_idx" ON "document_audit_events"("correlation_id");
