import { Badge } from "@/components/ui/badge"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { ItemGroup } from "@/features/list-views/group-items"
import {
  MAIN_CONTAINER_MD_WIDTH,
  useMainContainer,
} from "@/components/layout/main-container"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useEffect, useState, type ReactNode } from "react"

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
    <div className="flex h-full flex-col rounded-xl border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h3 className="truncate text-sm font-semibold capitalize">
          {group.title}
        </h3>
        <Badge variant="secondary" className="ml-auto shrink-0 tabular-nums">
          {group.items.length}
        </Badge>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {group.items.length > 0 ? (
          group.items.map((item) => (
            <div key={getItemKey(item)}>{renderCard(item)}</div>
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanDots({
  count,
  selectedIndex,
  onSelect,
}: {
  count: number
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  if (count <= 1) return null

  return (
    <div className="flex justify-center gap-1.5 py-3">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Go to column ${String(index + 1)}`}
          className={cn(
            "size-1.5 rounded-full transition-colors",
            index === selectedIndex ? "bg-primary" : "bg-muted-foreground/30"
          )}
          onClick={() => {
            onSelect(index)
          }}
        />
      ))}
    </div>
  )
}

function MobileKanbanCarousel<TItem>({
  groups,
  renderCard,
  getItemKey,
  emptyLabel,
}: {
  groups: ItemGroup<TItem>[]
  renderCard: (item: TItem) => ReactNode
  getItemKey: (item: TItem) => string
  emptyLabel: string
}) {
  const [api, setApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (!api) return
    const onSelect = () => {
      setSelectedIndex(api.selectedScrollSnap())
    }
    onSelect()
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Carousel
        setApi={setApi}
        opts={{ align: "center", containScroll: "trimSnaps", loop: false }}
        className="w-full flex-1"
      >
        <CarouselContent className="-ml-3">
          {groups.map((group) => (
            <CarouselItem
              key={group.key}
              className="basis-[82%] pl-3 @sm/main:basis-[78%]"
            >
              <KanbanColumn
                group={group}
                renderCard={renderCard}
                getItemKey={getItemKey}
                emptyLabel={emptyLabel}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <KanbanDots
        count={groups.length}
        selectedIndex={selectedIndex}
        onSelect={(index) => {
          api?.scrollTo(index)
        }}
      />
    </div>
  )
}

function DesktopKanbanScroll<TItem>({
  groups,
  renderCard,
  getItemKey,
  emptyLabel,
}: {
  groups: ItemGroup<TItem>[]
  renderCard: (item: TItem) => ReactNode
  getItemKey: (item: TItem) => string
  emptyLabel: string
}) {
  return (
    <div className="flex gap-3 overflow-x-auto p-3 @sm/main:p-4">
      {groups.map((group) => (
        <div key={group.key} className="flex w-72 shrink-0 flex-col">
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
  const isMobileViewport = useIsMobile()
  const { width } = useMainContainer()
  const useCarousel =
    isMobileViewport || (width > 0 && width < MAIN_CONTAINER_MD_WIDTH)

  if (useCarousel) {
    return (
      <MobileKanbanCarousel
        groups={groups}
        renderCard={renderCard}
        getItemKey={getItemKey}
        emptyLabel={emptyLabel}
      />
    )
  }

  return (
    <DesktopKanbanScroll
      groups={groups}
      renderCard={renderCard}
      getItemKey={getItemKey}
      emptyLabel={emptyLabel}
    />
  )
}
