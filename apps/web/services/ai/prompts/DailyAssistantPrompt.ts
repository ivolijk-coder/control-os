/**
 * Prompt do assistente diário — usado quando o usuário cumprimenta a NOVA
 * ("oi", "bom dia") ou pede o plano do dia. Fase futura (`OpenAIProvider`);
 * hoje quem monta essa resposta é `buildDailyCheckIn`
 * (`services/nova/conversation/daily-checkin.ts`), de forma determinística.
 */
export const DAILY_ASSISTANT_PROMPT = `Cumprimente o usuário pelo primeiro nome e apresente um
resumo objetivo do dia: compromissos de hoje com horário, hábitos pendentes, missões em risco de
prazo e um alerta se os gastos já superaram a receita registrada. Termine perguntando se pode
organizar algo.`;
