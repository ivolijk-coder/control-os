#!/usr/bin/env bash
# Publicação controlada do frontend do CONTROL OS na VPS.
#
# Atualiza somente por fast-forward para um commit explicitamente autorizado,
# cria e restaura um backup em PostgreSQL descartável, aplica migrations Prisma
# pendentes pelo mecanismo oficial e recria exclusivamente o serviço web.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$INFRA_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/.env}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-/srv/control-os-backups/manual}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"
EXPECTED_PRODUCT_COMMIT="74681fd5acaa9327433b67d590d3387be1f8dd7e"
REQUESTED_EXPECTED_COMMIT="${EXPECTED_COMMIT:-}"
REQUESTED_LOW_TRAFFIC_CONFIRMED="${LOW_TRAFFIC_CONFIRMED:-false}"
REQUESTED_LONG_TRANSACTION_SECONDS="${LONG_TRANSACTION_SECONDS:-60}"

restore_test_container=""
old_web_image=""
old_web_image_ref=""
web_recreated=false
deployment_completed=false

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

# Estes gates pertencem à invocação do deploy e não podem ser substituídos por
# valores antigos eventualmente presentes no arquivo persistente da VPS.
EXPECTED_COMMIT="$REQUESTED_EXPECTED_COMMIT"
LOW_TRAFFIC_CONFIRMED="$REQUESTED_LOW_TRAFFIC_CONFIRMED"
LONG_TRANSACTION_SECONDS="$REQUESTED_LONG_TRANSACTION_SECONDS"

: "${POSTGRES_USER:?POSTGRES_USER ausente no .env}"
: "${POSTGRES_DB:?POSTGRES_DB ausente no .env}"
: "${DOMAIN_APP:?DOMAIN_APP ausente no .env}"

# O Compose exige esta variável mesmo quando o worker não é selecionado. Este
# fallback só permite interpolar o arquivo; não ativa nem recria o worker.
export DOCUMENT_JOB_RUNNER_SECRET="${DOCUMENT_JOB_RUNNER_SECRET:-worker-nao-ativado}"

wait_for_web_health() {
  local deadline web_health
  deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  while (( SECONDS < deadline )); do
    web_health="$(
      docker inspect controlos_web \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        2>/dev/null || true
    )"
    [[ "$web_health" == "healthy" ]] && return 0
    [[ "$web_health" == "unhealthy" ]] && return 1
    sleep 3
  done

  return 1
}

run_public_smoke_tests() {
  local app_url finance_code documents_code intelligence_code
  app_url="https://$DOMAIN_APP"

  if ! curl --connect-timeout 10 --max-time 30 --fail --silent --show-error \
    "$app_url/api/health"; then
    echo "API health falhou" >&2
    return 1
  fi
  echo

  finance_code="$(curl --connect-timeout 10 --max-time 30 \
    --silent --output /dev/null --write-out '%{http_code}' \
    "$app_url/api/finance/transactions")"
  if [[ "$finance_code" != "401" ]]; then
    echo "API financeira sem autenticação retornou HTTP $finance_code; esperado 401" >&2
    return 1
  fi

  documents_code="$(curl --connect-timeout 10 --max-time 30 \
    --silent --output /dev/null --write-out '%{http_code}' \
    "$app_url/api/documents")"
  if [[ "$documents_code" != "401" ]]; then
    echo "API de documentos sem autenticação retornou HTTP $documents_code; esperado 401" >&2
    return 1
  fi

  intelligence_code="$(curl --connect-timeout 10 --max-time 30 \
    --silent --output /dev/null --write-out '%{http_code}' \
    "$app_url/api/finance/intelligence/status")"
  if [[ "$intelligence_code" != "401" ]]; then
    echo "Inteligência financeira sem autenticação retornou HTTP $intelligence_code; esperado 401" >&2
    return 1
  fi

  echo "Finance sem autenticação: HTTP $finance_code"
  echo "Documentos sem autenticação: HTTP $documents_code"
  echo "Inteligência financeira sem autenticação: HTTP $intelligence_code"
}

rollback_web() {
  if [[ -z "$old_web_image" || -z "$old_web_image_ref" ]]; then
    echo "ROLLBACK NÃO EXECUTADO: imagem anterior não foi identificada" >&2
    return 1
  fi

  echo "== Rollback operacional somente do web ==" >&2
  echo "A migration aditiva não será revertida automaticamente." >&2
  docker tag "$old_web_image" "$old_web_image_ref"
  docker compose up -d --no-deps web

  if ! wait_for_web_health; then
    docker logs --tail 100 controlos_web >&2 || true
    echo "ROLLBACK CRÍTICO: imagem anterior não ficou healthy" >&2
    return 1
  fi

  docker logs --tail 100 controlos_web >&2 || true
  if ! run_public_smoke_tests; then
    echo "ROLLBACK CRÍTICO: smoke tests falharam na imagem anterior" >&2
    return 1
  fi

  echo "Rollback do web concluído; banco e migrations foram preservados." >&2
}

