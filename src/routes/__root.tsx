import {
  createRootRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react"
import { useEffect } from "react"
import { api } from "@/convex/_generated/api"
import { ORGANISER_INVITE_PATH } from "@/convex/competitions/invites/validators"
import { STAFF_WCA_LOGIN_PATH } from "@/convex/wcaLogin/wcaLoginPaths"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthActions } from "@convex-dev/auth/react"
import { Layout } from "@/components/layout/layout"
import { AbilityProvider } from "@/features/auth"
import { getPageTitle } from "@/lib/page-title"
import { isSponsorSite } from "@/lib/sponsor-site"
import {
  findLoginProvider,
  isFeatureEnabled,
  organisationConfig,
  type FeatureId,
  type LoginProviderConfig,
} from "@/config/lib/organisation"
import { featureForPluginPath } from "@/plugins/registry"

const hasOrganiserWcaLogin = findLoginProvider("wca") !== undefined
const hasStaffWcaLogin = findLoginProvider("wca-staff") !== undefined

const PRODUCT_PUBLIC_AUTH_PATHS = new Set([
  "/impersonate/user",
  STAFF_WCA_LOGIN_PATH,
  ...(isFeatureEnabled("organiserInvites") || hasOrganiserWcaLogin
    ? [ORGANISER_INVITE_PATH]
    : []),
])

interface WcaSignInUrls {
  organiser: string | null | undefined
  staff: string | null | undefined
}

function SignInForm({ wcaSignInUrls }: { wcaSignInUrls: WcaSignInUrls }) {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()

  const handleGoogleSignIn = async () => {
    try {
      await signIn("google")
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Connection lost while action was in flight"
      ) {
        return
      }
      throw error
    }
  }

  const providerButton = (provider: LoginProviderConfig) => {
    if (provider.id === "google") {
      return (
        <Button
          key={provider.id}
          type="button"
          className="w-full"
          variant="outline"
          onClick={() => void handleGoogleSignIn()}
        >
          {provider.label}
        </Button>
      )
    }
    const wcaSignInUrl =
      provider.id === "wca-staff"
        ? wcaSignInUrls.staff
        : wcaSignInUrls.organiser
    if (wcaSignInUrl === null) {
      return null
    }
    return (
      <Button
        key={provider.id}
        type="button"
        className="w-full"
        variant="outline"
        disabled={wcaSignInUrl === undefined}
        onClick={() => {
          if (wcaSignInUrl !== undefined) {
            void navigate({ href: wcaSignInUrl })
          }
        }}
      >
        {provider.label}
      </Button>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Choose the account type that applies to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {organisationConfig.auth.providers.map(providerButton)}
      </CardContent>
    </Card>
  )
}

function featureForPath(pathname: string): FeatureId | null {
  if (pathname.startsWith("/sponsor") || isSponsorSite()) return "sponsors"
  if (pathname.startsWith(ORGANISER_INVITE_PATH) && !hasOrganiserWcaLogin) {
    return "organiserInvites"
  }
  if (pathname.startsWith("/admin/refunds")) return "refunds"
  if (pathname.startsWith("/events")) return "events"
  return featureForPluginPath(pathname)
}

function FeatureUnavailable() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            This feature is not available for this organisation.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function RootLayout() {
  const staffWcaSignInUrl = useQuery(
    api.wcaLogin.queries.wcaSignInUrl,
    hasStaffWcaLogin ? { flow: "staff" } : "skip"
  )
  const organiserWcaSignInUrl = useQuery(
    api.wcaLogin.queries.wcaSignInUrl,
    hasOrganiserWcaLogin ? { flow: "organiser" } : "skip"
  )
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const normalizedPath = pathname.replace(/\/+$/, "") || "/"
  const requiredFeature = featureForPath(normalizedPath)

  useEffect(() => {
    document.title = getPageTitle(pathname)
  }, [pathname])

  if (requiredFeature !== null && !isFeatureEnabled(requiredFeature)) {
    return <FeatureUnavailable />
  }

  if (PRODUCT_PUBLIC_AUTH_PATHS.has(normalizedPath)) {
    return <Outlet />
  }

  if (isSponsorSite() || normalizedPath.startsWith("/sponsor")) {
    return <Outlet />
  }

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-svh items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AbilityProvider>
          <Layout>
            <Outlet />
          </Layout>
        </AbilityProvider>
      </Authenticated>
      <Unauthenticated>
        <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {organisationConfig.organisation.name}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-balance">
              {organisationConfig.organisation.productName}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to access your competitions, tasks, and tools.
            </p>
          </div>
          <SignInForm
            wcaSignInUrls={{
              organiser: organiserWcaSignInUrl,
              staff: staffWcaSignInUrl,
            }}
          />
          <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
            Contact an administrator if you need access.
          </p>
        </div>
      </Unauthenticated>
    </>
  )
}

export const Route = createRootRoute({ component: RootLayout })
