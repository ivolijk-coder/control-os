import { beforeAll } from 'vitest';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertSafeTestDatabaseUrl(raw: string | undefined): void {
  if (!raw) return;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('A URL do banco de testes é inválida.');
  }
  const database = url.pathname.toLowerCase();
  const explicitlyTest = /(?:^|[_-])test(?:$|[_-])/.test(database);
  if (!LOCAL_HOSTS.has(url.hostname) && !explicitlyTest) {
    throw new Error('Testes bloqueados: a URL do banco não é claramente local ou de teste.');
  }
  if (!explicitlyTest && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('Testes bloqueados: use um banco explicitamente identificado como teste.');
  }
}

beforeAll(() => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('A suíte automatizada só pode executar com NODE_ENV=test.');
  }
  assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
  if (process.env.OPENAI_DOCUMENT_ANALYSIS_ENABLED === undefined) {
    process.env.OPENAI_DOCUMENT_ANALYSIS_ENABLED = 'false';
  }
});