cleanup() {
  local exit_code=$?
  trap - EXIT

  if [[ -n "$restore_test_container" ]]; then
    docker rm -f "$restore_test_container" >/dev/null 2>&1 || true
  fi

  if (( exit_code != 0 )) && [[ "$web_recreated" == "true" ]] && \
     [[ "$deployment_completed" != "true" ]]; then
    rollback_web || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT

[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || \
  fail "Informe EXPECTED_COMMIT com o hash operacional completo de 40 caracteres"
[[ "$EXPECTED_PRODUCT_COMMIT" =~ ^[0-9a-f]{40}$ ]] || \
  fail "EXPECTED_PRODUCT_COMMIT interno é inválido"
[[ "$LOW_TRAFFIC_CONFIRMED" == "true" ]] || \
  fail "Confirme a janela de baixo tráfego com LOW_TRAFFIC_CONFIRMED=true"
[[ "$LONG_TRANSACTION_SECONDS" =~ ^[1-9][0-9]*$ ]] || \
  fail "LONG_TRANSACTION_SECONDS deve ser um inteiro positivo"

cd "$REPO_DIR"

[[ "$(git branch --show-current)" == "$DEPLOY_BRANCH" ]] || \
  fail "Branch atual diferente da autorizada: esperado $DEPLOY_BRANCH"
[[ -z "$(git status --porcelain)" ]] || \
  fail "Working tree da VPS não está limpo. Nenhum arquivo foi alterado."

echo "== Estado inicial do repositório =="
echo "Diretório: $REPO_DIR"
echo "Branch: $(git branch --show-current)"
echo "HEAD: $(git rev-parse HEAD)"
echo "Marco de produto obrigatório: $EXPECTED_PRODUCT_COMMIT"
echo "Commit autorizado: $EXPECTED_COMMIT"

git fetch origin "$DEPLOY_BRANCH"

origin_commit="$(git rev-parse "origin/$DEPLOY_BRANCH")"
[[ "$origin_commit" == "$EXPECTED_COMMIT" ]] || \
  fail "origin/$DEPLOY_BRANCH divergiu: esperado $EXPECTED_COMMIT, encontrado $origin_commit"
git merge-base --is-ancestor "$EXPECTED_PRODUCT_COMMIT" "$EXPECTED_COMMIT" || \
  fail "O commit operacional $EXPECTED_COMMIT não contém o marco de produto $EXPECTED_PRODUCT_COMMIT"

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
[[ "$DEPLOY_COMMIT" == "$EXPECTED_COMMIT" ]] || \
  fail "Commit selecionado divergiu: esperado $EXPECTED_COMMIT, encontrado $DEPLOY_COMMIT"
echo "Commit selecionado para publicação: $DEPLOY_COMMIT"

cd "$INFRA_DIR"
docker compose config --quiet

protected_services=(api postgres redis traefik clamav evolution-postgres evolution-redis evolution-api)
optional_services=(document-worker)
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

echo "== Estado dos serviços opcionais antes da publicação =="
for service in "${optional_services[@]}"; do
  container_id="$(docker compose ps --all -q "$service")"
  container_before["$service"]="$container_id"

  if [[ -z "$container_id" ]]; then
    echo "$service: inexistente (deve permanecer inexistente)"
    continue
  fi

  container_state="$(docker inspect "$container_id" --format '{{.State.Status}}')"
  container_health="$(
    docker inspect "$container_id" \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}}'
  )"
  [[ "$container_state" == "running" ]] || \
    fail "O serviço opcional existente '$service' está em estado $container_state"
  [[ "$container_health" == "healthy" || "$container_health" == "sem-healthcheck" ]] || \
    fail "O serviço opcional existente '$service' está com health $container_health"
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

echo "Backup criado: $backup_file ($(wc -c < "$backup_file" | tr -d ' ') bytes)"
echo "Catálogo validado: $(wc -l < "$backup_catalog" | tr -d ' ') linhas"

echo "== Restauração integral em PostgreSQL descartável =="
restore_test_container="controlos-restore-${DEPLOY_COMMIT:0:7}-$timestamp-$$"
docker run --detach --rm \
  --name "$restore_test_container" \
  --network none \
  --memory 1024m \
  --env POSTGRES_USER=restore_user \
  --env POSTGRES_PASSWORD=restore_password_synthetic \
  --env POSTGRES_DB=restore_db \
  postgres:16-alpine >/dev/null

