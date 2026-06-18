import { Plus } from "lucide-react"
import { useState } from "react"
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
import { filterAuctionsBySearch } from "@/plugins/sponsor/admin/sponsorship-admin-derivations"
import { useSponsorshipEditorNavigation } from "@/plugins/sponsor/admin/use-sponsorship-admin-search"
import { useSponsorshipAuctionsForManager } from "@/plugins/sponsor/hooks/use-sponsorship"

export function OpenAuctionsListCard() {
  const [searchQuery, setSearchQuery] = useState("")
  const { auctions, isLoading } = useSponsorshipAuctionsForManager()
  const { openCreateAuction, openEditAuction } =
    useSponsorshipEditorNavigation()

  const openAuctions = auctions.filter((auction) => auction.state !== "closed")
  const filteredOpenAuctions = filterAuctionsBySearch(openAuctions, searchQuery)

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
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
            }}
            className="max-w-sm"
          />
          <Button
            variant="outline"
            onClick={() => {
              openCreateAuction()
            }}
          >
            <Plus className="size-4" />
            New auction draft
          </Button>
        </div>
        <AuctionTable
          rows={filteredOpenAuctions}
          emptyText="No open auctions."
          selectedId={null}
          actionLabel="Edit"
          onSelect={openEditAuction}
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  )
}
