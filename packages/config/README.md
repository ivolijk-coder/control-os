# @control-os/config

Configuração compartilhada do monorepo.

- `tsconfig.base.json` — configuração base do TypeScript (target, strict mode, paths dos pacotes `@control-os/*`). `apps/web/tsconfig.json` estende este arquivo.

Fase 2: contém apenas a configuração de TypeScript, movida da raiz do repositório para cá como parte da reorganização para deploy na Vercel. Outras configurações compartilhadas (ESLint, Tailwind) podem ser adicionadas aqui no futuro.
