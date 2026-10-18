# NamPS OS — Security Engineering & Policy

## 1. Principles
- **Least Privilege**: Users only receive data access required for their designated educational or administrative responsibilities.
- **Server-Side Enforcement**: All authorization checks are executed in server actions and API route handlers. Client-side states are never trusted for authorization.
- **Defense in Depth**: Robust validation (via Zod schemas), parameterized SQL queries via Drizzle ORM preventing SQL injection, and sanitized output encoding preventing XSS.

## 2. Authentication & Sessions
- Password hashing is performed using `bcryptjs` with high cost factors.
- Sessions are maintained using cryptographically signed JSON Web Tokens (JWT) stored in HTTP-only, SameSite secure cookies.
- No sensitive session secrets or passwords are exposed in client bundles.

## 3. Truly Anonymous Suggestions Privacy
- Anonymous submissions bypass session checks completely.
- Zero author identifiers or IP addresses are persisted.
- Secret tokens are verified via timing-safe cryptographic comparisons (`crypto.timingSafeEqual`).

## 4. Secret Management & Portability
- Environment variables (`.env`) control all secrets (`SESSION_SECRET`, `ANONYMOUS_PEPPER`, `DATABASE_URL`).
- `.env` and `.env.local` are strictly excluded via `.gitignore`.
- `.env.example` provides sanitized template values with explicit instructions.
