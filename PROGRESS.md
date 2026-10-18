# Progress

Scope source of truth: `docs/V1_PLAN.md` (`.ai/TASKS.md` and `.ai/STATE.md` are stale).

## M1 — Foundation and permissions: done, on the fork `shack-dev-j/dss` (2026-10-18)
- **Done:** Drizzle schema + migration on PGlite (dev/tests) / `pg` (production); username login, `sessions` table (HMAC of an opaque
  token), httpOnly cookie, real logout, password change + admin reset; JWT removed; `withAuth()` (401 → 404 → 403) and ownership
  helpers on every route; `DEMO_MODE` and `FEATURES` gates; config fails closed; db scripts fixed; eslint + CI workflow.
  Also a read-only `GET /api/marks`, and `audit_log` rows for grading and attendance edits.
- **Tests:** 42 (30 new permission tests; 12 of the original 13 ported to PGlite, the repo-level "unauthorized role" test became route-level tests).
- **Verified:** clean clone of `feat/m1-foundation` with `pnpm install --frozen-lockfile` + typecheck, lint, test, build, all exit 0;
  manual `next start` against a seeded DB (login → marks → logout → 401; demo reset 404 off; no start without `SESSION_SECRET`).
- **Not verified:** Docker/Postgres, a real GitHub Actions run, the UI in a browser.
- **Leftovers:** `shack-dev-j` has READ only on upstream `BilolbekYoldoshxojayev/dss`; both branches are pushed to the fork `shack-dev-j/dss` instead. Upstream PRs (plan → `main`, then M1) wait for write access or a PR from the fork. Cookie is `Secure` in
  production, so a pilot needs HTTPS. Login throttle is per username, so anyone can lock a user out for 15 min. Attendance stays
  per timetable slot (plan §3 differs); `homework`, backdate approvals, grading scale are M2/M3. `director`+`manager` → `admin`;
  parents can't log in unless `FEATURES` has `guardian`. `docker-compose` now requires `SESSION_SECRET`/`ANONYMOUS_PEPPER`, migrations run on container start (`MIGRATE_ON_START=true`, untested without Docker); a fresh production DB has no users, so an admin bootstrap is still needed (M5).
- **Also done after review:** account page (password change), admin user list + password reset, and real submissions in `AssignmentsModule` (`GET /api/assignments/submit`).
- **Next:** M2 (marks grid, term averages, audit on mark edits, closed terms).
