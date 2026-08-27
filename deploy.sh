#!/usr/bin/env bash
set -e

git pull --ff-only origin main

docker compose up -d db
docker compose up -d --build app
docker compose exec -T app npx prisma db push
docker compose restart app

docker compose exec -T app npm run deploy:commands

echo "Deploy concluído com sucesso."
