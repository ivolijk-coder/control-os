import { redirect } from 'next/navigation';

/** Raiz do app: Fase 1 não tem sessão real, então sempre entra pelo Login. */
export default function RootPage() {
  redirect('/login');
}
