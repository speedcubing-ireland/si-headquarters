# Manual Testing by Persona

Guide for manually testing the system as different user personas. Assumes you're running the frontend locally (`bun run dev`) with a Convex development backend.

## Components

### Headquarters (main internal app)

- **URL:** `http://localhost:5173`
- **Auth:** Google OAuth (`@speedcubingireland.com` staff) or WCA OAuth (competitors)
- **Key routes:** `/tasks`, `/competitions`, `/events`, `/inbox`, `/admin`, `/teams`, `/account`

### Sponsor Portal

- **URL:** `http://localhost:5173/sponsor`
- **Auth:** Email + OTP (better-auth), separate from Headquarters auth
- **Key routes:** `/sponsor/login`, `/sponsor/auctions`, `/sponsor/$auctionId`, `/sponsor/settings`
- **Feature flag:** Requires `VITE_SPONSORSHIP_ENABLED=1` in `.env.local`

## Personas

| Persona | Team | Permission Key | What They Can Access |
|---------|------|----------------|---------------------|
| **Director** | Directors | `DIRECTOR` | Everything, including `/admin/*` and god-mode impersonation |
| **Delegate** | Delegates | `DELEGATE` | Competition delegate-specific features |
| **Volunteer** | Volunteer | `VOLUNTEER` | General volunteer access (auto-assigned for `@speedcubingireland.com` emails) |
| **Competitions Team** | Competitions Team | `WCA_2FA` | WCA 2FA management (shared with Directors) |
| **Finance Team** | Finance Team | `SPONSORSHIP_MANAGER` | Sponsorship management (shared with Directors) |
| **Social Media Team** | Social Media Team | `SOCIAL_MEDIA_DASHBOARD` | Social media dashboard access |
| **Merch / Software / Graphics** | Respective teams | (none) | Team membership only, no special permission key |
| **Sponsor** | (separate system) | (separate auth) | Sponsor portal: auctions, bidding, settings |
| **No team** | (none) | (none) | Authenticated but no team — minimal access |

## How to Log In as Each Persona

### Headquarters personas (Director, Volunteer, Delegate, etc.)

#### Option 1: God Mode Impersonation (recommended for testing)

Requires Director access. Creates a one-time login link for any user.

1. Log into Headquarters as a Director (Google OAuth with a `@speedcubingireland.com` account that's in the Directors team)
2. Navigate to `/admin/god-mode` and select the "Incognito Login Links" tab
3. Search for the user you want to impersonate
4. Click "Login" to generate a one-time link (expires after 5 minutes)
5. Open the link in an incognito/private browser window
6. You're now authenticated as that user

The link format is `/auth/login-ticket?ticket=TOKEN&kind=user`.

#### Option 2: Direct OAuth login

- **Google OAuth:** Log in with a `@speedcubingireland.com` Google account. Users with this domain are auto-added to the Volunteer team. To test other roles, the account must already be a member of the appropriate team.
- **WCA OAuth:** Log in with a World Cube Association account (competitor flow).

#### Bootstrap: Getting Director access for the first time

If you don't yet have Director access and can't use god mode:

1. Log in with any method (Google or WCA OAuth)
2. In the [Convex dashboard](https://dashboard.convex.dev), find your user in the `users` table
3. Find the Directors team in the `teams` table
4. Add a `teamMembers` record linking your user to the Directors team

### Sponsor Portal

#### Option A: God Mode (from Director account)

Same flow as above, but select a sponsor as the target. The generated link uses `kind=sponsor`.

#### Option B: Direct login

1. Ensure `VITE_SPONSORSHIP_ENABLED=1` is set in `.env.local`
2. Navigate to `/sponsor/login`
3. Enter a sponsor email address and complete the OTP verification
4. Requires an existing sponsor account in the system

## Tips

- Use separate browser profiles or incognito windows to be logged in as multiple personas simultaneously
- Impersonation tickets are single-use and expire after 5 minutes — generate a fresh one each time
- Permission definitions live in `convex/lib/permissions/policies.ts`
- Team names and configuration are in `convex/lib/constants.ts`
