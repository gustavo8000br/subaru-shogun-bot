#!/usr/bin/env bash
set -euo pipefail

output_path="${1:-}"
if [[ -z "$output_path" ]]; then
  printf '%s\n' 'Uso: bash scripts/bootstrap-compose-env.sh <arquivo-temporario>' >&2
  exit 1
fi

env_path="${COMPOSE_SOURCE_ENV:-.env}"
if [[ ! -r "$env_path" ]]; then
  printf '%s\n' 'Não foi possível ler o arquivo de ambiente do Compose' >&2
  exit 1
fi

file_database_url=''
file_postgres_db=''
file_postgres_user=''
file_postgres_password=''

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ ^[[:space:]]*(DATABASE_URL|POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD)[[:space:]]*=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value//$'\r'/}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
      value="${value//\\n/$'\n'}"
      value="${value//\\\"/\"}"
      value="${value//\\\\/\\}"
    fi
    case "$key" in
      DATABASE_URL) file_database_url="$value" ;;
      POSTGRES_DB) file_postgres_db="$value" ;;
      POSTGRES_USER) file_postgres_user="$value" ;;
      POSTGRES_PASSWORD) file_postgres_password="$value" ;;
    esac
  fi
done < "$env_path"

database_url="${DATABASE_URL:-$file_database_url}"
if [[ "$database_url" != postgresql://* ]]; then
  printf '%s\n' 'DATABASE_URL ausente ou inválida; não foi possível preparar o ambiente do Compose' >&2
  exit 1
fi

authority_and_path="${database_url#postgresql://}"
if [[ "$authority_and_path" != *@*/* ]]; then
  printf '%s\n' 'DATABASE_URL ausente ou inválida; não foi possível preparar o ambiente do Compose' >&2
  exit 1
fi
userinfo="${authority_and_path%%@*}"
hostport_and_path="${authority_and_path#*@}"
hostport="${hostport_and_path%%/*}"
database_path="/${hostport_and_path#*/}"
host="${hostport%%:*}"
if [[ "$host" != 'db' ]]; then
  printf '%s\n' 'DATABASE_URL deve usar PostgreSQL no host interno db' >&2
  exit 1
fi
if [[ ! "$userinfo" =~ ^([^:]*):(.*)$ ]]; then
  printf '%s\n' 'DATABASE_URL não contém os dados necessários para preparar o ambiente do Compose' >&2
  exit 1
fi

percent_decode() {
  local value="$1"
  local decoded=''
  local character hex index=0
  while (( index < ${#value} )); do
    character="${value:index:1}"
    if [[ "$character" == '%' ]]; then
      hex="${value:index+1:2}"
      if [[ ! "$hex" =~ ^[0-9A-Fa-f]{2}$ ]]; then
        return 1
      fi
      printf -v character '%b' "\\x$hex"
      ((index += 3))
    else
      ((index += 1))
    fi
    decoded+="$character"
  done
  printf '%s' "$decoded"
}

database_name="${POSTGRES_DB:-${file_postgres_db:-${database_path#/?}}}"
database_name="${database_name%%\?*}"
postgres_user="${POSTGRES_USER:-$file_postgres_user}"
postgres_password="${POSTGRES_PASSWORD:-$file_postgres_password}"
postgres_user="${postgres_user:-$(percent_decode "${userinfo%%:*}")}" || {
  printf '%s\n' 'DATABASE_URL não contém os dados necessários para preparar o ambiente do Compose' >&2
  exit 1
}
postgres_password="${postgres_password:-$(percent_decode "${userinfo#*:}")}" || {
  printf '%s\n' 'DATABASE_URL não contém os dados necessários para preparar o ambiente do Compose' >&2
  exit 1
}

if [[ -z "$database_name" || -z "$postgres_user" || -z "$postgres_password" ]]; then
  printf '%s\n' 'DATABASE_URL não contém os dados necessários para preparar o ambiente do Compose' >&2
  exit 1
fi

escape_env_value() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '"%s"' "$value"
}

{
  printf 'POSTGRES_DB=%s\n' "$(escape_env_value "$database_name")"
  printf 'POSTGRES_USER=%s\n' "$(escape_env_value "$postgres_user")"
  printf 'POSTGRES_PASSWORD=%s\n' "$(escape_env_value "$postgres_password")"
} > "$output_path"
chmod 600 "$output_path"