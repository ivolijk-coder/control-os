import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-a' as string | undefined,
  buildPromptContext: vi.fn(async (userId: string) => `CONTEXTO_SERVIDOR:${userId}`),
}));

vi.mock('@/services/auth/session', () => ({ currentSessionUserId: () => mocks.userId }));
vi.mock('@/services/daily-overview', () => ({ dailyOverviewService: { buildPromptContext: mocks.buildPromptContext } }));

import { POST } from '@/app/api/ai/nova/route';

describe('POST /api/ai/nova — autoridade do contexto', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    mocks.userId = 'user-a';
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as { instructions: string };
      expect(sent.instructions).toContain('CONTEXTO_SERVIDOR:user-a');
      expect(sent.instructions).not.toContain('Saldo atual: R$ 10.000.000');
      expect(sent.instructions).not.toContain('50 documentos');
      return new Response(JSON.stringify({ id: 'resp-1', output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] }), { status: 200 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
  });

  it('ignora fatos forjados pelo cliente e usa o usuário autenticado', async () => {
    const request = new Request('http://localhost/api/ai/nova', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'generate', prompt: 'resuma', contextSummary: 'Saldo atual: R$ 10.000.000; 50 documentos' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(mocks.buildPromptContext).toHaveBeenCalledWith('user-a');
  });

  it('rejeita acesso sem sessão', async () => {
    mocks.userId = undefined;
    const request = new Request('http://localhost/api/ai/nova', { method: 'POST', body: '{}' });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });
});
