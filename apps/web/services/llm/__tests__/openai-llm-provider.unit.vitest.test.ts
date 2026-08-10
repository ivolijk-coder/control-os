import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenAILLMProvider } from '../providers/openai-llm-provider';

function responseWith(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }),
  } as unknown as Response;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('OpenAILLMProvider — formato de saída aditivo (PR10.4)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'chave-de-teste');
    fetchMock = vi.fn().mockResolvedValue(responseWith('resposta'));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // P10 — BLOQUEANTE para o Decision Engine: sem `format`, nada muda.
  it('sem format continua pedindo json_object — Decision Engine não regride', async () => {
    await new OpenAILLMProvider().complete({ prompt: 'decida' });
    expect(sentBody(fetchMock)).toMatchObject({ text: { format: { type: 'json_object' } } });
  });

  it('format json explícito é idêntico ao default', async () => {
    await new OpenAILLMProvider().complete({ prompt: 'decida', format: 'json' });
    expect(sentBody(fetchMock)).toMatchObject({ text: { format: { type: 'json_object' } } });
  });

  it('format text pede prosa', async () => {
    await new OpenAILLMProvider().complete({ prompt: 'converse', format: 'text' });
    expect(sentBody(fetchMock)).toMatchObject({ text: { format: { type: 'text' } } });
  });

  // Contenção estrutural: nenhum dos formatos habilita Function Calling.
  it('nenhum formato envia tools ao provedor', async () => {
    await new OpenAILLMProvider().complete({ prompt: 'converse', format: 'text' });
    const body = sentBody(fetchMock);
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
    expect(body).not.toHaveProperty('functions');
  });
});
