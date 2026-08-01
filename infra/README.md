# CONTROL OS — Infraestrutura de Produção (Docker)

Infraestrutura self-hosted completa para rodar o CONTROL OS numa VPS própria (testada na estrutura de uma Hostinger, Ubuntu 24.04 LTS) — alternativa/complemento ao deploy na Vercel já documentado no README raiz do monorepo. Cobre reverse proxy com SSL automático, banco de dados, cache e o gateway do WhatsApp (Evolution API), tudo orquestrado via Docker Compose.

## Arquitetura

```
                         Internet
                            │
                     ┌──────▼──────┐
                     │   Traefik   │  :80 → :443 (redirect), SSL Let's Encrypt
                     │ (dashboard  │  dashboard protegido por Basic Auth
                     │  protegido) │
                     └──────┬──────┘
           ┌─────────────────┼─────────────────┬──────────────────┐
           │                 │                 │                  │
      ┌────▼────┐      ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
      │   web   │      │    api    │    │  evolution  │    │  (futuro:   │
      │ Next.js │      │  FastAPI  │    │     api     │    │  Telegram,  │
      │(apps/web)│     │ (apps/api)│    │ (WhatsApp)  │    │  e-mail...) │
      └────┬────┘      └─────┬─────┘    └──────┬──────┘
           │                 │                 │
     ┌─────┴─────┐     ┌─────┴─────┐    ┌───────┴───────┐
     │ postgres  │     │ (mesmo    │    │  evolution-   │
     │  (rede    │     │ postgres) │    │  postgres +   │
     │ "backend")│     │           │    │  evolution-   │
     └─────┬─────┘     └───────────┘    │  redis (rede  │
           │                            │  isolada)     │
     ┌─────┴─────┐                      └───────────────┘
     │   redis   │
     │  (rede    │
     │ "backend")│
     └───────────┘
```

Três redes Docker: `traefik-public` (externa, único ponto exposto à internet), `backend` (Postgres + Redis do CONTROL OS, nunca exposta) e `evolution-backend` (Postgres + Redis DEDICADOS à Evolution API, isolados de tudo o resto — ver seção "Evolution API separada").

## Pré-requisitos

- VPS com Ubuntu 24.04 LTS, acesso root/sudo via SSH. (Testado com o padrão de VPS da Hostinger; qualquer VPS Ubuntu 24.04 com IP público serve.)
- Um domínio (ou subdomínio) que você controla, com acesso ao painel de DNS.
- Quatro registros DNS tipo **A** apontando para o IP público da VPS, um para cada serviço exposto:

  | Subdomínio (exemplo) | Aponta para | Serviço |
  |---|---|---|
  | `app.controlos.com.br` | IP da VPS | CONTROL OS (Next.js) |
  | `api.controlos.com.br` | IP da VPS | CONTROL OS API (FastAPI) |
  | `traefik.controlos.com.br` | IP da VPS | Dashboard do Traefik |
  | `evolution.controlos.com.br` | IP da VPS | Evolution API (WhatsApp) |

  Propague o DNS **antes** de subir a stack — o desafio HTTP-01 do Let's Encrypt precisa resolver esses nomes para este servidor para emitir o certificado.

## Instalação — passo a passo

### 1. Clonar o repositório na VPS

```bash
git clone <url-do-seu-repositorio> control-os
cd control-os/infra
```

### 2. Preparar o sistema operacional

```bash
sudo chmod +x scripts/setup-vps.sh
sudo ./scripts/setup-vps.sh
```

Isso instala Docker Engine + Compose plugin (repositório oficial do Docker, não o script de conveniência), configura o firewall (`ufw`: libera só SSH/80/443), cria a rede externa `traefik-public` e prepara o volume `acme.json` com as permissões que o Traefik exige (600).

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env   # ou o editor de sua preferência
```

Preencha **todos** os campos marcados como `CHANGE_ME_...` — são credenciais e nenhum tem valor padrão de propósito (ver comentário no topo do `.env.example`). Sugestão para gerar valores fortes:

```bash
openssl rand -hex 32
```

### 4. Gerar a senha do dashboard do Traefik

```bash
chmod +x scripts/generate-dashboard-hash.sh
./scripts/generate-dashboard-hash.sh admin
```

Pede a senha de forma interativa (não fica no histórico do shell) e grava o hash bcrypt em `traefik/dynamic/.htpasswd` — arquivo já listado no `.gitignore` desta pasta, nunca deve ser commitado.

### 5. Subir a stack

```bash
docker compose up -d --build
```

Primeira subida demora alguns minutos (build da imagem `web`, download das demais imagens). Acompanhe:

```bash
docker compose logs -f traefik
```

### 6. Verificar os certificados SSL

```bash
docker compose logs traefik | grep -i "certificate"
```

Espere ver `"Register... acme: obtained certificate"` para cada domínio. Se algo falhar aqui, veja "Troubleshooting" abaixo antes de continuar.

Teste no navegador: `https://app.controlos.com.br`, `https://api.controlos.com.br/health`, `https://traefik.controlos.com.br` (deve pedir usuário/senha), `https://evolution.controlos.com.br`.

