#!/usr/bin/env bash
set -u -o pipefail

report="docs/qa/evidence/story-0.5/pipeline-latest.md"
mkdir -p "$(dirname "$report")"
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT INT TERM

declare -a names statuses
overall=0
gate_counter=0
unit_summary="NOT RUN"
integration_summary="NOT RUN"
audit_summary=""
ci_summary=""

run_gate() {
  local name="$1"; shift
  gate_counter=$((gate_counter + 1))
  local output="$tmpdir/gate-${gate_counter}.log"
  names+=("$name")
  printf '\n== %s ==\n' "$name"
  "$@" >"$output" 2>&1
  local result=$?
  cat "$output"
  if [[ "$name" == "Unit tests (without DATABASE_URL/AIOX_TEST_DATABASE)" ]]; then
    unit_summary=$(grep -E '^ℹ (tests|pass|fail|skipped)' "$output" | tr '\n' ';' || true)
  elif [[ "$name" == "PostgreSQL ephemeral integration" ]]; then
    integration_summary=$(grep -E '^ℹ (tests|pass|fail|skipped)' "$output" | tr '\n' ';' || true)
  fi
  if (( result == 0 )); then
    statuses+=("PASS")
  else
    statuses+=("FAIL (exit $result)")
    overall=1
  fi
  if [[ "$name" == "PostgreSQL ephemeral integration" ]]; then
    names+=("Disposable container cleanup")
    if grep -q "Disposable integration DB cleanup verified: no project containers remain." "$output"; then
      statuses+=("PASS")
    else
      statuses+=("FAIL (cleanup marker missing)")
      overall=1
    fi
  fi
}

run_expected_failure_gate() {
  local name="$1"; local expected="$2"; shift 2
  gate_counter=$((gate_counter + 1))
  local output="$tmpdir/gate-${gate_counter}.log"
  names+=("$name")
  printf '\n== %s ==\n' "$name"
  if "$@" >"$output" 2>&1; then
    cat "$output"
    statuses+=("FAIL (command unexpectedly succeeded)")
    overall=1
  elif grep -Fq "$expected" "$output"; then
    statuses+=("PASS (expected connection failure observed)")
    printf 'Expected unreachable disposable database failure observed; command exited non-zero.\n'
  else
    cat "$output"
    statuses+=("FAIL (unexpected failure reason)")
    overall=1
  fi
}

run_waived_audit_gate() {
  local kind="$1"; shift
  gate_counter=$((gate_counter + 1))
  local output="$tmpdir/gate-${gate_counter}.json"
  local label="Dependency audit (${kind}; SEC-009 temporary waiver)"
  names+=("$label")
  printf '\n== %s ==\n' "$label"
  local audit_exit=0
  if "$@" >"$output"; then
    audit_exit=0
  else
    audit_exit=$?
  fi
  cat "$output"
  local validation
  if validation=$(node scripts/validate-audit-waiver.mjs "$output" "$audit_exit" "$kind"); then
    printf '%s\n' "$validation"
    statuses+=("WAIVED (3 HIGH/OPEN findings; expires 2026-10-27)")
    audit_summary+="${kind}: ${validation};"
  else
    printf '%s\n' "$validation"
    statuses+=("FAIL (outside approved waiver)")
    audit_summary+="${kind}: FAIL outside approved waiver;"
    overall=1
  fi
}

blocked_gate() {
  local name="$1"; local reason="$2"
  names+=("$name")
  statuses+=("BLOCKED")
  overall=1
  printf '\n== %s ==\nBLOCKED: %s\n' "$name" "$reason"
}

gate_status() {
  local wanted="$1"
  for i in "${!names[@]}"; do
    if [[ "${names[$i]}" == "$wanted" ]]; then printf '%s' "${statuses[$i]}"; return; fi
  done
  printf 'NOT RUN'
}

printf '# Story 0.5 — pipeline local\n\nGenerated: %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$report"
printf 'This report contains gate status only; command output was shown in the run and temporary logs were removed. No CI execution is inferred from local results.\n\n' >> "$report"

run_gate "Lint" npm run lint
run_gate "Typecheck" npm run typecheck
run_gate "Unit tests (without DATABASE_URL/AIOX_TEST_DATABASE)" env -u DATABASE_URL -u AIOX_TEST_DATABASE npm test
run_expected_failure_gate "Negative test: unreachable ephemeral DB fails" "Can't reach database server at \`127.0.0.1:1\`" env AIOX_TEST_DATABASE=ephemeral DATABASE_URL='postgresql://shogun_test:shogun_test_ephemeral_only@127.0.0.1:1/shogun_test?schema=public' npm test
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  run_gate "PostgreSQL ephemeral integration" npm run test:integration
else
  blocked_gate "PostgreSQL ephemeral integration" "Docker daemon unavailable; no database integration evidence"
  blocked_gate "Disposable container cleanup" "integration harness did not start"
fi
run_gate "Build" npm run build
run_gate "Prisma validate" npx prisma validate
run_waived_audit_gate "production" npm audit --omit=dev --json
run_waived_audit_gate "full" npm audit --json

