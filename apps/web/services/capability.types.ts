import type { ActionKind } from './control-hub';

/**
 * `Capability` — CONTROL HUB Fase 5 (Decision Engine com IA). "Capability
 * Registry: uma nova camada responsável por informar ao modelo quais
 * capacidades o sistema possui... Cada Capability deverá conter: nome,
 * descrição, parâmetros esperados, exemplos de uso. Essas informações
 * deverão ser utilizadas automaticamente para construir o prompt enviado ao
 * modelo. Evitar duplicação de informações."
 *
 * Vive num arquivo próprio no topo de `services/`, não dentro de
 * `services/decision-engine` nem de `services/action-engine` — mesmo motivo
 * já documentado para `action-result.types.ts` (Fase 4): este tipo é
 * consumido nos dois sentidos. `ActionHandler` (`services/action-engine`)
 * DECLARA a capability de cada ação (fonte única de verdade, ver abaixo); o
 * Decision Engine (`services/decision-engine`) só LÊ o catálogo já montado,
 * nunca o redefine. Um arquivo neutro evita que qualquer um dos dois módulos
 * dependa "de dentro" do outro.
 *
 * "Evitar duplicação de informações" levado a sério: em vez de manter uma
 * lista separada de capabilities desincronizável do catálogo real de Actions
 * registradas, cada `ActionHandler` (`services/action-engine/actions/*`) já
 * nasce com seu próprio campo `capability: Capability` — a MESMA lista de
 * handlers que alimenta o `ActionRegistry` (execução) também alimenta o
 * `CapabilityRegistry` (descrição pro prompt). Nunca podem divergir, porque
 * são literalmente o mesmo array (`DEFAULT_ACTION_HANDLERS`,
 * `services/action-engine/action-registry.ts`).
 */

/** Tipos de parâmetro suportados — deliberadamente os mesmos três de `services/action-engine/payload-guards.ts` (`getString`/`getNumber`/`getBoolean`), para a validação da resposta do modelo (Fase 5) poder reutilizar essas mesmas funções sem nenhuma tradução extra. */
export type CapabilityParameterType = 'string' | 'number' | 'boolean';

/** Descrição de um parâmetro esperado por uma Capability — o suficiente para (a) compor o prompt e (b) validar a resposta do modelo campo a campo. */
export interface CapabilityParameter {
  name: string;
  type: CapabilityParameterType;
  required: boolean;
  description: string;
}

/**
 * O que o modelo (Decision Engine LLM) precisa saber sobre UMA ação
 * disponível. "A IA nunca deverá inventar Actions. Ela deverá escolher
 * apenas Actions registradas." — `kind` aqui é sempre um `ActionKind` já
 * registrado no Action Engine (garantido por construção: só existe uma
 * `Capability` por `ActionHandler` real, nunca uma solta).
 */
export interface Capability {
  kind: ActionKind;
  description: string;
  parameters: CapabilityParameter[];
  /** Frases de exemplo (entrada do usuário) → o JSON de ação esperado, usadas no Prompt Builder para guiar o formato de saída. */
  examples: string[];
}
