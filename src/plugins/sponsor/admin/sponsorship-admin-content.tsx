import { Gavel, Settings, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminStats } from "@/plugins/sponsor/admin/components/admin-stats"
import { ClosedAuctionsTab } from "@/plugins/sponsor/admin/tabs/closed-auctions-tab"
import { OpenAuctionsTab } from "@/plugins/sponsor/admin/tabs/open-auctions-tab"
import { AuctionTypesTab } from "@/plugins/sponsor/admin/tabs/auction-types-tab"
import { AuctionSettingsTab } from "@/plugins/sponsor/admin/tabs/auction-settings-tab"
import { SponsorsTab } from "@/plugins/sponsor/admin/tabs/sponsors-tab"
import {
  isAdminSponsorshipTab,
  type AdminSponsorshipTab,
} from "@/plugins/sponsor/admin/types"
import { useSponsorshipAdminNavigation } from "@/plugins/sponsor/admin/use-sponsorship-admin-search"

export function SponsorshipAdminContent({
  activeTab,
}: {
  activeTab: AdminSponsorshipTab
}) {
  const { setTab } = useSponsorshipAdminNavigation()

  return (
    <>
      <AdminStats />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isAdminSponsorshipTab(value)) {
            setTab(value)
          }
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
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
          <TabsTrigger value="auctionSettings">
            <Settings className="size-4" />
            Auction Settings
          </TabsTrigger>
        </TabsList>

        <OpenAuctionsTab />
        <ClosedAuctionsTab />

        <TabsContent value="sponsors" className="space-y-4">
          <SponsorsTab />
        </TabsContent>

        <TabsContent value="auctionTypes" className="space-y-4">
          <AuctionTypesTab />
        </TabsContent>

        <TabsContent value="auctionSettings" className="space-y-4">
          <AuctionSettingsTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
