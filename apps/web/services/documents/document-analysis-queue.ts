import 'server-only';

import { createConnection } from 'node:net';

const QUEUE_KEY = 'controlos:document-analysis';

type RedisValue = string | number | null | RedisValue[];

function redisConfiguration() {
  const raw = process.env.REDIS_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  return { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined, database: Number(url.pathname.slice(1) || 0) };
}

function encodeCommand(parts: string[]) {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
}

function parseReply(input: Buffer, offset = 0): { value: RedisValue; offset: number } | undefined {
  const end = input.indexOf('\r\n', offset);
  if (end === -1) return undefined;
  const byte = input.at(offset);
  if (byte === undefined) return undefined;
  const prefix = String.fromCharCode(byte);
  const header = input.subarray(offset + 1, end).toString();
  const next = end + 2;
  if (prefix === '+' || prefix === '-') return { value: header, offset: next };
  if (prefix === ':') return { value: Number(header), offset: next };
  if (prefix === '$') {
    const length = Number(header);
    if (length === -1) return { value: null, offset: next };
    if (input.length < next + length + 2) return undefined;
    return { value: input.subarray(next, next + length).toString(), offset: next + length + 2 };
  }
  if (prefix === '*') {
    const size = Number(header); const values: RedisValue[] = []; let cursor = next;
    for (let index = 0; index < size; index += 1) { const item = parseReply(input, cursor); if (!item) return undefined; values.push(item.value); cursor = item.offset; }
    return { value: values, offset: cursor };
  }
  return undefined;
}

async function command(parts: string[]): Promise<RedisValue> {
  const config = redisConfiguration();
  if (!config) throw new Error('REDIS_URL não configurada para a fila de documentos.');
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: config.host, port: config.port }); let received = Buffer.alloc(0); const timeout = setTimeout(() => socket.destroy(new Error('Timeout Redis')), 5_000);
    const commands = [config.password ? ['AUTH', config.password] : undefined, config.database ? ['SELECT', String(config.database)] : undefined, parts].filter((value): value is string[] => Boolean(value));
    socket.on('connect', () => socket.write(commands.map(encodeCommand).join('')));
    socket.on('data', (chunk) => { received = Buffer.concat([received, chunk]); let offset = 0; const replies: RedisValue[] = []; while (true) { const parsed = parseReply(received, offset); if (!parsed) break; replies.push(parsed.value); offset = parsed.offset; }
      if (replies.length < commands.length) return;
      clearTimeout(timeout); socket.end(); const last = replies.at(-1);
      if (typeof last === 'string' && /^(ERR|NOAUTH|WRONGPASS|NOPERM)/.test(last)) reject(new Error(last)); else resolve(last ?? null);
    });
    socket.on('error', (error) => { clearTimeout(timeout); reject(error); });
  });
}

/** Fila Redis real. O banco continua sendo a fonte idempotente de estado. */
export async function enqueueDocumentAnalysisJob(jobId: string) { await command(['LPUSH', QUEUE_KEY, jobId]); }

export async function dequeueDocumentAnalysisJob(): Promise<string | undefined> {
  const value = await command(['RPOP', QUEUE_KEY]);
  return typeof value === 'string' ? value : undefined;
}

/** Permite que o worker dê prioridade à fila, mas se recupere de uma queda
 * entre o commit do banco e o LPUSH. */
export async function dequeueDocumentAnalysisJobSafely(): Promise<string | undefined> {
  try { return await dequeueDocumentAnalysisJob(); }
  catch { return undefined; }
}
