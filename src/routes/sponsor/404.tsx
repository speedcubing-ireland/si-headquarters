import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/sponsor/404")({
  component: SponsorSiteNotFoundPage,
})

function SponsorSiteNotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            This page is not available on the sponsor portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/sponsor/login">Back to sponsor portal</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
