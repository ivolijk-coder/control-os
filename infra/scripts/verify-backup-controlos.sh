#!/usr/bin/env bash
# Valida a integridade de um backup sem restaurar nem tocar no banco ativo.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 /var/backups/controlos/AAAAMMDDTHHMMSSZ" >&2
  exit 1
fi

backup_dir="$1"
if [[ ! -f "$backup_dir/SHA256SUMS" ]]; then
  echo "Manifesto SHA256SUMS não encontrado em: $backup_dir" >&2
  exit 1
fi

(cd "$backup_dir" && sha256sum -c SHA256SUMS)
echo "Integridade dos arquivos confirmada. Isto não substitui um teste de restauração isolado."
