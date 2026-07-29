-- Arquivos privados e propostas de leitura de contrato.
-- Esta migration é exclusivamente aditiva: nenhum documento ou lançamento
-- financeiro existente é alterado.

CREATE TYPE "StoredDocumentKind" AS ENUM ('GENERAL', 'CONTRACT');
CREATE TYPE "DocumentImportProposalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "stored_documents" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "openai_file_id" TEXT NOT NULL,
  "kind" "StoredDocumentKind" NOT NULL DEFAULT 'GENERAL',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "archived_at" TIMESTAMPTZ(3),
  CONSTRAINT "stored_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stored_documents_openai_file_id_key" ON "stored_documents"("openai_file_id");
CREATE INDEX "stored_documents_user_id_created_at_idx" ON "stored_documents"("user_id", "created_at");

ALTER TABLE "stored_documents"
  ADD CONSTRAINT "stored_documents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "document_import_proposals" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "status" "DocumentImportProposalStatus" NOT NULL DEFAULT 'PENDING',
  "extracted_data" JSONB NOT NULL,
  "resulting_installment_group_id" UUID,
  "confirmed_at" TIMESTAMPTZ(3),
  "rejected_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "document_import_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_import_proposals_user_id_status_idx" ON "document_import_proposals"("user_id", "status");
CREATE INDEX "document_import_proposals_document_id_idx" ON "document_import_proposals"("document_id");

ALTER TABLE "document_import_proposals"
  ADD CONSTRAINT "document_import_proposals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_import_proposals"
  ADD CONSTRAINT "document_import_proposals_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "stored_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
