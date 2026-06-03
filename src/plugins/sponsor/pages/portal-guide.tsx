import { Link, Navigate, useNavigate } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import {
  AlertTriangle,
  ArrowLeft,
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
import { SponsorPageLoading } from "@/plugins/sponsor/components/sponsor-ui"
import { ProxyBidIncrementTable } from "@/plugins/sponsor/components/proxy-bid-increment-table"
import { SponsorFrameworkGuideCard } from "@/plugins/sponsor/components/sponsor-framework-guide-card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isSponsorshipEnabled } from "@/lib/feature-flags"
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client"
import { api } from "@/convex/_generated/api"
import {
  clearSponsorImpersonationSessionToken,
  useSponsorSessionToken,
} from "@/plugins/sponsor/lib/sponsor-session-token"
import {
  SPONSOR_AUCTIONS_OVERVIEW,
  SPONSOR_BIDDING_NOTICE,
  SPONSOR_CLOSING_AND_RESULTS,
  SPONSOR_MINIMUM_BIDS,
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
  const {
    sessionToken,
    isPending: authPending,
    isImpersonating,
  } = useSponsorSessionToken()
  const endSponsorImpersonation = useMutation(
    api.impersonation.mutations.endSponsorImpersonation
  )
  const isSignedIn = sessionToken !== null

  if (authPending) {
    return <SponsorPageLoading />
  }

  const onLogout = async () => {
    if (isImpersonating && sessionToken !== null) {
      await endSponsorImpersonation({ sessionToken })
      clearSponsorImpersonationSessionToken()
    } else {
      await sponsorAuthClient.signOut()
    }
    toast.success("Signed out.")
    await navigate({ to: "/sponsor/login" })
  }

  const backTo = isSignedIn ? "/sponsor/auctions" : "/sponsor/login"
  const backLabel = isSignedIn ? "Back to auctions" : "Back to sign in"

  return (
    <SponsorPageShell maxWidthClassName="max-w-3xl">
      <SponsorPageHeader
        title={SPONSOR_GUIDE_PAGE_TITLE}
        subtitle="Auction formats, bidding rules, and sponsorship policy"
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to={backTo}>
                <ArrowLeft className="size-4" />
                {backLabel}
              </Link>
            </Button>
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

      <Card>
        <CardHeader>
          <CardTitle>{SPONSOR_AUCTIONS_OVERVIEW.title}</CardTitle>
          <CardDescription>{SPONSOR_AUCTIONS_OVERVIEW.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-muted-foreground">
          <p>{SPONSOR_AUCTIONS_OVERVIEW.detail}</p>
          <div>
            <p>{SPONSOR_AUCTIONS_OVERVIEW.formatsIntro}</p>
            <ul className="mt-2 list-disc pl-6">
              {SPONSOR_AUCTIONS_OVERVIEW.formatItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auction formats</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion
            type="single"
            collapsible
            defaultValue={SPONSORSHIP_FRAMEWORKS[0]}
          >
            {SPONSORSHIP_FRAMEWORKS.map((framework) => (
              <AccordionItem key={framework} value={framework}>
                <AccordionTrigger>
                  {sponsorshipFrameworkLabel(framework)}
                </AccordionTrigger>
                <AccordionContent>
                  <SponsorFrameworkGuideCard framework={framework} embedded />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{SPONSOR_MINIMUM_BIDS.title}</CardTitle>
          <CardDescription>{SPONSOR_MINIMUM_BIDS.sealedAndVickrey}</CardDescription>
        </CardHeader>
        <CardContent divided>
          <p className="text-muted-foreground">{SPONSOR_MINIMUM_BIDS.proxyIntro}</p>
          <ProxyBidIncrementTable />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{SPONSOR_CLOSING_AND_RESULTS.title}</CardTitle>
          <CardDescription>{SPONSOR_CLOSING_AND_RESULTS.body}</CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>{SPONSOR_BIDDING_NOTICE.title}</AlertTitle>
        <AlertDescription>
          {SPONSOR_BIDDING_NOTICE.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>
            Sponsor team email:{" "}
            <a
              className="text-foreground underline underline-offset-4"
              href={`mailto:${SPONSOR_TEAM_EMAIL}`}
            >
              {SPONSOR_TEAM_EMAIL}
            </a>
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <a href={`mailto:${SPONSOR_TEAM_EMAIL}`}>
              <Mail className="size-4" />
              Email sponsorship team
            </a>
          </Button>
        </CardFooter>
      </Card>
    </SponsorPageShell>
  )
}
