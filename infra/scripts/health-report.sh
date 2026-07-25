#!/usr/bin/env bash
# Relatório somente de leitura para o operador conferir a saúde básica da VPS.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$INFRA_DIR"

if [[ ! -f .env ]]; then
  echo "Arquivo .env não encontrado em $INFRA_DIR" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source ./.env
set +a

echo "== Containers =="
docker compose ps
echo ""
echo "== Espaço em disco =="
df -h /
echo ""
echo "== Memória =="
free -h
echo ""
echo "== Serviços com falha =="
systemctl --failed --no-pager || true
echo ""
echo "== Saúde externa =="
curl --fail --silent --show-error "https://${DOMAIN_API:?DOMAIN_API ausente no .env}/health" || true
echo ""
curl --fail --silent --show-error --head "https://${DOMAIN_APP:?DOMAIN_APP ausente no .env}" | head -n 1 || true