### 7. Aplicar as migrations do Prisma (banco do CONTROL OS)

Deliberadamente **não** automático no build/boot do container — mesma decisão já documentada no README raiz do monorepo ("rodar migration a cada build de aplicação é arriscado sem um passo de aprovação explícito"). Rode manualmente na primeira subida e a cada nova migration:

```bash
docker compose --profile maintenance run --rm --build migrate
```

O serviço temporário `migrate` usa a mesma versão do Prisma e os mesmos
arquivos de migration usados para construir o app. Ele termina sozinho após
aplicar (ou confirmar que não há) migrations e não fica exposto na internet.

### Scanner privado de documentos (ClamAV)

O serviço `clamav` executa `clamd` e `freshclam` exclusivamente na rede
interna `backend`: não publica portas no host e não possui labels do Traefik.
As assinaturas ficam no volume nomeado `controlos_clamav_data`, portanto
reiniciar ou recriar o container não força uma nova base vazia.

O primeiro start pode levar vários minutos enquanto a base é baixada e
carregada. O health check somente fica saudável quando `clamdcheck.sh`
recebe uma resposta válida do daemon. O `web` aguarda esse estado antes de
iniciar e conversa com `clamav:3310` usando o protocolo INSTREAM.

O limite do upload da aplicação é 15 MiB e `StreamMaxLength` fica em 20 MiB,
mantendo margem controlada sem aceitar streams arbitrariamente grandes. O
container tem **teto máximo configurado** de 4 GiB, não consumo esperado, e
reserva de 2 GiB: a documentação oficial do
ClamAV recomenda 4 GiB porque a carga e a recarga das assinaturas podem usar
mais de 2 GiB temporariamente. Reavalie esses valores antes de usar em uma VPS
menor. Se o scanner estiver indisponível, expirar ou devolver resposta
inválida, o fluxo falha fechado: nenhum byte é enviado ao storage privado,
download ou análise de IA sem resultado `CLEAN`.

`NOT_CONFIGURED` permanece uma dívida técnica deliberada. Sem scanner
configurado, o comportamento compatível continua sendo `scanStatus=PENDING`.

### Worker de análise documental (document-worker)

Depois que um documento passa pelo ClamAV (`scanStatus=CLEAN`) e é gravado no
R2, um `DocumentAnalysisJob` é criado e enfileirado (Postgres + Redis). Nada
processa essa fila sozinho: o serviço `document-worker`
(`infra/docker-compose.yml`) existe exatamente para isso, mas fica atrás de
`profiles: ["documents"]` de propósito — não sobe com `docker compose up -d`
comum, para impedir chamadas acidentais (e cobradas) à OpenAI antes de você
decidir ativar.

Antes de ativar, preencha em `infra/.env`:

- `DOCUMENT_JOB_RUNNER_SECRET` — segredo que autentica o worker no endpoint
  `POST /api/document-analysis/run`. Gere com `openssl rand -hex 32`.
- `OPENAI_DOCUMENT_ANALYSIS_ENABLED=true` — sem isto, a análise é bloqueada
  mesmo com `OPENAI_API_KEY` configurada (ver
  `services/documents/contract-analysis.ts`, `assertDocumentAnalysisEnabled`).
- `OPENAI_API_KEY` — já deve estar preenchida se o chat da NOVA usa
  `AI_PROVIDER=openai`; se não, preencha também aqui.

Depois, ative o worker:

```bash
docker compose --profile documents up -d document-worker
```

Ele roda um loop de polling autenticado contra o próprio `web` (rede interna
`backend`, sem porta pública), com `DOCUMENT_WORKER_POLL_INTERVAL_SECONDS`
(padrão 2s) entre tentativas. O banco continua sendo a fonte idempotente de
estado — jobs que já estavam `QUEUED` antes da ativação são processados
normalmente nos primeiros ciclos, sem duplicar: o worker reivindica cada job
com uma atualização condicional (`status: QUEUED → PROCESSING`, só uma
chamada vence a corrida) e a prévia resultante usa uma chave de idempotência
por documento+versão.

Para conferir se está ativo: `docker compose ps document-worker` (deve estar
`running`/`healthy`) e, depois de um upload novo `CLEAN`, o `analysisStatus`
do documento deve sair de `QUEUED` em poucos segundos.

### 8. Criar a primeira instância de WhatsApp na Evolution API

```bash
curl -X POST https://evolution.controlos.com.br/instance/create \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "controlos-principal", "qrcode": true}'
```

