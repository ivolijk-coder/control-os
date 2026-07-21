#!/usr/bin/env bash
# CONTROL OS — Postgres (app) — provisionamento multi-banco na primeira
# inicialização do volume.
#
# A imagem oficial "postgres" executa todo script em
# /docker-entrypoint-initdb.d/ automaticamente, mas SÓ na primeira vez que
# o volume de dados é criado (ver docker-compose.yml, serviço "postgres",
# volumes). Se o banco já existe, este script nunca roda de novo — isso é
# comportamento da própria imagem oficial, não algo implementado aqui.
#
# Propósito (infra multi-tenant): a variável POSTGRES_MULTIPLE_DATABASES
# (.env) aceita uma lista separada por vírgula de bancos a criar além do
# banco padrão já criado pela própria imagem (POSTGRES_DB). Hoje o valor
# padrão do .env.example é só "controlos" (o banco do apps/web) — a
# capacidade de adicionar um banco por tenant (ex.:
# "controlos,controlos_tenant_acme,controlos_tenant_beta") já existe aqui,
# pronta para quando o app ganhar lógica de seleção de banco por tenant
# (fora do escopo desta infraestrutura — ver README, seção "Multi-tenant:
# o que esta infraestrutura resolve e o que não resolve").
#
# Baseado no padrão de script comunitário amplamente usado para a imagem
# oficial do Postgres (create-multiple-postgresql-databases), adaptado aos
# nomes de variável deste projeto.

set -e
set -u

function create_database() {
	local database=$1
	echo "  Criando banco '$database' (se ainda não existir)..."
	psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
	    SELECT 'CREATE DATABASE "$database"'
	    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
	    GRANT ALL PRIVILEGES ON DATABASE "$database" TO "$POSTGRES_USER";
EOSQL
}

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
	echo "Provisionamento multi-banco solicitado: $POSTGRES_MULTIPLE_DATABASES"
	IFS=',' read -ra DATABASES <<< "$POSTGRES_MULTIPLE_DATABASES"
	for database in "${DATABASES[@]}"; do
		create_database "$(echo "$database" | xargs)" # xargs apara espaços em volta da vírgula
	done
	echo "Provisionamento multi-banco concluído."
else
	echo "POSTGRES_MULTIPLE_DATABASES não definida — usando só o banco padrão '$POSTGRES_DB'."
fi
