// Frontend redirect path for connecting an OAuth service account from the admin
// page. Kept free of server imports so both the Convex backend and the web
// client can import it (mirrors STAFF_WCA_LOGIN_PATH in
// convex/wcaLogin/wcaLoginPaths.ts).
//
// This must stay in sync with the route literal in
// src/routes/admin/service-accounts/callback.tsx — TanStack Router needs a
// literal there, so the two are checked against each other in
// convex/integrations/serviceAccounts.test.ts.
export const SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH =
  "/admin/service-accounts/callback"

// How long a started connection attempt stays redeemable.
export const SERVICE_ACCOUNT_OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000
