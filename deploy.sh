#!/usr/bin/env bash
set -e

git pull --ff-only origin main

docker compose up -d db
docker compose build app
docker compose run --rm --no-deps app npx prisma migrate deploy
docker compose up -d app

docker compose exec -T app npm run deploy:commands

echo "Deploy concluído com sucesso."
