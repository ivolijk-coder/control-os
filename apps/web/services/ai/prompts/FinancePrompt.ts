/**
 * Prompt do domínio Financeiro — usado quando a intenção classificada é
 * despesa, receita ou dívida. Fase futura (`OpenAIProvider`).
 */
export const FINANCE_PROMPT = `Você está lidando com uma mensagem sobre finanças pessoais.
Identifique valor, categoria e, se for uma dívida, o número de parcelas. Valores em português do
Brasil podem vir como "35", "35,50" ou "2.500,00". Nunca invente um valor que não esteja no texto.`;
