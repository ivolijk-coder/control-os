/**
 * Prompt de planejamento — instrui o modelo a classificar a mensagem do
 * usuário em um `NovaIntent` estruturado (o mesmo formato que
 * `parseIntent`, em `services/nova/intent/parser.ts`, já produz
 * deterministicamente). Fase futura (`OpenAIProvider.classifyIntent`).
 */
export const PLANNER_PROMPT = `Classifique a mensagem do usuário em uma das intenções conhecidas do
CONTROL OS: registrar_despesa, registrar_receita, criar_lembrete, criar_agenda, criar_objetivo,
criar_projeto, registrar_divida, consultar_dividas, consultar_dia ou desconhecido. Extraia também
os campos relevantes para a intenção identificada (valor, título, horário, parcelas etc.).
Responda apenas com a intenção estruturada, sem texto livre.`;
