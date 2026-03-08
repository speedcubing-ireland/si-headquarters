# Headquarters

Internal operations platform for Speedcubing Ireland — managing competitions, tasks, teams, sponsors, and communication workflows.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, TanStack Router, Radix UI
- **Backend:** [Convex](https://convex.dev) (real-time database, serverless functions, auth, crons)
- **Build:** Vite (via rolldown-vite), Bun
- **Linting/Formatting:** Biome, ESLint (Convex plugin)
- **Testing:** Vitest with `convex-test` and `@edge-runtime/vm`

## Prerequisites

- [Bun](https://bun.sh)
- A [Convex](https://convex.dev) account
- Internet access (Convex has no offline mode — all data and function execution lives in the cloud)

## Getting Started

### 1. Install dependencies

```sh
bun install
```

### 2. Link to Convex

Convex needs a cloud deployment even for development. Running `convex dev` provisions a personal dev deployment, creates `.env.local`, and generates types in `convex/_generated/`.

**First time (creates a new dev deployment):**

```sh
bunx convex dev
```

This will prompt you to log in, select or create a project, and automatically write `.env.local` with the necessary variables (`CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`). You don't need to set these yourself.

**Switching to a different project later:**

```sh
bunx convex dev --configure
```

### 3. Set critical secrets in Convex

Before pushing code for the first time, set the session encryption secrets in your Convex deployment. These are required for the backend to start.

**First, start `convex dev` in a separate terminal** (it will show errors about missing env vars until they're all configured — that's expected):

```sh
bunx convex dev
```

**Then, in another terminal, set these secrets:**

```sh
bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set SPONSOR_BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set CLI_AUTH_TOKEN "$(openssl rand -hex 32)"
```

The `convex dev` terminal will restart automatically once env vars are set. See [Environment Variables](#environment-variables) for the complete list of what goes where.

### 4. Set remaining environment variables

A setup script is provided to push all other Convex environment variables (OAuth credentials, service integrations, email, etc.) in one go. Fill in the placeholder values in the script, then run it:

```sh
./scripts/set-convex-env.sh            # targets dev deployment (default)
./scripts/set-convex-env.sh --prod     # targets production deployment
```

See [Environment Variables](#environment-variables) for details on each variable. A pre-commit hook will block you from accidentally committing the script with real values filled in.

### 5. Start development

```sh
bun run dev
```

This runs two processes in parallel:

- `vite` — frontend dev server with HMR
- `convex dev` — watches `convex/` and pushes functions/schema to your dev deployment on every save

### 6. Configure auth providers (optional)

OAuth tokens are stored per deployment. Each provider needs its credentials set as Convex environment variables first (see [Environment Variables](#environment-variables)), then linked via the CLI:

```sh
export CLI_AUTH_TOKEN=<your-token>   # must match the Convex-side env var
bun run auth google-sheets           # stores tokens in dev deployment
bun run auth canva
bun run auth wca
```

For production:

```sh
bun run auth:prod google-sheets      # stores tokens in prod deployment
bun run auth:prod canva
bun run auth:prod wca
```

The only difference between `auth` and `auth:prod` is that `auth:prod` sets `CONVEX_PROD=1`, which adds `--prod` to the underlying `convex run` commands, targeting the production deployment instead of dev.

## Background info: Dev vs Production Deployments

A single Convex project includes both a dev and a prod deployment — you don't need a separate project for production. Each deployment has its own database, environment variables, and stored tokens.

| | Development | Production |
|---|---|---|
| **Created by** | `bunx convex dev` | `bunx convex deploy` or Convex dashboard |
| **Function sync** | Live on every file save | One-time deploy |
| **Database** | Isolated dev data | Isolated prod data |
| **Auth tokens** | `bun run auth <provider>` | `bun run auth:prod <provider>` |

**Deploy to production:**

```sh
bunx convex deploy
```

**Build frontend for production** (needs prod URLs):

```sh
VITE_CONVEX_URL=https://<deployment>.convex.cloud \
VITE_CONVEX_SITE_URL=https://<deployment>.convex.site \
bun run build
```

## Testing

Tests run locally using `convex-test` and `@edge-runtime/vm` — no Convex deployment needed.

```sh
bun run test            # watch mode
bun run test:once       # single run
bun run test:coverage   # with coverage report
```

## Linting

```sh
bun run lint            # Biome lint + format (auto-fix)
bun run lint:convex     # ESLint for convex/ directory
bun run typecheck       # type-check frontend and convex
```

## Project Structure

```
├── convex/              # Convex backend (schema, functions, tests)
│   ├── schema.ts        # Database schema definitions
│   ├── tasks.ts         # Task management functions
│   ├── competitions.ts  # Competition management
│   ├── sponsors.ts      # Sponsor management
│   ├── teams.ts         # Team management
│   ├── notifications/   # Notification system
│   ├── emailQueue/      # Email dispatch pipeline
│   ├── sponsorship/     # Sponsorship auction system
│   ├── canva/           # Canva integration
│   ├── services/        # External service integrations (WCA, Google, Canva)
│   └── *.test.ts        # Backend tests
├── src/
│   ├── components/      # React UI components
│   ├── routes/          # TanStack Router pages
│   ├── hooks/           # Custom React hooks (including Convex hooks)
│   ├── lib/             # Shared utilities
│   ├── store/           # Zustand state stores
│   └── data/            # Static data
├── openapi/             # OpenAPI specs (WCA, Canva)
├── scripts/             # CLI utilities (auth setup, env setup)
└── public/              # Static assets
```

## Environment Variables

Environment variables are configured in two places:

- **Convex side** (per development vs production deployment): OAuth credentials, service integrations, secrets, email, and site configuration
- **`.env.local`**: Don't edit directly. Convex writes `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` here automatically

### Convex-side variables

These are set individually via `bunx convex env set`, or in bulk using the [setup script](#4-set-remaining-environment-variables).

#### Development Secrets

These should been set during initial setup (see [step 3](#3-set-critical-secrets-in-convex)). In which case skip.

| Variable | Purpose | How to Generate |
|---|---|---|
| `BETTER_AUTH_SECRET` | Session encryption for sponsor auth | `openssl rand -base64 32` (min 32 chars, required for deployment) |
| `SPONSOR_BETTER_AUTH_SECRET` | Session encryption for sponsor portal | `openssl rand -base64 32` (falls back to `BETTER_AUTH_SECRET` if not set) |
| `CLI_AUTH_TOKEN` | Authenticates CLI auth scripts | `openssl rand -hex 32` |

#### User Authentication

OAuth providers for signing into the application.

| Variable | Source | Notes |
|---|---|---|
| `AUTH_GOOGLE_ID` | [Google Cloud Console](https://console.cloud.google.com/) | OAuth client ID for staff login. Restricted to `speedcubingireland.com` domain. |
| `AUTH_GOOGLE_SECRET` | Google Cloud Console | Corresponding client secret. |
| `AUTH_WCA_ID` | [WCA](https://www.worldcubeassociation.org/) | OAuth client ID for competitor login. Scopes: `public email`. |
| `AUTH_WCA_SECRET` | WCA | Corresponding client secret. |
| `WCA_2FA_SECRET` | TOTP secret for WCA 2FA verification | Base32-encoded string (only needed if using 2FA) |

#### Service Integrations

Machine-to-machine OAuth credentials for calling external APIs. After setting each pair, run `bun run auth <provider>` to complete the OAuth flow and store refresh tokens.

| Variable | Source | CLI Command | Notes |
|---|---|---|---|
| `SERVICE_CANVA_ID` | [Canva Developers](https://www.canva.com/developers/) | `bun run auth canva` | Uses PKCE. Tokens auto-refresh (4h expiry). |
| `SERVICE_CANVA_SECRET` | Canva Developers | | |
| `SERVICE_GOOGLE_ID` | [Google Cloud Console](https://console.cloud.google.com/) | `bun run auth google-sheets` | For Sheets and Drive API. Tokens auto-refresh (1h expiry). |
| `SERVICE_GOOGLE_SECRET` | Google Cloud Console | | |
| `SERVICE_WCA_ID` | [WCA](https://www.worldcubeassociation.org/) | `bun run auth wca` | Scopes: `public email manage_competitions`. Tokens auto-refresh (2h expiry). |
| `SERVICE_WCA_SECRET` | WCA | | |

#### Email

| Variable | Source | Notes |
|---|---|---|
| `AZURE_EMAIL_CONNECTION_STRING` | [Azure Portal](https://portal.azure.com/) | Format: `endpoint=https://...;accesskey=...` |
| `EMAIL_SENDER_ADDRESS` | Set by developer | e.g. `noreply@speedcubing.ie` (domain must be verified in Azure) |

#### Site Configuration

| Variable | Notes |
|---|---|
| `SITE_URL` | Base URL for email links and auth callbacks. Defaults to `http://localhost:5173` in dev, `https://hq.speedcubing.ie` in prod. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS origins for sponsor auth. Automatically includes `SITE_URL`. |

### Client-Side variables

These are embedded into the frontend build. `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` are written automatically by `convex dev` to `.env.local` — don't edit them manually.

| Variable | Set by | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | Convex (auto) | WebSocket URL for Convex backend. |
| `VITE_CONVEX_SITE_URL` | Convex (auto) | HTTP URL for Convex HTTP routes. |
| `VITE_SPONSORSHIP_ENABLED` | Developer (optional) | Feature flag. Set to `1`, `true`, or `yes` to enable sponsor portal. |