A resposta traz um QR code (base64) para escanear no WhatsApp do número que vai operar o canal. Documentação completa de endpoints: [doc.evolution-api.com](https://doc.evolution-api.com).

## Evolution API separada

"Separada" aqui significa, literalmente, infraestrutura própria — não é o mesmo Postgres nem o mesmo Redis do CONTROL OS:

- `evolution-postgres` e `evolution-redis` são containers próprios, numa rede (`evolution-backend`) que `postgres`/`redis` (do CONTROL OS) não alcançam.
- Se a Evolution API tiver um incidente (travar, precisar de restore de backup, etc.), o CONTROL OS continua funcionando normalmente, e vice-versa.
- Isso segue à risca o próprio `docker-compose.yaml` de referência do projeto Evolution API (mesmo padrão de Postgres/Redis dedicados que os mantenedores publicam).

## Multi-tenant: o que esta infraestrutura resolve e o que não resolve

Sendo direto sobre o escopo, para não sugerir uma capacidade que o código da aplicação ainda não tem:

**Resolve (nível de infraestrutura):**
- **Roteamento por subdomínio.** O `docker-compose.yml` já traz (comentado) um router Traefik com `HostRegexp` que aceita qualquer subdomínio de `ROOT_DOMAIN` e o direciona para o mesmo container `web` — o padrão clássico de roteamento multi-tenant por Host header.
- **Provisionamento de banco por tenant.** `postgres/init/01-init-multiple-databases.sh` cria um banco Postgres por nome na variável `POSTGRES_MULTIPLE_DATABASES` — pronto para um banco por tenant (`controlos_tenant_acme`, `controlos_tenant_beta`, ...) na primeira subida do volume.
- **Isolamento entre serviços.** Redes separadas, containers separados, credenciais separadas por serviço.

**Não resolve (fica a cargo do código da aplicação, fora do escopo desta entrega):**
- **Resolução de tenant por request.** Nenhuma rota em `apps/web` hoje lê o header `Host` para decidir "qual tenant é este" nem troca de `DATABASE_URL` dinamicamente. Isso é lógica de aplicação (middleware do Next.js ou equivalente), não infraestrutura.
- **Isolamento de dados dentro de um mesmo banco.** Se a decisão de produto for "todos os tenants num único banco, separados por uma coluna `tenant_id`" (em vez de um banco por tenant), isso também é schema/lógica de aplicação — o Prisma schema atual (`apps/web/prisma/schema.prisma`) não tem esse campo ainda.

Ou seja: esta infraestrutura deixa o terreno pronto (rota certa chega no lugar certo, banco pode ser criado por tenant) sem inventar comportamento de aplicação que ainda não existe no código.

## SSL wildcard para multi-tenant (opcional)

O certResolver padrão usa desafio **HTTP-01** — funciona para qualquer domínio explícito (os 4 do `.env`), mas **não emite certificado wildcard** (`*.controlos.com.br`). Se o plano for um subdomínio por tenant sem cadastrar cada um manualmente, troque para desafio **DNS-01**:

1. No `docker-compose.yml`, serviço `traefik`, bloco `environment`: comente as duas linhas `TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_HTTPCHALLENGE_ENTRYPOINT` e descomente as duas linhas `TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_DNSCHALLENGE_PROVIDER`/`_DNSCHALLENGE_RESOLVERS` (provider `hostinger`, já preparado). Note que a configuração estática do Traefik hoje é 100% via variáveis de ambiente — não há mais `traefik.yml` montado no container (ver comentário no topo de `traefik/traefik.yml`, mantido só como referência).
2. Gere um token de API na Hostinger: hPanel → Avançado → API.
3. Preencha `HOSTINGER_API_TOKEN` no `.env` (linha já reservada, comentada).
4. Descomente as 5 linhas do router `web-tenants` no serviço `web` do `docker-compose.yml`.
5. `docker compose up -d` para aplicar.

Se o domínio for gerenciado em outro provedor de DNS (ex.: Cloudflare, mesmo com a VPS na Hostinger), troque `provider: hostinger` por qualquer um dos [provedores suportados pelo lego](https://go-acme.github.io/lego/dns/) (biblioteca ACME usada pelo Traefik) e ajuste as variáveis de ambiente exigidas por aquele provedor.

## Backups

Os dados que importam vivem em volumes nomeados (`controlos_postgres_data`, `controlos_evolution_postgres_data`, `controlos_evolution_instances`, etc. — nomes fixos, ver `docker-compose.yml`). Exemplo de backup lógico do Postgres do CONTROL OS:

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-controlos-$(date +%Y%m%d).sql
```

Para a rotina mínima local (banco principal, banco da Evolution e sessões
persistentes do WhatsApp), use o script versionado:

```bash
chmod +x scripts/backup-controlos.sh scripts/verify-backup-controlos.sh scripts/health-report.sh
./scripts/backup-controlos.sh
./scripts/verify-backup-controlos.sh /var/backups/controlos/AAAAMMDDTHHMMSSZ
```

O backup fica inicialmente na própria VPS — isso protege contra erro humano,
mas **não** contra perda da VPS. Antes de receber clientes, copie os backups
diariamente para armazenamento externo e execute uma restauração isolada
documentada. O script não restaura nem apaga banco/volume.

Mesma lógica para `evolution-postgres` com `EVOLUTION_POSTGRES_USER`/`EVOLUTION_POSTGRES_DB`. Automatize isso via `cron` — não incluído aqui de propósito (política de retenção/destino do backup é decisão operacional, não de infraestrutura).

## Atualizando a stack

Para publicar uma atualização do frontend em produção, use a rotina controlada:

```bash
cd /srv/control-os/infra
chmod +x scripts/deploy-web-safe.sh
./scripts/deploy-web-safe.sh
```

O script exige a branch `main` e o working tree limpo, atualiza o checkout
somente por fast-forward, cria um dump do PostgreSQL principal fora do
repositório e valida o arquivo com `pg_restore -l`. Em seguida, audita o estado
das migrations, executa exclusivamente `prisma migrate deploy` quando houver
uma migration pendente reconhecida, reconstrói somente o `web` e aguarda o
health check antes de executar os smoke tests públicos.

O processo é interrompido se houver divergência no Git, backup vazio ou
inválido, estado inesperado de migrations, falha de build/health ou resposta
inesperada das APIs. Os containers de banco, Redis, Traefik, API e Evolution
são identificados antes da publicação e devem permanecer os mesmos ao final.

Por padrão, os backups desta rotina ficam em
`/srv/control-os-backups/manual`. Esse diretório está fora do checkout Git. A
cópia externa e o teste periódico de restauração continuam obrigatórios; a
validação do catálogo prova que o dump pode ser lido pelo `pg_restore`, mas não
substitui um ensaio completo de restauração isolada.

Não use `docker compose up -d --build` para uma atualização rotineira: esse
comando tem escopo amplo e pode reconstruir ou recriar serviços que não fazem
parte da entrega aprovada.

## Troubleshooting

**Certificado não emite / Traefik loga erro de ACME.**
Confirme que os 4 registros DNS já propagaram (`dig +short app.controlos.com.br` deve devolver o IP da VPS) e que as portas 80/443 estão realmente abertas (`sudo ufw status`, e verifique também o firewall do painel da Hostinger, se houver um separado do `ufw` do sistema).

**Dashboard do Traefik pede senha mas nunca aceita.**
Rode `./scripts/generate-dashboard-hash.sh <usuario>` de novo — o script sobrescreve a entrada anterior do mesmo usuário. Confirme que `traefik/dynamic/.htpasswd` existe e tem uma linha (`cat traefik/dynamic/.htpasswd`).

**`web` não sobe / erro de conexão com o banco.**
Confira `docker compose logs web`. Erros de `DATABASE_URL` geralmente são `POSTGRES_PASSWORD` com caracteres especiais não escapados — evite `@`, `/`, `:` na senha, ou faça URL-encode manualmente na string de conexão.

**`acme.json: permissions '644' are too open`.**
O volume não foi preparado com `chmod 600` antes da primeira subida. Rode:
```bash
docker compose down
docker run --rm -v controlos_traefik_acme:/letsencrypt alpine:3.20 sh -c "chmod 600 /letsencrypt/acme.json"
docker compose up -d
```

**Evolution API não conecta ao WhatsApp / QR code não aparece.**
Confirme `docker compose logs evolution-api`. Erros de banco geralmente indicam que `evolution-postgres` ainda não passou no healthcheck — espere alguns segundos e tente de novo (`depends_on: condition: service_healthy` já deveria evitar isso, mas a primeira criação do schema pode levar um instante extra).

## Próximos passos (fora do escopo desta entrega)

- **Webhook HTTP real da Evolution API → CONTROL OS.** A Fase 8 do produto (ver `services/channel-gateway` no monorepo) entregou a infraestrutura interna do Channel Gateway (adapter de canal, envelope de mensagem, roteamento para o CONTROL HUB) — mas nenhuma Route Handler HTTP pública (`app/api/whatsapp/webhook`, por exemplo) existe ainda para receber os eventos que `EVOLUTION_WEBHOOK_URL` chamaria. Conectar os dois é o próximo passo natural, e deve ser rápido dado que a arquitetura já existe.
- **Migração do canal Web para o CONTROL HUB.** Documentado no próprio código (`channels/web`) como decisão consciente de escopo — o chat da NOVA na UI ainda fala direto com `ConversationService`, não com `controlHub.receive`.
- **Lógica de tenant na aplicação** — ver seção "Multi-tenant" acima.
