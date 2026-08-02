-- Fase F ("NOVA como centro da experiência"): estágio humano do
-- processamento de um DocumentAnalysisJob, pra UI de progresso em chat com
-- polling curto ("Lendo documento…", "Identificando tipo…", "Extraindo
-- informações…", "Preparando recomendação…", terminando em COMPLETED ou
-- FAILED). Sem estágio de "verificando segurança" aqui: o scan de vírus é
-- síncrono no upload, antes de qualquer job existir — ver comentário do
-- enum em schema.prisma.
--
-- Aditiva: cria só o tipo novo e uma coluna nova com DEFAULT. Nenhum dado
-- existente é alterado; jobs já concluídos (COMPLETED/FAILED) ficam com
-- READING_DOCUMENT no histórico (o valor não importa mais pra eles — só
-- jobs QUEUED/PROCESSING são consultados pelo polling).

CREATE TYPE "DocumentAnalysisProgressStage" AS ENUM ('READING_DOCUMENT', 'IDENTIFYING_TYPE', 'EXTRACTING_DATA', 'PREPARING_RECOMMENDATION', 'COMPLETED', 'FAILED');

ALTER TABLE "document_analysis_jobs"
  ADD COLUMN "progress_stage" "DocumentAnalysisProgressStage" NOT NULL DEFAULT 'READING_DOCUMENT';
