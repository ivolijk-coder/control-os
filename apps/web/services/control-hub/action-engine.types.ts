/**
 * Vocabulário de ações que o Action Engine executa — CONTROL HUB Fase 4:
 * "o primeiro Action Engine real". Cada valor é `<domínio>.<verbo>`.
 *
 * Fase 1 tinha só 7 valores (um verbo por domínio); Fase 4 adiciona
 * `calendar.update`/`calendar.delete`/`expense.update`/`expense.delete` —
 * exatamente o catálogo de 11 ações do pedido original. Deliberadamente NÃO
 * adicionamos `habit.create`/`goal.create`/`asset.*` nesta fase: o pedido
 * original não os lista, e "não criar abstrações desnecessárias" vale tanto
 * para código quanto para o catálogo de ações — cada Action nova nasce
 * quando um caso de uso real pedir, nunca especulativamente.
 *
 * Fase 6 (Persistência real) adiciona `income.*` — "Implementar: Receitas
 * (createIncome/updateIncome/deleteIncome/listIncome)". Mesmo padrão de
 * `expense.*` (a mesma entidade `Transaction`/`FinanceEntry`, só o `type`
 * muda); `registrar_receita` (`NovaIntent`, já reconhecida por `parseIntent`
 * desde antes desta fase) agora tem uma Action real de verdade pra virar
 * (`MockDecisionProvider` já mapeava isso — ver `decision-engine`/
 * `services/decision-engine/mock-decision-provider.ts`).
 *
 * Mesmo espírito do `NovaActionKind` já usado em `services/nova/interfaces`
 * (nunca duplicar): aquele é o vocabulário interno de execução contra
 * `useDataStore` (acoplado ao navegador); este é o vocabulário do Action
 * Engine (server-side, contra Module Services). Os dois convergem em
 * significado ("registrar uma despesa"), não em tipo — ver
 * `services/action-engine/actions/` para a implementação real, que fala com
 * `services/modules/*` (Module Services), nunca com `NovaContext`/Zustand.
 *
 * Fase 7 (Financeiro completo) adiciona `transfer.create`/`installment.create`/
 * `recurring.create`/`account.create`/`category.create` — o catálogo pedido
 * explicitamente ("Expandir as Actions existentes... transfer.create,
 * installment.create, recurring.create, account.create, category.create").
 */
export type ActionKind =
  | 'calendar.create'
  | 'calendar.update'
  | 'calendar.delete'
  | 'expense.create'
  | 'expense.update'
  | 'expense.delete'
  | 'income.create'
  | 'income.update'
  | 'income.delete'
  | 'transfer.create'
  | 'installment.create'
  | 'recurring.create'
  | 'account.create'
  | 'category.create'
  | 'fixed-occurrence.pay'
  | 'fixed-occurrence.list_due'
  | 'financial_status.get'
  | 'task.create'
  | 'note.create'
  | 'habit.update'
  | 'goal.update'
  | 'document.store';

/**
 * Um pedido de execução — o Decision Engine produz uma lista destes, o
 * Action Engine consome.
 *
 * CONTROL HUB — Fase 4: `confidence` chega aqui em vez de num `DecisionResult`
 * paralelo com o formato `{ action, confidence, parameters }` sugerido no
 * pedido original — `DecisionResult` (`decision-engine.types.ts`) já existe
 * desde a Fase 1 e cobre mais casos (`reply`/`ask_clarification`/`noop`, não
 * só `execute_actions`), e já carrega uma LISTA de `ActionRequest` (um
 * `DecisionResult` pode propor mais de uma ação por mensagem). "Caso já
 * exista uma interface semelhante, reutilizar" — em vez de competir com
 * `DecisionResult`, `confidence` vira um campo por-ação aqui, o que é
 * estritamente mais expressivo: cada ação de um lote pode ter sua própria
 * confiança, não só uma nota única pro lote inteiro. `kind`/`payload` já
 * cobrem `action`/`parameters` do exemplo original.
 */
export interface ActionRequest {
  kind: ActionKind;
  payload: Record<string, unknown>;
  /** Confiança do Decision Engine nesta proposta específica (0–1). Opcional — `MockDecisionEngine` preenche; um Decision Engine futuro pode usar para decidir se executa direto ou pede confirmação. */
  confidence?: number;
}

/**
 * Resultado de uma ação executada — formato pedido explicitamente
 * ("Todos os módulos deverão retornar exatamente esse formato"). Toda
 * Action e todo Module Service (`services/modules/*`) devolve exatamente
 * isto.
 *
 * Definido em `@/services/action-result.types` (fora deste módulo, ver lá o
 * porquê: direção de dependência entre Module Services e Control Hub) e
 * reexportado aqui por compatibilidade — quem já importa `ActionResult` de
 * `@/services/control-hub` continua funcionando sem nenhuma mudança.
 *
 * Substitui o formato da Fase 1 (`{ request, ok, detail }`) — seguro porque
 * `ActionEngine.execute` nunca foi de fato chamado em produção até agora
 * (`MockDecisionEngine` nunca produzia `actions` não vazias, e nenhum
 * consumidor lia o resultado — ver `control-hub.service.ts`); não há
 * comportamento observável para preservar aqui. Correlação com o pedido
 * original (qual `ActionRequest` gerou qual resultado) agora é posicional —
 * `ActionEngine.execute(actions)` devolve um array na MESMA ordem de
 * `actions`, sem precisar ecoar o `request` de volta dentro de cada item.
 *
 * `data` é onde cada Module Service devolve o registro que criou/alterou
 * (ex.: o `AgendaEvent` criado) — é isso que permite ao Decision Engine (ou
 * a um Event Bus futuro, ver "EVENTOS" no pedido original) montar uma
 * resposta ou disparar um evento sem precisar consultar o módulo de novo.
 */
export type { ActionResult } from '@/services/action-result.types';
