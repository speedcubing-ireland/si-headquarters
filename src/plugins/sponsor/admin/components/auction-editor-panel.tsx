import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AuctionCreateForm } from "@/plugins/sponsor/admin/components/auction-create-form"
import { AuctionEditPanel } from "@/plugins/sponsor/admin/components/auction-edit-panel"
import { AuctionPanelHistory } from "@/plugins/sponsor/admin/components/auction-panel-history"
import type { SponsorshipAdmin } from "@/plugins/sponsor/admin/use-sponsorship-admin"

export function AuctionEditorPanel({ admin }: { admin: SponsorshipAdmin }) {
  const { effectiveEditorMode } = admin.open

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {effectiveEditorMode === "create"
            ? "Create Sponsorship Auction"
            : "Edit Sponsorship Auction"}
        </CardTitle>
        <CardDescription>
          {effectiveEditorMode === "create"
            ? "Create a draft for a competition."
            : "Manage selected auction lifecycle and invites."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {effectiveEditorMode === "create" ? (
          <AuctionCreateForm admin={admin} />
        ) : (
          <AuctionEditPanel admin={admin} />
        )}
        <Separator />
        <AuctionPanelHistory admin={admin} />
      </CardContent>
    </Card>
  )
}
