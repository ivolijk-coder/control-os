'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button, Card, Input, Label } from '@control-os/ui';
import { FormError } from '@/components/ui/form-error';
import { cn } from '@/lib/utils';
import { OPENAI_VOICE_OPTIONS, setVoicePreference, type OpenAIVoice } from '@/services/voice/voice-preferences';

const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'Mínimo de 8 caracteres', test: (v: string) => v.length >= 8 },
  { id: 'upper', label: 'Uma letra maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'number', label: 'Um número', test: (v: string) => /\d/.test(v) },
];

// Número oficial atual do CONTROL OS na Cloud API. O link só abre o
// WhatsApp com a mensagem pronta; a confirmação continua dependendo do
// envio feito pela própria pessoa, a prova de que ela controla o número.
const CONTROL_OS_WHATSAPP_NUMBER = '554499599236';

/**
 * Formulário de Cadastro — cria a conta de produto e pede a confirmação do
 * WhatsApp antes de esse número poder registrar qualquer dado pessoal.
 */
export function CadastroForm() {
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [novaVoice, setNovaVoice] = React.useState<OpenAIVoice>('nova');
  const [legendaryVoice, setLegendaryVoice] = React.useState<OpenAIVoice>('onyx');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [verification, setVerification] = React.useState<{ phone: string; code: string } | null>(null);

  const requirementsMet = PASSWORD_REQUIREMENTS.every((req) => req.test(password));

  function openWhatsAppConfirmation() {
    if (!verification) return;
    const message = encodeURIComponent(`VINCULAR ${verification.code}`);
    window.open(`https://wa.me/${CONTROL_OS_WHATSAPP_NUMBER}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password || !phone) {
      setError('Preencha todos os campos para continuar.');
      return;
    }
    if (!requirementsMet) {
      setError('A senha ainda não atende aos requisitos mínimos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      });
      const data = await response.json() as { phone?: string; code?: string; message?: string };
      if (!response.ok || !data.phone || !data.code) {
        setError(data.message ?? 'Não foi possível criar a conta agora.');
        return;
      }
      // A escolha inicial é uma preferência deste dispositivo; o usuário
      // pode mudar as duas vozes quando quiser em Configurações.
      setVoicePreference('nova', novaVoice);
      setVoicePreference('legendary', legendaryVoice);
      setVerification({ phone: data.phone, code: data.code });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-sm font-bold text-black">
          C
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-text-primary">Criar sua conta</h1>
          <p className="mt-1 text-sm text-text-secondary">Comece a operar com o CONTROL OS em minutos.</p>
        </div>
      </div>

      {verification ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-text-primary">Confirme seu WhatsApp</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Pelo número <strong className="text-text-primary">{verification.phone}</strong>, envie esta mensagem para o WhatsApp do CONTROL OS:
          </p>
          <p className="mt-4 text-sm text-text-secondary">Assim confirmamos que o número é seu e seus dados ficam separados dos demais usuários.</p>
          <Button type="button" size="lg" className="mt-6 w-full" onClick={openWhatsAppConfirmation}>
            Confirmar no WhatsApp
          </Button>
          <Button type="button" variant="secondary" size="lg" className="mt-3 w-full" onClick={() => router.push('/login')}>
            Já enviei a confirmação
          </Button>
        </Card>
      ) : <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>

          <fieldset className="flex flex-col gap-3 rounded-md border border-white/[0.08] bg-white/[0.02] p-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Como as IAs devem falar?</p>
              <p className="mt-1 text-xs text-text-tertiary">Você poderá mudar isso depois em Configurações.</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary" htmlFor="nova-voice">
              Voz da NOVA
              <select
                id="nova-voice"
                value={novaVoice}
                onChange={(event) => setNovaVoice(event.target.value as OpenAIVoice)}
                className="rounded-md border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-purple/60"
              >
                {OPENAI_VOICE_OPTIONS.map((voice) => <option key={voice.id} value={voice.id}>{voice.label} — {voice.description}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary" htmlFor="legendary-voice">
              Voz da LEGENDARY
              <select
                id="legendary-voice"
                value={legendaryVoice}
                onChange={(event) => setLegendaryVoice(event.target.value as OpenAIVoice)}
                className="rounded-md border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold/60"
              >
                {OPENAI_VOICE_OPTIONS.map((voice) => <option key={voice.id} value={voice.id}>{voice.label} — {voice.description}</option>)}
              </select>
            </label>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Seu WhatsApp</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
              placeholder="(44) 99999-9999"
            />
            <p className="text-xs text-text-tertiary">Usaremos este número para ligar suas mensagens à sua conta.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <ul className="mt-1 flex flex-col gap-1">
              {PASSWORD_REQUIREMENTS.map((req) => {
                const met = req.test(password);
                return (
                  <li
                    key={req.id}
                    className={cn(
                      'flex items-center gap-1.5 text-xs transition-colors duration-fast ease-out',
                      met ? 'text-accent-green' : 'text-text-tertiary'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                        met ? 'border-accent-green bg-accent-green/15' : 'border-white/15'
                      )}
                    >
                      {met && <Check className="h-2.5 w-2.5" />}
                    </span>
                    {req.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <FormError message={error} />

          <Button type="submit" size="lg" className="mt-2 w-full" loading={isSubmitting}>
            Criar conta
          </Button>
        </form>
      </Card>}

      <p className="mt-6 text-center text-sm text-text-secondary">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </motion.div>
  );
}
