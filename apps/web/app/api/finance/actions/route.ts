import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { actionRegistry } from '@/services/action-engine';
import { currentSessionUserId } from '@/services/auth/session';
import type { ActionKind } from '@/services/control-hub';

/**
 * Route Handler server-only (CONTROL OS — Fase 7: Financeiro completo).
 * Ponte HTTP fina sobre o Action Engine (`services/action-engine`) — igual
 * espírito de `channels/whatsapp` (um "canal" externo que aciona o mesmo
 * `ActionRegistry` que o CONTROL HUB já usa, sem duplicar NENHUMA lógica de
 * negócio).
 *
 * Por que esta rota existe: o chat real da NOVA (`services/ai`,
 * `ConversationService`/`ActionExecutor`) roda no NAVEGADOR — e
 * `PrismaFinanceRepository`/`@prisma/client` só podem rodar no servidor
 * (Node). As Actions de Finance do chat real (`services/ai/actions/
 * create-expense-action.ts` etc.) chamam esta rota via `fetch` (não
 * `PersistentFinanceService` diretamente) para persistir de verdade — ver
 * `services/ai/finance-bridge.ts`.
 *
 * Escopo deliberadamente restrito: só aceita os `ActionKind` do domínio
 * Financeiro (`FINANCE_ACTION_KINDS` abaixo) — nunca vira um "executar
 * qualquer Action" genérico só porque seria fácil; isso é uma decisão de
 * superfície de ataque, não uma limitação técnica.
 */
const FINANCE_ACTION_KINDS: readonly ActionKind[] = [
  'expense.create',
  'expense.update',
  'expense.delete',
  'income.create',
  'income.update',
  'income.delete',
  'transfer.create',
  'installment.create',
  'recurring.create',
  'account.create',
  'category.create',
];

function isFinanceActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && FINANCE_ACTION_KINDS.includes(value as ActionKind);
}

function isPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // A identidade nunca vem do payload enviado pelo navegador. Sem esta
  // verificação, a execução cai no usuário de compatibilidade do módulo
  // financeiro e poderia misturar dados entre pessoas.
  const userId = currentSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Faça login para registrar ou alterar dados financeiros.' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Corpo da requisição não é um JSON válido.' }, { status: 400 });
  }

  if (typeof rawBody !== 'object' || rawBody === null || !('kind' in rawBody) || !('payload' in rawBody)) {
    return NextResponse.json({ success: false, message: 'Esperado { kind, payload }.' }, { status: 400 });
  }

  const { kind, payload } = rawBody;
  if (!isFinanceActionKind(kind)) {
    return NextResponse.json({ success: false, message: `Ação financeira desconhecida: "${String(kind)}".` }, { status: 400 });
  }
  if (!isPayload(payload)) {
    return NextResponse.json({ success: false, message: '"payload" precisa ser um objeto.' }, { status: 400 });
  }

  try {
    const [result] = await actionRegistry.execute([{ kind, payload }], userId);
    return NextResponse.json(result ?? { success: false, message: 'Nenhum resultado devolvido pelo Action Engine.' });
  } catch (error) {
    console.error('Falha ao executar ação financeira autenticada:', error);
    return NextResponse.json({ success: false, message: 'Não foi possível concluir a ação financeira agora.' }, { status: 500 });
  }
}
