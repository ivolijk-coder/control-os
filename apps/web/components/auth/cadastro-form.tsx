'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button, Card, Input, Label } from '@control-os/ui';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'Mínimo de 8 caracteres', test: (v: string) => v.length >= 8 },
  { id: 'upper', label: 'Uma letra maiúscula', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'number', label: 'Um número', test: (v: string) => /\d/.test(v) },
];

/**
 * Formulário de Cadastro — Fase 1 cria a sessão localmente via
 * `useAppStore.login` (mesmo mock usado no Login). A criação de conta real,
 * validada por apps/api + PostgreSQL, entra em uma fase futura.
 */
export function CadastroForm() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const requirementsMet = PASSWORD_REQUIREMENTS.every((req) => req.test(password));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password) {
      setError('Preencha todos os campos para continuar.');
      return;
    }
    if (!requirementsMet) {
      setError('A senha ainda não atende aos requisitos mínimos.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
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

      <Card className="p-6">
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

          {error && <p className="text-xs text-accent-red">{error}</p>}

          <Button type="submit" size="lg" className="mt-2 w-full" loading={isSubmitting}>
            Criar conta
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </motion.div>
  );
}
