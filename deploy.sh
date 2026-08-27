#!/usr/bin/env bash
set -e

git pull --ff-only origin main

compose_env="$(mktemp)"
trap 'rm -f "$compose_env"' EXIT
node scripts/bootstrap-compose-env.mjs "$compose_env"

compose=(docker compose --env-file "$compose_env")

"${compose[@]}" up -d db
"${compose[@]}" build app
"${compose[@]}" run --rm --no-deps app npx prisma migrate deploy
"${compose[@]}" up -d app

"${compose[@]}" exec -T app npm run deploy:commands

echo "Deploy concluído com sucesso."
