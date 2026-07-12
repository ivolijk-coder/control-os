export interface MockNovaReply {
  content: string;
  checklist: string[];
}

interface MockReplyRule {
  test: (normalizedText: string) => boolean;
  reply: MockNovaReply;
}

const RULES: MockReplyRule[] = [
  {
    test: (t) => /lembr|agend|calend|dia \d/.test(t),
    reply: {
      content: 'Anotado. Vou te lembrar no momento certo.',
      checklist: ['Missão criada', 'Lembrete criado', 'Calendário atualizado'],
    },
  },
  {
    test: (t) => /miss[aã]o|objetivo|projeto/.test(t),
    reply: {
      content: 'Missão registrada no espaço certo.',
      checklist: ['Missão criada', 'Adicionada à Timeline'],
    },
  },
  {
    test: (t) => /gast|financ|receita|fatura|pagamento|das\b/.test(t),
    reply: {
      content: 'Dei uma olhada no seu financeiro.',
      checklist: ['Resumo financeiro atualizado', 'Adicionado à Timeline'],
    },
  },
  {
    test: (t) => /empresa|cliente|equipe/.test(t),
    reply: {
      content: 'Aqui está um retrato rápido do seu ecossistema.',
      checklist: ['Painel do dia atualizado'],
    },
  },
  {
    test: (t) => /organiz|prioriz|dia\b/.test(t),
    reply: {
      content: 'Reorganizei o que importa primeiro.',
      checklist: ['Prioridades do dia atualizadas', 'Timeline reorganizada'],
    },
  },
];

const DEFAULT_REPLY: MockNovaReply = {
  content: 'Recebido — anotei isso para você.',
  checklist: ['Adicionado à Timeline'],
};

/**
 * generateMockNovaReply — resposta local e determinística (Nova Experience
 * — Fase 2).
 *
 * Não é IA real: apenas casamento de palavras-chave, para dar naturalidade
 * ao Modo de Conversa enquanto a arquitetura real (services/ai, executor,
 * memory, tool registry) não existe — isso é explicitamente uma fase
 * futura. Nenhum dado de verdade é criado por esta função; ela só decide
 * qual confirmação visual mockada aparece na conversa.
 */
export function generateMockNovaReply(userText: string): MockNovaReply {
  const normalized = userText.toLowerCase();
  const matchedRule = RULES.find((rule) => rule.test(normalized));
  return matchedRule?.reply ?? DEFAULT_REPLY;
}
