# Headquarters

Internal operations platform for Speedcubing Ireland — competitions, tasks, teams, and sponsor workflows.

## Prerequisites

- [Bun](https://bun.sh)
- [Convex](https://convex.dev) account

## Setup

```sh
bun install
bun run convex dev   # links your Convex deployment
```

### Environment

**Convex Auth** (Google login for staff):

```sh
bunx @convex-dev/auth jwks
bunx convex env set AUTH_GOOGLE_ID "<id>"
bunx convex env set AUTH_GOOGLE_SECRET "<secret>"
```

OAuth redirect URI: `{CONVEX_SITE_URL}/api/auth/callback/google`
The current config restricts emails to `@speedcubingireland.com`.

**App secrets:**

```sh
bunx convex env set SPONSOR_BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set CLI_AUTH_TOKEN "$(openssl rand -hex 32)"
```

**Integration credentials** (all required — see `convex/env.ts`):

| Group | Keys |
|---|---|
| Service OAuth | `SERVICE_GOOGLE_ID/SECRET`, `SERVICE_WCA_ID/SECRET`, `SERVICE_CANVA_ID/SECRET` |
| Canva | `CANVA_CERT_TEMPLATE_ID`, `CANVA_CERT_OUTPUT_FOLDER_ID`, `CANVA_LANYARD_*` |
| Discord | `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` |
| WCA 2FA | `WCA_2FA_SECRET` |
| Email | `SPONSORSHIP_EMAIL_SENDER_ADDRESS`, `RESEND_TEST_MODE` |
| URLs | `SITE_URL`, `SPONSOR_SITE_URL` (optional) |

After setting service OAuth credentials, exchange tokens:

```sh
export CLI_AUTH_TOKEN=<value>
bun run auth google   # localhost:3847
bun run auth wca      # localhost:3848
bun run auth canva    # localhost:3849
```

For production: `CONVEX_PROD=1 bun run auth <provider>`.

**Optional client flags** (`.env.local`):

| Variable | Effect |
|---|---|
| `VITE_SPONSORSHIP_ENABLED` | `1` — enables sponsorship UI |

## Running

```sh
bun run dev
```

Starts HQ frontend (`:5173`), sponsor portal (`:5174`), and Convex dev sync in parallel.

## Deploying

```sh
bun run build:deploy   # convex deploy + frontend build
```

When deploying on vercel `CONVEX_DEPLOY_KEY` also needs to be set

## Scripts

| Command | What it does |
|---|---|
| `bun run test` | Vitest (watch) |
| `bun run test:once` | Vitest (CI) |
| `bun run lint` / `lint:fix` | Oxlint |
| `bun run format` / `format:check` | Oxfmt |
| `bun run typecheck` | tsc + tsgo (Convex) |
| `bun run email:dev` | Preview sponsor email templates |
| `bun run openapi-ts` | Regenerate WCA/Canva API clients |

## Project layout

```
convex/
  schema.ts, auth.ts     # core schema and staff auth
  competitions/          # calendar, updates, weekend slots
  tasks/                 # task board, labels, reviews, blockers
  teams/, users/         # org structure
  templates/             # competition template engine
  plugins/               # integration plugins (sheets, wca, canva, discord, sponsor)
src/
  routes/                # TanStack Router pages
  features/              # domain UI
  plugins/               # frontend plugin registry
  components/            # shared UI (shadcn)
  lib/, hooks/           # utilities and Convex hooks
scripts/
  auth.ts                # OAuth CLI for service integrations
```

## Auth

| Audience | Mechanism |
|---|---|
| Staff (HQ) | Convex Auth + Google (`@speedcubingireland.com`) |
| Sponsors | Better Auth — OTP email via `/api/sponsor-auth` |
| Service APIs | OAuth CLI (`bun run auth`) — stores refresh tokens |
| Admin testing | Impersonation tokens (admin UI) |

## Integrations

| Plugin | Purpose |
|---|---|
| **Sheets** | Schedule transfer and check-in population via Google Sheets/Drive |
| **WCA** | Competition API + 2FA code generation |
| **Canva** | Certificate and lanyard exports from brand templates |
| **Discord** | Guild member lookup for account linking |
| **Sponsor** | Auction portal, admin tooling, transactional email (Resend) |