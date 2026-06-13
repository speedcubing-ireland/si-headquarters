import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react"
import { useEffect } from "react"
import { api } from "@/convex/_generated/api"
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

function isSponsorPortalPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (isSponsorSite()) {
    return true
  }
  return normalized.startsWith("/sponsor")
}

function isPublicAuthPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  return (
    normalized === "/impersonate/user" || normalized === "/invite/organiser"
  )
}

function SignInForm() {
  const { signIn } = useAuthActions()
  const wcaSignInUrl = useQuery(api.organisers.queries.wcaSignInUrl, {})

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
        {typeof wcaSignInUrl === "string" ? (
          <Button
            type="button"
            className="w-full"
            variant="outline"
            onClick={() => {
              window.location.assign(wcaSignInUrl)
            }}
          >
            External Organiser (WCA)
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RootLayoutInner() {
  const { isSponsorPortal, pathname } = useRouterState({
    select: (state) => ({
      isSponsorPortal: isSponsorPortalPath(state.location.pathname),
      pathname: state.location.pathname,
    }),
  })

  useEffect(() => {
    document.title = getPageTitle(pathname)
  }, [pathname])

  if (isPublicAuthPath(pathname)) {
    return <Outlet />
  }

  if (isSponsorPortal) {
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
          <SignInForm />
          <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
            Speedcubing Ireland Volunteers sign in with Google. External
            Organisers sign in with WCA. Contact an admin if you need access.
          </p>
        </div>
      </Unauthenticated>
    </>
  )
}

function RootLayout() {
  return <RootLayoutInner />
}

export const Route = createRootRoute({ component: RootLayout })
