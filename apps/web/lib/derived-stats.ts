import type { AgendaEvent, DashboardStat, FinanceEntry, Mission } from '@control-os/types';
import { toLocalDateString } from '@/services/nova';
import { formatCurrency } from './utils';

/**
 * Deriva os indicadores "ao vivo" do Painel Inteligente (CONTROL OS 3.0) a
 * partir de `useDataStore` — Receita, Gastos, Missões e Agenda passam a
 * refletir dados reais criados tanto por conversa quanto por navegação
 * manual. Clientes e Projetos continuam mockados (`MOCK_PAINEL_HOJE`): não
 * existe domínio próprio para eles ainda (fora do escopo do 3.0).
 */
export function buildLiveDashboardStats(
  missions: Mission[],
  financeEntries: FinanceEntry[],
  agendaEvents: AgendaEvent[]
): DashboardStat[] {
  const receitaTotal = financeEntries
    .filter((entry) => entry.type === 'receita')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const gastosTotal = financeEntries
    .filter((entry) => entry.type === 'despesa')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const missoesAtivas = missions.filter((mission) => mission.status !== 'concluida').length;

  // Bugfix: `toISOString().slice(0, 10)` extraía a data em UTC — ver `services/nova/date.ts`.
  const today = toLocalDateString();
  const compromissosHoje = agendaEvents.filter((event) => event.date === today).length;

  return [
    { id: 'painel_receita', label: 'Receita', value: formatCurrency(receitaTotal), accent: 'blue' },
    { id: 'painel_gastos', label: 'Gastos', value: formatCurrency(gastosTotal), accent: 'red' },
    { id: 'painel_missoes', label: 'Missões', value: `${missoesAtivas} ativas`, accent: 'purple' },
    {
      id: 'painel_agenda',
      label: 'Agenda',
      value: `${compromissosHoje} compromisso${compromissosHoje === 1 ? '' : 's'} hoje`,
      accent: 'blue',
    },
  ];
}
