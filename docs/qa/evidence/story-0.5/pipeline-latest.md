# Story 0.5 — pipeline local

Generated: 2026-09-27T23:35:56Z

This report contains gate status only; command output was shown in the run and temporary logs were removed. No CI execution is inferred from local results.

| Gate | Result |
|---|---|
| Lint | PASS |
| Typecheck | PASS |
| Unit tests (without DATABASE_URL/AIOX_TEST_DATABASE) | PASS |
| Negative test: unreachable ephemeral DB fails | PASS (expected connection failure observed) |
| PostgreSQL ephemeral integration | PASS |
| Disposable container cleanup | PASS |
| Build | PASS |
| Prisma validate | PASS |
| Dependency audit (production; SEC-009 temporary waiver) | WAIVED (3 HIGH/OPEN findings; expires 2026-10-27) |
| Dependency audit (full; SEC-009 temporary waiver) | WAIVED (3 HIGH/OPEN findings; expires 2026-10-27) |
| Secret scan | BLOCKED |
| CI configuration inventory | CONFIGURED (not executed locally; hosted run pending) |

Unit test summary: ℹ tests 24;ℹ pass 23;ℹ fail 0;ℹ skipped 1;
Integration summary: ℹ tests 30;ℹ pass 30;ℹ fail 0;ℹ skipped 0;

GitHub Actions: GitHub Actions configured (ci.yml); not executed locally; hosted run pending.
SEC-009: HIGH, OPEN, WAIVED temporarily through 2026-10-27 inclusive; production: SEC-009 WAIVED: 3 HIGH findings, OPEN, advisory GHSA-ggr8-5vv4-36mx; prisma@6.19.3 -> @prisma/config@6.19.3 -> deepmerge-ts@7.1.5; accepted through 2026-10-27 inclusive. npm audit production exit 1 is retained as raw evidence.;full: SEC-009 WAIVED: 3 HIGH findings, OPEN, advisory GHSA-ggr8-5vv4-36mx; prisma@6.19.3 -> @prisma/config@6.19.3 -> deepmerge-ts@7.1.5; accepted through 2026-10-27 inclusive. npm audit full exit 1 is retained as raw evidence.;

`npm test` is run with both `DATABASE_URL` and `AIOX_TEST_DATABASE` unset. Integration is run only through the disposable Docker harness. This local run does not execute GitHub Actions. Secret scan is separately blocked when gitleaks is unavailable. Raw npm audit JSON was printed in this run; temporary files are removed at exit.
