import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auditDocument, documentStorage, DocumentError, newStorageKey, scanDocument, validateUploadedDocument } from './document-core';
import { enqueueDocumentAnalysisJob } from './document-analysis-queue';
import type { DocumentAnalysisProgressStage } from './contract-analysis';

function titleFromName(fileName: string): string { return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 160) || 'Documento sem título'; }

export async function uploadDocument(userId: string, file: File, titleInput?: string | null, source: 'manual' | 'nova' | 'api' = 'manual') {
  const validated = await validateUploadedDocument(file);
  const existing = await prisma.storedDocument.findFirst({
    where: { userId, sha256: validated.sha256, storageStatus: 'AVAILABLE', archivedAt: null },
    select: { id: true, title: true, originalFileName: true, mimeType: true, sizeBytes: true, kind: true, createdAt: true, analysisStatus: true, scanStatus: true },
  });
  if (existing) return { document: existing, duplicate: true };

  const storage = documentStorage();
  const storageKey = newStorageKey(userId, validated.extension);
  const title = titleInput?.trim().slice(0, 160) || titleFromName(file.name);
  const kind = validated.detectedMimeType === 'application/pdf' ? 'CONTRACT' as const : 'GENERAL' as const;
  let document;
  try {
    document = await prisma.storedDocument.create({
      data: {
        userId, title, displayName: title, originalFileName: file.name.slice(0, 255), mimeType: file.type || validated.detectedMimeType,
        detectedMimeType: validated.detectedMimeType, extension: validated.extension, sizeBytes: validated.buffer.length, sha256: validated.sha256,
        storageProvider: storage.provider, storageStatus: 'PENDING_UPLOAD', scanStatus: 'PENDING', kind,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await prisma.storedDocument.findFirst({
        where: { userId, sha256: validated.sha256 },
        select: { id: true, title: true, originalFileName: true, mimeType: true, sizeBytes: true, kind: true, createdAt: true, analysisStatus: true, scanStatus: true },
      });
      if (duplicate) return { document: duplicate, duplicate: true };
    }
    throw error;
  }
  const correlationId = await auditDocument({ userId, documentId: document.id, operation: 'DOCUMENT_CREATED', source, entityType: 'document', entityId: document.id, after: { name: document.originalFileName, sha256: validated.sha256, size: validated.buffer.length } });
  try {
    // Nenhum byte chega ao storage definitivo antes de ser aprovado pelo
    // scanner. Arquivos suspeitos ficam somente como metadados em quarentena.
    const scan = await scanDocument(validated);
    if (scan.status === 'INFECTED') {
      await prisma.storedDocument.update({ where: { id: document.id }, data: { storageStatus: 'QUARANTINED', scanStatus: 'INFECTED', scanDetails: scan.details, analysisStatus: 'NEEDS_REVIEW', analysisErrorCode: 'SECURITY_SCAN_INFECTED', analysisErrorMessage: 'Arquivo bloqueado pelo verificador de segurança.' } });
      await auditDocument({ userId, documentId: document.id, operation: 'DOCUMENT_SCAN_INFECTED', source: 'system', entityType: 'document', entityId: document.id, correlationId, after: scan.details });
      throw new DocumentError('SECURITY_SCAN_INFECTED', 'O arquivo foi bloqueado pela verificação de segurança. Ele não foi armazenado nem enviado para análise.');
    }
    if (scan.status !== 'CLEAN') {
      const code = scan.status === 'PENDING' ? 'SECURITY_SCAN_PENDING' : 'SCANNER_UNAVAILABLE';
      await prisma.storedDocument.update({ where: { id: document.id }, data: { storageStatus: 'PENDING_UPLOAD', scanStatus: scan.status === 'PENDING' ? 'PENDING' : 'FAILED', scanDetails: scan.details, analysisStatus: 'NEEDS_REVIEW', analysisErrorCode: code, analysisErrorMessage: 'O documento aguarda uma verificação de segurança confiável.' } });
      await auditDocument({ userId, documentId: document.id, operation: 'DOCUMENT_SCAN_BLOCKED', source: 'system', entityType: 'document', entityId: document.id, correlationId, after: scan.details });
      throw new DocumentError(code, 'O documento ainda não pode ser armazenado ou analisado: a verificação de segurança não foi concluída.', true);
    }
    await storage.put(storageKey, validated.buffer, validated.detectedMimeType);
    const updated = await prisma.storedDocument.update({
      where: { id: document.id },
      data: {
        storageKey, storageStatus: 'AVAILABLE', scanStatus: 'CLEAN', scanDetails: scan.details,
        analysisStatus: 'NOT_REQUESTED',
      },
      select: { id: true, title: true, originalFileName: true, mimeType: true, sizeBytes: true, kind: true, createdAt: true, analysisStatus: true, scanStatus: true },
    });
    await auditDocument({ userId, documentId: document.id, operation: 'DOCUMENT_UPLOAD_COMPLETED', source, entityType: 'document', entityId: document.id, correlationId, after: { storageProvider: storage.provider, scanStatus: 'CLEAN' } });
    return { document: updated, duplicate: false };
  } catch (error) {
    if (error instanceof DocumentError && (error.code === 'SECURITY_SCAN_INFECTED' || error.code === 'SECURITY_SCAN_PENDING' || error.code === 'SCANNER_UNAVAILABLE')) throw error;
    await storage.remove(storageKey).catch(() => undefined);
    await prisma.storedDocument.update({ where: { id: document.id }, data: { storageStatus: 'UPLOAD_FAILED', analysisStatus: 'FAILED', analysisErrorCode: error instanceof DocumentError ? error.code : 'UNKNOWN', analysisErrorMessage: 'Não foi possível concluir o armazenamento privado.' } });
    await auditDocument({ userId, documentId: document.id, operation: 'DOCUMENT_UPLOAD_FAILED', source, entityType: 'document', entityId: document.id, correlationId, after: { code: error instanceof DocumentError ? error.code : 'UNKNOWN' } });
    throw error;
  }
}

export async function listDocuments(userId: string, input: { q?: string; cursor?: string; includeArchived?: boolean; kind?: 'GENERAL' | 'CONTRACT'; folder?: string; tag?: string; analysisStatus?: string } = {}) {
  const take = 30;
  const documents = await prisma.storedDocument.findMany({
    where: {
      userId,
      ...(input.includeArchived ? {} : { archivedAt: null }),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.folder ? { folder: input.folder } : {}),
      ...(input.tag ? { tags: { has: input.tag } } : {}),
      ...(input.analysisStatus ? { analysisStatus: input.analysisStatus as never } : {}),
      ...(input.q ? { OR: [{ title: { contains: input.q, mode: 'insensitive' } }, { originalFileName: { contains: input.q, mode: 'insensitive' } }] } : {}),
    },
    take: take + 1, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, displayName: true, originalFileName: true, mimeType: true, detectedMimeType: true, extension: true, sizeBytes: true, kind: true, createdAt: true, archivedAt: true, analysisStatus: true, analysisErrorCode: true, analysisErrorMessage: true, scanStatus: true, storageStatus: true,
      importProposals: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, extractedData: true, validationWarnings: true, createdAt: true } } },
  });
  const nextCursor = documents.length > take ? documents.pop()?.id : undefined;
  return { documents, nextCursor };
}

