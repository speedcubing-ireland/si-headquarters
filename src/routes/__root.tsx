import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthActions } from "@convex-dev/auth/react"

function SignInForm() {
  const { signIn } = useAuthActions()
  return (
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
            onClick={() => void signIn("google")}
          >
            Speedcubing Ireland Volunteer (GSuite)
          </Button>
        </CardContent>
      </Card>
      <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
        Speedcubing Ireland Volunteers sign in with Google. External Organisers
        sign in with WCA. Contact an admin if you need access.
      </p>
    </div>
  )
}

function RootLayout() {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-svh items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AuthLoading>
      <Authenticated>
        <Outlet />
      </Authenticated>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
    </>
  )
}

export const Route = createRootRoute({ component: RootLayout })
