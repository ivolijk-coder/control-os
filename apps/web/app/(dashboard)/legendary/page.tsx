import { NovaWorkspace } from '@/components/nova/nova-workspace';

/**
 * Ambiente do LEGENDARY: mentoria de desenvolvimento pessoal, produtividade,
 * repertório e decisões estratégicas. A conversa assume a tela quando começa;
 * antes dela, há uma única direção e três caminhos de evolução.
 */
export default function LegendaryPage() {
  return <NovaWorkspace variant="docked" lockedPersona="legendary" />;
}
