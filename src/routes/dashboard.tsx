import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  dashboardLinkHref,
  loadDashboardLinks,
  type DashboardLink,
  type DashboardLinkIcon,
} from "@/features/dashboard/dashboard-links"
import { createFileRoute } from "@tanstack/react-router"
import {
  AwardIcon,
  BadgeIcon,
  CalendarIcon,
  CuboidIcon,
  ExternalLinkIcon,
  type LucideIcon,
} from "lucide-react"

const LINK_ICONS = {
  "identity-card": BadgeIcon,
  calendar: CalendarIcon,
  cube: CuboidIcon,
  award: AwardIcon,
} satisfies Record<DashboardLinkIcon, LucideIcon>

function DashboardLinkCard({ link }: { link: DashboardLink }) {
  const Icon = LINK_ICONS[link.icon]
  const href = dashboardLinkHref(link)

  return (
    <Card className="h-full">
      <CardHeader className="flex-1">
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <CardTitle>{link.title}</CardTitle>
        <CardDescription>{link.description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <a href={href} target="_blank" rel="noopener noreferrer">
            {link.actionLabel}
            <ExternalLinkIcon />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}

function DashboardPage() {
  const links = Route.useLoaderData()

  return (
    <Page.Shell
      title="Dashboard"
      contentClassName={PAGE_CONTENT_PADDING_SCROLL}
    >
      <div className="grid gap-4 @3xl/main:grid-cols-3 @md/main:grid-cols-2">
        {links.map((link) => (
          <DashboardLinkCard key={link.id} link={link} />
        ))}
      </div>
    </Page.Shell>
  )
}

function DashboardPendingPage() {
  return (
    <Page.Shell title="Dashboard">
      <Page.Status variant="loading" message="Loading dashboard links…" />
    </Page.Shell>
  )
}

function DashboardErrorPage() {
  return (
    <Page.Shell title="Dashboard">
      <Page.Status
        variant="empty"
        message="Dashboard links are temporarily unavailable."
      />
    </Page.Shell>
  )
}

export const Route = createFileRoute("/dashboard")({
  loader: loadDashboardLinks,
  staleTime: 5 * 60 * 1000,
  pendingComponent: DashboardPendingPage,
  errorComponent: DashboardErrorPage,
  component: DashboardPage,
})
