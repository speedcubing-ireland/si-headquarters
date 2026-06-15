import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Copy, MessageCirclePlusIcon, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime } from "@/lib/format/irish-dates"

type InviteLink = FunctionReturnType<
  typeof api.competitions.invites.mutations.create
>

export function OrganiserInviteButton({
  competitionId,
}: {
  competitionId: Id<"competitions">
}) {
  const invites = useQuery(api.competitions.invites.queries.list, {
    id: competitionId,
  })
  const createInvite = useMutation(api.competitions.invites.mutations.create)
  const revokeInvite = useMutation(api.competitions.invites.mutations.revoke)

  const [open, setOpen] = useState(false)
  const [link, setLink] = useState<InviteLink | null>(null)
  const [busy, setBusy] = useState(false)

  const handleCreate = async () => {
    setBusy(true)
    try {
      const result = await createInvite({ id: competitionId })
      setLink(result)
      toast.success("Organiser invite link created.")
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not create link."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setLink(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="w-full">
          <MessageCirclePlusIcon />
          Invite Organiser To HQ
        </Button>
      </DialogTrigger>
      <DialogContent className="space-y-3">
        <DialogHeader>
          <DialogTitle>Invite organisers</DialogTitle>
          <DialogDescription>
            Share a link that lets organisers sign in with their WCA account and
            join this competition. Links last 30 days and can be used by
            multiple people.
          </DialogDescription>
        </DialogHeader>
        {link !== null ? (
          <div className="space-y-2 rounded-md bg-muted/40 p-2">
            <p className="font-mono text-xs break-all text-muted-foreground">
              {link.url}
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Expires {formatDateTime(link.expiresAt)}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(link.url).then(() => {
                    toast.success("Copied invite link.")
                  })
                }}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          </div>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => void handleCreate()}
        >
          {busy ? <Spinner /> : null}
          Create invite link
        </Button>
        {invites !== undefined && invites.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Active links
            </p>
            <ul className="space-y-1">
              {invites.map((invite) => (
                <li
                  key={invite._id}
                  className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span className="min-w-0 truncate">
                    By {invite.createdByName}, expires{" "}
                    {formatDateTime(invite.expiresAt)}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Revoke invite link"
                    onClick={() => {
                      void revokeInvite({
                        id: competitionId,
                        inviteId: invite._id,
                      }).then(() => {
                        toast.success("Invite link revoked.")
                      })
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
