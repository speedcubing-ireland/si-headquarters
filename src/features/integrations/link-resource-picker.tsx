import * as DataSelector from "@/components/data-selectors/data-selector"
import type { BuiltSelectorOptions } from "@/components/data-selectors/selector-options"
import { LinkActionShell } from "@/features/integrations/link-action-shell"
import type { LucideIcon } from "lucide-react"

export function LinkResourcePicker<TItem, TValue>({
  triggerIcon: TriggerIcon,
  triggerIconClassName,
  triggerLabel,
  objectNoun,
  model,
  open,
  pending,
  searchable,
  searchQuery,
  onSearchChange,
  loading,
  emptyMessage,
  onOpenChange,
  onPick,
  error,
}: {
  triggerIcon: LucideIcon
  triggerIconClassName?: string
  triggerLabel: string
  objectNoun: string
  model: BuiltSelectorOptions<TItem, TValue>
  open: boolean
  pending: boolean
  searchable?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
  loading?: boolean
  emptyMessage?: string
  onOpenChange: (open: boolean) => void
  onPick: (value: TValue) => void | Promise<void>
  error: string | null
}) {
  return (
    <LinkActionShell error={error}>
      <DataSelector.PickRoot
        model={model}
        open={open}
        pending={pending}
        searchable={searchable}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onOpenChange={onOpenChange}
        onPick={(value) => {
          void onPick(value)
        }}
      >
        <DataSelector.ButtonTrigger disabled={pending}>
          <TriggerIcon className={triggerIconClassName} />
          {triggerLabel}
        </DataSelector.ButtonTrigger>
        <DataSelector.PickContent
          model={model}
          objectNoun={objectNoun}
          loading={loading}
          emptyMessage={emptyMessage}
          searchable={searchable}
        />
      </DataSelector.PickRoot>
    </LinkActionShell>
  )
}
