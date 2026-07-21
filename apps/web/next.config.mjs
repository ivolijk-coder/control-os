/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // "standalone" — CONTROL OS Infra (Docker/VPS): gera .next/standalone com
  // um server.js mínimo e só as dependências de produção realmente usadas
  // (Next.js traça o grafo de imports). Sem isso, a imagem Docker precisaria
  // copiar node_modules inteiro (incluindo devDependencies do monorepo) —
  // muito maior e mais lento de construir. Não afeta o deploy na Vercel
  // (vercel.json continua sendo o caminho usado lá; a Vercel ignora este
  // campo e usa o próprio pipeline de build serverless dela). Ver
  // infra/README.md e apps/web/Dockerfile.
  output: 'standalone',
  transpilePackages: [
    '@control-os/ui',
    '@control-os/types',
    '@control-os/hooks',
    '@control-os/utils',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
