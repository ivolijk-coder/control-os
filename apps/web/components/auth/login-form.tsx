'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button, Card, Input, Label } from '@control-os/ui';
import { useAppStore } from '@/lib/store';

/**
 * Formulário de Login — Fase 1 usa `useAppStore.login`, que simula latência
 * de rede e autentica com o usuário mockado. Nenhuma chamada real a
 * apps/api ou ao Control Core™ acontece ainda.
 */
export function LoginForm() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);

  const [email, setEmail] = React.useState('ivolijk@gmail.com');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Preencha e-mail e senha para continuar.');
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
          <h1 className="text-lg font-semibold tracking-tight text-text-primary">Entrar no CONTROL OS</h1>
          <p className="mt-1 text-sm text-text-secondary">A inteligência operacional que pensa com você.</p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <a href="#" className="text-xs text-text-tertiary transition-colors hover:text-text-primary">
                Esqueceu a senha?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-accent-red">{error}</p>}

          <Button type="submit" size="lg" className="mt-2 w-full" loading={isSubmitting}>
            Entrar
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Ainda não tem conta?{' '}
        <Link href="/cadastro" className="font-medium text-text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </motion.div>
  );
}
