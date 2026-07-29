import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticPdf, syntheticPng } from './fixtures';

const auditCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    documentAuditEvent: { create: auditCreate },
  },
}));

describe('upload e validação de documentos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DOCUMENT_SCANNER_PROVIDER', '');
  });

  it('rejeita arquivo vazio ou incompleto', async () => {
    const { validateUploadedDocument } = await import('../document-core');
    await expect(validateUploadedDocument(new File([], 'vazio.pdf', { type: 'application/pdf' })))
      .rejects.toMatchObject({ code: 'INVALID_FILE' });
  });

  it('rejeita arquivo acima do limite configurado', async () => {
    vi.stubEnv('DOCUMENT_MAX_UPLOAD_BYTES', '16');
    const { validateUploadedDocument } = await import('../document-core');
    await expect(validateUploadedDocument(new File([new Uint8Array(17)], 'grande.txt', { type: 'text/plain' })))
      .rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('aceita PDF sintético cuja assinatura corresponde à extensão', async () => {
    const { validateUploadedDocument } = await import('../document-core');
    const result = await validateUploadedDocument(syntheticPdf());
    expect(result.detectedMimeType).toBe('application/pdf');
    expect(result.extension).toBe('pdf');
    expect(result.pageCount).toBe(1);
  });

  it('aceita imagem PNG sintética válida', async () => {
    const { validateUploadedDocument } = await import('../document-core');
    await expect(validateUploadedDocument(syntheticPng())).resolves.toMatchObject({
      detectedMimeType: 'image/png',
      extension: 'png',
    });
  });

  it('rejeita MIME/extensão inválidos, assinatura incompatível e executável renomeado', async () => {
    const { validateUploadedDocument } = await import('../document-core');
    const executable = new File(['MZsynthetic executable'], 'arquivo.pdf', { type: 'application/pdf' });
    await expect(validateUploadedDocument(executable)).rejects.toMatchObject({ code: 'INVALID_FILE' });
    await expect(validateUploadedDocument(new File(['texto seguro'], 'arquivo.exe')))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
    await expect(validateUploadedDocument(new File([await syntheticPng().arrayBuffer()], 'falso.pdf')))
      .rejects.toMatchObject({ code: 'INVALID_FILE' });
  });

  it('calcula SHA-256 determinístico e deduplica conteúdo independentemente do nome', async () => {
    const { validateUploadedDocument } = await import('../document-core');
    const first = syntheticPdf('mesmo conteúdo');
    const second = new File([await first.arrayBuffer()], 'outro-nome.pdf', { type: 'application/pdf' });
    const [a, b] = await Promise.all([validateUploadedDocument(first), validateUploadedDocument(second)]);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toBe(createHash('sha256').update(a.buffer).digest('hex'));
  });

  it('gera storage key opaca sem usar o nome original', async () => {
    const { newStorageKey } = await import('../document-core');
    const key = newStorageKey('user-test', 'pdf');
    expect(key).toMatch(/^documents\/user-test\/[0-9a-f-]+\.pdf$/);
    expect(key).not.toContain('contrato');
  });
});

describe('scanner com falha fechada', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DOCUMENT_SCANNER_PROVIDER', 'http');
    vi.stubEnv('DOCUMENT_SCANNER_ENDPOINT', 'https://scanner.test/scan');
  });

  async function validated() {
    const { validateUploadedDocument } = await import('../document-core');
    return validateUploadedDocument(syntheticPdf());
  }

  it('classifica arquivo limpo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ clean: true, engine: 'mock' }), { status: 200 })));
    const { scanDocument } = await import('../document-core');
    await expect(scanDocument(await validated())).resolves.toEqual({
      status: 'CLEAN',
      details: { scanner: 'mock' },
    });
  });

  it('bloqueia arquivo infectado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ clean: false, engine: 'mock' }), { status: 200 })));
    const { scanDocument } = await import('../document-core');
    await expect(scanDocument(await validated())).resolves.toMatchObject({ status: 'INFECTED' });
  });

  it.each([
    ['scanner indisponível', () => Promise.reject(new Error('offline')), 'scanner_unavailable'],
    ['timeout', () => Promise.reject(new DOMException('timeout', 'TimeoutError')), 'scanner_unavailable'],
    ['resposta inválida', () => Promise.resolve(new Response('{}', { status: 200 })), 'scanner_invalid_response'],
  ])('falha fechada quando há %s', async (_name, implementation, reason) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(implementation));
    const { scanDocument } = await import('../document-core');
    await expect(scanDocument(await validated())).resolves.toEqual({
      status: 'FAILED',
      details: { reason },
    });
  });
});

describe('erros e auditoria sanitizados', () => {
  it('remove segredos e conteúdo integral de estruturas aninhadas', async () => {
    const { sanitizeDocumentDiagnostics } = await import('../document-core');
    expect(sanitizeDocumentDiagnostics({
      OPENAI_API_KEY: 'secret',
      Authorization: 'Bearer secret',
      nested: { documentContent: 'conteúdo integral', requestId: 'req-1' },
    })).toEqual({
      OPENAI_API_KEY: '[REDACTED]',
      Authorization: '[REDACTED]',
      nested: { documentContent: '[REDACTED]', requestId: 'req-1' },
    });
  });

  it('audita somente metadados sanitizados', async () => {
    const { auditDocument } = await import('../document-core');
    await auditDocument({
      userId: 'user-a',
      operation: 'DOCUMENT_UPLOAD_FAILED',
      source: 'system',
      entityType: 'document',
      entityId: 'doc-a',
      after: { token: 'secret', requestId: 'req-1' },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        after: { token: '[REDACTED]', requestId: 'req-1' },
      }),
    }));
  });
});