if command -v gitleaks >/dev/null 2>&1; then
  run_gate "Secret scan (gitleaks, redacted)" gitleaks detect --no-banner --redact --source .
else
  blocked_gate "Secret scan" "gitleaks is not installed; no secret-scan result is claimed"
fi

if [[ -d .github/workflows ]] && find .github/workflows -maxdepth 1 -type f -print -quit | grep -q .; then
  workflow_files=$(find .github/workflows -maxdepth 1 -type f -printf '%f, ' | sed 's/, $//')
  names+=("CI configuration inventory")
  statuses+=("CONFIGURED (not executed locally; hosted run pending)")
  printf '\n== CI configuration inventory ==\nCONFIGURED (not executed locally; hosted run pending): %s\n' "$workflow_files"
  ci_summary="GitHub Actions configured (${workflow_files}); not executed locally; hosted run pending."
else
  blocked_gate "CI configuration inventory" "no .github/workflows configuration exists; local execution is not CI evidence"
  ci_summary="GitHub Actions not configured."
fi

{
  printf '| Gate | Result |\n|---|---|\n'
  for i in "${!names[@]}"; do printf '| %s | %s |\n' "${names[$i]}" "${statuses[$i]}"; done
  printf '\nUnit test summary: %s\nIntegration summary: %s\n' "$unit_summary" "$integration_summary"
  printf '\nGitHub Actions: %s\n' "$ci_summary"
  printf 'SEC-009: HIGH, OPEN, WAIVED temporarily through 2026-10-27 inclusive; %s\n' "$audit_summary"
  printf '\n`npm test` is run with both `DATABASE_URL` and `AIOX_TEST_DATABASE` unset. Integration is run only through the disposable Docker harness. This local run does not execute GitHub Actions. Secret scan is separately blocked when gitleaks is unavailable. Raw npm audit JSON was printed in this run; temporary files are removed at exit.\n'
} >> "$report"

catalog="docs/qa/evidence/story-0.5/baseline-catalog-latest.md"
{
  printf '# Story 0.5 — catálogo finito e evidência\n\nGerado: %s. Resultados locais não equivalem a ensaio operacional nem a aprovação de QA/Architect.\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '| ID | Tipo | Pré-condição, ação e resultado esperado | Resultado e evidência |\n|---|---|---|---|\n'
  printf '| B0.5-01 | Integração PostgreSQL | Fixtures A/B sintéticas; consultar e alterar user-shared em A; B deve permanecer inalterada | %s; `tests/postgres-integrity.test.ts`; `pipeline-latest.md` |\n' "$(gate_status "PostgreSQL ephemeral integration")"
  printf '| B0.5-02 | Harness/integração + contrato | Schema legado sintético, migrations, URLs negativas; URL não permitida recusada e container removido | URL guard/negative DB gate; migrations e AuditLog/SquadMember/index postconditions: %s; cleanup: %s; `tests/postgres-integrity.test.ts`, `scripts/test-integration.sh` |\n' "$(gate_status "PostgreSQL ephemeral integration")" "$(gate_status "Disposable container cleanup")"
  printf '| B0.5-03 | Unitário de contrato | Clock virtual para 5 min/24 h, downtime, grace, emptySinceAt e eventos; wall-clock determinístico sem sleep | %s; `tests/baseline-contracts.test.ts`; não afirma implementação funcional de expiração |\n' "$(gate_status "Unit tests (without DATABASE_URL/AIOX_TEST_DATABASE)")"
  printf '| B0.5-04 | Unitário de contrato | Fake com sucesso/falha por chamada; delete exige operação terminal registrada e fetch remoto que confirme guild/ownership; forged, ausente e owner divergente não apagam | %s; `tests/baseline-contracts.test.ts`, `tests/support/fake-discord.ts`; Architect ainda precisa revisar |\n' "$(gate_status "Unit tests (without DATABASE_URL/AIOX_TEST_DATABASE)")"
  printf '| B0.5-05 | Pipeline/segurança | Executar gates disponíveis e inventariar CI/scanner; findings e ausências explícitos | Consulte `pipeline-latest.md`; SEC-009 HIGH/OPEN/WAIVED, GitHub Actions e scanner têm status próprios |\n\n'
  printf '## Limites da evidência\n\n- `npm test` roda sem DATABASE_URL/AIOX_TEST_DATABASE; testes PostgreSQL aparecem como skipped nesse modo.\n- `npm run test:integration` usa PostgreSQL 16 efêmero, schema sintético e migrations; não é ensaio operacional/cutover nem valida Discord real.\n- Build, lint, typecheck e Prisma validate são gates estáticos/estruturais, não aceite comportamental.\n- Execução local não é evidência de GitHub Actions; ver status de configuração e hosted run em `pipeline-latest.md`. Secret scanning está BLOCKED sem gitleaks.\n- O fake é uma fronteira de teste e requer parecer Architect; nenhum parecer QA/Architect foi inventado.\n'
} > "$catalog"

printf '\nPipeline report: %s\n' "$report"
printf 'Catalog report: %s\n' "$catalog"
exit "$overall"
