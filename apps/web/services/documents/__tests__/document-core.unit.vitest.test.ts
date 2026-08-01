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

describe('storage Cloudflare R2 pela abstração S3 compatível', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('DOCUMENT_STORAGE_PROVIDER', 'r2');
    vi.stubEnv('R2_ACCOUNT_ID', 'account-test');
    vi.stubEnv('R2_BUCKET', 'private-documents');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'access-test');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret-test');
    vi.stubEnv('R2_ENDPOINT', 'https://account-test.r2.cloudflarestorage.com');
  });

  it('faz upload, download, head e exclusão no bucket privado', async () => {
    const content = Buffer.from('conteúdo privado');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(content, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { documentStorage } = await import('../document-core');
    const storage = documentStorage();

    await storage.put('documents/user-a/file.pdf', content, 'application/pdf');
    await expect(storage.get('documents/user-a/file.pdf')).resolves.toEqual(content);
    await expect(storage.exists('documents/user-a/file.pdf')).resolves.toBe(true);
    await expect(storage.remove('documents/user-a/file.pdf')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['https://account-test.r2.cloudflarestorage.com/private-documents/documents/user-a/file.pdf', 'PUT'],
      ['https://account-test.r2.cloudflarestorage.com/private-documents/documents/user-a/file.pdf', 'GET'],
      ['https://account-test.r2.cloudflarestorage.com/private-documents/documents/user-a/file.pdf', 'HEAD'],
      ['https://account-test.r2.cloudflarestorage.com/private-documents/documents/user-a/file.pdf', 'DELETE'],
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'content-type': 'application/pdf' });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('secret-test');
  });

  it('deriva o endpoint oficial a partir do account id', async () => {
    vi.stubEnv('R2_ENDPOINT', '');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { documentStorage } = await import('../document-core');
    await documentStorage().exists('documents/user-a/file.pdf');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://account-test.r2.cloudflarestorage.com/private-documents/documents/user-a/file.pdf',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  it('usa configuração R2 com o seletor S3 compatível', async () => {
    vi.stubEnv('DOCUMENT_STORAGE_PROVIDER', 's3');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { documentStorage } = await import('../document-core');
    await documentStorage().exists('documents/user-a/file.pdf');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://account-test.r2.cloudflarestorage.com/private-documents/documents/user-a/file.pdf',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  it('falha fechado quando a configuração está incompleta', async () => {
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
    const { documentStorage } = await import('../document-core');
    expect(() => documentStorage()).toThrow('Cloudflare R2 não está configurado');
  });

  it('normaliza credencial inválida sem expor detalhes do provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('credential secret-test invalid', { status: 403 })));
    const { documentStorage } = await import('../document-core');
    await expect(documentStorage().put('documents/user-a/file.pdf', Buffer.from('x'), 'application/pdf'))
      .rejects.toMatchObject({ code: 'PROVIDER_AUTH_ERROR', message: 'O storage privado não autorizou armazenar o arquivo.' });
  });

  it('trata bucket ou objeto inexistente em head, download e delete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const { documentStorage } = await import('../document-core');
    const storage = documentStorage();
    await expect(storage.exists('documents/user-a/missing.pdf')).resolves.toBe(false);
    await expect(storage.get('documents/user-a/missing.pdf')).rejects.toMatchObject({ code: 'UNKNOWN' });
    await expect(storage.remove('documents/user-a/missing.pdf')).resolves.toBeUndefined();
  });
});

describe('erros e auditoria sanitizados', () => {
  it('não expõe mensagens internas de erros inesperados na API', async () => {
    const { publicDocumentFailure } = await import('../document-core');
    expect(publicDocumentFailure(
      new Error('Invalid prisma.storedDocument.findFirst invocation: analysis_status does not exist'),
      'Não foi possível guardar o arquivo agora.',
    )).toEqual({
      code: 'UNKNOWN',
      message: 'Não foi possível guardar o arquivo agora.',
      status: 500,
    });
  });

  it('preserva mensagens seguras de erro de domínio', async () => {
    const { DocumentError, publicDocumentFailure } = await import('../document-core');
    expect(publicDocumentFailure(
      new DocumentError('FILE_TOO_LARGE', 'Envie um arquivo menor.'),
      'Falha genérica.',
    )).toEqual({
      code: 'FILE_TOO_LARGE',
      message: 'Envie um arquivo menor.',
      status: 413,
    });
  });

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
