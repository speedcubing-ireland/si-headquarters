import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { DisplaySettings, MatchMode } from "@/features/list-views/types"
import { defaultDisplaySettings } from "@/features/list-views/types"
import {
  cloneTasksFilters,
  parseDisplaySettingsJson,
  parseTasksFiltersJson,
  serializeDisplaySettings,
  serializeTaskFilters,
} from "@/features/tasks/list/task-list-serialize"
import {
  emptyTasksFilters,
  type TasksFilters,
} from "@/features/tasks/list/task-list-types"
import { useMutation, useQuery } from "convex/react"
import { useCallback } from "react"

export type SavedViewRecord = {
  _id: Id<"savedViews">
  ownerId: Id<"users">
  visibility: "private" | "public"
  name: string
  description: string | null
  filtersJson: string
  displaySettingsJson: string
  lastUsedAt: number | null
}

export function useTaskSavedViews({
  pageId,
  filters,
  matchMode,
  display,
  activeViewId,
  applySnapshot,
}: {
  pageId: string
  filters: TasksFilters
  matchMode: MatchMode
  display: DisplaySettings
  activeViewId: Id<"savedViews"> | null
  applySnapshot: (snapshot: {
    filters: TasksFilters
    matchMode: MatchMode
    display: DisplaySettings
    activeViewId: Id<"savedViews"> | null
  }) => void
}) {
  const views = useQuery(api.views.queries.listViews, {
    entity: "tasks",
    pageId,
  })
  const createView = useMutation(api.views.mutations.createView)
  const updateView = useMutation(api.views.mutations.updateView)
  const deleteViewMutation = useMutation(api.views.mutations.deleteView)
  const touchView = useMutation(api.views.mutations.touchView)

  const applyView = useCallback(
    (view: SavedViewRecord) => {
      const parsedFilters = parseTasksFiltersJson(view.filtersJson)
      applySnapshot({
        filters: parsedFilters.filters,
        matchMode: parsedFilters.matchMode,
        display: parseDisplaySettingsJson(view.displaySettingsJson),
        activeViewId: view._id,
      })
      void touchView({ id: view._id })
    },
    [applySnapshot, touchView]
  )

  const createCurrentView = useCallback(
    async (
      name: string,
      description: string | null,
      visibility: "private" | "public"
    ) => {
      const id = await createView({
        entity: "tasks",
        pageId,
        name,
        description: description ?? undefined,
        visibility,
        filtersJson: serializeTaskFilters(filters, matchMode),
        displaySettingsJson: serializeDisplaySettings(display),
      })
      applySnapshot({
        filters,
        matchMode,
        display,
        activeViewId: id,
      })
      return id
    },
    [applySnapshot, createView, display, filters, matchMode, pageId]
  )

  const saveActiveView = useCallback(async () => {
    if (!activeViewId) return
    await updateView({
      id: activeViewId,
      filtersJson: serializeTaskFilters(filters, matchMode),
      displaySettingsJson: serializeDisplaySettings(display),
    })
  }, [activeViewId, display, filters, matchMode, updateView])

  const deleteView = useCallback(
    async (viewId: Id<"savedViews">) => {
      await deleteViewMutation({ id: viewId })
      if (activeViewId === viewId) {
        applySnapshot({
          filters: cloneTasksFilters(emptyTasksFilters),
          matchMode: "all",
          display: defaultDisplaySettings,
          activeViewId: null,
        })
      }
    },
    [activeViewId, applySnapshot, deleteViewMutation]
  )

  return {
    views: views ?? [],
    activeViewId,
    applyView,
    createCurrentView,
    saveActiveView,
    deleteView,
  }
}
