#!/usr/bin/env bash
set -e

git pull --ff-only origin main

docker compose up -d --build

echo "Deploy concluído com sucesso."
