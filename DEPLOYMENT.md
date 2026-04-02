# OpenServe OS — Deployment Guide

## Neuen Kunden aufschalten (Option A — ein Server pro Kunde)

### Voraussetzungen
- Ubuntu 22.04 VPS (Hetzner CX21, ~CHF 5/Mt.)
- Domain z.B. `kunde.openserve.ch` → DNS A-Record auf Server-IP
- SSH-Zugang zum Server

---

### 1. Server einrichten (einmalig pro Server)

```bash
# Einloggen
ssh root@DEINE-SERVER-IP

# Docker installieren
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Certbot für SSL installieren
apt install -y nginx certbot python3-certbot-nginx

# Repo klonen
git clone https://github.com/JonasStreule/openserve-os.git /opt/openserve
cd /opt/openserve
```

---

### 2. Neuen Kunden anlegen

```bash
cd /opt/openserve
./scripts/new-tenant.sh bellavista-luzern admin
```

Das Skript:
- Erstellt `/opt/openserve/tenants/bellavista-luzern/` mit Docker-Compose + .env
- Startet alle Container (Postgres, Redis, Backend, Frontend)
- Führt alle Migrationen aus
- Erstellt Admin-User mit zufälligem PIN
- Gibt eine Zusammenfassung mit Login-Daten aus

**Ausgabe sichern und dem Kunden schicken!**

---

### 3. SSL + Nginx einrichten

```bash
# Nginx-Konfig für den Kunden erstellen
cat > /etc/nginx/sites-available/bellavista <<'EOF'
server {
    listen 80;
    server_name bellavista.openserve.ch;

    # Frontend
    location / {
        proxy_pass http://localhost:81;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -s /etc/nginx/sites-available/bellavista /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL-Zertifikat (Let's Encrypt, kostenlos)
certbot --nginx -d bellavista.openserve.ch
```

---

### 4. Automatische Backups einrichten

```bash
# Crontab öffnen
crontab -e

# Täglich um 03:00 Uhr Backup
0 3 * * * /opt/openserve/scripts/backup.sh bellavista-luzern
```

Backups landen in `/opt/openserve/backups/bellavista-luzern/`.

---

### 5. Updates ausrollen

```bash
cd /opt/openserve
git pull

# Neue Docker Images ziehen (werden via GitHub Actions gebaut)
cd tenants/bellavista-luzern
docker compose pull
docker compose up -d

# Neue Migrationen ausführen (falls vorhanden)
for f in /opt/openserve/migrations/*.sql; do
  docker compose exec -T postgres-bellavista-luzern \
    psql -U pos_bellavista_luzern -d openserve_bellavista_luzern -f - < "$f" || true
done
```

---

## Umgebungsvariablen (Übersicht)

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindung | `postgresql://user:pass@localhost/db` |
| `JWT_SECRET` | Signier-Secret für Tokens | Zufälliger 40-Zeichen-String |
| `JWT_EXPIRY` | Token-Gültigkeit | `8h` (Standard) |
| `CORS_ORIGIN` | Erlaubte Frontend-URLs | `https://pos.restaurant.ch` |
| `SENTRY_DSN` | Fehler-Tracking (optional) | `https://...@sentry.io/...` |
| `PORT` | Backend-Port | `3000` |

---

## Sentry einrichten (empfohlen)

1. Account auf [sentry.io](https://sentry.io) erstellen (kostenlos bis 5k Errors/Mt.)
2. Zwei Projekte anlegen: **openserve-backend** (Node.js) und **openserve-frontend** (React)
3. DSN in `.env` des Kunden eintragen:
   ```
   SENTRY_DSN=https://abc123@o123.ingest.sentry.io/456
   VITE_SENTRY_DSN=https://def456@o123.ingest.sentry.io/789
   ```
4. Docker-Stack neu starten: `docker compose up -d`

---

## Monitoring (UptimeRobot — kostenlos)

1. Account auf [uptimerobot.com](https://uptimerobot.com)
2. New Monitor → HTTP(s)
3. URL: `https://bellavista.openserve.ch/api/health`
4. Interval: 5 Minuten
5. Alert-Kontakt: Deine E-Mail

Bei Ausfall → sofort E-Mail.

---

## Kundenübergabe-Checkliste

```
[ ] Domain gesetzt und SSL aktiv
[ ] /api/health gibt { "status": "ok" } zurück
[ ] Admin-Login funktioniert
[ ] Demo-QR-Code gescannt → Speisekarte sichtbar
[ ] Testbestellung aufgegeben → erscheint in Küche
[ ] Backup-Cron eingerichtet
[ ] Sentry DSN eingetragen
[ ] UptimeRobot Monitor aktiv
[ ] Zugangsdaten sicher an Kunden übergeben
```
