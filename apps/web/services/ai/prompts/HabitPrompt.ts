/**
 * Prompt do domínio Hábitos — usado quando a intenção classificada envolve
 * criar ou acompanhar um hábito. Fase futura (`OpenAIProvider`); hoje o
 * módulo Hábitos (`/habitos`) só é editado por navegação manual, ainda sem
 * intent dedicada no parser determinístico.
 */
export const HABIT_PROMPT = `Você está lidando com uma mensagem sobre um hábito pessoal (ex.:
"quero malhar toda terça", "beber mais água"). Extraia o título do hábito e, se mencionada, a
categoria (saúde, produtividade, etc.).`;
