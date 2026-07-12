import type { NovaIntentKind } from '../interfaces';

export interface NovaToolDescriptor {
  kind: NovaIntentKind;
  label: string;
  description: string;
}

/**
 * Catálogo descritivo das ferramentas que a Nova sabe executar — usado para
 * introspecção (ex.: listar capacidades da Nova em uma UI futura) e como
 * documentação viva.
 *
 * O despacho real (intenção → função) vive em `planner/` e `executor/`, via
 * `switch` exaustivo sobre a união discriminada `NovaIntent`. Um mapa
 * genérico "intent → função" heterogêneo exigiria um type cast para
 * recuperar a relação entre cada `kind` e o subtipo de intenção
 * correspondente — o que violaria a regra de nunca usar `as`/`any` como
 * atalho. Por isso o registro aqui é só dados, não funções.
 */
export const TOOL_REGISTRY: readonly NovaToolDescriptor[] = [
  {
    kind: 'registrar_despesa',
    label: 'Registrar despesa',
    description: 'Cria um lançamento de despesa e atualiza Financeiro, Dashboard e Histórico.',
  },
  {
    kind: 'registrar_receita',
    label: 'Registrar receita',
    description: 'Cria um lançamento de receita e atualiza caixa e indicadores.',
  },
  {
    kind: 'criar_lembrete',
    label: 'Criar lembrete',
    description: 'Cria uma missão de lembrete e adiciona ao histórico.',
  },
  {
    kind: 'criar_agenda',
    label: 'Criar compromisso',
    description: 'Cria um evento de agenda e um lembrete vinculado.',
  },
  {
    kind: 'criar_objetivo',
    label: 'Criar objetivo',
    description: 'Cria uma missão de meta/objetivo.',
  },
  {
    kind: 'criar_projeto',
    label: 'Criar projeto',
    description: 'Cria uma missão de projeto.',
  },
  {
    kind: 'registrar_divida',
    label: 'Registrar dívida',
    description: 'Cria uma dívida (com parcelas) e atualiza o Histórico.',
  },
  {
    kind: 'consultar_dividas',
    label: 'Consultar dívidas',
    description: 'Responde com um resumo das dívidas em aberto — não cria nem altera dados.',
  },
  {
    kind: 'desconhecido',
    label: 'Conversa livre',
    description: 'Nenhuma ação executável identificada — a Nova apenas responde.',
  },
];
