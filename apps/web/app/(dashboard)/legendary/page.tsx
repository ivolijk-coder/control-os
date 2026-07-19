import { HomeHero } from '@/components/home/home-hero';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { MOCK_USER } from '@/lib/mock-data';

/**
 * Ambiente oficial da LEGENDARY — rota própria e fixa (`lockedPersona`),
 * irmã de `/nova`, nunca um toggle dentro da mesma tela (ver
 * `nova-workspace.tsx`; decisão do usuário: "NOVA e LEGENDARY não são
 * apenas dois modelos de IA. São dois módulos independentes do CONTROL
 * OS... o usuário deve sentir que navegou para outro ambiente do
 * sistema").
 *
 * Reaproveita a mesma casca de `NovaWorkspace variant="docked"` de
 * `/nova` — mesmo Design System, mesma mecânica de conversa — mas SEM
 * `HomeTopInsights`/`HomeSummaryStrip`: os dois só cobrem áreas
 * operacionais (maior gasto, hábitos pendentes, atalhos pros módulos de
 * Financeiro/Agenda/etc.) que são território da NOVA, não da LEGENDARY
 * (mentoria, não execução — ver `SystemPrompt.ts`). Fica só a saudação e
 * a conversa.
 */
export default function LegendaryPage() {
  const firstName = MOCK_USER.name.split(' ')[0] ?? MOCK_USER.name;

  return (
    <NovaWorkspace
      variant="docked"
      lockedPersona="legendary"
      topContent={<HomeHero firstName={firstName} />}
    />
  );
}
