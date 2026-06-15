import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { PublicAuthMessage } from "@/components/public-auth-card"

export const Route = createFileRoute("/sponsor/404")({
  component: SponsorSiteNotFoundPage,
})

function SponsorSiteNotFoundPage() {
  return (
    <PublicAuthMessage
      title="Page not found"
      description="This page is not available on the sponsor portal."
    >
      <CardContent>
        <Button asChild className="w-full">
          <Link to="/sponsor/login">Back to sponsor portal</Link>
        </Button>
      </CardContent>
    </PublicAuthMessage>
  )
}
