# Staging Environment Setup / Настройка Staging-окружения

One-time VPS setup for the development/staging site. Run these steps once before
the first deployment from the `develop` branch.

---

## 1. PostgreSQL — dev database

```bash
sudo -u postgres psql -c "CREATE DATABASE tiles_survive_dev;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tiles_survive_dev TO tilessurvive;"
```

---

## 2. App directory

Create a separate directory for the staging app (different from production):

```bash
mkdir -p /home/<user>/bot-dev
```

---

## 3. systemd service

Create `/etc/systemd/system/tiles-survive-web-dev.service`:

```ini
[Unit]
Description=Tiles Survive Dev Web
After=network.target

[Service]
Type=simple
User=<user>
WorkingDirectory=/home/<user>/bot-dev
ExecStart=/home/<user>/.nvm/versions/node/<version>/bin/npm run start:dev --workspace=@tiles-survive/web
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Replace `<user>` and `<version>` with your VPS username and Node version.

```bash
sudo systemctl daemon-reload
sudo systemctl enable tiles-survive-web-dev
```

---

## 4. nginx reverse proxy

Add a server block for your staging subdomain (e.g. `dev.yourdomain.com`):

```nginx
server {
    server_name dev.yourdomain.com;

    location / {
        proxy_pass         http://localhost:6646;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. SSL certificate

```bash
sudo certbot --nginx -d dev.yourdomain.com
```

---

## 6. GitHub Secrets

Add these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `DEV_VPS_APP_PATH` | Absolute path to staging app dir (e.g. `/home/user/bot-dev`) |
| `DEV_VPS_ENV` | Full `.env` content for staging (see template below) |
| `DEV_SERVICE_NAME` | `tiles-survive-web-dev` |
| `TURBO_TOKEN` | Turbo remote cache token from [turbo.build](https://turbo.build) (optional) |
| `TURBO_TEAM` | Turbo team slug (optional, only needed with TURBO_TOKEN) |

The following existing secrets are reused — no duplication needed:
`VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER`

### DEV_VPS_ENV template

Start from a copy of the production `.env` and change these values:

```dotenv
DATABASE_URL=postgresql://tilessurvive:<password>@localhost:5432/tiles_survive_dev

# Set this so the staging site shows the banner and [DEV] title
NEXT_PUBLIC_APP_ENV=staging

# Point to your staging domain
BETTER_AUTH_URL=https://dev.yourdomain.com
BETTER_AUTH_TRUSTED_ORIGINS=https://dev.yourdomain.com

# Keep the rest (BOT_API_URL, BOT_API_KEY, BETTER_AUTH_SECRET, etc.) the same as prod
```

---

## 7. First deploy

1. Push a commit to the `develop` branch to trigger the deployment workflow.
2. The workflow runs `prisma migrate deploy` automatically — no manual step needed.
3. Seed the dev database with test data:

```bash
npm run db:seed
```

The seed creates:
- 20 alliance members (bilingual: English + Russian names)
- 2 Reservoir Raid plans (1 active, 1 ended)
- 1 Alliance Duel instance (5 days, WIN outcome)
- 2 Leaderboard snapshots (SOLO_POWER, BATTLE_VANGUARD)
- 3 test users:

| Email | Password | Role | Status |
|-------|----------|------|--------|
| `admin@dev.local` | `devpassword` | admin | ACTIVE |
| `user1@dev.local` | `devpassword` | member | ACTIVE |
| `user2@dev.local` | `devpassword` | — | PENDING |

### Seed options

```bash
# Reset all platform data and re-seed from scratch
npm run db:seed -- -- --reset

# Seed only a specific area (members are always seeded as a prerequisite)
npm run db:seed -- -- --scenario raid
npm run db:seed -- -- --scenario duel
npm run db:seed -- -- --scenario leaderboard
npm run db:seed -- -- --scenario members
```

---

## 8. GitHub branch protection (manual, in GitHub UI)

**`main`** — Settings → Branches → Add rule:
- Pattern: `main`
- Require a pull request before merging ✓
- Require 1 approving review ✓
- Dismiss stale reviews on new commits ✓
- Do not allow bypassing the above settings ✓

**`develop`** — Settings → Branches → Add rule:
- Pattern: `develop`
- Require a pull request before merging ✓
- Require 1 approving review ✓

---

## Workflow summary

```
develop branch  →  push  →  deploy-dev.yml   →  dev.yourdomain.com  (staging)
main branch     →  push  →  deploy.yml        →  yourdomain.com      (production)

Something broke on staging?
  GitHub Actions → Rollback Dev Website → run workflow → enter commit SHA
```
