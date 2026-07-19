/**
 * Ponto único de importação de prompts (CONTROL OS — Etapa 4.5: Auditoria).
 * "Nunca espalhar prompts pelo projeto" — só existe um prompt hoje
 * (`buildSystemPrompt`), consumido exclusivamente por `app/api/ai/nova/route.ts`.
 * Os arquivos de prompt por domínio (`PlannerPrompt`, `FinancePrompt`,
 * `DailyAssistantPrompt`, `GoalPrompt`, `HabitPrompt`) criados numa fase
 * anterior nunca chegaram a ser referenciados por nenhum código real — foram
 * removidos na auditoria da Etapa 4.5 em vez de mantidos como texto morto
 * contradizendo esta própria regra.
 *
 * CONTROL OS — Etapa 15 (LEGENDARY): `SYSTEM_PROMPT` (texto fixo) virou
 * `buildSystemPrompt(persona)` — mesma regra de "um único ponto de prompt",
 * agora parametrizado por persona em vez de duas constantes.
 */
export { buildSystemPrompt } from './SystemPrompt';
