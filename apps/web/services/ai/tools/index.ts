/**
 * Ferramentas da camada de IA (CONTROL OS — Preparação para OpenAI
 * GPT-5.5). Hoje cada uma só chama a Action correspondente
 * (`services/ai/actions/`) — o formato final que um provedor de IA real vai
 * invocar (ex.: via function calling do GPT-5.5), sem nunca tocar em
 * `useDataStore` diretamente.
 */
export { CalendarTool } from './calendar-tool';
export { FinanceTool } from './finance-tool';
export { NotesTool } from './notes-tool';
export { GoalsTool } from './goals-tool';
export { TripsTool } from './trips-tool';
export { DocumentsTool } from './documents-tool';
export { HabitsTool } from './habits-tool';
export { AssetsTool } from './assets-tool';
