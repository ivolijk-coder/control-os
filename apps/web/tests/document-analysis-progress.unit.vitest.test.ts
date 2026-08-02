import { describe, expect, it } from 'vitest';
import {
  documentAnalysisFailed,
  progressStageLabel,
  shouldKeepPollingDocumentAnalysis,
} from '@/lib/document-analysis-progress';

describe('progressStageLabel', () => {
  it('mapeia cada estágio humano pro rótulo exato pedido', () => {
    expect(progressStageLabel('VERIFYING_SECURITY')).toBe('Verificando segurança…');
    expect(progressStageLabel('READING_DOCUMENT')).toBe('Lendo documento…');
    expect(progressStageLabel('IDENTIFYING_TYPE')).toBe('Identificando tipo…');
    expect(progressStageLabel('EXTRACTING_DATA')).toBe('Extraindo informações…');
    expect(progressStageLabel('PREPARING_RECOMMENDATION')).toBe('Preparando recomendação…');
  });

  it('estágio ausente ou desconhecido nunca quebra — cai em Lendo documento…', () => {
    expect(progressStageLabel(null)).toBe('Lendo documento…');
    expect(progressStageLabel(undefined)).toBe('Lendo documento…');
    expect(progressStageLabel('algo_que_nao_existe')).toBe('Lendo documento…');
  });
});

describe('shouldKeepPollingDocumentAnalysis', () => {
  it('continua sondando só em QUEUED/PROCESSING', () => {
    expect(shouldKeepPollingDocumentAnalysis('QUEUED')).toBe(true);
    expect(shouldKeepPollingDocumentAnalysis('PROCESSING')).toBe(true);
  });

  it('para em qualquer estado terminal — inclusive NEEDS_REVIEW, que espera o usuário, não mais progresso', () => {
    for (const status of ['COMPLETED', 'FAILED', 'NEEDS_REVIEW', 'NOT_REQUESTED', null, undefined]) {
      expect(shouldKeepPollingDocumentAnalysis(status)).toBe(false);
    }
  });
});

describe('documentAnalysisFailed', () => {
  it('só é true em FAILED', () => {
    expect(documentAnalysisFailed('FAILED')).toBe(true);
    expect(documentAnalysisFailed('COMPLETED')).toBe(false);
    expect(documentAnalysisFailed('NEEDS_REVIEW')).toBe(false);
  });
});
