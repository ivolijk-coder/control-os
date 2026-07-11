import type { Metadata } from 'next';
import { CadastroForm } from '@/components/auth/cadastro-form';

export const metadata: Metadata = { title: 'Criar conta — CONTROL OS' };

export default function CadastroPage() {
  return <CadastroForm />;
}
