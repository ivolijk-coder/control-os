/**
 * Descrição das Tools no formato "function calling" da OpenAI (CONTROL OS
 * — Etapa 4: Preparação profissional para OpenAI GPT-5.5).
 *
 * Puramente descritivo — nenhuma função aqui executa nada. A OpenAI só usa
 * isto para ESCOLHER qual ferramenta chamar e com quais argumentos; quem de
 * fato executa é sempre `IntentResolver` → `ActionExecutor` →
 * `useDataStore`, exatamente como já acontece com o `MockAIProvider`. "A
 * OpenAI nunca grava diretamente no banco. Ela apenas escolhe qual Tool
 * executar."
 *
 * Um schema por `NovaIntentKind` que já tem uma Action dedicada
 * (`services/ai/actions/`) — os mesmos 5 + dívida que `IntentResolver` já
 * resolve hoje. `criar_projeto`/`registrar_divida` cobrem o restante do
 * ciclo (dívida tem Action; projeto ainda cai no executor legado — ver
 * `IntentResolver` —, mas continua útil ter o schema pra classificação).
 */

export interface ToolSchemaProperty {
  type: 'string' | 'number';
  description: string;
}

export interface ToolSchema {
  /** Igual ao `NovaIntentKind` correspondente — `OpenAIProvider` mapeia de volta 1:1. */
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolSchemaProperty>;
    required: string[];
  };
}

export const INTENT_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'registrar_despesa',
    description: 'Registrar uma despesa (dinheiro que saiu) informada pelo usuário.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Valor da despesa, em reais.' },
        description: { type: 'string', description: 'Descrição curta da despesa.' },
      },
      required: ['amount', 'description'],
    },
  },
  {
    name: 'registrar_receita',
    description: 'Registrar uma receita (dinheiro que entrou) informada pelo usuário.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Valor da receita, em reais.' },
        description: { type: 'string', description: 'Descrição curta da receita.' },
      },
      required: ['amount', 'description'],
    },
  },
  {
    name: 'criar_lembrete',
    description: 'Criar um lembrete simples para o usuário.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'O que o usuário quer ser lembrado de fazer.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'criar_agenda',
    description: 'Criar um compromisso na agenda do usuário.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do compromisso.' },
        time: { type: 'string', description: 'Horário no formato HH:MM, se mencionado.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'criar_objetivo',
    description: 'Criar uma meta/objetivo pessoal para o usuário.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Descrição da meta.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'criar_projeto',
    description: 'Criar um projeto pessoal para o usuário (ex.: uma viagem, uma reforma).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Descrição do projeto.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'registrar_divida',
    description: 'Registrar uma dívida parcelada informada pelo usuário.',
    parameters: {
      type: 'object',
      properties: {
        totalAmount: { type: 'number', description: 'Valor total da dívida, em reais.' },
        installments: { type: 'number', description: 'Número de parcelas (1 se à vista).' },
        description: { type: 'string', description: 'Descrição curta da dívida.' },
      },
      required: ['totalAmount', 'description'],
    },
  },
];
