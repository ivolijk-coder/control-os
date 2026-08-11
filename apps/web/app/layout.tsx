import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CONTROL OS',
  description: 'A plataforma de inteligência operacional que pensa junto com você.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  // A faixa de status do iOS encosta na barra de TOPO, e a barra de topo é
  // navegação — escura nos dois temas. Por isso este valor não acompanha o
  // tema: se acompanhasse, no tema claro o iPhone pintaria a faixa de branco
  // colada num cabeçalho preto.
  themeColor: '#0B0F16',
  // A ordem importa: o primeiro valor é o preferido. Com o claro virando
  // padrão do produto, ele passa a vir primeiro.
  colorScheme: 'light dark',
};

/**
 * Aplica o tema ANTES da primeira pintura.
 *
 * O `ThemeManager` faz isso num `useEffect`, ou seja, depois da hidratação.
 * Enquanto o escuro era o único tema real isso não aparecia. Com o claro
 * existindo de verdade, quem tem o claro salvo veria a página nascer escura
 * e piscar para clara em toda abertura — o tipo de detalhe que separa um
 * produto caro de um barato.
 *
 * Este script é síncrono e fica no `<head>`: o navegador o executa antes de
 * pintar qualquer pixel. O `ThemeManager` continua existindo e cuidando da
 * troca em tempo real; este aqui só resolve o primeiro quadro.
 *
 * Envolvido em try/catch porque `localStorage` lança em navegação privada
 * de alguns navegadores — e um tema errado é muito melhor que uma tela em
 * branco.
 *
 * A regra aqui é a MESMA de `getThemePreference` em `lib/theme-preferences.ts`,
 * escrita duas vezes de propósito (este script não pode importar módulo).
 * Desde esta etapa o claro é o padrão: só `'dark'` gravado leva ao escuro.
 * Se uma das duas mudar, a outra muda junto — há um gate conferindo.
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('control-os-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen bg-bg font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
