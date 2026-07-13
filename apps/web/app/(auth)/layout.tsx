export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg bg-ambient-glow px-4">
      {/* Glow de fundo — consistente com a linguagem visual da Etapa 1 */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-b from-accent-purple/15 via-accent-blue/5 to-transparent blur-3xl" />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
