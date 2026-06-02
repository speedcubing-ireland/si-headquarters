import { TabsContent } from "@/components/ui/tabs"
import { AuctionEditorPanel } from "@/plugins/sponsor/admin/components/auction-editor-panel"
import { OpenAuctionsListCard } from "@/plugins/sponsor/admin/components/open-auctions-list-card"
import type { SponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"

export function OpenAuctionsTab({ admin }: { admin: SponsorshipAdmin }) {
  return (
    <TabsContent value="open" className="space-y-4">
      <div className="grid gap-4 @xl/main:grid-cols-[1.5fr_1fr]">
        <OpenAuctionsListCard admin={admin} />
        <AuctionEditorPanel admin={admin} />
      </div>
    </TabsContent>
  )
}
