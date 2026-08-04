-- PR6.1 — idempotência persistente de contratos financeiros.
-- Aditiva: contratos legados permanecem com NULL e nenhuma parcela é tocada.

ALTER TABLE "financial_contracts"
  ADD COLUMN "idempotency_key" VARCHAR(120),
  ADD COLUMN "idempotency_fingerprint" VARCHAR(128);

CREATE UNIQUE INDEX "financial_contracts_user_id_idempotency_key_key"
  ON "financial_contracts"("user_id", "idempotency_key");
