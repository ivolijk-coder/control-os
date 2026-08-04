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
    case 'transferir_conta':
      // CONTROL OS — Fase 7: um único passo — `CreateTransferAction` não
      // escreve `addTimelineEvent` (só persiste via `finance-bridge`, ver
      // doc da classe), então não há passo de "Atualizar histórico" aqui.
      return [{ kind: 'criar_transferencia', label: 'Transferir entre contas' }];
    case 'parcelar_despesa':
      return [{ kind: 'criar_parcelamento', label: 'Parcelar despesa' }];
    case 'criar_emprestimo':
      return [{ kind: 'criar_emprestimo', label: 'Cadastrar empréstimo' }];
    case 'criar_financiamento':
      return [{ kind: 'criar_financiamento', label: 'Cadastrar financiamento' }];
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
    case 'excluir_agenda':
      return [{ kind: 'excluir_evento_agenda', label: 'Excluir compromisso da agenda' }];
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
    case 'criar_habito':
      return [
        { kind: 'criar_habito', label: 'Criar hábito' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'criar_viagem':
      return [
        { kind: 'criar_viagem', label: 'Criar viagem' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'criar_documento':
      return [
        { kind: 'criar_documento', label: 'Adicionar documento' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'criar_bem':
      return [
        { kind: 'criar_bem', label: 'Registrar bem patrimonial' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'criar_nota':
      return [
        { kind: 'criar_nota', label: 'Criar nota' },
        { kind: 'registrar_timeline', label: 'Adicionar ao histórico' },
      ];
    case 'pagar_conta_fixa':
      return [{ kind: 'pagar_conta_fixa', label: 'Registrar pagamento da conta fixa' }];
    case 'consultar_contas_vencendo':
      return [{ kind: 'consultar_contas_vencendo', label: 'Consultar contas a vencer' }];
    case 'consultar_dividas':
    case 'consultar_dia':
      // Leitura, não gera checklist de execução — tratada direto em `conversation/`.
      return [];
    case 'desconhecido':
      return [];
  }
}
