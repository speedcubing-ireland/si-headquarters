import { TabsContent } from "@/components/ui/tabs"
import { OpenAuctionsListCard } from "@/plugins/sponsor/admin/components/open-auctions-list-card"

export function OpenAuctionsTab() {
  return (
    <TabsContent value="open" className="space-y-4">
      <OpenAuctionsListCard />
    </TabsContent>
  )
}
