# NamPS OS — School Server Migration & Self-Hosting Guide

This guide describes the complete, tested procedure for Namangan Presidential School IT administrators to migrate NamPS OS from the free cloud demo environment to the school's own self-hosted Linux server.

---

## 1. Prerequisites
- **Operating System**: Ubuntu 22.04 LTS or Debian 12 (recommended)
- **CPU & RAM**: Minimum 2 CPU cores, 4 GB RAM, 20 GB SSD storage
- **Software**: Docker Engine >= 24.0 and Docker Compose Plugin >= 2.20
- **Network**: Static internal IP or public domain with port 80/443 forwarded
- **SSL Certificate**: Let's Encrypt (via Caddy or Nginx) or school intranet TLS cert

---

## 2. Server Setup & Repository Clone

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Docker and Docker Compose
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker

# 3. Clone the official NamPS OS repository
git clone https://github.com/BilolbekYoldoshxojayev/dss.git /opt/namps-os
cd /opt/namps-os
```

---

## 3. Environment Configuration

Copy the sample environment file and set secure production credentials:

```bash
cp .env.example .env
```

Edit `/opt/namps-os/.env`:
```ini
NODE_ENV=production
PORT=3000

# Strong production database password
POSTGRES_USER=namps_admin
POSTGRES_PASSWORD=Use_A_Very_Strong_Password_Here_2026!
POSTGRES_DB=namps_production

DATABASE_URL=postgresql://namps_admin:Use_A_Very_Strong_Password_Here_2026!@db:5432/namps_production

# Cryptographic Keys (Generate with: openssl rand -hex 32)
SESSION_SECRET=generate_random_64_character_hex_string
ANONYMOUS_PEPPER=generate_another_random_64_character_hex_string

# Disable demo mode for official school production
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_APP_URL=https://school.namps.uz
```

---

## 4. Launch Containerized Services

```bash
# Build and start services in the background
docker compose up -d --build

# Verify container status
docker compose ps

# Check logs
docker compose logs -f app
```

---

## 5. Reverse Proxy & HTTPS (Nginx Example)

Create `/etc/nginx/sites-available/namps.conf`:

```nginx
server {
    listen 80;
    server_name school.namps.uz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name school.namps.uz;

    ssl_certificate /etc/letsencrypt/live/school.namps.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/school.namps.uz/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration:
```bash
sudo ln -s /etc/nginx/sites-available/namps.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Real School Data Import

1. Log in with the Manager or Director account.
2. Navigate to **"CSV import qilish (Maktab ko'chirish)"**.
3. Download the official CSV templates for Students, Teachers, Classes, and Timetables.
4. Prepare real school records according to the template columns.
5. Upload CSV and click **"Tekshirish (Dry-run)"** to validate schemas, detect missing fields, and check row integrity without writing.
6. Once validated with 0 errors, click **"Tizimga Import Qilish"** to insert records transactionally.

---

## 7. Automated Daily Backups

Set up an automated cron job to run the backup script every night at 02:00 AM:

```bash
# Make scripts executable
chmod +x /opt/namps-os/scripts/backup.sh
chmod +x /opt/namps-os/scripts/restore.sh

# Open crontab
sudo crontab -e

# Add backup schedule
0 2 * * * /opt/namps-os/scripts/backup.sh >> /var/log/namps_backup.log 2>&1
```

---

## 8. Rollback & Disaster Recovery

To restore a previous backup in the event of hardware failure:

```bash
/opt/namps-os/scripts/restore.sh /opt/namps-os/backups/namps_os_backup_20261017_020000.sql.gz
```
The script will prompt for confirmation, uncompress the archive, and safely restore the schema and records.
