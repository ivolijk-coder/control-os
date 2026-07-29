import 'server-only';

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';

const MAX_UPLOAD_BYTES = Number(process.env.DOCUMENT_MAX_UPLOAD_BYTES ?? 15 * 1024 * 1024);
const MIN_UPLOAD_BYTES = 8;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt']);

// O `Buffer` do Node usa `ArrayBufferLike`, enquanto as APIs Web do Next
// exigem `ArrayBuffer`. Esta cópia também impede compartilhar o buffer mutável
// da validação com um provider externo.
function webBody(buffer: Buffer): ArrayBuffer {
  return Uint8Array.from(buffer).buffer;
}

export type DocumentFailureCode =
  | 'INVALID_FILE' | 'UNSUPPORTED_FILE' | 'PASSWORD_PROTECTED' | 'FILE_TOO_LARGE'
  | 'MODEL_UNSUPPORTED' | 'PROVIDER_RATE_LIMIT' | 'PROVIDER_TIMEOUT' | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_TEMPORARY_ERROR' | 'EXTRACTION_INVALID' | 'SECURITY_SCAN_PENDING'
  | 'SECURITY_SCAN_INFECTED' | 'SCANNER_UNAVAILABLE' | 'UNKNOWN';

export class DocumentError extends Error {
  constructor(
    public readonly code: DocumentFailureCode,
    message: string,
    public readonly retryable = false,
    public readonly diagnostics?: Record<string, string | number | boolean>,
  ) { super(message); }
}

export type ValidatedUpload = {
  buffer: Buffer; sha256: string; extension: string; detectedMimeType: string; pageCount?: number;
};

function extensionOf(name: string): string {
  const value = name.split('.').pop()?.toLowerCase() ?? '';
  return value === 'jpeg' ? 'jpg' : value;
}

function detectedMime(buffer: Buffer): string | undefined {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return undefined;
}

function mimeMatchesExtension(extension: string, mime: string): boolean {
  return (extension === 'pdf' && mime === 'application/pdf')
    || (extension === 'jpg' && mime === 'image/jpeg')
    || (extension === 'png' && mime === 'image/png')
    || (extension === 'webp' && mime === 'image/webp');
}

