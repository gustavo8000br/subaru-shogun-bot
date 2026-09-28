#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
work_dir=$(mktemp -d)
compose_nonce="${work_dir##*.}"
compose_project="shogun-test-${compose_nonce,,}"
compose=(docker compose --project-name "$compose_project" -f docker-compose.test.yml)
cleanup() {
  local original_exit=$?
  trap - EXIT
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  local leftovers
  leftovers=$("${compose[@]}" ps --all --quiet) || leftovers="cleanup-check-error"
  rm -rf "$work_dir"
  if [[ -n "$leftovers" ]]; then
    echo "Disposable integration cleanup failed for this Compose project." >&2
    exit 1
  fi
  echo "Disposable integration DB cleanup verified: no project containers remain."
  exit "$original_exit"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$project_root"

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is required for the isolated integration test database." >&2
  exit 1
fi

# The URL is deliberately local, disposable, and never read from .env.
"${compose[@]}" up --detach --wait test-db
port=$("${compose[@]}" port test-db 5432 | sed 's/.*://')
export DATABASE_URL="postgresql://shogun_test:shogun_test_ephemeral_only@127.0.0.1:${port}/shogun_test?schema=public"
export AIOX_TEST_DATABASE=ephemeral

# Prisma CLI auto-loads .env files from its working/schema directory. Run the
# migrations from an isolated temp copy so this harness never reads project .env.
cp prisma/schema.prisma "$work_dir/schema.prisma"
cp -R prisma/migrations "$work_dir/migrations"

# Production's baseline migration is a marker for an already-existing legacy
# schema. Recreate that legacy schema in the disposable database, then mark
# only that baseline as applied before exercising the forward migrations.
container_id=$("${compose[@]}" ps -q test-db)
if [[ -z "$container_id" ]]; then
  echo "Could not locate the disposable PostgreSQL container through this Compose project." >&2
  exit 1
fi
docker exec -i "$container_id" \
  psql -v ON_ERROR_STOP=1 -U shogun_test -d shogun_test \
  < tests/fixtures/legacy-schema.sql
docker exec -i "$container_id" psql -v ON_ERROR_STOP=1 -U shogun_test -d shogun_test <<'SQL'
INSERT INTO "AuditLog" ("id", "eventType")
VALUES ('story-0-5-legacy-audit', 'legacy_migration_probe');
SQL
(cd "$work_dir" && "$project_root/node_modules/.bin/prisma" migrate resolve --schema schema.prisma --applied 20260827_000000_legacy_baseline)
(cd "$work_dir" && "$project_root/node_modules/.bin/prisma" migrate deploy --schema schema.prisma)
npm test
