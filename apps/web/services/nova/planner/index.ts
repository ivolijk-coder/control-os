import type { NovaAction, NovaIntent } from '../interfaces';

/**
 * Monta o plano (checklist) de passos para uma intenção — puramente
 * declarativo, sem tocar em `useDataStore`. A UI usa este plano para o modo
 * de conversa com confirmação em checklist (Nova Experience — Fase 2); a
 * execução de fato acontece em `executor/`.
 *
 * `switch` exaustivo sobre a união discriminada `NovaIntent`: se um novo
 * `NovaIntentKind` for adicionado sem um caso aqui, a build quebra — não é
 * possível esquecer um plano silenciosamente.
 */
export function buildPlan(intent: NovaIntent): NovaAction[] {
  switch (intent.kind) {
    case 'registrar_despesa':
      return [
        { kind: 'criar_despesa', label: 'Registrar despesa' },
        { kind: 'registrar_timeline', label: 'Atualizar Financeiro, Dashboard e Histórico' },
      ];
    case 'registrar_receita':
      return [
        { kind: 'criar_receita', label: 'Registrar receita' },
        { kind: 'registrar_timeline', label: 'Atualizar caixa e indicadores' },
      ];
    case 'criar_lembrete':
      return [
        { kind: 'criar_missao', label: 'Criar missão de lembrete' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'criar_agenda':
      return [
        { kind: 'criar_evento_agenda', label: 'Criar compromisso na agenda' },
        { kind: 'criar_missao', label: 'Criar lembrete vinculado' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'criar_objetivo':
      return [
        { kind: 'criar_missao', label: 'Criar objetivo' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'criar_projeto':
      return [
        { kind: 'criar_missao', label: 'Criar projeto' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'registrar_divida':
      return [
        { kind: 'criar_divida', label: 'Registrar dívida' },
        { kind: 'registrar_timeline', label: 'Atualizar Financeiro' },
      ];
    case 'consultar_dividas':
    case 'consultar_dia':
      // Leitura, não gera checklist de execução — tratada direto em `conversation/`.
      return [];
    case 'desconhecido':
      return [];
  }
}
