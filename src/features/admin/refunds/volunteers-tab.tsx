import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { RefundVolunteerRecord } from "@/convex/refunds/api"
import { useRefundMutations } from "@/features/admin/refunds/use-refunds"

function parseWcaIdList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\n]/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ]
}

interface VolunteerDraft {
  name: string
  wcaId: string
  transferTargets: string
}

function volunteerToDraft(v: RefundVolunteerRecord): VolunteerDraft {
  return {
    name: v.name,
    wcaId: v.wcaId ?? "",
    transferTargets: v.transferToWcaIds.join(", "),
  }
}

export function VolunteersTab({
  volunteers,
  isLoading,
  onRefresh,
}: {
  volunteers: RefundVolunteerRecord[]
  isLoading: boolean
  onRefresh: () => void
}) {
  const { createVolunteer, updateVolunteer, deleteVolunteer } =
    useRefundMutations()

  const [drafts, setDrafts] = useState<
    Record<string, VolunteerDraft | undefined>
  >({})
  const [newDraft, setNewDraft] = useState<VolunteerDraft>({
    name: "",
    wcaId: "",
    transferTargets: "",
  })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] =
    useState<RefundVolunteerRecord | null>(null)

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, VolunteerDraft> = {}
      for (const v of volunteers) {
        const key = String(v.id)
        next[key] = current[key] ?? volunteerToDraft(v)
      }
      return next
    })
  }, [volunteers])

  const handleCreate = async () => {
    if (!newDraft.name.trim()) {
      toast.error("Name is required.")
      return
    }
    setIsCreating(true)
    try {
      await createVolunteer({
        name: newDraft.name.trim(),
        wcaId: newDraft.wcaId.trim() || undefined,
        transferToWcaIds: parseWcaIdList(newDraft.transferTargets),
      })
      setNewDraft({ name: "", wcaId: "", transferTargets: "" })
      toast.success("Volunteer added.")
      onRefresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add volunteer."
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async (volunteer: RefundVolunteerRecord) => {
    const key = String(volunteer.id)
    const draft = drafts[key]
    if (draft === undefined) return

    const name = draft.name.trim()
    const wcaId = draft.wcaId.trim() || undefined
    const transferToWcaIds = parseWcaIdList(draft.transferTargets)

    if (!name) {
      toast.error("Name is required.")
      return
    }
    if (wcaId === undefined && transferToWcaIds.length === 0) {
      toast.error("Either a WCA ID or transfer WCA ID is required.")
      return
    }

    setBusyId(key)
    try {
      await updateVolunteer(volunteer.id, { name, wcaId, transferToWcaIds })
      toast.success("Volunteer updated.")
      onRefresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update volunteer."
      )
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (volunteer: RefundVolunteerRecord) => {
    const key = String(volunteer.id)
    setBusyId(key)
    try {
      await deleteVolunteer(volunteer.id)
      toast.success("Volunteer deleted.")
      onRefresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete volunteer."
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volunteers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading...
          </div>
        ) : volunteers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No volunteers configured. Add one below.
          </p>
        ) : (
          <div className="space-y-2">
            {volunteers.map((volunteer) => {
              const key = String(volunteer.id)
              const draft = drafts[key] ?? volunteerToDraft(volunteer)
              const isBusy = busyId === key

              return (
                <div
                  key={key}
                  className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_0.8fr_1.2fr_auto]"
                >
                  <Input
                    value={draft.name}
                    onChange={(e) => {
                      setDrafts((d) => ({
                        ...d,
                        [key]: { ...draft, name: e.target.value },
                      }))
                    }}
                    disabled={isBusy}
                    placeholder="Name"
                  />
                  <Input
                    value={draft.wcaId}
                    onChange={(e) => {
                      setDrafts((d) => ({
                        ...d,
                        [key]: { ...draft, wcaId: e.target.value },
                      }))
                    }}
                    disabled={isBusy}
                    placeholder="WCA ID"
                  />
                  <Input
                    value={draft.transferTargets}
                    onChange={(e) => {
                      setDrafts((d) => ({
                        ...d,
                        [key]: { ...draft, transferTargets: e.target.value },
                      }))
                    }}
                    disabled={isBusy}
                    placeholder="Transfer WCA IDs (comma-separated)"
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => void handleSave(volunteer)}
                    >
                      <Save className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isBusy}
                      onClick={() => {
                        setDeleteTarget(volunteer)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="grid gap-2 border-t pt-4 md:grid-cols-[1fr_0.8fr_1.2fr_auto]">
          <Input
            value={newDraft.name}
            onChange={(e) => {
              setNewDraft((d) => ({ ...d, name: e.target.value }))
            }}
            disabled={isCreating}
            placeholder="Name"
          />
          <Input
            value={newDraft.wcaId}
            onChange={(e) => {
              setNewDraft((d) => ({ ...d, wcaId: e.target.value }))
            }}
            disabled={isCreating}
            placeholder="WCA ID"
          />
          <Input
            value={newDraft.transferTargets}
            onChange={(e) => {
              setNewDraft((d) => ({ ...d, transferTargets: e.target.value }))
            }}
            disabled={isCreating}
            placeholder="Transfer WCA IDs (optional)"
          />
          <Button
            onClick={() => void handleCreate()}
            disabled={isCreating}
            size="sm"
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </div>
      </CardContent>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete volunteer?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} will be removed from the volunteers list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget !== null) {
                  void handleDelete(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
