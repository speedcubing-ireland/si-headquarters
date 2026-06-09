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

Setup an auth oauth client in the google cloud dashboard
Authorised Javascript Origins: http://localhost:5173
OAuth redirect URI: `{CONVEX_SITE_URL}/api/auth/callback/google`
The current config restricts emails to `@speedcubingireland.com`.

```sh
bunx @convex-dev/auth
bunx convex env set AUTH_GOOGLE_ID "<id>"
bunx convex env set AUTH_GOOGLE_SECRET "<secret>"
```

**App secrets:**

```sh
bunx convex env set SPONSOR_BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
openssl rand -hex 32 # note this value, set it in local env also as CLI_AUTH_TOKEN
bunx convex env set CLI_AUTH_TOKEN "<above_value>"
```

**Integration credentials** (all required — see `convex/env.ts`):

WCA Client:
Redirect URI - http://localhost:3848
Scopes - public dob email manage_competitions openid profile cms

Canva Client:
Redirect URI - http://127.0.0.1:3849
Scopes - I am not bothered to write this down, just guess or use AI :)
You will need to specify some templates for integrations also

Google Client:
Redirect URI - http://localhost:3847
You likely also need to enable various APIs for the project such as sheets/drive

Discord:
Create a bot and add it to the server. I am not bothered to write the scopes so just guess/use ai :)
Set DISCORD_GUILD_ID from the server you are using
Set DISCORD_PUBLIC_KEY from the portal
Set DISCORD_ACTION_SECRET with random content e.g. `openssl rand -base64 32`
Set DISCORD_BOT_TOKEN from the portal

In the portal you will need to set the Interactions Endpoint URL with `https://{CONVEX_SITE_URL}/discord/interactions`
This requires the project to be deployed first as discord confirms the URL.

For a full list of ENV variables you may need to set - check ./convex/\_generated/server.d.ts Env type

After setting service OAuth credentials, exchange tokens:

```sh
bun run auth google   # localhost:3847
bun run auth wca      # localhost:3848
bun run auth canva    # localhost:3849
```

For production: `CONVEX_PROD=1 bun run auth <provider>`.

## Running

```sh
bun run dev
```

Starts HQ frontend (`:5173`), sponsor portal (`:5174`), and Convex dev sync in parallel.

After the first deploy (or on a fresh dev deployment), run the bootstrap mutation from the [Convex dashboard](https://dashboard.convex.dev): **`seed/mutations:run`**.

It is idempotent and safe to re-run. It ensures all default teams and task labels exist, and if there is exactly one user with no team assignments yet, adds that user to the Directors team.

## Deploying

```sh
bun run build:deploy   # convex deploy + frontend build
```

When deploying on vercel `CONVEX_DEPLOY_KEY` also needs to be set

## Scripts

| Command                           | What it does                     |
| --------------------------------- | -------------------------------- |
| `bun run test`                    | Vitest (watch)                   |
| `bun run test:once`               | Vitest (CI)                      |
| `bun run lint` / `lint:fix`       | Oxlint                           |
| `bun run format` / `format:check` | Oxfmt                            |
| `bun run typecheck`               | tsc + tsgo (Convex)              |
| `bun run email:dev`               | Preview sponsor email templates  |
| `bun run openapi-ts`              | Regenerate WCA/Canva API clients |

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

| Audience      | Mechanism                                          |
| ------------- | -------------------------------------------------- |
| Staff (HQ)    | Convex Auth + Google (`@speedcubingireland.com`)   |
| Sponsors      | Better Auth — OTP email via `/api/sponsor-auth`    |
| Service APIs  | OAuth CLI (`bun run auth`) — stores refresh tokens |
| Admin testing | Impersonation tokens (admin UI)                    |

## Integrations

| Plugin      | Purpose                                                           |
| ----------- | ----------------------------------------------------------------- |
| **Sheets**  | Schedule transfer and check-in population via Google Sheets/Drive |
| **WCA**     | Competition API + 2FA code generation                             |
| **Canva**   | Certificate and lanyard exports from brand templates              |
| **Discord** | Guild member lookup for account linking                           |
| **Sponsor** | Auction portal, admin tooling, transactional email (Resend)       |

## License

The **source code** in this repository is released under the [MIT License](LICENSE).

**Speedcubing Ireland–specific content is not freely licensed.** Copy, UI text,
email templates, sponsor guide wording, logos, trade dress, and other branding
that refers to Speedcubing Ireland remain the property of Speedcubing Ireland CLG
(or their respective owners).
