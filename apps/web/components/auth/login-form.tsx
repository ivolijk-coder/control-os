'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button, Card, Input, Label } from '@control-os/ui';
import { FormError } from '@/components/ui/form-error';

/**
 * Formulário de login da conta do CONTROL OS.
 */
export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // O autofill do navegador (ou de um gerenciador de senhas) às vezes
    // preenche o campo direto no DOM sem disparar o evento `onChange` que o
    // React escuta — o input fica visivelmente cheio, mas o state
    // controlado (`email`/`password`) continua vazio, e a validação abaixo
    // acusava "preencha e-mail e senha" mesmo com os dois campos cheios na
    // tela. Lendo o valor final direto do FormData no momento do envio (o
    // valor real que o navegador tem, não o que o React acha que tem)
    // elimina esse descompasso sem trocar os inputs de controlados pra
    // não-controlados.
    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get('email') ?? email).trim();
    const submittedPassword = String(formData.get('password') ?? password);

    if (!submittedEmail || !submittedPassword) {
      setError('Preencha e-mail e senha para continuar.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) {
        setError(data.message ?? 'Não foi possível entrar.');
        return;
      }
      // CONTROL OS — Home/Dashboard (Design Lab → implementação oficial):
      // Home passou de /nova (chat) para /dashboard (Visão geral).
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
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
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
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <FormError message={error} />

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
