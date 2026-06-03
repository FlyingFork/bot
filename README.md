# Tiles Survive — Developer Guide

> **Language / Язык:** [English](#english) · [Русский](#русский)

---

<a name="english"></a>

## English

### Overview

Tiles Survive is a community management platform for an alliance in a mobile strategy game. It consists of two applications living in a single monorepo:

- **`apps/web`** — Next.js dashboard (member management, events, leaderboards, scores, uploads)
- **`apps/bot`** — Discord.js bot (translation groups, reaction roles, admin notifications)

Shared code lives in:

- **`packages/database`** — Prisma ORM client and schema (PostgreSQL)
- **`packages/logger`** — Pino logger shared across apps
- **`packages/types`** — Shared TypeScript types

The build system is **Turbo**. Package manager is **npm workspaces**.

---

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 20 |
| npm | >= 10.9.2 |
| PostgreSQL | >= 14 |

---

### Repository structure

```
/
├── apps/
│   ├── web/          Next.js web dashboard (port 6645 in prod, 6646 in staging)
│   └── bot/          Discord.js bot (API on port 3001)
├── packages/
│   ├── database/     Prisma schema, migrations, seed script
│   ├── logger/       Pino logger utility
│   └── types/        Shared TypeScript types
├── .github/
│   └── workflows/
│       ├── deploy.yml          Production deploy (triggered by push to main)
│       ├── deploy-dev.yml      Staging deploy (triggered by push to develop)
│       └── rollback-dev.yml    Manual staging rollback (workflow_dispatch)
├── .env.example                Local development environment template
├── .env.example.development    Staging/dev environment template
├── SETUP.md                    One-time VPS staging setup guide
└── README.md                   This file
```

---

### Branches

| Branch | Purpose | Auto-deploy target |
|--------|---------|-------------------|
| `develop` | Active development, feature staging | Staging VPS (`dev.yourdomain.com`) |
| `main` | Production-ready code | Production VPS (`yourdomain.com`) |

**All development happens on `develop`.** When a feature is tested and approved on the staging site, it is promoted to `main` via a pull request. Direct pushes to both branches are blocked by branch protection rules — a reviewed PR is required.

Feature lifecycle:
```
local dev  →  push to develop  →  staging auto-deploys  →  review on dev.yourdomain.com
                                                                        ↓
                                              open PR: develop → main  →  production auto-deploys
```

---

### Local development setup

#### 1. Clone and install

```bash
git clone https://github.com/FlyingFork/bot.git
cd bot
git checkout develop
npm install
```

#### 2. Environment variables

```bash
cp .env.example.development .env
# Edit .env — fill in your local PostgreSQL credentials and secrets
cp .env packages/database/.env
cp .env apps/web/.env
cp .env apps/bot/.env
```

Key variables to set for local development:

| Variable | What to put |
|----------|-------------|
| `DATABASE_URL` | Local PostgreSQL URL pointing to `tiles_survive_dev` |
| `BETTER_AUTH_SECRET` | Any random 32+ character string |
| `BETTER_AUTH_URL` | `http://localhost:3000` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `http://localhost:3000` |
| `BOT_API_KEY` | Any random string, same in web and bot |
| `DISCORD_TOKEN` | Your Discord bot token (bot only) |

#### 3. Database setup

```bash
# Generate the Prisma client (required after every schema change)
npm run db:generate

# Apply all migrations to your local database
npm run db:migrate

# Seed the database with test data (members, events, test users)
npm run db:seed
```

Test users created by the seed (password: `devpassword`):

| Email | Role | Status |
|-------|------|--------|
| `admin@dev.local` | admin | ACTIVE |
| `user1@dev.local` | member | ACTIVE |
| `user2@dev.local` | — | PENDING |

#### 4. Start the development server

```bash
# Start all apps in parallel (web + bot)
npm run dev

# Or start only the web app
npm run dev --workspace=@tiles-survive/web
```

The web dashboard is available at `http://localhost:3000`.

---

### Common commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in watch mode |
| `npm run build` | Build all apps |
| `npm run typecheck` | TypeScript check across all packages |
| `npm run lint` | ESLint across all packages |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Create and apply a new migration (dev only) |
| `npm run db:migrate:deploy` | Apply pending migrations without creating new ones (CI/production) |
| `npm run db:seed` | Seed the database with test data |
| `npm run db:seed -- -- --reset` | Wipe all platform data and re-seed |
| `npm run db:seed -- -- --scenario raid` | Seed only raid data |
| `npm run db:seed -- -- --scenario duel` | Seed only duel data |
| `npm run db:seed -- -- --scenario leaderboard` | Seed only leaderboard data |
| `npm run db:studio` | Open Prisma Studio (visual DB editor) |

---

### Making schema changes

1. Edit `packages/database/prisma/schema.prisma`
2. Run `npm run db:migrate` — Prisma will prompt for a migration name and apply it
3. Run `npm run db:generate` — regenerates the TypeScript client
4. Commit both the migration files and any changes to the generated client

> Never run `db:migrate` in production or staging. Only `db:migrate:deploy` is used there (applied automatically by the CI workflow).

---

### CI / CD pipelines

#### Staging (`develop` branch)

Every push to `develop` triggers `.github/workflows/deploy-dev.yml`:

1. Install dependencies (`npm ci`)
2. Lint (`eslint`)
3. Type check (`tsc --noEmit`)
4. rsync files to staging VPS
5. On VPS: generate Prisma client → apply migrations → install → build → restart web service

If a new push arrives while a deploy is running, the in-progress deploy is cancelled and the new one starts immediately.

#### Production (`main` branch)

Every push to `main` (only via merged PR from `develop`) triggers `.github/workflows/deploy.yml`:

1. rsync files to production VPS
2. On VPS: generate Prisma client → install → build → restart web + bot services

#### Rollback (staging only)

If the staging site breaks, use the manual rollback workflow:

1. Go to **GitHub → Actions → Rollback Dev Website**
2. Click **Run workflow**
3. Enter the commit SHA to roll back to (find it in `git log`)
4. Click **Run workflow**

No code changes needed — the VPS is reverted to the specified commit.

---

### GitHub secrets reference

#### Shared by both workflows

| Secret | Description |
|--------|-------------|
| `VPS_SSH_KEY` | SSH private key for VPS access |
| `VPS_HOST` | VPS hostname or IP |
| `VPS_USER` | SSH username |

#### Production only

| Secret | Description |
|--------|-------------|
| `VPS_APP_PATH` | Absolute path to production app directory |
| `VPS_ENV_PRODUCTION` | Full `.env` file content for production |
| `VPS_SERVICE_NAME` | systemd service name for the web app |
| `VPS_SERVICE_NAME_B` | systemd service name for the bot |

#### Staging only

| Secret | Description |
|--------|-------------|
| `DEV_VPS_APP_PATH` | Absolute path to staging app directory |
| `DEV_VPS_ENV` | Full `.env` file content for staging |
| `DEV_SERVICE_NAME` | systemd service name for the staging web app |
| `TURBO_TOKEN` | Turbo remote cache token (optional) |
| `TURBO_TEAM` | Turbo team slug (optional) |

---

### Branch protection rules

Configure in **GitHub → Settings → Branches**:

**`main`**: require PR, 1 approving review, dismiss stale reviews, block direct push  
**`develop`**: require PR, 1 approving review

---

### PR checklist

When opening a PR from `develop` → `main`:

- [ ] Feature tested on staging (`dev.yourdomain.com`)
- [ ] TypeScript types pass (`npm run typecheck`)
- [ ] No console errors in the browser
- [ ] Migrations included if the schema changed

---

<a name="русский"></a>

---

## Русский

### Обзор

Tiles Survive — платформа для управления альянсом в мобильной стратегии. Проект состоит из двух приложений в одном монорепозитории:

- **`apps/web`** — дашборд на Next.js (участники, события, лидерборды, очки, загрузки данных)
- **`apps/bot`** — Discord-бот на Discord.js (группы перевода, реакционные роли, уведомления администратора)

Общий код находится в:

- **`packages/database`** — Prisma ORM, схема и клиент (PostgreSQL)
- **`packages/logger`** — общий логгер Pino
- **`packages/types`** — общие TypeScript-типы

Система сборки — **Turbo**, менеджер пакетов — **npm workspaces**.

---

### Требования

| Инструмент | Версия |
|-----------|--------|
| Node.js | >= 20 |
| npm | >= 10.9.2 |
| PostgreSQL | >= 14 |

---

### Структура репозитория

```
/
├── apps/
│   ├── web/          Next.js дашборд (порт 6645 в проде, 6646 на staging)
│   └── bot/          Discord.js бот (API на порту 3001)
├── packages/
│   ├── database/     Prisma-схема, миграции, скрипт сидинга
│   ├── logger/       Утилита Pino-логгера
│   └── types/        Общие TypeScript-типы
├── .github/
│   └── workflows/
│       ├── deploy.yml          Деплой в прод (при пуше в main)
│       ├── deploy-dev.yml      Деплой на staging (при пуше в develop)
│       └── rollback-dev.yml    Откат staging вручную (workflow_dispatch)
├── .env.example                Шаблон для локальной разработки
├── .env.example.development    Шаблон для staging/dev окружения
├── SETUP.md                    Руководство по первичной настройке VPS
└── README.md                   Этот файл
```

---

### Ветки

| Ветка | Назначение | Авто-деплой |
|-------|-----------|-------------|
| `develop` | Активная разработка, тестирование фич | Staging VPS (`dev.yourdomain.com`) |
| `main` | Продакшн-готовый код | Production VPS (`yourdomain.com`) |

**Вся разработка ведётся в ветке `develop`.** Когда функциональность проверена на staging-сайте и одобрена, она переносится в `main` через pull request. Прямые пуши в обе ветки заблокированы — требуется PR с проверкой кода.

Жизненный цикл фичи:
```
локальная разработка  →  пуш в develop  →  автодеплой на staging  →  проверка на dev.yourdomain.com
                                                                                  ↓
                                                открываем PR: develop → main  →  автодеплой в прод
```

---

### Локальная настройка

#### 1. Клонирование и установка

```bash
git clone https://github.com/FlyingFork/bot.git
cd bot
git checkout develop
npm install
```

#### 2. Переменные окружения

```bash
cp .env.example.development .env
# Отредактируйте .env — укажите данные вашей локальной БД и секреты
cp .env packages/database/.env
cp .env apps/web/.env
cp .env apps/bot/.env
```

Основные переменные для локальной разработки:

| Переменная | Что указать |
|-----------|-------------|
| `DATABASE_URL` | URL локального PostgreSQL, база `tiles_survive_dev` |
| `BETTER_AUTH_SECRET` | Любая случайная строка длиной 32+ символов |
| `BETTER_AUTH_URL` | `http://localhost:3000` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `http://localhost:3000` |
| `BOT_API_KEY` | Любая строка, одинаковая в web и bot |
| `DISCORD_TOKEN` | Токен вашего Discord-бота (только для бота) |

#### 3. Настройка базы данных

```bash
# Генерация Prisma-клиента (нужно после каждого изменения схемы)
npm run db:generate

# Применить все миграции к локальной БД
npm run db:migrate

# Заполнить БД тестовыми данными (участники, события, тестовые пользователи)
npm run db:seed
```

Тестовые пользователи после сидинга (пароль: `devpassword`):

| Email | Роль | Статус |
|-------|------|--------|
| `admin@dev.local` | admin | ACTIVE |
| `user1@dev.local` | member | ACTIVE |
| `user2@dev.local` | — | PENDING |

#### 4. Запуск сервера разработки

```bash
# Запустить все приложения параллельно (web + bot)
npm run dev

# Или только веб-приложение
npm run dev --workspace=@tiles-survive/web
```

Веб-дашборд доступен по адресу `http://localhost:3000`.

---

### Основные команды

| Команда | Описание |
|---------|---------|
| `npm run dev` | Запустить все приложения в режиме watch |
| `npm run build` | Собрать все приложения |
| `npm run typecheck` | Проверка TypeScript во всех пакетах |
| `npm run lint` | ESLint во всех пакетах |
| `npm run db:generate` | Перегенерировать Prisma-клиент после изменений схемы |
| `npm run db:migrate` | Создать и применить новую миграцию (только для dev) |
| `npm run db:migrate:deploy` | Применить ожидающие миграции без создания новых (CI/прод) |
| `npm run db:seed` | Заполнить БД тестовыми данными |
| `npm run db:seed -- -- --reset` | Очистить все данные платформы и заполнить заново |
| `npm run db:seed -- -- --scenario raid` | Только данные рейдов |
| `npm run db:seed -- -- --scenario duel` | Только данные дуэлей |
| `npm run db:seed -- -- --scenario leaderboard` | Только данные лидерборда |
| `npm run db:studio` | Открыть Prisma Studio (визуальный редактор БД) |

---

### Изменения схемы базы данных

1. Отредактируйте `packages/database/prisma/schema.prisma`
2. Запустите `npm run db:migrate` — Prisma запросит название миграции и применит её
3. Запустите `npm run db:generate` — перегенерирует TypeScript-клиент
4. Закоммитьте файлы миграции и изменения в сгенерированном клиенте

> Никогда не запускайте `db:migrate` в продакшне или на staging. Там используется только `db:migrate:deploy` (применяется автоматически CI-воркфлоу).

---

### CI/CD пайплайны

#### Staging (ветка `develop`)

Каждый пуш в `develop` запускает `.github/workflows/deploy-dev.yml`:

1. Установка зависимостей (`npm ci`)
2. Линтинг (`eslint`)
3. Проверка типов (`tsc --noEmit`)
4. rsync файлов на staging VPS
5. На VPS: генерация Prisma-клиента → применение миграций → установка → сборка → перезапуск web-сервиса

Если в процессе деплоя приходит новый пуш — текущий деплой отменяется и запускается новый.

#### Продакшн (ветка `main`)

Каждый пуш в `main` (только через смёрженный PR из `develop`) запускает `.github/workflows/deploy.yml`:

1. rsync файлов на production VPS
2. На VPS: генерация Prisma-клиента → установка → сборка → перезапуск web + bot сервисов

#### Откат (только staging)

Если staging-сайт сломался, используйте ручной воркфлоу отката:

1. Перейдите в **GitHub → Actions → Rollback Dev Website**
2. Нажмите **Run workflow**
3. Введите SHA коммита для отката (найдите в `git log`)
4. Нажмите **Run workflow**

Изменения кода не нужны — VPS откатится к указанному коммиту.

---

### Справочник GitHub Secrets

#### Общие для обоих воркфлоу

| Secret | Описание |
|--------|---------|
| `VPS_SSH_KEY` | Приватный SSH-ключ для доступа к VPS |
| `VPS_HOST` | Хостнейм или IP VPS |
| `VPS_USER` | Имя пользователя SSH |

#### Только для продакшна

| Secret | Описание |
|--------|---------|
| `VPS_APP_PATH` | Абсолютный путь к директории прод-приложения |
| `VPS_ENV_PRODUCTION` | Полное содержимое `.env` для продакшна |
| `VPS_SERVICE_NAME` | Имя systemd-сервиса веб-приложения |
| `VPS_SERVICE_NAME_B` | Имя systemd-сервиса бота |

#### Только для staging

| Secret | Описание |
|--------|---------|
| `DEV_VPS_APP_PATH` | Абсолютный путь к директории staging-приложения |
| `DEV_VPS_ENV` | Полное содержимое `.env` для staging |
| `DEV_SERVICE_NAME` | Имя systemd-сервиса staging веб-приложения |
| `TURBO_TOKEN` | Токен удалённого кэша Turbo (опционально) |
| `TURBO_TEAM` | Slug команды Turbo (опционально) |

---

### Правила защиты веток

Настраиваются в **GitHub → Settings → Branches**:

**`main`**: требуется PR, 1 проверяющий, сброс устаревших ревью, блокировка прямых пушей  
**`develop`**: требуется PR, 1 проверяющий

---

### Чеклист PR

При открытии PR из `develop` → `main`:

- [ ] Функциональность проверена на staging (`dev.yourdomain.com`)
- [ ] TypeScript-типы проходят (`npm run typecheck`)
- [ ] Нет ошибок в консоли браузера
- [ ] Миграции добавлены, если изменялась схема БД
