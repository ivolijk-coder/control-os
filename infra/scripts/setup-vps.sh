#!/usr/bin/env bash
# CONTROL OS — Infra — preparo inicial da VPS (Ubuntu 24.04 LTS, ex.: Hostinger)
#
# Roda UMA VEZ, logo após o primeiro acesso SSH a uma VPS nova. Faz só
# infraestrutura de sistema operacional (Docker + firewall + diretórios) —
# nenhum container da stack é iniciado aqui (ver README, passo seguinte:
# "docker compose up -d").
#
# Uso (como root ou usuário com sudo):
#   chmod +x scripts/setup-vps.sh
#   ./scripts/setup-vps.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode este script como root (ou via sudo)." >&2
  exit 1
fi

echo "==> Atualizando pacotes do sistema..."
apt-get update -y
apt-get upgrade -y

echo "==> Instalando pré-requisitos..."
apt-get install -y ca-certificates curl gnupg ufw

echo "==> Adicionando a chave GPG oficial do Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "==> Adicionando o repositório oficial do Docker (Ubuntu 24.04 — noble)..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "==> Instalando Docker Engine + Compose plugin..."
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Habilitando o Docker no boot..."
systemctl enable docker
systemctl start docker

echo "==> Configurando firewall (ufw) — libera só SSH, HTTP e HTTPS..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Criando a rede externa 'traefik-public' (usada pelo docker-compose.yml)..."
docker network inspect traefik-public > /dev/null 2>&1 \
  || docker network create traefik-public

echo "==> Preparando o arquivo de certificados do Traefik (acme.json)..."
# O Traefik se recusa a usar acme.json com permissões abertas demais —
# precisa existir com 600 ANTES do primeiro "docker compose up". Como
# "traefik_acme" é um volume nomeado (não um bind mount), criamos o
# arquivo dentro dele rodando um container descartável que monta o mesmo
# volume, evitando ter que descobrir o caminho do volume no host.
docker volume inspect controlos_traefik_acme > /dev/null 2>&1 \
  || docker volume create controlos_traefik_acme
docker run --rm -v controlos_traefik_acme:/letsencrypt alpine:3.20 \
  sh -c "touch /letsencrypt/acme.json && chmod 600 /letsencrypt/acme.json"

echo ""
echo "==> VPS pronta. Próximos passos (ver README.md):"
echo "    1. Aponte os registros DNS (A) de cada domínio para o IP desta VPS."
echo "    2. Copie .env.example para .env e preencha todos os valores."
echo "    3. Gere o hash da senha do dashboard: ./scripts/generate-dashboard-hash.sh <usuario>"
echo "    4. Suba a stack: docker compose up -d --build"
echo ""
echo "Se você (usuário não-root) quiser rodar 'docker' sem sudo depois, adicione"
echo "seu usuário ao grupo docker: usermod -aG docker \$SEU_USUARIO (requer novo login)."
