import type { NovaPersona } from '@/services/nova';

/** Vozes disponíveis no endpoint de síntese da OpenAI. */
export const OPENAI_VOICE_OPTIONS = [
  { id: 'nova', label: 'Nova', description: 'Clara e acolhedora' },
  { id: 'shimmer', label: 'Shimmer', description: 'Leve e energética' },
  { id: 'alloy', label: 'Alloy', description: 'Equilibrada e neutra' },
  { id: 'echo', label: 'Echo', description: 'Direta e firme' },
  { id: 'fable', label: 'Fable', description: 'Expressiva e narrativa' },
  { id: 'onyx', label: 'Onyx', description: 'Grave e serena' },
] as const;

export type OpenAIVoice = (typeof OPENAI_VOICE_OPTIONS)[number]['id'];

const STORAGE_KEY = 'control-os-voice-preferences-v2';
const DEFAULT_VOICE_BY_PERSONA: Record<NovaPersona, OpenAIVoice> = {
  nova: 'shimmer',
  legendary: 'onyx',
};

function isOpenAIVoice(value: unknown): value is OpenAIVoice {
  return typeof value === 'string' && OPENAI_VOICE_OPTIONS.some((option) => option.id === value);
}

export function getVoicePreferences(): Record<NovaPersona, OpenAIVoice> {
  if (typeof window === 'undefined') return DEFAULT_VOICE_BY_PERSONA;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_BY_PERSONA;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_VOICE_BY_PERSONA;
    const values = parsed as Record<string, unknown>;
    return {
      nova: isOpenAIVoice(values.nova) ? values.nova : DEFAULT_VOICE_BY_PERSONA.nova,
      legendary: isOpenAIVoice(values.legendary) ? values.legendary : DEFAULT_VOICE_BY_PERSONA.legendary,
    };
  } catch {
    return DEFAULT_VOICE_BY_PERSONA;
  }
}

export function getVoicePreference(persona: NovaPersona): OpenAIVoice {
  return getVoicePreferences()[persona];
}

export function setVoicePreference(persona: NovaPersona, voice: OpenAIVoice): void {
  if (typeof window === 'undefined') return;
  const next = { ...getVoicePreferences(), [persona]: voice };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
