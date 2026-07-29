import { describe, expect, it } from 'vitest';

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const hasRedis = Boolean(process.env.TEST_REDIS_URL);
const hasStorage = Boolean(process.env.TEST_STORAGE_ENDPOINT && process.env.TEST_STORAGE_BUCKET);
const hasClamAV = Boolean(process.env.TEST_CLAMAV_HOST && process.env.TEST_CLAMAV_PORT);

describe.skipIf(!hasDatabase)('PostgreSQL real de teste', () => {
  it('responde sem utilizar a URL de produção', async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`;
    expect(Number(result[0]?.value)).toBe(1);
  });
});

describe.skipIf(!hasRedis)('Redis real de teste', () => {
  it('enfileira e remove jobs sem duplicar o identificador', async () => {
    process.env.REDIS_URL = process.env.TEST_REDIS_URL;
    const { dequeueDocumentAnalysisJob, enqueueDocumentAnalysisJob } = await import('@/services/documents/document-analysis-queue');
    while (await dequeueDocumentAnalysisJob()) {
      // Limpa somente a fila do Redis isolado de teste.
    }
    await enqueueDocumentAnalysisJob('job-integration-a');
    expect(await dequeueDocumentAnalysisJob()).toBe('job-integration-a');
    expect(await dequeueDocumentAnalysisJob()).toBeUndefined();
  });
});

describe.skipIf(!hasStorage)('Storage S3/R2 real de teste', () => {
  it.todo('valida put/get/remove em bucket exclusivo de homologação');
});

describe.skipIf(!hasClamAV)('ClamAV real de teste', () => {
  it.todo('valida arquivo limpo e assinatura EICAR sintética');
});
