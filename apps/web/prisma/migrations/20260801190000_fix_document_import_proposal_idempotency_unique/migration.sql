-- Corrige o índice único de document_import_proposals.idempotency_key para
-- deixar de ser parcial. Causa raiz: prisma.documentImportProposal.upsert()
-- gera "INSERT ... ON CONFLICT (idempotency_key) DO UPDATE ..." sem cláusula
-- WHERE; o Postgres só aceita um índice único PARCIAL como alvo de
-- ON CONFLICT quando a própria instrução repete o predicado do índice — o
-- que o Prisma não faz. Um índice único comum (sem WHERE) já permite
-- múltiplos NULL em Postgres, então esta troca não muda nenhuma regra de
-- negócio existente, só corrige a compatibilidade com ON CONFLICT. Nenhuma
-- linha é apagada ou alterada.

DROP INDEX IF EXISTS "document_import_proposals_idempotency_key_key";
CREATE UNIQUE INDEX "document_import_proposals_idempotency_key_key"
  ON "document_import_proposals"("idempotency_key");
