# NamPS OS — Namangan Presidential School Digital Platform

> **NamPS OS** is a unified, production-grade digital school operating system engineered for **Namangan Presidential School (NamPS)**, Uzbekistan, built with $0 software budget impact and 100% portability to a self-hosted school server.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-Passing-emerald)](https://vitest.dev/)

---

## 🌟 Core Features

- **Tailored Role Portals**:
  - **Director**: School-wide strategic oversight, policy governance, anonymous suggestion disposition, leadership action items.
  - **Manager**: Operational administration, user provisioning, academic term structure, bulk CSV import/export, timetable conflicts.
  - **Teacher**: Teaching schedule, student rosters, session attendance ledger, assignment creation with time estimates, rubric grading queue with feedback.
  - **Student**: Daily & weekly timetable (Asia/Tashkent UTC+5), active assignments, workload coordination calendar, published gradebook, extracurricular events and clubs.
  - **Parent / Guardian**: Verified guardian-child linkage, attendance reports, academic progress, and upcoming deadlines.
- **Truly Anonymous Student Suggestions (Privacy Subsystem)**:
  - Unauthenticated submission flow with zero author identity data (no user ID, no IP address storage in DB, no log of suggestion body text).
  - High-entropy dual credentials: Public Receipt Code (`NPS-XXXXXXX`) and Private Secret Token (`sec_...`).
  - Private status check protected by cryptographic timing-safe SHA-256 verifier.
- **Bilingual & Accessible**: Full Uzbek (Latin script, primary) and English localization with WCAG 2.2 AA accessibility and light/dark theme support.
- **Interactive Demo Environment**: Rich fictional dataset for Grades 5–11 with one-click role switching and safe state reset.
- **School Server Portability**: Complete containerized deployment via Docker and Docker Compose (PostgreSQL 16) with automated backup and restore scripts.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/BilolbekYoldoshxojayev/dss.git
cd dss

# Install dependencies
pnpm install

# Run automated tests
pnpm test

# Type check
pnpm typecheck

# Configure (the app refuses to start without DATABASE_URL, SESSION_SECRET, ANONYMOUS_PEPPER)
cp .env.example .env.local   # then put real random values in SESSION_SECRET / ANONYMOUS_PEPPER

# Create the local embedded database (PGlite, no Docker) and load demo data
pnpm db:migrate && pnpm db:seed

# Start development server
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in with a seeded username
(`azamat.toirov` student, `jasur.rahimov` teacher, `director` / `manager` admin) and password `Demo123!`.
With `DEMO_MODE=true` the login page also offers one-click demo roles.

---

## 🐳 Self-Hosted Deployment (Docker Compose)

To run the complete platform on an Ubuntu/Debian school server:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Launch containerized services (App + PostgreSQL 16)
docker-compose up -d --build

# 3. Check service health
docker-compose ps
```
The application will be accessible on port `3000` with persistent database storage in `namps_pgdata`.

For full step-by-step instructions, see [`docs/SCHOOL_SERVER_MIGRATION.md`](docs/SCHOOL_SERVER_MIGRATION.md).

---

## 📚 Documentation Index

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — Comprehensive functional specification.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design and security boundaries.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — Database schema and relational constraints.
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) — Role-based access control matrix.
- [`docs/ANONYMITY_AND_PRIVACY.md`](docs/ANONYMITY_AND_PRIVACY.md) — Mathematical privacy design and threat model.
- [`docs/SECURITY.md`](docs/SECURITY.md) — Security engineering, authentication, and secret management.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — Design tokens, typography, and accessibility standards.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — $0 Free public deployment guide.
- [`docs/SCHOOL_SERVER_MIGRATION.md`](docs/SCHOOL_SERVER_MIGRATION.md) — Physical server handover and data migration guide.
- [`docs/PILOT_GUIDE.md`](docs/PILOT_GUIDE.md) — Interactive walkthrough and demo demonstration guide.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