restore_deadline=$((SECONDS + 60))
until docker exec "$restore_test_container" \
  pg_isready -U restore_user -d restore_db >/dev/null 2>&1; do
  (( SECONDS < restore_deadline )) || \
    fail "PostgreSQL descartável não ficou pronto para validar o backup"
  sleep 2
done

docker exec -i "$restore_test_container" \
  pg_restore --exit-on-error --no-owner --no-privileges \
    -U restore_user -d restore_db < "$backup_file"

restored_contract_count="$(
  docker exec "$restore_test_container" psql -X -A -t \
    -U restore_user -d restore_db \
    -c 'SELECT COUNT(*) FROM financial_contracts;'
)"
[[ "$restored_contract_count" =~ ^[0-9]+$ ]] || \
  fail "Restauração isolada não permitiu consultar financial_contracts"

docker rm -f "$restore_test_container" >/dev/null
restore_test_container=""
echo "Restauração isolada aprovada; financial_contracts: $restored_contract_count registros"

echo "== Checagem de segurança pré-migration =="
docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
SELECT COUNT(*) AS financial_contract_rows,
       pg_size_pretty(pg_total_relation_size('financial_contracts')) AS total_size
FROM financial_contracts;
SQL

long_transaction_count="$(
  docker compose exec -T postgres psql -X -A -t -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND xact_start IS NOT NULL AND now() - xact_start > make_interval(secs => $LONG_TRANSACTION_SECONDS);"
)"
[[ "$long_transaction_count" == "0" ]] || \
  fail "Há $long_transaction_count transação(ões) com mais de ${LONG_TRANSACTION_SECONDS}s"

waiting_lock_count="$(
  docker compose exec -T postgres psql -X -A -t -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT COUNT(*) FROM pg_locks WHERE relation = 'financial_contracts'::regclass AND NOT granted;"
)"
[[ "$waiting_lock_count" == "0" ]] || \
  fail "Há $waiting_lock_count lock(s) aguardando em financial_contracts"

relation_lock_count="$(
  docker compose exec -T postgres psql -X -A -t -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT COUNT(*) FROM pg_locks WHERE relation = 'financial_contracts'::regclass;"
)"
[[ "$relation_lock_count" == "0" ]] || \
  fail "Há $relation_lock_count lock(s) ativo(s) em financial_contracts; aguarde a tabela ficar ociosa"
echo "Sem transações longas ou locks ativos/pendentes em financial_contracts."

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
old_web_image_ref="$(docker inspect controlos_web --format '{{.Config.Image}}' 2>/dev/null || true)"
[[ -n "$old_web_image" && -n "$old_web_image_ref" ]] || \
  fail "Não foi possível preservar a identidade da imagem web anterior"

echo "== Build e recriação exclusiva do web =="
echo "Imagem preservada para rollback: $old_web_image ($old_web_image_ref)"
docker compose build web
new_web_image="$(docker image inspect infra-web:latest --format '{{.Id}}')"
web_recreated=true
docker compose up -d --no-deps web

wait_for_web_health || \
  fail "O web não ficou healthy em ${HEALTH_TIMEOUT_SECONDS}s"

if docker inspect controlos_web --format '{{range .Config.Env}}{{println .}}{{end}}' | \
   grep -Fxq 'ENABLE_NOVA_CONTRACT_CREATION=true'; then
  fail "ENABLE_NOVA_CONTRACT_CREATION está true dentro do container web"
fi
echo "ENABLE_NOVA_CONTRACT_CREATION: desabilitada"

for service in "${protected_services[@]}"; do
  container_after="$(docker compose ps -q "$service")"
  [[ "$container_after" == "${container_before[$service]}" ]] || \
    fail "O serviço protegido '$service' foi recriado inesperadamente"
done

for service in "${optional_services[@]}"; do
  container_after="$(docker compose ps --all -q "$service")"
  [[ "$container_after" == "${container_before[$service]}" ]] || \
    fail "O serviço opcional '$service' mudou inesperadamente"
done

echo "== Smoke tests =="
run_public_smoke_tests || fail "Smoke tests públicos falharam"

[[ -z "$(git -C "$REPO_DIR" status --porcelain)" ]] || \
  fail "Working tree da VPS não está limpo ao final"

deployment_completed=true

echo "== Publicação concluída =="
echo "Commit: $DEPLOY_COMMIT"
echo "Backup restaurado e validado: $backup_file"
echo "Imagem anterior do web: $old_web_image"
echo "Imagem ativa do web: $new_web_image"
echo "Container web: running / healthy"
echo "API health: sucesso"
echo "Demais serviços: não recriados"
echo "Working tree: limpo"
