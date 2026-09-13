import { Badge } from "@/components/ui/badge"
import type { ItemGroup } from "@/features/list-views/group-items"
import type { ReactNode } from "react"

function KanbanColumn<TItem>({
  group,
  renderCard,
  getItemKey,
  emptyLabel,
}: {
  group: ItemGroup<TItem>
  renderCard: (item: TItem) => ReactNode
  getItemKey: (item: TItem) => string
  emptyLabel: string
}) {
  return (
    <section className="flex w-full flex-col rounded-xl border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h3 className="truncate text-sm font-semibold capitalize">
          {group.title}
        </h3>
        <Badge variant="secondary" className="ml-auto shrink-0 tabular-nums">
          {group.items.length}
        </Badge>
      </div>
      <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
        {group.items.length > 0 ? (
          group.items.map((item) => (
            <div key={getItemKey(item)}>{renderCard(item)}</div>
          ))
        ) : (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  )
}

export function KanbanBoard<TItem>({
  groups,
  renderCard,
  getItemKey,
  emptyLabel = "No items",
}: {
  groups: ItemGroup<TItem>[]
  renderCard: (item: TItem) => ReactNode
  getItemKey: (item: TItem) => string
  emptyLabel?: string
}) {
  return (
    <div className="flex snap-x snap-mandatory scroll-px-3 items-start gap-3 overflow-x-auto overscroll-x-contain p-3 @sm/main:scroll-px-4 @sm/main:p-4 @md/main:snap-none">
      {groups.map((group) => (
        <div
          key={group.key}
          className="w-full max-w-80 shrink-0 snap-start @md/main:w-80"
        >
          <KanbanColumn
            group={group}
            renderCard={renderCard}
            getItemKey={getItemKey}
            emptyLabel={emptyLabel}
          />
        </div>
      ))}
    </div>
  )
}
