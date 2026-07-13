/**
 * Ponto único de importação de prompts (CONTROL OS — Etapa 4.5: Auditoria).
 * "Nunca espalhar prompts pelo projeto" — só existe um prompt hoje
 * (`SYSTEM_PROMPT`), consumido exclusivamente por `app/api/ai/nova/route.ts`.
 * Os arquivos de prompt por domínio (`PlannerPrompt`, `FinancePrompt`,
 * `DailyAssistantPrompt`, `GoalPrompt`, `HabitPrompt`) criados numa fase
 * anterior nunca chegaram a ser referenciados por nenhum código real — foram
 * removidos na auditoria da Etapa 4.5 em vez de mantidos como texto morto
 * contradizendo esta própria regra.
 */
export { SYSTEM_PROMPT } from './SystemPrompt';
