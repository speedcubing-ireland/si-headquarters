# Organisation Operations Platform

Configurable operations platform for competitions, tasks, teams, and sponsor workflows.

## Prerequisites

- [Bun](https://bun.sh)
- [Convex](https://convex.dev) account

## Setup

```sh
bun install
bun run convex dev   # links your Convex deployment
```

### Organisation configuration

Forks customize the non-secret manifest at
`config/organisation-config.ts`. It controls organisation branding, regional
defaults, contact addresses, sponsor portal defaults, enabled features, and
login providers. The manifest is checked by TypeScript and validated with Zod
when loaded.

Keep OAuth secrets and API credentials in the deployment environment rather
than the manifest. The environment wizard only requests credentials for features
and login providers enabled by the manifest.

Team object keys are stable authorization identifiers; change a team's `name`
to relabel it without changing permissions or membership. After first deploying
the optional `systemRole` field to an existing installation, backfill current
teams once:

```sh
bunx convex run migrations:backfillTeamSystemRoles
```

### Environment

The wizard prompts for credentials interactively, so it helps to know what
it will ask for before you start. Run it in dry-run mode first to get the full
list of variables — with a description, input kind, and any default — so you
can go and gather each credential (OAuth clients, API keys, template IDs, etc.)
up front rather than discovering them one prompt at a time. It writes nothing
and prints no secrets:

```sh
bun run set-convex-env --dry-run
```

Once you've collected everything on that list, run the wizard for a fresh dev
deployment:

```sh
bun run set-convex-env
```

The wizard targets your Convex dev deployment by default, keeps existing
deployment values unless you choose to replace them, generates local app
secrets, and writes the generated `CLI_AUTH_TOKEN` to `.env.local` for the
OAuth helper.

Flags:

- `--dry-run` — print the required variables and their metadata, then exit.
- `--deployment <ref>` — target a different deployment (default `dev`).
- `--force` — replace every existing value without prompting.

For another deployment, pass an explicit reference:

```sh
bun run set-convex-env -- --deployment prod
```

The wizard prompts for real credentials only. Do not reuse credentials pasted in
chat or committed files; rotate any secret that has been exposed.

**Convex Auth** (Google login for staff):

Create an auth OAuth client in the Google Cloud dashboard.

Authorised JavaScript origins:

- `http://localhost:5173`

OAuth redirect URI:

- `{CONVEX_SITE_URL}/api/auth/callback/google`

If the manifest enables Google staff login, `auth.providers[].hostedDomain`
controls the allowed email domain.

**WCA login** (staff + organisers, optional):

Staff and external organisers sign in with their WCA account. Create a second
WCA OAuth application — separate from the `SERVICE_WCA_*` integration client.
The single app needs **both** redirect URIs registered:

Redirect URIs:

- `{SITE_URL}/auth/wca` (e.g. `http://localhost:5173/auth/wca`) — staff sign-in
- `{SITE_URL}/invite/organiser` (e.g. `http://localhost:5173/invite/organiser`) — organiser invites

Scopes - public email

Set `AUTH_WCA_ID` / `AUTH_WCA_SECRET` in the Convex deployment. When unset, the
WCA sign-in button and organiser invite links are hidden.

The main sign-in page's **Sign in with WCA** button uses the staff flow
(`/auth/wca`): it only admits WCA accounts already present in the `users` table
(matched by `wcaUserId`); unknown accounts are rejected, no user is created.

Organisers join via an invite link generated from a competition's People card
(`/invite/organiser`); links are valid for 30 days, reusable by multiple
organisers, and revocable. Organiser sign-in without a valid invite only works
for accounts that have already been invited.

**Integration credentials** (all required by the wizard):

WCA Client:
Redirect URI - http://localhost:3848
Scopes - public email manage_competitions

Canva Client:
Redirect URI - http://127.0.0.1:3849
Scopes - design:content:write design:meta:read folder:read folder:write brandtemplate:meta:read brandtemplate:content:read
You will need to specify the certificate and lanyard template and output folder IDs.

Google Client:
Redirect URI - http://localhost:3847
You likely also need to enable various APIs for the project such as sheets/drive

Discord:
Create a bot and add it to the server.
Scopes - `bot` `applications.commands`
Bot permissions - `View Channels` `Send Messages`
Set DISCORD_GUILD_ID from the server you are using
Set DISCORD_PUBLIC_KEY from the portal
Set DISCORD_BOT_TOKEN from the portal

In the portal you will need to set the Interactions Endpoint URL with `https://{CONVEX_SITE_URL}/discord/interactions`
This requires the project to be deployed first as discord confirms the URL.

After setting service OAuth credentials with the wizard, exchange tokens:

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

Starts the main frontend (`:5173`), sponsor portal (`:5174`), and Convex dev sync in parallel.

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
