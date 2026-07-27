-- Sprint 2.1 — núcleo financeiro de transações.
-- Migração somente aditiva: preserva cada lançamento existente como
-- confirmado e retropreenche os campos necessários para cálculo realizado.

CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REVERSED');
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'NOVA', 'WHATSAPP', 'API');

ALTER TABLE "finance_transactions"
  ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "competence_date" TIMESTAMP(3),
  ADD COLUMN "due_date" TIMESTAMP(3),
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "confirmed_at" TIMESTAMP(3),
  ADD COLUMN "canceled_at" TIMESTAMP(3),
  ADD COLUMN "idempotency_key" VARCHAR(120),
  ADD COLUMN "idempotency_fingerprint" VARCHAR(128),
  ADD COLUMN "correlation_id" UUID,
  ADD COLUMN "reversal_of_id" UUID;

-- O legado não tinha pendência, cancelamento nem estorno; portanto todos os
-- registros históricos representam fatos já confirmados na data existente.
UPDATE "finance_transactions"
SET
  "competence_date" = "date",
  "paid_at" = "date",
  "confirmed_at" = "created_at"
WHERE "competence_date" IS NULL;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_reversal_of_id_fkey"
  FOREIGN KEY ("reversal_of_id") REFERENCES "finance_transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "finance_transactions_user_id_status_competence_date_idx"
  ON "finance_transactions"("user_id", "status", "competence_date");
CREATE INDEX "finance_transactions_reversal_of_id_idx"
  ON "finance_transactions"("reversal_of_id");
CREATE UNIQUE INDEX "finance_transactions_user_id_idempotency_key_key"
  ON "finance_transactions"("user_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

ALTER TABLE "finance_audit_events"
  ADD COLUMN "correlation_id" UUID;
