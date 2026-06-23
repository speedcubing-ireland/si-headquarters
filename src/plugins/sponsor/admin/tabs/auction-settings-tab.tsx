import { useState, type SubmitEvent } from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  useAuctionSettings,
  useAuctionSettingsMutations,
} from "@/plugins/sponsor/hooks/use-sponsorship"

export function AuctionSettingsTab() {
  const { settings, isLoading } = useAuctionSettings()
  const { updateAuctionSettings } = useAuctionSettingsMutations()

  const [startDelayHours, setStartDelayHours] = useState<string>("")
  const [durationHours, setDurationHours] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  const effectiveStartDelay =
    startDelayHours !== ""
      ? startDelayHours
      : String(settings?.startDelayHours ?? "")
  const effectiveDuration =
    durationHours !== "" ? durationHours : String(settings?.durationHours ?? "")

  const isDirty = startDelayHours !== "" || durationHours !== ""

  const onSave = async (event: SubmitEvent) => {
    event.preventDefault()
    const parsedDelay = Number(effectiveStartDelay)
    const parsedDuration = Number(effectiveDuration)
    if (!Number.isInteger(parsedDelay) || parsedDelay < 1) {
      toast.error("Start delay must be a positive whole number of hours.")
      return
    }
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
      toast.error("Duration must be a positive whole number of hours.")
      return
    }
    setIsSaving(true)
    try {
      await updateAuctionSettings({
        startDelayHours: parsedDelay,
        durationHours: parsedDuration,
      })
      toast.success("Auction settings saved.")
      setStartDelayHours("")
      setDurationHours("")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings."
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auction Settings</CardTitle>
        <CardDescription>
          Default timing applied when creating a new auction draft.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void onSave(event)
            }}
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Auction start delay (hours)
              </p>
              <Input
                type="number"
                min="1"
                step="1"
                value={effectiveStartDelay}
                onChange={(e) => {
                  setStartDelayHours(e.target.value)
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Auction duration (hours)
              </p>
              <Input
                type="number"
                min="1"
                step="1"
                value={effectiveDuration}
                onChange={(e) => {
                  setDurationHours(e.target.value)
                }}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSaving || (!isDirty && !isLoading)}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