export async function openDocument(userId: string, id: string) {
  const document = await prisma.storedDocument.findFirst({ where: { id, userId, archivedAt: null } });
  if (!document) return undefined;
  if (!document.storageKey || document.storageStatus !== 'AVAILABLE') throw new DocumentError('UNKNOWN', 'Este documento ainda não está disponível para download.');
  if (document.scanStatus !== 'CLEAN') throw new DocumentError('SECURITY_SCAN_PENDING', 'Este documento está guardado, mas o download só é liberado após a verificação de segurança.');
  const content = await documentStorage().get(document.storageKey);
  await auditDocument({ userId, documentId: id, operation: 'DOCUMENT_OPENED', source: 'manual', entityType: 'document', entityId: id });
  await auditDocument({ userId, documentId: id, operation: 'DOCUMENT_DOWNLOADED', source: 'manual', entityType: 'document', entityId: id });
  return { document, content };
}

export async function setDocumentArchived(userId: string, id: string, archived: boolean) {
  const current = await prisma.storedDocument.findFirst({ where: { id, userId } });
  if (!current) return undefined;
  const document = await prisma.storedDocument.update({ where: { id }, data: { archivedAt: archived ? new Date() : null, storageStatus: archived ? 'ARCHIVED' : (current.storageKey ? 'AVAILABLE' : current.storageStatus) } });
  await auditDocument({ userId, documentId: id, operation: archived ? 'DOCUMENT_ARCHIVED' : 'DOCUMENT_RESTORED', source: 'manual', entityType: 'document', entityId: id, before: { archivedAt: current.archivedAt }, after: { archivedAt: document.archivedAt } });
  return document;
}

