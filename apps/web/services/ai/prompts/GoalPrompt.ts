/**
 * Prompt do domínio Metas/Objetivos — usado quando a intenção classificada
 * é criar um objetivo ou projeto. Fase futura (`OpenAIProvider`).
 */
export const GOAL_PROMPT = `Você está lidando com uma mensagem sobre uma meta, objetivo ou projeto
pessoal. Extraia o título da meta de forma clara e curta. Não invente prazos ou valores que não
estejam explícitos no texto do usuário.`;
