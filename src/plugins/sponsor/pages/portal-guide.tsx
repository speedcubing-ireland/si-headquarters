import { Link, Navigate, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  LogIn,
  LogOut,
  Mail,
} from "lucide-react"
import { toast } from "sonner"
import {
  SponsorPageHeader,
  SponsorPageShell,
} from "@/plugins/sponsor/components/sponsor-page-layout"
import { PortalThemeToggle } from "@/plugins/sponsor/components/portal-theme-toggle"
import { ProxyBidIncrementTable } from "@/plugins/sponsor/components/proxy-bid-increment-table"
import { SponsorFrameworkGuideCard } from "@/plugins/sponsor/components/sponsor-framework-guide-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client"
import {
  SPONSOR_AUCTIONS_OVERVIEW,
  SPONSOR_BIDDING_NOTICE,
  SPONSOR_CLOSING_AND_RESULTS,
  SPONSOR_PROXY_BID_INCREMENTS,
  SPONSOR_TEAM_EMAIL,
} from "@/plugins/sponsor/lib/sponsor-guide"
import {
  SPONSORSHIP_FRAMEWORKS,
  SPONSOR_GUIDE_PAGE_TITLE,
  sponsorshipFrameworkLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui"

export function PortalGuidePage() {
  if (!isSponsorshipEnabled) {
    return <Navigate to="/" />
  }
  return <SponsorGuideEnabled />
}

function SponsorGuideEnabled() {
  const navigate = useNavigate()
  const { data: authSession, isPending: authPending } =
    sponsorAuthClient.useSession()
  const sessionToken = authSession?.session.token ?? null
  const isSignedIn = sessionToken !== null

  if (authPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const onLogout = async () => {
    await sponsorAuthClient.signOut()
    toast.success("Signed out.")
    await navigate({ to: "/sponsor/login" })
  }

  return (
    <SponsorPageShell maxWidthClassName="max-w-3xl">
      <SponsorPageHeader
        title={SPONSOR_GUIDE_PAGE_TITLE}
        subtitle="How auctions work, bidding rules, and sponsorship policy"
        actions={
          <>
            <PortalThemeToggle />
            {isSignedIn ? (
              <Button variant="outline" onClick={() => void onLogout()}>
                <LogOut className="size-4" />
                Log out
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/sponsor/login">
                  <LogIn className="size-4" />
                  Sign in
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {isSignedIn ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/sponsor/auctions">
              <ArrowLeft className="size-4" />
              Back to auctions
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/sponsor/login">
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{SPONSOR_AUCTIONS_OVERVIEW.title}</CardTitle>
            <CardDescription>{SPONSOR_AUCTIONS_OVERVIEW.body}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {SPONSOR_AUCTIONS_OVERVIEW.formatsIntro}
            </p>
            <div className="flex flex-wrap gap-2">
              {SPONSORSHIP_FRAMEWORKS.map((framework) => (
                <Badge key={framework} variant="secondary">
                  {sponsorshipFrameworkLabel(framework)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auction formats</CardTitle>
            <CardDescription>
              Each competition uses one format. Open an auction to see which
              applies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue={SPONSORSHIP_FRAMEWORKS[0]}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
                {SPONSORSHIP_FRAMEWORKS.map((framework) => (
                  <TabsTrigger key={framework} value={framework}>
                    {sponsorshipFrameworkLabel(framework)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {SPONSORSHIP_FRAMEWORKS.map((framework) => (
                <TabsContent key={framework} value={framework}>
                  <div className="space-y-6">
                    <SponsorFrameworkGuideCard framework={framework} embedded />
                    {framework === "ebay_proxy" ? (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">
                          {SPONSOR_PROXY_BID_INCREMENTS.title}
                        </h3>
                        <ProxyBidIncrementTable />
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{SPONSOR_CLOSING_AND_RESULTS.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {SPONSOR_CLOSING_AND_RESULTS.body}
            </p>
          </CardContent>
        </Card>

        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{SPONSOR_BIDDING_NOTICE.title}</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              {SPONSOR_BIDDING_NOTICE.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Need help?</CardTitle>
            <CardDescription>
              Contact the Speedcubing Ireland sponsorship team with questions or
              technical issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a href={`mailto:${SPONSOR_TEAM_EMAIL}`}>
                <Mail className="size-4" />
                {SPONSOR_TEAM_EMAIL}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </SponsorPageShell>
  )
}
