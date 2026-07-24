import { NovaWorkspace } from '@/components/nova/nova-workspace';

/**
 * Ambiente operacional da NOVA: uma prioridade clara, o contexto essencial
 * de hoje e um campo para agir. A conversa ocupa a tela quando começa; a
 * tela inicial não tenta competir com ela nem com o dashboard completo.
 */
export default function NovaPage() {
  return <NovaWorkspace variant="docked" lockedPersona="nova" />;
}
