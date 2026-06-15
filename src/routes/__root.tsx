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

const HQ_PUBLIC_AUTH_PATHS = new Set([
  "/impersonate/user",
  ORGANISER_INVITE_PATH,
])

function SignInForm({
  wcaSignInUrl,
}: {
  wcaSignInUrl: string | null | undefined
}) {
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

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Choose the account type that applies to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          className="w-full"
          variant="outline"
          onClick={() => void handleGoogleSignIn()}
        >
          Speedcubing Ireland Volunteer (GSuite)
        </Button>
        {wcaSignInUrl !== null ? (
          <Button
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
            External Organiser (WCA)
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RootLayout() {
  const wcaSignInUrl = useQuery(api.organisers.queries.wcaSignInUrl, {})
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const normalizedPath = pathname.replace(/\/+$/, "") || "/"

  useEffect(() => {
    document.title = getPageTitle(pathname)
  }, [pathname])

  if (HQ_PUBLIC_AUTH_PATHS.has(normalizedPath)) {
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
              Speedcubing Ireland
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-balance">
              Volunteer & Competition Headquarters
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to access your competitions, tasks, and tools.
            </p>
          </div>
          <SignInForm wcaSignInUrl={wcaSignInUrl} />
          <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
            Speedcubing Ireland Volunteers sign in with Google. External
            Organisers sign in with WCA. Contact an admin if you need access.
          </p>
        </div>
      </Unauthenticated>
    </>
  )
}

export const Route = createRootRoute({ component: RootLayout })