export async function enqueueDocumentAnalysis(userId: string, id: string) {
  const document = await prisma.storedDocument.findFirst({ where: { id, userId, archivedAt: null } });
  if (!document) return undefined;
  if (document.scanStatus !== 'CLEAN') throw new DocumentError('SECURITY_SCAN_PENDING', 'O documento foi guardado, mas aguarda a verificação de segurança antes da análise.');
  if (document.detectedMimeType !== 'application/pdf') throw new DocumentError('UNSUPPORTED_FILE', 'Somente contratos em PDF podem gerar uma prévia financeira.');
  const job = await prisma.documentAnalysisJob.upsert({
    where: { documentId_analysisVersion: { documentId: document.id, analysisVersion: document.analysisVersion } },
    create: { documentId: document.id, analysisVersion: document.analysisVersion },
    // progressStage volta pro início (Fase F) — um reenfileiramento (nova
    // versão de análise, ou repetir depois de FAILED) refaz o pipeline
    // inteiro; o estágio da tentativa anterior nunca é reaproveitado.
    update: { status: 'QUEUED', progressStage: 'READING_DOCUMENT', runAfter: new Date(), attempts: 0, lockedAt: null, lockedBy: null, lastErrorCode: null, lastErrorMessage: null },
  });
  await prisma.storedDocument.update({ where: { id }, data: { analysisStatus: 'QUEUED', analysisErrorCode: null, analysisErrorMessage: null } });
  await auditDocument({ userId, documentId: id, operation: 'DOCUMENT_ANALYSIS_QUEUED', source: 'manual', entityType: 'document', entityId: id, after: { jobId: job.id, version: document.analysisVersion } });
  await enqueueDocumentAnalysisJob(job.id);
  return job;
}

export type DocumentAnalysisProgress = {
  documentId: string;
  analysisStatus: string;
  progressStage: DocumentAnalysisProgressStage | null;
  jobStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

/**
 * Leitura pra polling curto (Fase F — "NOVA como centro da experiência").
 * Deliberadamente barata: um `findFirst` pelo documento (já com índice por
 * `id`/`userId` no schema) e outro pelo job da versão de análise atual —
 * nunca a lista inteira de documentos, que é o que a tela de Documentos já
 * usa e seria cara demais pra chamar a cada poucos segundos.
 *
 * `progressStage`/`jobStatus` só existem enquanto houve pelo menos um job
 * pra esta versão (`null` se a análise nunca foi pedida). `analysisStatus`
 * (em `StoredDocument`) continua a fonte de verdade pro estado geral —
 * `progressStage` só refina o "PROCESSING" com o estágio humano; o
 * cliente para de sondar assim que `analysisStatus` sai de
 * QUEUED/PROCESSING.
 */
export async function getDocumentAnalysisProgress(userId: string, id: string): Promise<DocumentAnalysisProgress | undefined> {
  const document = await prisma.storedDocument.findFirst({
    where: { id, userId },
    select: { id: true, analysisStatus: true, analysisVersion: true, analysisErrorCode: true, analysisErrorMessage: true },
  });
  if (!document) return undefined;
  const job = await prisma.documentAnalysisJob.findFirst({
    where: { documentId: document.id, analysisVersion: document.analysisVersion },
    select: { status: true, progressStage: true },
  });
  return {
    documentId: document.id,
    analysisStatus: document.analysisStatus,
    progressStage: job?.progressStage ?? null,
    jobStatus: job?.status ?? null,
    errorCode: document.analysisErrorCode,
    errorMessage: document.analysisErrorMessage,
  };
}

export async function cancelDocumentAnalysis(userId: string, id: string) {
  const document = await prisma.storedDocument.findFirst({ where: { id, userId, archivedAt: null } });
  if (!document) return undefined;
  const job = await prisma.documentAnalysisJob.findFirst({ where: { documentId: id, analysisVersion: document.analysisVersion, status: 'QUEUED' } });
  if (!job) throw new DocumentError('UNKNOWN', 'Não há uma análise pendente para cancelar.');
  await prisma.$transaction([
    prisma.documentAnalysisJob.update({ where: { id: job.id }, data: { status: 'CANCELLED', lockedAt: null, lockedBy: null } }),
    prisma.storedDocument.update({ where: { id }, data: { analysisStatus: 'NOT_REQUESTED', analysisErrorCode: null, analysisErrorMessage: null } }),
  ]);
  await auditDocument({ userId, documentId: id, operation: 'DOCUMENT_ANALYSIS_CANCELLED', source: 'manual', entityType: 'document', entityId: id, after: { jobId: job.id } });
  return { id: job.id };
}
