#!/usr/bin/env bash
set -e

git pull --ff-only origin main

docker compose up -d --build

docker compose exec -T app npm run deploy:commands

echo "Deploy concluído com sucesso."
