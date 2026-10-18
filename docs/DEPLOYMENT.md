# Deploying NamPS OS on a school server or VPS

One machine, Docker Compose, HTTPS. Everything below runs from the project folder on the server.
(`docker-compose.yml` starts: **caddy** → **app** → **db** (PostgreSQL 16), plus a daily **backup** job.)

## 0. What you need
- A Linux server or VPS (2 GB RAM is plenty for one school), with Docker + the Compose plugin.
- A domain name pointing at the server, **or** a LAN-only setup (see 3b). The app **requires HTTPS**: session cookies are `Secure`,
  so logging in over plain `http://` will silently not work.
- Ports 80 and 443 open. Nothing else is published (the database is not reachable from outside).

## 1. First install
```bash
git clone <repo-url> namps && cd namps
cp .env.production.example .env
```
Edit `.env`:
- `POSTGRES_PASSWORD`, `SESSION_SECRET`, `ANONYMOUS_PEPPER` → random values: `openssl rand -hex 32` (three times).
- `DOMAIN=school.example.uz`
- `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` (≥ 12 characters) → the very first administrator.
- Leave `DEMO_MODE` unset and `FEATURES` empty.

```bash
docker compose up -d --build
docker compose ps            # all four should become "healthy"/running
docker compose logs -f app   # look for: [bootstrap] Created the first administrator ...
```
Open `https://your-domain`, log in with the bootstrap account — you must choose a new password straight away.
Then **delete the `BOOTSTRAP_ADMIN_*` lines from `.env`** and run `docker compose up -d` again (they are ignored once users exist, but secrets don't belong in files).

The database tables are created automatically at start (`MIGRATE_ON_START=true`).

## 2. Setting up the school (as administrator)
1. **School setup → Terms**: add the terms of the year. **Subjects**: add subjects. **Grading**: pick 5-point or percent.
2. **Import class lists** (menu): upload a CSV with `fullName,username,gradeLevel,section` (template button). Classes are created
   automatically. Download the **one-time passwords** file straight away and hand them out privately — it is shown only once.
3. **Users**: add teachers (and other admins). **School setup → Classes**: appoint class teachers.
4. **School setup → Who teaches what**: connect teacher + subject + class. **Timetable**: add the weekly lessons.
5. Every new or reset account must choose its own password at first login.

## 3. HTTPS options
**a) Public domain (recommended):** set `DOMAIN`, make sure DNS points to the server and 80/443 are open. Caddy gets and renews a
free Let's Encrypt certificate by itself.

**b) LAN only / no public domain:** set `DOMAIN=namps.school.local` (a name your DNS or hosts files resolve) and
`CADDY_TLS="tls internal"` in `.env`. Caddy then issues a certificate from its own CA; browsers warn until that CA is trusted
(export it from the `caddy_data` volume: `docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .`).

## 4. Backups and restore
- A `backup` container writes `./backups/db_<time>.dump` (PostgreSQL custom format) and `uploads_<time>.tar.gz` **every day at 02:00
  Tashkent time** and keeps 14 days (`BACKUP_HOUR_UTC`, `BACKUP_KEEP_DAYS`). Each dump is checked to be readable right after it is written.
- Take one now: `./scripts/backup.sh`
- **Copy `./backups` off the machine** regularly (another disk, another computer). A backup on the same disk dies with it.
- **Prove the newest backup restores** (do this after setup, then monthly): `./scripts/verify-restore.sh` — restores into a scratch
  database, compares row counts, deletes the scratch database, prints PASS/FAIL and how long the restore took.
- **Real restore** (replaces live data!): `./scripts/restore.sh backups/db_YYYYMMDD_HHMMSS.dump backups/uploads_YYYYMMDD_HHMMSS.tar.gz`
  It stops the app, restores, starts the app. Type `restore` to confirm.

## 5. Updating
```bash
./scripts/backup.sh            # always first
git pull
docker compose up -d --build   # migrations run automatically at start
docker compose logs --tail 50 app
```
Rollback: `git checkout <previous tag/commit>`, `docker compose up -d --build`; if a migration must be undone, restore the pre-update backup.

## 6. Monitoring and troubleshooting
- Health: `curl -fsS https://your-domain/api/health` → `{"ok":true}` (point any uptime monitor at it).
- `docker compose logs app` / `caddy` / `db`. The app refuses to start without `DATABASE_URL`, `SESSION_SECRET`, `ANONYMOUS_PEPPER`.
- Forgot an admin password: another administrator resets it (Users → Reset password). That is why **two admin accounts** are
  required. If the only admin is locked out, a developer must set a new bcrypt hash directly in the `users` table and set
  `must_change_password = true`.
- Locked out by repeated wrong passwords: 10 failures per username per 15 minutes; restart the app (`docker compose restart app`) to clear it.

## 7. Security checklist before the pilot
- [ ] `.env` is not in git and only the administrator can read it (`chmod 600 .env`).
- [ ] `DEMO_MODE` is **not** set; `FEATURES` is empty.
- [ ] Two administrator accounts exist.
- [ ] `https://` works, and `http://` redirects to it.
- [ ] A backup exists, was copied elsewhere, and `verify-restore.sh` printed PASS.
- [ ] The server's OS updates are enabled and the firewall allows only 80/443 (and SSH from known addresses).
