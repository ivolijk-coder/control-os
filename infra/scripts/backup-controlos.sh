#!/usr/bin/env bash
# Backup lógico local do CONTROL OS. Não envia dados a terceiros e não altera
# containers nem volumes. Para proteção real contra perda da VPS, copie os
# arquivos gerados para um armazenamento externo antes de considerar a rotina
# concluída.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/controlos}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo de ambiente não encontrado: $ENV_FILE" >&2
  exit 1
fi

# O .env é criado e controlado pelo operador; as variáveis são usadas apenas
# para nomear/validar o dump e nunca são impressas pelo script.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER ausente no .env}"
: "${POSTGRES_DB:?POSTGRES_DB ausente no .env}"
: "${EVOLUTION_POSTGRES_USER:?EVOLUTION_POSTGRES_USER ausente no .env}"
: "${EVOLUTION_POSTGRES_DB:?EVOLUTION_POSTGRES_DB ausente no .env}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/$timestamp"
mkdir -p "$target"
chmod 700 "$target"

cd "$INFRA_DIR"
echo "Criando backup lógico do banco principal..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$target/controlos.dump"

echo "Criando backup lógico do banco da Evolution..."
docker compose exec -T evolution-postgres pg_dump -U "$EVOLUTION_POSTGRES_USER" -d "$EVOLUTION_POSTGRES_DB" --format=custom \
  > "$target/evolution.dump"

echo "Arquivando sessões persistentes da Evolution..."
docker run --rm \
  -v controlos_evolution_instances:/source:ro \
  -v "$target":/backup \
  alpine:3.20 sh -c 'tar -C /source -czf /backup/evolution-instances.tar.gz .'

sha256sum "$target/controlos.dump" "$target/evolution.dump" "$target/evolution-instances.tar.gz" > "$target/SHA256SUMS"
chmod 600 "$target"/*

# Retenção local. Nunca remove volumes, bancos ou containers.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf -- {} +

echo "Backup concluído: $target"
echo "Próximo passo obrigatório: copiar este diretório para armazenamento externo seguro."
