import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AuctionTable } from "@/plugins/sponsor/admin/components/auction-table"
import type { SponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"

export function OpenAuctionsListCard({ admin }: { admin: SponsorshipAdmin }) {
  const { open, loading, actions } = admin
  const {
    openSearchQuery,
    setOpenSearchQuery,
    filteredOpenAuctions,
    effectiveSelectedAuctionId,
  } = open
  const { isLoadingAuctions } = loading
  const { resetCreatePanel, selectAuctionForEditing } = actions

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft, Scheduled, and Active Auctions</CardTitle>
        <CardDescription>
          Select an auction to edit details and manage its lifecycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search competitions or phases"
            value={openSearchQuery}
            onChange={(event) => {
              setOpenSearchQuery(event.target.value)
            }}
            className="max-w-sm"
          />
          <Button
            variant="outline"
            onClick={() => {
              resetCreatePanel()
            }}
          >
            <Plus className="size-4" />
            New auction draft
          </Button>
        </div>
        <AuctionTable
          rows={filteredOpenAuctions}
          emptyText="No open auctions."
          selectedId={effectiveSelectedAuctionId}
          actionLabel="Edit"
          onSelect={selectAuctionForEditing}
          isLoading={isLoadingAuctions}
        />
      </CardContent>
    </Card>
  )
}
