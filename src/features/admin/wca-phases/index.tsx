import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { RotateCcwIcon, SaveIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Page } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Dot } from "@/components/data-selectors/phase-selector"
import { api } from "@/convex/_generated/api"
import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import {
  WCA_MILESTONE_DESCRIPTIONS,
  WCA_MILESTONE_LABELS,
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import { formatDateTime } from "@/lib/format/dates"

type MappingSettings = FunctionReturnType<
  typeof api.phases.wcaMappingSettings.get
>
type TemplatePhase = MappingSettings["phases"][number]

const UNMAPPED_VALUE = "__unmapped__"

function toPhaseKeyByMilestone(
  mappings: MappingSettings["mappings"]
): Record<string, string | null> {
  return Object.fromEntries(
    mappings.map((mapping) => [mapping.milestone, mapping.phaseKey])
  )
}

function MilestoneRow({
  milestone,
  phases,
  phaseKey,
  disabled,
  onChange,
}: {
  milestone: WcaMilestone
  phases: readonly TemplatePhase[]
  phaseKey: string | null
  disabled: boolean
  onChange: (phaseKey: string | null) => void
}) {
  const selected = phases.find((phase) => phase.key === phaseKey) ?? null

  return (
    <div className="grid gap-2 border-b py-4 last:border-b-0 sm:grid-cols-2 sm:items-start sm:gap-6">
      <div className="space-y-1">
        <p className="text-sm font-medium">{WCA_MILESTONE_LABELS[milestone]}</p>
        <p className="text-xs text-muted-foreground">
          {WCA_MILESTONE_DESCRIPTIONS[milestone]}
        </p>
      </div>
      <Select
        value={phaseKey ?? UNMAPPED_VALUE}
        disabled={disabled}
        onValueChange={(value) => {
          onChange(value === UNMAPPED_VALUE ? null : value)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {selected === null ? (
              <span className="text-muted-foreground">Not mapped</span>
            ) : (
              <span className="flex items-center gap-2">
                <Dot className="size-2.5" color={selected.color} />
                {selected.name}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNMAPPED_VALUE}>Not mapped</SelectItem>
          {phases.map((phase) => (
            <SelectItem key={phase.key} value={phase.key}>
              <span className="flex items-center gap-2">
                <Dot className="size-2.5" color={phase.color} />
                {phase.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function AdminWcaPhasesPage() {
  const settings = useQuery(api.phases.wcaMappingSettings.get, {})
  const updateMappings = useMutation(api.phases.wcaMappingSettings.update)
  const resetMappings = useMutation(
    api.phases.wcaMappingSettings.resetToDefaults
  )

  const [draft, setDraft] = useState<Record<string, string | null> | null>(null)
  const [busy, setBusy] = useState<"saving" | "resetting" | null>(null)

  const serverMapping = useMemo(
    () =>
      settings === undefined ? null : toPhaseKeyByMilestone(settings.mappings),
    [settings]
  )

  // Adopt the server's mapping whenever it changes underneath us (first load,
  // or another director saving). Local edits are discarded, which is the right
  // call for a settings screen two people rarely edit at once.
  useEffect(() => {
    if (serverMapping !== null) {
      setDraft(serverMapping)
    }
  }, [serverMapping])

  if (settings === undefined || draft === null || serverMapping === null) {
    return <Page.Status variant="loading" message="Loading phase mapping…" />
  }

  const isDirty = WCA_MILESTONES.some(
    (milestone) => draft[milestone] !== serverMapping[milestone]
  )

  const save = async () => {
    setBusy("saving")
    try {
      await updateMappings({
        mappings: WCA_MILESTONES.map((milestone) => ({
          milestone,
          phaseKey: draft[milestone] ?? null,
        })),
      })
      toast.success("Phase mapping saved.")
    } catch (error) {
      toast.error(unknownErrorMessage(error, { includeConvexError: true }))
    } finally {
      setBusy(null)
    }
  }

  const reset = async () => {
    setBusy("resetting")
    try {
      await resetMappings({})
      toast.success("Phase mapping reset to the template defaults.")
    } catch (error) {
      toast.error(unknownErrorMessage(error, { includeConvexError: true }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">WCA phases</h2>
        <p className="text-sm text-muted-foreground">
          Which WCA milestone moves a competition into which phase. The sync
          only ever moves competitions forward, so a phase someone entered early
          is never undone, and milestones left unmapped never move anything.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{settings.templateName}</CardTitle>
          <CardDescription>
            {settings.isCustomised && settings.updatedAt !== null
              ? `Customised — last changed ${formatDateTime(settings.updatedAt)}.`
              : "Using the template's default mapping."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="-my-4">
            {WCA_MILESTONES.map((milestone) => (
              <MilestoneRow
                key={milestone}
                milestone={milestone}
                phases={settings.phases}
                phaseKey={draft[milestone] ?? null}
                disabled={busy !== null}
                onChange={(phaseKey) => {
                  setDraft((current) =>
                    current === null
                      ? current
                      : { ...current, [milestone]: phaseKey }
                  )
                }}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Later milestones must map to later phases. Cancellation is not here:
            the WCA cancelling a competition flags it instead of moving it.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy !== null || !settings.isCustomised}
              onClick={() => void reset()}
            >
              {busy === "resetting" ? <Spinner /> : <RotateCcwIcon />}
              Reset to defaults
            </Button>
            <Button
              disabled={busy !== null || !isDirty}
              onClick={() => void save()}
            >
              {busy === "saving" ? <Spinner /> : <SaveIcon />}
              Save
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
