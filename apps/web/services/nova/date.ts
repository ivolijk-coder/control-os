/**
 * Data local em ISO (`YYYY-MM-DD`) — ponto único (CONTROL OS — bugfix:
 * NOVA respondendo com a data errada).
 *
 * Origem do bug: todo o código (`buildModelContextSummary`, Recommendation
 * Engine, `buildTodayHighlights`, Home, Missões, Agenda...) calculava "hoje"
 * com `new Date().toISOString().slice(0, 10)`. `toISOString()` SEMPRE
 * devolve o instante em UTC — à noite no fuso do usuário (ex.: Brasil,
 * UTC-3), o relógio em UTC já virou o dia seguinte, então `.slice(0, 10)`
 * extraía a data de AMANHÃ, não a de hoje. O `Date` em si sempre esteve
 * certo (`new Date()` reflete o instante real); o bug estava só em qual
 * fuso a gente lia dele.
 *
 * `getFullYear`/`getMonth`/`getDate` são os únicos getters de `Date` que
 * respeitam o fuso horário LOCAL do ambiente onde o código roda — o
 * navegador do usuário, já que toda essa camada roda no cliente
 * (`NovaWorkspace`, páginas do dashboard). Nenhuma soma de dias manual,
 * nenhum fuso fixo no código: só lê os componentes de data que o próprio
 * `Date` já calcula certos.
 *
 * Ponto único: qualquer lugar do app que precisa da data de hoje (ou da
 * data de um outro `Date` qualquer, ex.: "há N dias") deve importar daqui —
 * nunca duplicar `toISOString().slice(0, 10)` de novo.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
