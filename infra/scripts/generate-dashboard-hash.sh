#!/usr/bin/env bash
# CONTROL OS — Infra — gera o hash de senha do dashboard do Traefik
#
# Uso:
#   ./scripts/generate-dashboard-hash.sh <usuario>
#
# Pede a senha de forma interativa (nunca aparece na tela nem fica no
# histórico do shell), gera o hash bcrypt no formato htpasswd e grava (ou
# atualiza) a linha correspondente em traefik/dynamic/.htpasswd — o
# arquivo que traefik/dynamic/middlewares.yml referencia no middleware
# "dashboard-auth" (basicAuth.usersFile).
#
# Não exige instalar apache2-utils no host: usa a imagem oficial "httpd"
# (contém o utilitário htpasswd) via um container descartável.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTPASSWD_FILE="$SCRIPT_DIR/../traefik/dynamic/.htpasswd"

if [ "$#" -ne 1 ]; then
  echo "Uso: $0 <usuario>" >&2
  exit 1
fi

USERNAME="$1"

read -r -s -p "Senha para '$USERNAME' (não aparece na tela): " PASSWORD
echo ""
read -r -s -p "Confirme a senha: " PASSWORD_CONFIRM
echo ""

if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
  echo "As senhas não coincidem. Tente novamente." >&2
  exit 1
fi

if [ -z "$PASSWORD" ]; then
  echo "Senha vazia não é permitida." >&2
  exit 1
fi

mkdir -p "$(dirname "$HTPASSWD_FILE")"

# "-nbB": n = não grava em arquivo (imprime no stdout, gravamos nós
# mesmos abaixo); b = senha vem por argumento (não interativo dentro do
# container); B = bcrypt (formato que o middleware basicAuth do Traefik
# espera).
NEW_LINE="$(docker run --rm httpd:2.4-alpine htpasswd -nbB "$USERNAME" "$PASSWORD")"

# Remove uma entrada anterior do mesmo usuário (se existir) antes de
# adicionar a nova — permite rodar este script de novo para trocar a
# senha, sem duplicar linhas no arquivo.
if [ -f "$HTPASSWD_FILE" ]; then
  grep -v "^${USERNAME}:" "$HTPASSWD_FILE" > "${HTPASSWD_FILE}.tmp" 2>/dev/null || true
  mv "${HTPASSWD_FILE}.tmp" "$HTPASSWD_FILE"
fi

echo "$NEW_LINE" >> "$HTPASSWD_FILE"
chmod 600 "$HTPASSWD_FILE"

echo ""
echo "Hash gravado em: $HTPASSWD_FILE"
echo "Reinicie o Traefik para aplicar (o provider 'file' já observa o"
echo "arquivo com watch: true — normalmente nem precisa reiniciar):"
echo "  docker compose restart traefik"
