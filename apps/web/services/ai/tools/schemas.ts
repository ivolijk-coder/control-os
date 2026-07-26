/**
 * Descrição das Tools no formato "function calling" da OpenAI (CONTROL OS
 * — Etapa 4: Preparação profissional para OpenAI GPT-5.5 / Etapa 5: OpenAI
 * GPT-5.5 como cérebro da NOVA).
 *
 * Puramente descritivo — nenhuma função aqui executa nada. A OpenAI só usa
 * isto para ESCOLHER qual ferramenta chamar e com quais argumentos; quem de
 * fato executa é sempre `IntentResolver` → `ActionExecutor` →
 * `useDataStore`, exatamente como já acontece com o `MockAIProvider`. "A
 * OpenAI nunca grava diretamente no banco. Ela apenas escolhe qual Tool
 * executar."
 *
 * Cobre os 12 domínios acionáveis do CONTROL OS — um schema por
 * `NovaIntentKind` que tem uma Action ou executor dedicado (`criar_projeto`
 * e `registrar_divida` caem no executor legado — ver `IntentResolver` —,
 * mas o schema segue igual, só quem executa por baixo muda). As intents de
 * consulta (`consultar_dividas`, `consultar_dia`) NÃO viram tool: no modo
 * `reason` (Etapa 5) a OpenAI já recebe um resumo do contexto real em
 * `instructions` e responde direto a partir dele — "nunca enviar contexto
 * desnecessário" também vale ao contrário, não faz sentido uma tool
 * só para reler o que já está na mensagem.
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
    name: 'transferir_conta',
    description:
      'Transferir dinheiro entre duas contas do usuário (ex.: "transferi 500 para o Nubank"). Não altera o patrimônio total — só move saldo de uma conta para outra.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Valor transferido, em reais.' },
        toAccountName: { type: 'string', description: 'Conta de destino (ex.: "Nubank", "Poupança").' },
        fromAccountName: {
          type: 'string',
          description: 'Conta de origem, se mencionada. Se ausente, só pode ser inferida quando o usuário tiver exatamente uma conta ativa.',
        },
      },
      required: ['amount', 'toAccountName'],
    },
  },
  {
    name: 'parcelar_despesa',
    description:
      'Parcelar uma despesa em N lançamentos mensais ligados (ex.: "parcela esse notebook em 12x"). Só chamar quando o valor total E o número de parcelas forem conhecidos.',
    parameters: {
      type: 'object',
      properties: {
        totalAmount: { type: 'number', description: 'Valor total da compra, em reais.' },
        installments: { type: 'number', description: 'Número de parcelas.' },
        description: { type: 'string', description: 'Descrição curta da compra (ex.: "Notebook").' },
      },
      required: ['totalAmount', 'installments', 'description'],
    },
  },
  {
    name: 'criar_lembrete',
    description: 'Criar um lembrete simples para o usuário.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'O que o usuário quer ser lembrado de fazer.' },
        dueDate: {
          type: 'string',
          description:
            'Data do lembrete, formato AAAA-MM-DD, se o usuário mencionar uma referência de tempo (ex.: "amanhã", "sexta", "dia 20"). Resolva a referência usando a data de hoje informada no contexto. Se não houver nenhuma referência de tempo, omita este campo.',
        },
        time: { type: 'string', description: 'Horário no formato HH:MM, se mencionado (ex.: "às 9h" → "09:00").' },
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
        date: {
          type: 'string',
          description:
            'Data do compromisso, formato AAAA-MM-DD, se o usuário mencionar uma referência de tempo (ex.: "sexta", "amanhã", "semana que vem", "dia 20"). Resolva a referência usando a data de hoje informada no contexto. Se não houver nenhuma referência de tempo, omita este campo (o compromisso cai em hoje).',
        },
        time: { type: 'string', description: 'Horário no formato HH:MM, se mencionado.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'excluir_agenda',
    description:
      'Excluir um compromisso específico da agenda. Use somente quando o usuário pedir claramente para excluir/remover/cancelar e somente com o eventId exato listado no contexto. Nunca adivinhe um ID.',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'ID exato do compromisso, copiado do contexto da agenda.' },
        title: { type: 'string', description: 'Título do compromisso correspondente, para a confirmação mostrada ao usuário.' },
      },
      required: ['eventId', 'title'],
    },
  },
  {
    name: 'criar_objetivo',
    description: 'Criar uma meta/objetivo pessoal para o usuário.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Descrição da meta.' },
        dueDate: {
          type: 'string',
          description:
            'Prazo da meta, formato AAAA-MM-DD, só se o usuário mencionar um (ex.: "até dezembro", "em 3 meses"). Se mencionar só mês/ano, use o último dia do mês; se não mencionar nenhum prazo, omita este campo.',
        },
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
  {
    name: 'criar_habito',
    description: 'Criar um hábito recorrente que o usuário quer acompanhar (ex.: malhar, ler, meditar).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Nome do hábito.' },
        category: { type: 'string', description: 'Categoria do hábito (ex.: Saúde, Estudo). Se não mencionada, pode omitir.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'criar_viagem',
    description:
      'Criar uma viagem planejada pelo usuário. Só chamar quando destino E pelo menos uma referência de período forem conhecidos (datas exatas OU só o mês, ex.: "em outubro") — se não houver NENHUMA referência de tempo, pergunte antes de chamar esta ferramenta.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Cidade ou país de destino.' },
        startDate: {
          type: 'string',
          description:
            'Data de ida, formato AAAA-MM-DD. Se o usuário mencionar datas exatas, use-as. Se mencionar só o mês (ex.: "em outubro", sem dia exato), use o primeiro dia desse mês — resolva o ano usando a data de hoje informada no contexto.',
        },
        endDate: {
          type: 'string',
          description:
            'Data de volta, formato AAAA-MM-DD. Se o usuário mencionar datas exatas, use-as. Se mencionar só o mês (sem dia exato), use o último dia desse mesmo mês.',
        },
        budget: { type: 'number', description: 'Orçamento estimado da viagem, em reais, se mencionado.' },
      },
      required: ['destination', 'startDate', 'endDate'],
    },
  },
  {
    name: 'criar_documento',
    description: 'Adicionar um documento pessoal do usuário (ex.: RG, passaporte, contrato).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Nome do documento.' },
        category: { type: 'string', description: 'Categoria do documento (ex.: Identidade, Contrato). Se não mencionada, pode omitir.' },
        expiresAt: { type: 'string', description: 'Data de validade, formato AAAA-MM-DD, se mencionada.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'criar_bem',
    description: 'Registrar um bem patrimonial do usuário (ex.: carro, imóvel, equipamento).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do bem.' },
        estimatedValue: { type: 'number', description: 'Valor estimado do bem, em reais.' },
        category: { type: 'string', description: 'Categoria do bem (ex.: Veículo, Imóvel). Se não mencionada, pode omitir.' },
      },
      required: ['name', 'estimatedValue'],
    },
  },
  {
    name: 'criar_nota',
    description: 'Criar uma nota de texto livre pedida pelo usuário.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título da nota.' },
        content: { type: 'string', description: 'Conteúdo da nota.' },
        category: { type: 'string', description: 'Categoria da nota, se mencionada.' },
      },
      required: ['title', 'content'],
    },
  },
];
