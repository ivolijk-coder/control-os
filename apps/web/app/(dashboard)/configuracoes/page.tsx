'use client';

import * as React from 'react';
import { Check, Moon, Sun, Volume2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { getInitials } from '@/lib/utils';
import type { NovaPersona } from '@/services/nova';
import { getVoiceProvider } from '@/services/voice';
import { getVoicePreferences, OPENAI_VOICE_OPTIONS, setVoicePreference, type OpenAIVoice } from '@/services/voice/voice-preferences';
import { getThemePreference, setThemePreference, type AppTheme } from '@/lib/theme-preferences';

const CONTROL_OS_WHATSAPP_NUMBER = '554499599236';

/**
 * Configurações — página nova, criada junto com a simplificação da Sidebar
 * (fim dos Control Spaces™, navegação flat de "pessoa física").
 *
 * `nav_configuracoes` entrou na lista final de navegação pedida pelo
 * usuário; como `mock-data.ts` historicamente evita apontar um item de menu
 * para uma rota sem página ("nunca existir um link morto no meio do
 * caminho"), esta tela mínima nasce junto com o item — só identidade e
 * preferências básicas, mesmo padrão visual de qualquer outra página do
 * produto (`GlassCard`/`FadeIn`, nenhum componente novo). Conteúdo completo
 * (plano, integrações, notificações etc.) é trabalho futuro, fora do escopo
 * desta mudança de navegação.
 */
export default function ConfiguracoesPage() {
  const [whatsApp, setWhatsApp] = React.useState<{ status: 'loading' | 'active' | 'pending' | 'unauthenticated'; phone?: string }>({ status: 'loading' });
  const [account, setAccount] = React.useState<{ name: string; email: string } | null>(null);
  const [linking, setLinking] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [voicePreferences, setVoicePreferences] = React.useState<Record<NovaPersona, OpenAIVoice>>({ nova: 'nova', legendary: 'onyx' });
  const [testingVoice, setTestingVoice] = React.useState<NovaPersona | null>(null);
  const [voiceMessage, setVoiceMessage] = React.useState<string | null>(null);
  const [theme, setTheme] = React.useState<AppTheme>('dark');

  React.useEffect(() => {
    fetch('/api/account/whatsapp')
      .then(async (response) => ({ response, data: await response.json() as { status?: 'active' | 'pending'; phone?: string } }))
      .then(({ response, data }) => setWhatsApp(response.ok ? { status: data.status ?? 'pending', phone: data.phone } : { status: 'unauthenticated' }))
      .catch(() => setWhatsApp({ status: 'unauthenticated' }));
  }, []);

  React.useEffect(() => {
    setVoicePreferences(getVoicePreferences());
    setTheme(getThemePreference());
  }, []);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => ({ response, data: await response.json() as { user?: { name: string; email: string } } }))
      .then(({ response, data }) => setAccount(response.ok ? data.user ?? null : null))
      .catch(() => setAccount(null));
  }, []);

  const whatsAppContent =
    whatsApp.status === 'loading' ? 'Verificando conexão…' :
    whatsApp.status === 'active' ? `Ativo · ${whatsApp.phone}` :
    whatsApp.status === 'pending' ? 'Aguardando confirmação do número' :
    'Entre novamente para ver sua configuração';

  async function beginWhatsAppLink() {
    setLinking(true);
    setLinkError(null);
    try {
      const response = await fetch('/api/account/whatsapp/link', { method: 'POST' });
      const data = await response.json() as { code?: string; message?: string };
      if (!response.ok || !data.code) {
        setLinkError(data.message ?? 'Não foi possível iniciar o vínculo.');
        return;
      }
      const message = encodeURIComponent(`VINCULAR ${data.code}`);
      window.open(`https://wa.me/${CONTROL_OS_WHATSAPP_NUMBER}?text=${message}`, '_blank', 'noopener,noreferrer');
    } catch {
      setLinkError('Não foi possível iniciar o vínculo. Tente novamente.');
    } finally {
      setLinking(false);
    }
  }

  function updateVoice(persona: NovaPersona, voice: OpenAIVoice) {
    setVoicePreference(persona, voice);
    setVoicePreferences((current) => ({ ...current, [persona]: voice }));
    setVoiceMessage('Preferência salva neste dispositivo.');
  }

  function updateTheme(nextTheme: AppTheme) {
    setThemePreference(nextTheme);
    setTheme(nextTheme);
  }

  function testVoice(persona: NovaPersona) {
    setTestingVoice(persona);
    setVoiceMessage(null);
    const label = persona === 'nova' ? 'NOVA' : 'LEGENDARY';
    getVoiceProvider().unlock();
    getVoiceProvider().speak(
      persona === 'nova'
        ? 'Olá, eu sou a NOVA. Pode falar comigo quando quiser.'
        : 'Olá, eu sou a LEGENDARY. Vamos transformar intenção em progresso.',
      {
        persona,
        onEnd: () => setTestingVoice(null),
        onError: () => {
          setTestingVoice(null);
          setVoiceMessage(`Não foi possível tocar a voz da ${label} agora.`);
        },
      }
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <FadeIn>
        <h1 className="text-lg font-semibold text-text-primary">Configurações</h1>
      </FadeIn>

      <FadeIn delay={0.05}>
        <GlassCard interactive={false} className="flex items-center gap-4 p-5">
          <Avatar className="h-12 w-12 ring-1 ring-white/10">
            <AvatarFallback>{getInitials(account?.name ?? 'Sua conta')}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-text-primary">{account?.name ?? 'Sua conta'}</span>
            <span className="truncate text-xs text-text-tertiary">{account?.email ?? 'Entre para ver seus dados'}</span>
          </div>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.08}>
        <GlassCard interactive={false} className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <ICON_MAP.Settings className="h-4 w-4 shrink-0 text-text-tertiary" />
            <div>
              <span className="text-sm font-medium text-text-primary">Aparência</span>
              <p className="mt-0.5 text-xs text-text-tertiary">Escolha a identidade visual que fica mais confortável para você.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { id: 'dark' as const, label: 'Escuro', description: 'Identidade CONTROL OS', Icon: Moon, preview: 'bg-[#080808] border-white/10' },
              { id: 'light' as const, label: 'Claro', description: 'Leve, limpo e estilo iPhone', Icon: Sun, preview: 'bg-[#f6f7fb] border-slate-200' },
            ]).map(({ id, label, description, Icon, preview }) => {
              const selected = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateTheme(id)}
                  className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-accent-blue bg-accent-blue/10' : 'border-border hover:bg-white/[0.04]'}`}
                  aria-pressed={selected}
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg border ${preview}`}><Icon className={`h-5 w-5 ${id === 'light' ? 'text-slate-700' : 'text-accent-blue'}`} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text-primary">{label}</span>
                    <span className="block text-xs text-text-tertiary">{description}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-accent-blue" aria-label="Selecionado" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-text-tertiary">A preferência é salva neste dispositivo. Você pode voltar ao escuro quando quiser.</p>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard interactive={false} className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <ICON_MAP.Settings className="h-4 w-4 shrink-0 text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">WhatsApp</span>
          </div>
          <div className="flex flex-col gap-3 rounded-md bg-white/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-text-tertiary">Status da conexão</span>
              <span className="text-sm text-text-primary">{whatsAppContent}</span>
            </div>
            {whatsApp.status === 'active' ? (
              <span className="w-fit rounded-full bg-accent-green/15 px-2.5 py-1 text-xs font-medium text-accent-green">Vinculado</span>
            ) : (
              <span className="w-fit rounded-full bg-white/[0.08] px-2.5 py-1 text-xs text-text-secondary">Pendente</span>
            )}
          </div>
          <p className="text-xs text-text-tertiary">Mensagens recebidas por um número vinculado são registradas somente na conta correspondente.</p>
          {whatsApp.status === 'pending' && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={beginWhatsAppLink}
                disabled={linking}
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linking ? 'Preparando vínculo…' : 'Vincular WhatsApp'}
              </button>
              {linkError && <p className="text-xs text-accent-red">{linkError}</p>}
            </div>
          )}
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.15}>
        <GlassCard interactive={false} className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <Volume2 className="h-4 w-4 shrink-0 text-text-tertiary" />
            <div>
              <span className="text-sm font-medium text-text-primary">Voz das IAs</span>
              <p className="mt-0.5 text-xs text-text-tertiary">Escolha como a NOVA e a LEGENDARY falam nas conversas por voz.</p>
            </div>
          </div>

          {(['nova', 'legendary'] as const).map((persona) => {
            const label = persona === 'nova' ? 'NOVA' : 'LEGENDARY';
            return (
              <div key={persona} className="flex flex-col gap-3 rounded-md bg-white/[0.04] p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="text-xs text-text-tertiary">Voz usada quando você fala com a {label}.</p>
                </div>
                <select
                  value={voicePreferences[persona]}
                  onChange={(event) => updateVoice(persona, event.target.value as OpenAIVoice)}
                  className="rounded-md border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-purple/60"
                  aria-label={`Voz da ${label}`}
                >
                  {OPENAI_VOICE_OPTIONS.map((voice) => <option key={voice.id} value={voice.id}>{voice.label} — {voice.description}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => testVoice(persona)}
                  disabled={testingVoice !== null}
                  className="rounded-md border border-white/[0.12] px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testingVoice === persona ? 'Tocando…' : 'Ouvir voz'}
                </button>
              </div>
            );
          })}
          {voiceMessage && <p role="status" className="text-xs text-text-tertiary">{voiceMessage}</p>}
        </GlassCard>
      </FadeIn>
    </div>
  );
}
