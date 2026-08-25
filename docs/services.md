# Service & credential setup

Detailed setup for the external services the platform integrates with. The
[environment wizard](#environment-wizard) only prompts for credentials the
manifest (`config/organisation-config.ts`) actually enables, so configure the
manifest first.

Keep all secrets in the Convex deployment environment, never in the manifest.
Do not reuse credentials pasted in chat or committed files — rotate anything
that has been exposed.

## Environment wizard

`bun run set-convex-env` writes the deployment environment interactively. Run it
in dry-run mode first to see every variable it will ask for — name, description,
input kind, and default — so you can gather credentials up front:

```sh
bun run set-convex-env --dry-run        # print required variables, write nothing
bun run set-convex-env                   # configure the dev deployment
bun run set-convex-env -- --deployment prod
```

It targets the `dev` deployment by default, keeps existing values unless you
replace them, generates local app secrets, and writes `CLI_AUTH_TOKEN` to
`.env.local` for the OAuth helper.

Flags:

- `--dry-run` — print the required variables and their metadata, then exit.
- `--deployment <ref>` — target a different deployment (default `dev`).
- `--force` — replace every existing value without prompting.

## Login providers

### Google staff login (Convex Auth)

Create an OAuth client in the Google Cloud dashboard.

- Authorised JavaScript origin: `http://localhost:5173`
- Redirect URI: `{CONVEX_SITE_URL}/api/auth/callback/google`

`auth.providers[].hostedDomain` in the manifest restricts the allowed email
domain.

### WCA login (staff + organisers)

Staff and external organisers sign in with their WCA account. Create a WCA OAuth
application **separate** from the `SERVICE_WCA_*` integration client. It needs
**both** redirect URIs registered:

- `{SITE_URL}/auth/wca` — staff sign-in (e.g. `http://localhost:5173/auth/wca`)
- `{SITE_URL}/invite/organiser` — organiser invites

Scopes: `public email`. Set `AUTH_WCA_ID` / `AUTH_WCA_SECRET` in the deployment;
when unset, the WCA button and organiser invites are hidden.

- **Staff** (`/auth/wca`): only admits WCA accounts already in the `users` table
  (matched by `wcaUserId`). Unknown accounts are rejected — no user is created.
  See [Getting started → first user](../README.md#getting-started).
- **Organisers** (`/invite/organiser`): join via an invite link from a
  competition's People card. Links last 30 days, are reusable, and revocable.

## Integration credentials

All required by the wizard.

Each provider needs **two** redirect URIs registered: the admin-page one (used
by the browser flow, the primary path) and the loopback one (used by the
`bun run auth` CLI fallback).

| Service    | Admin redirect URI                                                 | CLI redirect URI        | Scopes / notes                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WCA**    | `{SITE_URL}/admin/service-accounts/callback`                       | `http://localhost:3848` | `public email manage_competitions`                                                                                                                                                |
| **Canva**  | `{SITE_URL}/admin/service-accounts/callback` (`127.0.0.1` locally) | `http://127.0.0.1:3849` | `design:content:write design:meta:read folder:read folder:write brandtemplate:meta:read brandtemplate:content:read` — also needs certificate/lanyard template + output folder IDs |
| **Google** | `{SITE_URL}/admin/service-accounts/callback`                       | `http://localhost:3847` | enable the Sheets/Drive APIs on the project                                                                                                                                       |

`SITE_URL` is the deployment's frontend origin (`http://localhost:5173` by
default). Register the admin URI for **every** environment you connect from —
typically `http://localhost:5173/admin/service-accounts/callback` for dev and
`https://<your-host>/admin/service-accounts/callback` for production — and make
sure it matches `SITE_URL` exactly, including scheme and port.

Locally the host differs per provider: Canva rejects `localhost` and only accepts
`127.0.0.1`, so its admin redirect URI is
`http://127.0.0.1:5173/admin/service-accounts/callback` while WCA and Google use
`http://localhost:5173/admin/service-accounts/callback`. The backend applies that
substitution itself (`localhostRedirectHostname` on the Canva plugin), and the
callback page hops back to the `SITE_URL` origin — sessions are per-origin, so
the token exchange has to run where you signed in. Leave `SITE_URL` as
`http://localhost:5173`. Production is unaffected: deployed origins are not
loopback, so all three providers share `SITE_URL` exactly.

### Discord

Create a bot and add it to the server.

- Scopes: `bot` `applications.commands`
- Bot permissions: `View Channels` `Send Messages`
- Set `DISCORD_GUILD_ID` (server), `DISCORD_PUBLIC_KEY` and `DISCORD_BOT_TOKEN`
  (portal).
- Set the portal's **Interactions Endpoint URL** to
  `https://{CONVEX_SITE_URL}/discord/interactions`. Discord verifies the URL, so
  the project must be deployed first.

## Exchanging service tokens

After the wizard sets the OAuth client credentials, **deploy before exchanging
tokens** — both paths below call OAuth functions on the deployment, so those
functions and the env vars must be pushed first.

### From the admin page (primary)

Sign in as a director and open **Admin → Service accounts**. Each card has
**Connect** (or **Reconnect**), which opens the provider's consent screen and
stores the token on return. The card shows the access-token expiry, whether a
refresh token is present, the granted scopes, and who connected it.

**Refresh** exchanges the stored refresh token without re-consenting.
**Disconnect** deletes the stored token; the platform stops using that service
until it is connected again. Disconnecting does not revoke the grant at the
provider — do that in the provider's own console if a token may have leaked.

Requires `SITE_URL` to be correct and the admin redirect URI registered with the
provider (see the table above).

### From the CLI (bootstrap / fallback)

Still available, and the only option before the site is deployed and reachable
at `SITE_URL`. Start `bun run dev` (or `bun run convex dev`), leave it running,
then:

```sh
bun run auth google   # localhost:3847
bun run auth wca      # localhost:3848
bun run auth canva    # localhost:3849
```

For production, prefix with `CONVEX_PROD=1`, e.g. `CONVEX_PROD=1 bun run auth canva`.

Tokens stored this way have no user attached, so the admin card shows the CLI as
the connector rather than a named director.
