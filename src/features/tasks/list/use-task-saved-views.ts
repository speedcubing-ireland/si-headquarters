import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { DisplaySettings, MatchMode } from "@/features/list-views/types"
import { defaultDisplaySettings } from "@/features/list-views/types"
import {
  getPresetSnapshot,
  serializeTaskFiltersForPage,
  type TaskListPageConfig,
} from "@/features/tasks/list/task-list-config"
import {
  cloneTasksFilters,
  parseDisplaySettingsJson,
  parseTasksFiltersJson,
  serializeDisplaySettings,
} from "@/features/tasks/list/task-list-serialize"
import type {
  TaskListViewSnapshot,
  TasksFilters,
} from "@/features/tasks/list/task-list-types"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useCallback } from "react"

export type SavedTaskView = FunctionReturnType<
  typeof api.views.queries.listViews
>[number]

const EMPTY_SAVED_TASK_VIEWS: SavedTaskView[] = []

export function useTaskSavedViews({
  config,
  userId,
  filters,
  matchMode,
  display,
  activeViewId,
  applySnapshot,
}: {
  config: TaskListPageConfig
  userId: Id<"users"> | null
  filters: TasksFilters
  matchMode: MatchMode
  display: DisplaySettings
  activeViewId: Id<"savedViews"> | null
  applySnapshot: (snapshot: TaskListViewSnapshot) => void
}) {
  const views = useQuery(api.views.queries.listViews, {
    entity: "tasks",
    pageId: config.pageId,
  })
  const createView = useMutation(api.views.mutations.createView)
  const updateView = useMutation(api.views.mutations.updateView)
  const deleteViewMutation = useMutation(api.views.mutations.deleteView)
  const touchView = useMutation(api.views.mutations.touchView)

  const applyView = useCallback(
    (view: SavedTaskView) => {
      const parsedFilters = parseTasksFiltersJson(view.filtersJson)
      applySnapshot({
        baselineFilters: cloneTasksFilters(parsedFilters.filters),
        baselineMatchMode: parsedFilters.matchMode,
        display: parseDisplaySettingsJson(view.displaySettingsJson),
        activeViewId: view._id,
        activePresetId: null,
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
        pageId: config.pageId,
        name,
        description: description ?? undefined,
        visibility,
        filtersJson: serializeTaskFiltersForPage(
          config.scope,
          filters,
          matchMode
        ),
        displaySettingsJson: serializeDisplaySettings(display),
      })
      applySnapshot({
        baselineFilters: cloneTasksFilters(filters),
        baselineMatchMode: matchMode,
        display,
        activeViewId: id,
        activePresetId: null,
      })
      return id
    },
    [
      applySnapshot,
      config.pageId,
      config.scope,
      createView,
      display,
      filters,
      matchMode,
    ]
  )

  const saveActiveView = useCallback(async () => {
    if (!activeViewId) return
    await updateView({
      id: activeViewId,
      filtersJson: serializeTaskFiltersForPage(
        config.scope,
        filters,
        matchMode
      ),
      displaySettingsJson: serializeDisplaySettings(display),
    })
    applySnapshot({
      baselineFilters: cloneTasksFilters(filters),
      baselineMatchMode: matchMode,
      display,
      activeViewId,
      activePresetId: null,
    })
  }, [
    activeViewId,
    applySnapshot,
    config.scope,
    display,
    filters,
    matchMode,
    updateView,
  ])

  const deleteView = useCallback(
    async (viewId: Id<"savedViews">) => {
      await deleteViewMutation({ id: viewId })
      if (activeViewId !== viewId) return
      const preset = getPresetSnapshot(config.defaultPreset, userId)
      applySnapshot({
        baselineFilters: cloneTasksFilters(preset.filters),
        baselineMatchMode: preset.matchMode,
        display: defaultDisplaySettings,
        activeViewId: null,
        activePresetId: config.defaultPreset,
      })
    },
    [
      activeViewId,
      applySnapshot,
      config.defaultPreset,
      deleteViewMutation,
      userId,
    ]
  )

  return {
    views: views ?? EMPTY_SAVED_TASK_VIEWS,
    isLoaded: views !== undefined,
    applyView,
    createCurrentView,
    saveActiveView,
    deleteView,
  }
}
