import { createFileRoute } from "@tanstack/react-router"
import { AdminAccessGuard } from "@/features/admin/admin-access-guard"
import { ServiceAccountCallbackPage } from "@/features/admin/service-accounts/callback-page"
import { ensureCanonicalCallbackOrigin } from "@/features/admin/service-accounts/canonical-origin"

// The path literal must match SERVICE_ACCOUNT_OAUTH_CALLBACK_PATH in
// convex/integrations/serviceAccountPaths.ts — TanStack Router needs a literal
// here, so the two are asserted equal in
// convex/integrations/serviceAccounts.test.ts.
export const Route = createFileRoute("/admin/service-accounts/callback")({
  // Runs before the root layout can show the sign-in wall: a provider that
  // insists on its own loopback host (Canva wants 127.0.0.1) drops the browser on
  // an origin with no session, so the flow has to move back to SITE_URL first.
  beforeLoad: ensureCanonicalCallbackOrigin,
  validateSearch: (search) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    errorDescription:
      typeof search.error_description === "string"
        ? search.error_description
        : undefined,
  }),
  component: ServiceAccountCallbackRoute,
})

function ServiceAccountCallbackRoute() {
  const { code, state, error, errorDescription } = Route.useSearch()

  return (
    <AdminAccessGuard>
      <ServiceAccountCallbackPage
        code={code}
        state={state}
        error={error}
        errorDescription={errorDescription}
      />
    </AdminAccessGuard>
  )
}
