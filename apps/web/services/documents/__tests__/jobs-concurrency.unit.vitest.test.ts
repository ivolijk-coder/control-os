import { beforeEach, describe, expect, it, vi } from 'vitest';

let jobStatus: 'QUEUED' | 'PROCESSING';
let attempts: number;

const updateMany = vi.fn(async ({ where }: { where: { status: string } }) => {
  if (jobStatus !== where.status) return { count: 0 };
  jobStatus = 'PROCESSING';
  attempts += 1;
  await Promise.resolve();
  return { count: 1 };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    documentAnalysisJob: { updateMany },
  },
}));
vi.mock('../document-analysis-queue', () => ({
  dequeueDocumentAnalysisJobSafely: vi.fn(),
  enqueueDocumentAnalysisJob: vi.fn(),
}));

describe('lock de jobs concorrentes', () => {
  beforeEach(() => {
    jobStatus = 'QUEUED';
    attempts = 0;
    updateMany.mockClear();
  });

  it('permite apenas um worker efetivo para o mesmo job', async () => {
    const { claimDocumentAnalysisJob } = await import('../contract-analysis');
    const results = await Promise.all([
      claimDocumentAnalysisJob('job-a', 'worker-a'),
      claimDocumentAnalysisJob('job-a', 'worker-b'),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(jobStatus).toBe('PROCESSING');
    expect(attempts).toBe(1);
  });
});