/** Valida conteúdo real e não apenas nome ou MIME fornecido pelo navegador. */
export async function validateUploadedDocument(file: File): Promise<ValidatedUpload> {
  if (file.size < MIN_UPLOAD_BYTES) throw new DocumentError('INVALID_FILE', 'O arquivo está vazio ou incompleto.');
  if (file.size > MAX_UPLOAD_BYTES) throw new DocumentError('FILE_TOO_LARGE', `Envie um arquivo de até ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new DocumentError('UNSUPPORTED_FILE', 'Envie PDF, JPG, PNG, WebP ou TXT.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectedMime(buffer);
  if (extension === 'txt') {
    // Texto simples não tem assinatura. Rejeita NUL, comum em binários disfarçados.
    if (buffer.includes(0)) throw new DocumentError('INVALID_FILE', 'O arquivo não é um texto simples válido.');
  } else if (!mime || !mimeMatchesExtension(extension, mime)) {
    throw new DocumentError('INVALID_FILE', 'O conteúdo do arquivo não corresponde ao formato informado.');
  }
  if (mime === 'application/pdf') {
    const firstChunk = buffer.subarray(0, Math.min(buffer.length, 2 * 1024 * 1024)).toString('latin1');
    if (/\/Encrypt\b/.test(firstChunk)) throw new DocumentError('PASSWORD_PROTECTED', 'PDF protegido por senha não pode ser analisado. Remova a senha e envie novamente.');
    const pageCount = (firstChunk.match(/\/Type\s*\/Page\b/g) ?? []).length;
    if (pageCount === 0) throw new DocumentError('INVALID_FILE', 'O PDF não possui páginas legíveis.');
    return { buffer, extension, detectedMimeType: mime, pageCount, sha256: createHash('sha256').update(buffer).digest('hex') };
  }
  return { buffer, extension, detectedMimeType: mime ?? 'text/plain', sha256: createHash('sha256').update(buffer).digest('hex') };
}

export interface PrivateDocumentStorage {
  provider: 'S3' | 'LOCAL_DEVELOPMENT';
  put(key: string, content: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class LocalDevelopmentStorage implements PrivateDocumentStorage {
  provider = 'LOCAL_DEVELOPMENT' as const;
  private root = process.env.DOCUMENT_STORAGE_LOCAL_DIR ?? join(process.cwd(), '.document-storage');
  private pathFor(key: string) { return join(this.root, ...key.split('/')); }
  async put(key: string, content: Buffer) { const target = this.pathFor(key); await mkdir(join(target, '..'), { recursive: true }); await writeFile(target, content, { mode: 0o600 }); }
  async get(key: string) { return readFile(this.pathFor(key)); }
  async remove(key: string) { await rm(this.pathFor(key), { force: true }); }
  async exists(key: string) { return readFile(this.pathFor(key)).then(() => true).catch(() => false); }
}

/**
 * Provider S3 compatível. A assinatura AWS SigV4 fica deliberadamente no
 * servidor; chave, bucket e storageKey nunca são enviados ao navegador.
 * A configuração é obrigatória em produção, evitando que a VPS vire storage
 * definitivo por acidente.
 */
class S3CompatibleStorage implements PrivateDocumentStorage {
  provider = 'S3' as const;
  private endpoint = (process.env.DOCUMENT_S3_ENDPOINT ?? '').replace(/\/$/, '');
  private bucket = process.env.DOCUMENT_S3_BUCKET ?? '';
  private accessKey = process.env.DOCUMENT_S3_ACCESS_KEY ?? '';
  private secretKey = process.env.DOCUMENT_S3_SECRET_KEY ?? '';
  private region = process.env.DOCUMENT_S3_REGION ?? 'us-east-1';

  private signingKey(date: string) {
    const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
    return hmac(hmac(hmac(hmac(`AWS4${this.secretKey}`, date), this.region), 's3'), 'aws4_request');
  }

  private async request(method: 'PUT' | 'GET' | 'DELETE' | 'HEAD', key: string, body?: Buffer, mimeType?: string): Promise<Response> {
    if (!this.endpoint || !this.bucket || !this.accessKey || !this.secretKey) {
      throw new DocumentError('UNKNOWN', 'O armazenamento privado de documentos não está configurado.');
    }
    const endpoint = new URL(this.endpoint);
    const canonicalUri = `/${encodeURIComponent(this.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const payloadHash = createHash('sha256').update(body ?? Buffer.alloc(0)).digest('hex');
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const scope = `${date}/${this.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const signature = createHmac('sha256', this.signingKey(date)).update(stringToSign).digest('hex');
    const headers: Record<string, string> = {
      host: endpoint.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (mimeType) headers['content-type'] = mimeType;
    return fetch(`${endpoint.origin}${canonicalUri}`, { method, headers, body: body ? webBody(body) : undefined });
  }

  async put(key: string, content: Buffer, mimeType: string) {
    const response = await this.request('PUT', key, content, mimeType);
    if (!response.ok) throw new DocumentError('PROVIDER_TEMPORARY_ERROR', 'O storage privado recusou o arquivo.', response.status >= 500);
  }
  async get(key: string) {
    const response = await this.request('GET', key);
    if (!response.ok) throw new DocumentError('PROVIDER_TEMPORARY_ERROR', 'Não foi possível recuperar o documento.', response.status >= 500);
    return Buffer.from(await response.arrayBuffer());
  }
  async remove(key: string) { await this.request('DELETE', key); }
  async exists(key: string) { return (await this.request('HEAD', key)).ok; }
}

export function documentStorage(): PrivateDocumentStorage {
  const provider = process.env.DOCUMENT_STORAGE_PROVIDER;
  if (provider === 's3') return new S3CompatibleStorage();
  if (process.env.NODE_ENV === 'production') throw new DocumentError('UNKNOWN', 'Storage privado de documentos não configurado. Configure DOCUMENT_STORAGE_PROVIDER=s3 antes de aceitar uploads.');
  return new LocalDevelopmentStorage();
}

export function newStorageKey(userId: string, extension: string): string { return `documents/${userId}/${randomUUID()}.${extension}`; }

export async function auditDocument(input: {
  userId: string; documentId?: string; proposalId?: string; operation: string; source: 'manual' | 'nova' | 'api' | 'system'; entityType: string; entityId: string; before?: unknown; after?: unknown; correlationId?: string;
}) {
  const correlationId = input.correlationId ?? randomUUID();
  await prisma.documentAuditEvent.create({ data: { ...input, correlationId, before: input.before as never, after: input.after as never } });
  return correlationId;
}

/** Sem um antivírus/serviço configurado, arquivo nunca é tratado como limpo. */
export async function scanDocument(_input: ValidatedUpload): Promise<{ status: 'CLEAN' | 'INFECTED' | 'FAILED' | 'PENDING'; details: Record<string, string> }> {
  const provider = process.env.DOCUMENT_SCANNER_PROVIDER ?? (process.env.DOCUMENT_SCANNER_ENDPOINT ? 'http' : process.env.DOCUMENT_CLAMAV_HOST ? 'clamav' : undefined);
  if (!provider) return { status: 'PENDING', details: { reason: 'scanner_not_configured' } };
  if (provider === 'clamav') return scanWithClamAV(_input.buffer);
  if (provider !== 'http' || !process.env.DOCUMENT_SCANNER_ENDPOINT) return { status: 'FAILED', details: { reason: 'scanner_invalid_configuration' } };
  const timeout = Math.max(1_000, Number(process.env.DOCUMENT_SCANNER_TIMEOUT_MS ?? 30_000));
  try {
    // O scanner recebe bytes antes de qualquer persistência definitiva. O
    // serviço deve responder `{ clean: boolean, engine?: string }`.
    const response = await fetch(process.env.DOCUMENT_SCANNER_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: webBody(_input.buffer), signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) return { status: 'FAILED', details: { reason: 'scanner_http_error', httpStatus: String(response.status) } };
    const result = await response.json().catch(() => null) as { clean?: boolean; engine?: string } | null;
    if (!result || typeof result.clean !== 'boolean') return { status: 'FAILED', details: { reason: 'scanner_invalid_response' } };
    if (!result.clean) return { status: 'INFECTED', details: { reason: 'scanner_detected_threat', engine: result.engine ?? 'external' } };
    return { status: 'CLEAN', details: { scanner: result.engine ?? 'external' } };
  } catch {
    return { status: 'FAILED', details: { reason: 'scanner_unavailable' } };
  }
}

/** Cliente do protocolo INSTREAM do ClamAV. O scanner continua isolado por
 * `scanDocument`, portanto nenhum serviço de documento conhece o provider. */
async function scanWithClamAV(content: Buffer): Promise<{ status: 'CLEAN' | 'INFECTED' | 'FAILED'; details: Record<string, string> }> {
  const host = process.env.DOCUMENT_CLAMAV_HOST ?? 'clamav';
  const port = Number(process.env.DOCUMENT_CLAMAV_PORT ?? 3310);
  const timeout = Math.max(1_000, Number(process.env.DOCUMENT_SCANNER_TIMEOUT_MS ?? 30_000));
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let response = '';
    let settled = false;
    const finish = (result: { status: 'CLEAN' | 'INFECTED' | 'FAILED'; details: Record<string, string> }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'FAILED', details: { reason: 'clamav_timeout', host } }), timeout);
    socket.once('error', () => finish({ status: 'FAILED', details: { reason: 'clamav_unavailable', host } }));
    socket.on('data', (chunk) => { response += chunk.toString('utf8'); });
    socket.once('end', () => {
      if (/\bOK\b/.test(response)) finish({ status: 'CLEAN', details: { scanner: 'clamav', host } });
      else if (/\bFOUND\b/.test(response)) finish({ status: 'INFECTED', details: { scanner: 'clamav', host, result: response.trim().slice(0, 240) } });
      else finish({ status: 'FAILED', details: { reason: 'clamav_invalid_response', result: response.trim().slice(0, 240) } });
    });
    socket.once('connect', () => {
      const header = Buffer.from('zINSTREAM\0');
      const size = Buffer.alloc(4); size.writeUInt32BE(content.length);
      socket.write(Buffer.concat([header, size, content, Buffer.alloc(4)]));
      socket.end();
    });
  });
}
