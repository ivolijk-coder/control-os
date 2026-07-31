#!/usr/bin/env bash
# Publicação controlada do frontend do CONTROL OS na VPS.
#
# Esta rotina atualiza somente por fast-forward, cria e valida um backup do
# banco principal, aplica migrations Prisma pendentes pelo mecanismo oficial e
# recria exclusivamente o serviço web. Ela não faz commit, push, db push,
# alterações de infraestrutura ou ativação do document-worker.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$INFRA_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/.env}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-/srv/control-os-backups/manual}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"

fail() {
  echo "ERRO: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatório ausente: $1"
}

require_command git
require_command docker
require_command curl

[[ -f "$ENV_FILE" ]] || fail "Arquivo de ambiente não encontrado: $ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER ausente no .env}"
: "${POSTGRES_DB:?POSTGRES_DB ausente no .env}"
: "${DOMAIN_APP:?DOMAIN_APP ausente no .env}"

# O Compose exige esta variável mesmo quando o worker não é selecionado. O
# fallback existe somente para permitir a interpolação do arquivo e não ativa
# nem recria o document-worker.
export DOCUMENT_JOB_RUNNER_SECRET="${DOCUMENT_JOB_RUNNER_SECRET:-worker-nao-ativado}"

cd "$REPO_DIR"

[[ "$(git branch --show-current)" == "$DEPLOY_BRANCH" ]] || \
  fail "Branch atual diferente da autorizada: esperado $DEPLOY_BRANCH"
[[ -z "$(git status --porcelain)" ]] || \
  fail "Working tree da VPS não está limpo. Nenhum arquivo foi alterado."

echo "== Estado inicial do repositório =="
echo "Diretório: $REPO_DIR"
echo "Branch: $(git branch --show-current)"
echo "HEAD: $(git rev-parse HEAD)"

git fetch origin "$DEPLOY_BRANCH"

read -r commits_local commits_remote < <(
  git rev-list --left-right --count "HEAD...origin/$DEPLOY_BRANCH"
)

[[ "$commits_local" == "0" ]] || \
  fail "A branch local possui commits não enviados ou divergiu de origin/$DEPLOY_BRANCH"

if [[ "$commits_remote" != "0" ]]; then
  git merge --ff-only "origin/$DEPLOY_BRANCH"
fi

[[ -z "$(git status --porcelain)" ]] || \
  fail "Working tree deixou de estar limpo após a atualização"

DEPLOY_COMMIT="$(git rev-parse HEAD)"
echo "Commit selecionado para publicação: $DEPLOY_COMMIT"

cd "$INFRA_DIR"
docker compose config --quiet

protected_services=(api postgres redis traefik evolution-postgres evolution-redis evolution-api)
declare -A container_before

echo "== Saúde dos serviços protegidos antes da publicação =="
for service in "${protected_services[@]}"; do
  container_id="$(docker compose ps -q "$service")"
  [[ -n "$container_id" ]] || fail "O serviço obrigatório '$service' não está em execução"

  container_state="$(docker inspect "$container_id" --format '{{.State.Status}}')"
  [[ "$container_state" == "running" ]] || \
    fail "O serviço obrigatório '$service' está em estado $container_state"

  container_health="$(
    docker inspect "$container_id" \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}}'
  )"
  [[ "$container_health" == "healthy" || "$container_health" == "sem-healthcheck" ]] || \
    fail "O serviço obrigatório '$service' está com health $container_health"

  container_before["$service"]="$container_id"
  echo "$service: running / $container_health"
done

echo "== Backup do PostgreSQL principal =="
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/control-os-before-${DEPLOY_COMMIT:0:7}-$timestamp.dump"
backup_catalog="$backup_file.list"

docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$backup_file"
chmod 600 "$backup_file"
[[ -s "$backup_file" ]] || fail "O backup falhou ou ficou vazio: $backup_file"

