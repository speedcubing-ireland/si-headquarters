import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/convex/_generated/api"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import {
  TaskIntegrationCardShell,
  type TaskIntegrationCardRow,
} from "@/features/integrations/task-integration-card-shell"
import { useAction } from "convex/react"
import { ExternalLinkIcon, PaletteIcon } from "lucide-react"
import { useState } from "react"

interface CanvaDesignCandidate {
  designId: string
  designUrl: string
  title: string
  thumbnailUrl?: string
}

export function CanvaTaskCard({ row }: { row: TaskIntegrationCardRow }) {
  const validateDesign = useAction(api.plugins.canva.links.validateDesign)
  const linkDesign = useAction(api.plugins.canva.links.linkDesign)
  const output = row.output?.kind === "canva_design" ? row.output : undefined
  const openDesignButton =
    output?.designUrl === undefined ? null : (
      <Button asChild type="button" variant="outline">
        <a href={output.designUrl} target="_blank" rel="noreferrer">
          Open design
          <ExternalLinkIcon />
        </a>
      </Button>
    )

  const [manualOpen, setManualOpen] = useState(false)
  const [manualUrl, setManualUrl] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkPending, setLinkPending] = useState<"validate" | "link" | null>(
    null
  )
  const [candidate, setCandidate] = useState<CanvaDesignCandidate | null>(null)

  function resetManualDialog(open: boolean) {
    setManualOpen(open)
    if (!open) {
      setManualUrl("")
      setLinkError(null)
      setLinkPending(null)
      setCandidate(null)
    }
  }

  async function validateManualDesign() {
    setLinkPending("validate")
    setLinkError(null)
    setCandidate(null)
    try {
      setCandidate(
        await validateDesign({
          id: row._id,
          designUrl: manualUrl.trim(),
        })
      )
    } catch (caught) {
      setLinkError(unknownErrorMessage(caught, { includeConvexError: true }))
    } finally {
      setLinkPending(null)
    }
  }

  async function linkManualDesign() {
    if (candidate === null) {
      return
    }
    setLinkPending("link")
    setLinkError(null)
    try {
      await linkDesign({ id: row._id, designUrl: candidate.designUrl })
      resetManualDialog(false)
    } catch (caught) {
      setLinkError(unknownErrorMessage(caught, { includeConvexError: true }))
    } finally {
      setLinkPending(null)
    }
  }

  return (
    <>
      <TaskIntegrationCardShell
        icon={<PaletteIcon className="size-4 text-pink-500" />}
        row={row}
        showLastMessage={false}
        alert={({ status }) =>
          status === "awaiting_manual_share"
            ? "Open the design in Canva, share it with your team, then confirm below."
            : undefined
        }
        actions={({ actions, status }) => {
          if (status === "running" || actions.pending === "run") {
            return null
          }
          if (status === "completed") {
            return openDesignButton
          }
          if (status === "awaiting_manual_share") {
            return (
              <>
                {openDesignButton}
                <Button
                  type="button"
                  disabled={actions.pending === "confirm"}
                  onClick={() => {
                    void actions.confirmManualStep({
                      expectedStatus: status,
                      completedMessage: "Manual step confirmed.",
                    })
                  }}
                >
                  Confirm shared
                </Button>
              </>
            )
          }
          return (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void actions.run()
                }}
              >
                Generate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetManualDialog(true)
                }}
              >
                Link existing
              </Button>
            </>
          )
        }}
      >
        {row.status === "running" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Generating design...
          </div>
        ) : output?.thumbnailUrl !== undefined ? (
          <div className="flex justify-center rounded-lg border">
            <img
              className="h-48 w-auto object-contain"
              src={output.thumbnailUrl}
              alt=""
            />
          </div>
        ) : null}
      </TaskIntegrationCardShell>
      <Dialog open={manualOpen} onOpenChange={resetManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link existing Canva design</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="https://www.canva.com/design/..."
              value={manualUrl}
              disabled={linkPending !== null}
              onChange={(event) => {
                setManualUrl(event.target.value)
                setCandidate(null)
                setLinkError(null)
              }}
            />
            {candidate !== null ? (
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">{candidate.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {candidate.designId}
                </p>
                {candidate.thumbnailUrl !== undefined ? (
                  <img
                    className="mt-3 max-h-48 w-full rounded-md object-contain"
                    src={candidate.thumbnailUrl}
                    alt=""
                  />
                ) : null}
              </div>
            ) : null}
            {linkError !== null ? (
              <p className="text-sm text-destructive">{linkError}</p>
            ) : null}
          </div>
          <DialogFooter>
            {candidate === null ? (
              <Button
                type="button"
                disabled={manualUrl.trim() === "" || linkPending !== null}
                onClick={() => {
                  void validateManualDesign()
                }}
              >
                {linkPending === "validate" ? "Validating..." : "Validate"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={linkPending !== null}
                onClick={() => {
                  void linkManualDesign()
                }}
              >
                {linkPending === "link" ? "Linking..." : "Link design"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
