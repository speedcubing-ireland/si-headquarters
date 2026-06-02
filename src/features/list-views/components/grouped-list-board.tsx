import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ItemGroup } from "@/features/list-views/group-items"
import type { ReactNode } from "react"

function InsetListRows<TItem>({
  items,
  renderRow,
  getRowKey,
}: {
  items: TItem[]
  renderRow: (item: TItem) => ReactNode
  getRowKey: (item: TItem) => string
}) {
  return (
    <>
      {items.map((item) => (
        <div
          key={getRowKey(item)}
          className="border-b border-border last:border-b-0"
        >
          {renderRow(item)}
        </div>
      ))}
    </>
  )
}

function GroupBody<TItem>({
  group,
  renderRow,
  getRowKey,
}: {
  group: ItemGroup<TItem>
  renderRow: (item: TItem) => ReactNode
  getRowKey: (item: TItem) => string
}) {
  if (group.items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        No items in this group
      </p>
    )
  }

  const rows = (
    <InsetListRows
      items={group.items}
      renderRow={renderRow}
      getRowKey={getRowKey}
    />
  )

  if (group.key === "all") {
    return <div className="bg-background">{rows}</div>
  }

  return <div className="mt-2 border-y bg-background">{rows}</div>
}

function GroupSection<TItem>({
  group,
  renderRow,
  getRowKey,
  itemLabel,
}: {
  group: ItemGroup<TItem>
  renderRow: (item: TItem) => ReactNode
  getRowKey: (item: TItem) => string
  itemLabel: (count: number) => string
}) {
  const body = <GroupBody group={group} renderRow={renderRow} getRowKey={getRowKey} />

  if (group.key === "all") {
    return <div className="group rounded-xl border bg-card py-5 text-sm">{body}</div>
  }

  return (
    <Collapsible
      defaultOpen
      className="group rounded-xl border bg-card text-sm data-[state=open]:pb-4"
    >
      <div className="relative flex items-center gap-4 px-4 group-data-[state=closed]:py-2 group-data-[state=open]:pt-2">
        <CollapsibleTrigger
          aria-label={`Toggle ${group.title}`}
          className="absolute inset-0"
        />
        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-4">
          <h3 className="font-heading text-base leading-snug font-semibold capitalize">
            {group.title}
          </h3>
          <Badge variant="outline">{itemLabel(group.items.length)}</Badge>
        </div>
      </div>
      <CollapsibleContent>{body}</CollapsibleContent>
    </Collapsible>
  )
}

export function GroupedListBoard<TItem>({
  groups,
  renderRow,
  getRowKey,
  itemLabel,
}: {
  groups: ItemGroup<TItem>[]
  renderRow: (item: TItem) => ReactNode
  getRowKey: (item: TItem) => string
  itemLabel: (count: number) => string
}) {
  return (
    <div className="flex flex-col gap-3 p-3 @sm/main:p-4">
      {groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          renderRow={renderRow}
          getRowKey={getRowKey}
          itemLabel={itemLabel}
        />
      ))}
    </div>
  )
}
