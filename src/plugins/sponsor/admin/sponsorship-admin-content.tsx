import { Gavel, Users } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminStats } from "@/plugins/sponsor/admin/components/admin-stats"
import { ClosedAuctionsTab } from "@/plugins/sponsor/admin/tabs/closed-auctions-tab"
import { OpenAuctionsTab } from "@/plugins/sponsor/admin/tabs/open-auctions-tab"
import { AuctionTypesTab } from "@/plugins/sponsor/admin/tabs/auction-types-tab"
import { SponsorsTab } from "@/plugins/sponsor/admin/tabs/sponsors-tab"
import {
  isAdminSponsorshipTab,
  type AdminSponsorshipTab,
} from "@/plugins/sponsor/admin/types"
import { useSponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"
import { useSponsorshipAdminNavigation } from "@/plugins/sponsor/admin/use-sponsorship-admin-search"

export function SponsorshipAdminContent({
  activeTab,
}: {
  activeTab: AdminSponsorshipTab
}) {
  const admin = useSponsorshipAdmin()
  const { stats, loading, sponsors, actions } = admin
  const { setTab } = useSponsorshipAdminNavigation()

  return (
    <>
      <AdminStats stats={stats} />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isAdminSponsorshipTab(value)) {
            setTab(value)
          }
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="open">
            <Gavel className="size-4" />
            Open
          </TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="auctionTypes">Auction Types</TabsTrigger>
          <TabsTrigger value="sponsors">
            <Users className="size-4" />
            Sponsors
          </TabsTrigger>
        </TabsList>

        <OpenAuctionsTab admin={admin} />
        <ClosedAuctionsTab />

        <TabsContent value="sponsors" className="space-y-4">
          <SponsorsTab
            sponsors={sponsors.sponsors}
            isLoadingSponsors={loading.isLoadingSponsors}
            name={sponsors.name}
            email={sponsors.email}
            avatarUrl={sponsors.avatarUrl}
            isSubmittingSponsor={sponsors.isSubmittingSponsor}
            busySponsorId={sponsors.busySponsorId}
            onNameChange={sponsors.setName}
            onEmailChange={sponsors.setEmail}
            onAvatarUrlChange={sponsors.setAvatarUrl}
            onCreateSponsor={(event) => {
              void actions.onCreateSponsor(event)
            }}
            onSendAccessEmail={(id) => {
              void actions.onSendAccessEmail(id)
            }}
            onResetSessions={(id) => {
              void actions.onResetSessions(id)
            }}
            onArchiveSponsor={(id) => {
              void actions.onArchiveSponsor(id)
            }}
            onUnarchiveSponsor={(id) => {
              void actions.onUnarchiveSponsor(id)
            }}
          />
        </TabsContent>

        <TabsContent value="auctionTypes" className="space-y-4">
          <AuctionTypesTab />
        </TabsContent>
      </Tabs>

      {loading.isLoadingCompetitions ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3" />
          Loading competitions…
        </p>
      ) : null}
    </>
  )
}
