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
  colorScheme: 'dark light',
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
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('control-os-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

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
