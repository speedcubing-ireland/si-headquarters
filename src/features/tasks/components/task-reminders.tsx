import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { addDays, set } from "date-fns"
import { fromZonedTime, toZonedTime } from "date-fns-tz"
import {
  AlarmClockPlusIcon,
  BellRingIcon,
  CalendarClockIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const DUBLIN_TZ = "Europe/Dublin"

function nextDublinEightAm(nowMs = Date.now()) {
  const dublinEightAmOnDay = (dayOffset: number) => {
    const inDublin = toZonedTime(new Date(nowMs), DUBLIN_TZ)
    const target = set(addDays(inDublin, dayOffset), {
      hours: 8,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    })
    return fromZonedTime(target, DUBLIN_TZ).getTime()
  }

  const candidate = dublinEightAmOnDay(1)
  return candidate <= nowMs ? dublinEightAmOnDay(2) : candidate
}

function formatReminderTime(remindAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(remindAt))
}

function toDateTimeLocalValue(ms: number) {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function TaskRemindersDialog({ taskId }: { taskId: Id<"tasks"> }) {
  const createReminder = useMutation(api.notifications.reminders.createForTask)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [customValue, setCustomValue] = useState(() =>
    toDateTimeLocalValue(Date.now() + 60 * 60 * 1000)
  )
  const [preset, setPreset] = useState<"1h" | "tomorrow" | "custom">("1h")
  const [isSaving, setIsSaving] = useState(false)

  const reminderTime = () => {
    if (preset === "1h") return Date.now() + 60 * 60 * 1000
    if (preset === "tomorrow") return nextDublinEightAm()
    return new Date(customValue).getTime()
  }
  const handleCreateReminder = async () => {
    setIsSaving(true)
    try {
      await createReminder({
        taskId,
        remindAt: reminderTime(),
        message: message.trim() || null,
      })
      setMessage("")
      setOpen(false)
      toast.success("Reminder scheduled.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not schedule reminder."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          <AlarmClockPlusIcon />
          Reminders
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Task reminder</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <FieldSet>
            <Field>
              <FieldLabel>When</FieldLabel>
              <ToggleGroup
                type="single"
                value={preset}
                variant="outline"
                spacing={0}
                className="w-full"
                onValueChange={(value) => {
                  if (
                    value === "1h" ||
                    value === "tomorrow" ||
                    value === "custom"
                  ) {
                    setPreset(value)
                  }
                }}
              >
                <ToggleGroupItem className="flex-1" value="1h">
                  1h
                </ToggleGroupItem>
                <ToggleGroupItem className="flex-1" value="tomorrow">
                  Tomorrow
                </ToggleGroupItem>
                <ToggleGroupItem className="flex-1" value="custom">
                  Custom
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {preset === "custom" && (
              <Field>
                <FieldLabel htmlFor="task-reminder-at">
                  Date and time
                </FieldLabel>
                <Input
                  id="task-reminder-at"
                  type="datetime-local"
                  value={customValue}
                  onChange={(event) => {
                    setCustomValue(event.target.value)
                  }}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="task-reminder-message">Message</FieldLabel>
              <Textarea
                id="task-reminder-message"
                value={message}
                placeholder="Optional message"
                onChange={(event) => {
                  setMessage(event.target.value)
                }}
              />
            </Field>
          </FieldSet>
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={isSaving}
            onClick={() => {
              void handleCreateReminder()
            }}
          >
            <CalendarClockIcon />
            Create reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TaskPendingReminders({ taskId }: { taskId: Id<"tasks"> }) {
  const reminders = useQuery(api.notifications.reminders.listForTask, {
    taskId,
  })
  const cancelReminder = useMutation(api.notifications.reminders.cancel)
  const [cancellingId, setCancellingId] = useState<Id<"taskReminders"> | null>(
    null
  )
  const handleCancelReminder = async (reminderId: Id<"taskReminders">) => {
    setCancellingId(reminderId)
    try {
      await cancelReminder({ reminderId })
      toast.success("Reminder cancelled.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not cancel reminder."
      )
    } finally {
      setCancellingId(null)
    }
  }

  if (reminders === undefined || reminders.length === 0) return null

  return (
    <section className="col-span-full rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <BellRingIcon className="size-4" />
        Pending reminders
      </div>
      <div className="grid gap-2">
        {reminders.map((reminder) => (
          <div
            key={reminder._id}
            className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm">
                {formatReminderTime(reminder.remindAt)}
              </div>
              {reminder.message !== null && (
                <div className="truncate text-xs text-muted-foreground">
                  {reminder.message}
                </div>
              )}
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={cancellingId === reminder._id}
              aria-label="Cancel reminder"
              onClick={() => {
                void handleCancelReminder(reminder._id)
              }}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
