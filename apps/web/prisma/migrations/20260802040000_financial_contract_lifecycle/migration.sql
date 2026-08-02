-- Evolução "Parcelas & Empréstimos" — Fase 3 (ciclo de vida do contrato):
-- renomeia o valor do enum `ContractStatus` de FINISHED para PAID_OFF, para
-- refletir a semântica de negócio (contrato quitado, seja por todas as
-- parcelas pagas naturalmente, seja por quitação antecipada).
--
-- Seguro: nenhum caminho de código grava FINISHED hoje (contrato sempre
-- nasce ACTIVE; o valor só existia declarado no enum desde a Fase 1, nunca
-- atribuído a uma linha) — não há dado existente para migrar, então o
-- rename não precisa de UPDATE. Aditiva em cima do enum já existente,
-- nenhuma tabela é recriada ou perde dados.

ALTER TYPE "ContractStatus" RENAME VALUE 'FINISHED' TO 'PAID_OFF';
