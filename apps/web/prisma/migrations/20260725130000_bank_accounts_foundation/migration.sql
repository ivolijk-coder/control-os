-- CONTROL FINANCE — Contas Bancárias
-- Migração exclusivamente aditiva. Nenhuma tabela, coluna ou dado existente
-- é removido. O saldo de abertura passa a ser registrado em Transaction.

CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TransactionOrigin" AS ENUM ('MANUAL', 'ACCOUNT_OPENING_BALANCE');

ALTER TABLE "finance_accounts"
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archived_at" TIMESTAMPTZ(3),
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "finance_transactions"
  ADD COLUMN "origin" "TransactionOrigin" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "finance_audit_events" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "operation" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "before_state" JSONB,
  "after_state" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_audit_events_user_id_entity_type_entity_id_idx"
  ON "finance_audit_events"("user_id", "entity_type", "entity_id");
CREATE INDEX "finance_audit_events_user_id_created_at_idx"
  ON "finance_audit_events"("user_id", "created_at");

-- O constraint anterior mantém a unicidade exata; este índice adicional
-- impede também "Nubank" e "nubank" para o mesmo usuário.
CREATE UNIQUE INDEX "finance_accounts_user_id_lower_name_key"
  ON "finance_accounts"("user_id", lower("name"));
