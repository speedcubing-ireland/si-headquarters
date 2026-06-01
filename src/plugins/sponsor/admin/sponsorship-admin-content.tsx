import { Gavel, Loader2, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminStats } from "@/plugins/sponsor/admin/components/admin-stats"
import { ClosedAuctionsTab } from "@/plugins/sponsor/admin/tabs/closed-auctions-tab"
import { OpenAuctionsTab } from "@/plugins/sponsor/admin/tabs/open-auctions-tab"
import { AuctionTypesTab } from "@/plugins/sponsor/admin/tabs/auction-types-tab"
import { SponsorsTab } from "@/plugins/sponsor/admin/tabs/sponsors-tab"
import { isAdminSponsorshipTab } from "@/plugins/sponsor/admin/types"
import { useSponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"

export function SponsorshipAdminContent() {
  const admin = useSponsorshipAdmin()
  const { stats, loading, sponsors, actions } = admin

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-4 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sponsorship Admin
        </h1>
        <p className="text-sm text-muted-foreground">Directors + Finance Team</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-0 lg:px-6">
        <AdminStats stats={stats} />

        <Tabs
          value={actions.activeTab}
          onValueChange={(value) => {
            if (isAdminSponsorshipTab(value)) {
              actions.setActiveTab(value)
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
          <ClosedAuctionsTab admin={admin} />

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
            <Loader2 className="size-3 animate-spin" />
            Loading competitions…
          </p>
        ) : null}
      </div>
    </div>
  )
}