docker compose exec -T postgres pg_restore -l < "$backup_file" > "$backup_catalog"
chmod 600 "$backup_catalog"
[[ -s "$backup_catalog" ]] || fail "A validação pg_restore -l não produziu catálogo"

echo "Backup validado: $backup_file ($(wc -c < "$backup_file" | tr -d ' ') bytes)"
echo "Catálogo validado: $(wc -l < "$backup_catalog" | tr -d ' ') linhas"

echo "== Auditoria das migrations =="
docker compose --profile maintenance build migrate

set +e
migration_status_before="$(
  docker compose --profile maintenance run --rm --no-deps migrate \
    pnpm --filter @control-os/web exec prisma migrate status 2>&1
)"
migration_status_code=$?
set -e
printf '%s\n' "$migration_status_before"

if [[ "$migration_status_code" == "0" ]] && \
   grep -Fq "Database schema is up to date" <<< "$migration_status_before"; then
  echo "Nenhuma migration pendente. migrate deploy não será executado."
elif grep -Fq "have not yet been applied" <<< "$migration_status_before"; then
  echo "Migration pendente reconhecida. Executando exclusivamente migrate deploy."
  docker compose --profile maintenance run --rm --no-deps migrate
else
  fail "Estado de migrations inesperado. Publicação interrompida antes do build do web."
fi

migration_status_after="$(
  docker compose --profile maintenance run --rm --no-deps migrate \
    pnpm --filter @control-os/web exec prisma migrate status 2>&1
)" || {
  printf '%s\n' "$migration_status_after" >&2
  fail "Falha na validação final das migrations"
}
printf '%s\n' "$migration_status_after"
grep -Fq "Database schema is up to date" <<< "$migration_status_after" || \
  fail "O banco não foi confirmado como atualizado"

old_web_image="$(docker inspect controlos_web --format '{{.Image}}' 2>/dev/null || true)"

echo "== Build e recriação exclusiva do web =="
docker compose build web
new_web_image="$(docker image inspect infra-web:latest --format '{{.Id}}')"
docker compose up -d --no-deps web

deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  web_health="$(
    docker inspect controlos_web \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      2>/dev/null || true
  )"
  [[ "$web_health" == "healthy" ]] && break
  [[ "$web_health" == "unhealthy" ]] && fail "O container web ficou unhealthy"
  sleep 3
done
[[ "${web_health:-}" == "healthy" ]] || \
  fail "O web não ficou healthy em ${HEALTH_TIMEOUT_SECONDS}s"

for service in "${protected_services[@]}"; do
  container_after="$(docker compose ps -q "$service")"
  [[ "$container_after" == "${container_before[$service]}" ]] || \
    fail "O serviço protegido '$service' foi recriado inesperadamente"
done

echo "== Smoke tests =="
app_url="https://$DOMAIN_APP"
curl --fail --silent --show-error "$app_url/api/health"
echo

finance_code="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "$app_url/api/finance/transactions")"
[[ "$finance_code" == "401" ]] || \
  fail "API financeira sem autenticação retornou HTTP $finance_code; esperado 401"

documents_code="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "$app_url/api/documents")"
[[ "$documents_code" == "401" ]] || \
  fail "API de documentos sem autenticação retornou HTTP $documents_code; esperado 401"

[[ -z "$(git -C "$REPO_DIR" status --porcelain)" ]] || \
  fail "Working tree da VPS não está limpo ao final"

echo "== Publicação concluída =="
echo "Commit: $DEPLOY_COMMIT"
echo "Backup: $backup_file"
echo "Imagem anterior do web: ${old_web_image:-não disponível}"
echo "Imagem ativa do web: $new_web_image"
echo "Container web: running / healthy"
echo "API health: sucesso"
echo "Finance sem autenticação: HTTP $finance_code"
echo "Documentos sem autenticação: HTTP $documents_code"
echo "Demais serviços: não recriados"
echo "Working tree: limpo"
