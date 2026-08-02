/**
 * Lógica pura do progresso de análise de documento (Fase F — "NOVA como
 * centro da experiência"). Separada de `use-document-analysis-progress.ts`
 * (que faz o `fetch`/polling em si) de propósito: esta parte não toca rede
 * nem DOM, então é testável direto com vitest — o mesmo padrão já usado em
 * todo `services/**` deste projeto, aplicado aqui à camada de cliente.
 *
 * `VERIFYING_SECURITY` nunca vem do servidor (ver comentário do enum
 * `DocumentAnalysisProgressStage` em `prisma/schema.prisma`: o scan de
 * vírus é síncrono durante o upload, antes de qualquer
 * `DocumentAnalysisJob` existir) — é um estágio só do cliente, mostrado
 * enquanto a própria requisição de upload está em voo. Por isso o union
 * abaixo é um superconjunto do enum do banco.
 */
export type DocumentAnalysisProgressStage =
  | 'VERIFYING_SECURITY'
  | 'READING_DOCUMENT'
  | 'IDENTIFYING_TYPE'
  | 'EXTRACTING_DATA'
  | 'PREPARING_RECOMMENDATION'
  | 'COMPLETED'
  | 'FAILED';

const STAGE_LABELS: Record<DocumentAnalysisProgressStage, string> = {
  VERIFYING_SECURITY: 'Verificando segurança…',
  READING_DOCUMENT: 'Lendo documento…',
  IDENTIFYING_TYPE: 'Identificando tipo…',
  EXTRACTING_DATA: 'Extraindo informações…',
  PREPARING_RECOMMENDATION: 'Preparando recomendação…',
  COMPLETED: 'Análise concluída.',
  FAILED: 'Não consegui concluir a análise agora.',
};

/** `stage` ausente/desconhecido cai em READING_DOCUMENT — o próximo passo real de qualquer job é sempre ler o documento (ver default do schema). */
export function progressStageLabel(stage: string | null | undefined): string {
  if (stage && stage in STAGE_LABELS) return STAGE_LABELS[stage as DocumentAnalysisProgressStage];
  return STAGE_LABELS.READING_DOCUMENT;
}

/**
 * `analysisStatus` (de `StoredDocument`, não `progressStage`) é a fonte de
 * verdade sobre quando parar de sondar — `progressStage` só refina o
 * "PROCESSING" com o estágio humano. NEEDS_REVIEW conta como parada:
 * significa que o usuário precisa agir (não há mais progresso pra mostrar,
 * a ConversationTask já foi criada pedindo confirmação — ver Fase C/D).
 */
export function shouldKeepPollingDocumentAnalysis(analysisStatus: string | null | undefined): boolean {
  return analysisStatus === 'QUEUED' || analysisStatus === 'PROCESSING';
}

export function documentAnalysisFailed(analysisStatus: string | null | undefined): boolean {
  return analysisStatus === 'FAILED';
}
