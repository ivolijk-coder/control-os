import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { auditDocument } from '@/services/documents/document-core';
import { listPendingConversationTasks } from '@/services/conversation-tasks';

/**
 * `GET /api/nova/conversation-tasks` — lista `ConversationTask`s
 * `PENDING`/`WAITING_USER` do usuário (Fase D — "NOVA como centro da
 * experiência"). Genérico: nunca sabe se a task veio de um documento, de
 * um e-mail ou de qualquer produtor futuro — só repassa `type`/`title`/
 * `message`/`priority`/`actions`, exatamente como `ConversationTaskService`
 * devolve.
 *
 * `auditDocument` (nome herdado de quando só documentos geravam auditoria
 * — segue reutilizável aqui porque `documentId` já é opcional, ver
 * `services/documents/document-core.ts`) registra `CONVERSATION_TASK_PRESENTED`
 * a cada busca. Sem uma coluna `presentedAt` na tabela (ver schema.prisma —
 * a Fase B deliberadamente não criou uma), não há como distinguir "primeira
 * vez que a NOVA mostrou" de "reabriu a conversa de novo": aceitamos
 * eventos repetidos em troca de não precisar de estado novo — o
 * `correlationId` (o próprio id da task) já deixa claro que são o mesmo
 * evento revisitado, não uma pendência nova. A falha de auditoria nunca
 * derruba a resposta ao usuário — é um efeito colateral, não o motivo da
 * chamada.
 */
export async function GET() {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ success: false, message: 'Faça login para continuar a conversa.' }, { status: 401 });

  const tasks = await listPendingConversationTasks(userId);
  await Promise.all(tasks.map((task) =>
    auditDocument({
      userId,
      operation: 'CONVERSATION_TASK_PRESENTED',
      source: 'nova',
      entityType: 'conversation_task',
      entityId: task.id,
      correlationId: task.id,
    }).catch(() => undefined)
  ));

  return NextResponse.json({
    success: true,
    tasks: tasks.map((task) => ({
      id: task.id,
      type: task.type,
      priority: task.priority,
      title: task.title,
      message: task.message,
      actions: task.actions,
      createdAt: task.createdAt.toISOString(),
    })),
  });
}
