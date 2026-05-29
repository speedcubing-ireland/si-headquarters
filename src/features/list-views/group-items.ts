export interface ItemGroup<TItem> {
  key: string
  title: string
  items: TItem[]
}

export function groupItems<TItem>(
  items: TItem[],
  grouping: string | null,
  resolve: (item: TItem, grouping: string) => { key: string; title: string }
): ItemGroup<TItem>[] {
  if (grouping === null) {
    return [{ key: "all", title: "All", items }]
  }

  const groups = new Map<string, ItemGroup<TItem>>()
  for (const item of items) {
    const { key, title } = resolve(item, grouping)
    const group = groups.get(key) ?? { key, title, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }

  return [...groups.values()]
}
