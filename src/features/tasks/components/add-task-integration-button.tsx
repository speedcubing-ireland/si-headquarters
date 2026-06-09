import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { INTEGRATION_PLUGINS } from "@/plugins/integrations/registry"
import { useMutation, useQuery } from "convex/react"
import { CableIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"

type AddTaskIntegrationButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick"
> & {
  taskId: Id<"tasks">
}

export function AddTaskIntegrationButton({
  taskId,
  variant = "outline",
  children,
  disabled,
  ...buttonProps
}: AddTaskIntegrationButtonProps) {
  const available = useQuery(
    api.integrations.taskIntegrations.queries.listAvailableForTask,
    {
      taskId,
    }
  )
  const attach = useMutation(api.integrations.taskIntegrations.mutations.attach)
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const isLoading = available === undefined
  const options = available ?? []

  const label = children ?? (
    <>
      <CableIcon />
      Add Integration
    </>
  )

  if (isLoading || options.length === 0) {
    return (
      <Button
        {...buttonProps}
        variant={variant}
        type="button"
        disabled={disabled ?? (isLoading || options.length === 0)}
      >
        {label}
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          {...buttonProps}
          variant={variant}
          type="button"
          disabled={disabled}
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search integrations..." />
          <CommandList>
            <CommandEmpty>No integrations available.</CommandEmpty>
            <CommandGroup>
              {options.map((def) => {
                const plugin = INTEGRATION_PLUGINS.find(
                  (entry) => entry.id === def.pluginId
                )
                const Icon = plugin?.adminIcon ?? CableIcon
                return (
                  <CommandItem
                    key={def.id}
                    value={`${def.label} ${def.id}`}
                    disabled={pendingId !== null}
                    onSelect={() => {
                      setPendingId(def.id)
                      void attach({ taskId, integrationId: def.id })
                        .then(() => {
                          setOpen(false)
                        })
                        .finally(() => {
                          setPendingId(null)
                        })
                    }}
                  >
                    <Icon />
                    <div className="min-w-0">
                      <p className="truncate">{def.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {def.id}
                      </p>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
