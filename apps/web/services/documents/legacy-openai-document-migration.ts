import 'server-only';

import { prisma } from '@/lib/prisma';
import { auditDocument, documentStorage, DocumentError, newStorageKey, scanDocument, validateUploadedDocument } from './document-core';

export type LegacyOpenAIMigrationReport = {
  inspected: number;
  migrated: number;
  skipped: number;
  failed: number;
  nextCursor?: string;
};

/**
 * Utilitário operacional, deliberadamente sem rota HTTP e sem execução
 * automática. Ele transfere um lote de arquivos legados da OpenAI para o
 * storage privado. Pode ser retomado pelo cursor e não remove o arquivo de
 * origem: a remoção requer validação e aprovação separadas.
 */
export async function migrateLegacyOpenAIDocuments(input: { take?: number; cursor?: string; dryRun?: boolean } = {}): Promise<LegacyOpenAIMigrationReport> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new DocumentError('PROVIDER_AUTH_ERROR', 'OPENAI_API_KEY é necessária para migrar documentos legados.');
  const take = Math.min(Math.max(input.take ?? 20, 1), 100);
  const documents = await prisma.storedDocument.findMany({
    where: { storageProvider: 'LEGACY_OPENAI', storageStatus: { in: ['MIGRATION_PENDING', 'MIGRATION_FAILED'] }, openaiFileId: { not: null } },
    orderBy: { id: 'asc' }, take: take + 1, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const nextCursor = documents.length > take ? documents.pop()?.id : undefined;
  const report: LegacyOpenAIMigrationReport = { inspected: documents.length, migrated: 0, skipped: 0, failed: 0, nextCursor };
  const storage = documentStorage();

  for (const document of documents) {
    if (!document.openaiFileId) { report.skipped += 1; continue; }
    try {
      if (input.dryRun) { report.skipped += 1; continue; }
      const response = await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(document.openaiFileId)}/content`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(90_000) });
      if (!response.ok) throw new DocumentError('PROVIDER_TEMPORARY_ERROR', `A OpenAI recusou a leitura do arquivo legado (${response.status}).`, response.status >= 500 || response.status === 429);
      const content = Buffer.from(await response.arrayBuffer());
      const validated = await validateUploadedDocument(new File([Uint8Array.from(content)], document.originalFileName, { type: document.mimeType }));
      const scan = await scanDocument(validated);
      if (scan.status !== 'CLEAN') throw new DocumentError(scan.status === 'INFECTED' ? 'SECURITY_SCAN_INFECTED' : 'SECURITY_SCAN_PENDING', 'O arquivo legado não passou pela verificação de segurança.');
      const storageKey = newStorageKey(document.userId, validated.extension);
      await storage.put(storageKey, validated.buffer, validated.detectedMimeType);
      await prisma.$transaction(async (tx) => {
        await tx.storedDocument.update({ where: { id: document.id }, data: { sha256: validated.sha256, detectedMimeType: validated.detectedMimeType, extension: validated.extension, sizeBytes: validated.buffer.length, storageProvider: storage.provider, storageStatus: 'AVAILABLE', storageKey, scanStatus: 'CLEAN', scanDetails: scan.details, analysisStatus: 'NOT_REQUESTED' } });
        await tx.documentAuditEvent.create({ data: { userId: document.userId, documentId: document.id, operation: 'DOCUMENT_MIGRATED_FROM_OPENAI', source: 'system', entityType: 'document', entityId: document.id, after: { storageProvider: storage.provider, sha256: validated.sha256 } } });
      });
      report.migrated += 1;
    } catch (error) {
      report.failed += 1;
      await prisma.storedDocument.update({ where: { id: document.id }, data: { storageStatus: 'MIGRATION_FAILED', analysisErrorCode: error instanceof DocumentError ? error.code : 'UNKNOWN', analysisErrorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Falha na migração do documento legado.' } });
      await auditDocument({ userId: document.userId, documentId: document.id, operation: 'DOCUMENT_MIGRATION_FAILED', source: 'system', entityType: 'document', entityId: document.id, after: { code: error instanceof DocumentError ? error.code : 'UNKNOWN' } });
    }
  }
  return report;
}
