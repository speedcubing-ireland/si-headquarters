# Organisation Operations Platform

Configurable operations platform for competitions, tasks, teams, and sponsor workflows.

## Prerequisites

- [Bun](https://bun.sh)
- [Convex](https://convex.dev) account

## Getting started

1. **Install:** `bun install`
2. **Create the deployment:** `bun run convex dev`. The first run fails because
   the environment isn't configured yet — once it has created the project, quit
   out (`Ctrl-C`).
3. **Configure organisation:** edit `config/organisation-config.ts` (branding,
   regional defaults, enabled features, login providers).
4. **Set the environment:** `bun run set-convex-env`. The wizard only asks for
   credentials your manifest enables — see [Service setup](docs/services.md) for
   what each one needs (and run it with `--dry-run` first to gather them).
5. **Run it:** `bun run dev`. Starts the frontend (`:5173`), sponsor portal
   (`:5174`), and Convex sync, pushed and live.
6. **Exchange service tokens** (only if you enabled integrations): with the
   deployment running, `bun run auth <google|wca|canva>`. This must come after a
   deploy — see
   [Service setup](docs/services.md#exchanging-service-tokens).
7. **Bootstrap data:** Create first user as below and then run `bunx convex run seed/mutations:run`

### First user (WCA login)

WCA staff sign-in only admits accounts already in the `users` table, so create
yourself before signing in — entirely from the CLI:

```sh
# create your user (use your own WCA id)
bunx convex run seed/mutations:createUser '{"wcaUserId": 54140, "name": "Your Name"}'

# seed teams + labels; assigns the sole user to Directors
bunx convex run seed/mutations:run
```

Then add yourself to the Volunteer team (and any others) in the admin panel

## Configuration

`config/organisation-config.ts` is the non-secret manifest: branding, regional
defaults, contact addresses, sponsor portal defaults, enabled features, and
login providers. Secrets live in the deployment environment, not the manifest.

Team object keys are stable authorization identifiers — change a team's `name`
to relabel it without affecting permissions or membership.

Credentials and per-service setup: **[docs/services.md](docs/services.md)**.

Upgrading an existing install to the optional `systemRole` field? Backfill once:

```sh
bunx convex run migrations:backfillTeamSystemRoles
```

## Deploying

```sh
bun run build:deploy   # convex deploy + frontend build
```

On Vercel, also set `CONVEX_DEPLOY_KEY`.

## Scripts

| Command                           | What it does                     |
| --------------------------------- | -------------------------------- |
| `bun run dev`                     | Frontend + sponsor portal + Convex sync |
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
| Staff         | Convex Auth + configured provider/domain           |
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

Organisation-specific content in a deployed fork, including branding, logos,
trade dress, and configured copy, remains the property of that organisation
(or its respective owners).
