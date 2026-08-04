/**
 * `ActionResult` — o formato de retorno comum a toda a camada de execução
 * do CONTROL OS (CONTROL HUB — Fase 4: Action Engine real). "Todos os
 * módulos deverão retornar exatamente esse formato."
 *
 * Vive num arquivo próprio, fora de `services/control-hub/` e fora de
 * `services/modules/`, por uma questão de DIREÇÃO de dependência (achado da
 * auditoria desta fase, "identifique oportunidades para reduzir
 * acoplamento"): `services/modules/*` (Module Services — CalendarService,
 * FinanceService etc.) são a camada de domínio, mais baixa na pilha; o
 * Action Engine (`services/action-engine`) e o CONTROL HUB
 * (`services/control-hub`) orquestram por cima dela. Se `ActionResult`
 * morasse dentro de `services/control-hub/action-engine.types.ts` (onde
 * vivia até a Fase 3), todo Module Service precisaria importar de dentro do
 * Control Hub para devolver seu resultado — uma dependência de baixo para
 * cima, exatamente o tipo de acoplamento que esta arquitetura existe para
 * evitar. Um arquivo compartilhado, sem dependências de nenhum dos dois
 * lados, resolve isso: `services/control-hub/action-engine.types.ts`
 * reexporta `ActionResult` daqui (compatibilidade — nada muda para quem já
 * importa de `@/services/control-hub`); `services/modules/*` importa
 * diretamente daqui, nunca do Control Hub.
 *
 * Não vive em `@control-os/types` (o pacote de tipos de domínio
 * compartilhados — `Mission`, `FinanceEntry` etc.) pelo mesmo motivo já
 * documentado para `HubMessage` (`control-hub.types.ts`): `ActionResult` é
 * um contrato de EXECUÇÃO/infraestrutura ("como" uma ação é reportada),
 * não um dado de domínio do produto ("o quê" o produto guarda) — categorias
 * diferentes, lugares diferentes.
 */
export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  /** Status HTTP opcional para adapters; handlers de domínio não precisam conhecê-lo. */
  status?: number;
}
