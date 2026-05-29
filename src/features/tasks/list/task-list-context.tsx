import type { Id } from "@/convex/_generated/dataModel"
import type { DateRangeFilter, DisplaySettings, MatchMode } from "@/features/list-views/types"
import { defaultDisplaySettings } from "@/features/list-views/types"
import { TaskListContext } from "@/features/tasks/list/task-list-context-types"
import type { TaskListContextValue } from "@/features/tasks/list/task-list-context-types"
import {
  cloneTasksFilters,
  serializeDisplaySettings,
  serializeTaskFilters,
} from "@/features/tasks/list/task-list-serialize"
import { readTaskListPageSnapshot, writeTaskListPageSnapshot } from "@/features/tasks/list/task-list-storage"
import {
  emptyTasksFilters,
  hasActiveTaskFilters,
  shouldShowTaskMatchModeToggle,
  type TasksFilters,
} from "@/features/tasks/list/task-list-types"
import { useTaskSavedViews } from "@/features/tasks/list/use-task-saved-views"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

function useTaskListState(pageId: string): TaskListContextValue {
  const storedSnapshot = readTaskListPageSnapshot(pageId)

  const [filters, setFilters] = useState<TasksFilters>(
    () => storedSnapshot?.filters ?? cloneTasksFilters(emptyTasksFilters)
  )
  const [matchMode, setMatchMode] = useState<MatchMode>(
    () => storedSnapshot?.matchMode ?? "all"
  )
  const [display, setDisplay] = useState<DisplaySettings>(
    () => storedSnapshot?.display ?? defaultDisplaySettings
  )
  const [activeViewId, setActiveViewId] = useState<Id<"savedViews"> | null>(null)
  const [createViewOpen, setCreateViewOpen] = useState(false)
  const [createViewName, setCreateViewName] = useState("")
  const [createViewDescription, setCreateViewDescription] = useState("")
  const [createViewPublic, setCreateViewPublic] = useState(false)

  const applySnapshot = useCallback(
    (snapshot: {
      filters: TasksFilters
      matchMode: MatchMode
      display: DisplaySettings
      activeViewId: Id<"savedViews"> | null
    }) => {
      setFilters(snapshot.filters)
      setMatchMode(snapshot.matchMode)
      setDisplay(snapshot.display)
      setActiveViewId(snapshot.activeViewId)
    },
    []
  )

  const savedViews = useTaskSavedViews({
    pageId,
    filters,
    matchMode,
    display,
    activeViewId,
    applySnapshot,
  })

  useEffect(() => {
    writeTaskListPageSnapshot(pageId, {
      filters,
      matchMode,
      display,
    })
  }, [display, filters, matchMode, pageId])

  const activeView = useMemo(
    () => savedViews.views.find((view) => view._id === activeViewId) ?? null,
    [activeViewId, savedViews.views]
  )

  const isDirty = useMemo(() => {
    if (activeView === null) {
      return (
        serializeTaskFilters(filters, matchMode) !==
          serializeTaskFilters(emptyTasksFilters, "all") ||
        serializeDisplaySettings(display) !==
          serializeDisplaySettings(defaultDisplaySettings)
      )
    }
    return (
      serializeTaskFilters(filters, matchMode) !== activeView.filtersJson ||
      serializeDisplaySettings(display) !== activeView.displaySettingsJson
    )
  }, [activeView, display, filters, matchMode])

  const setArrayFilter = useCallback(
    <K extends keyof TasksFilters>(key: K, value: TasksFilters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }))
    },
    []
  )

  const setDueDate = useCallback((range: DateRangeFilter | undefined) => {
    setFilters((current) => ({ ...current, dueDate: range }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(cloneTasksFilters(emptyTasksFilters))
    setMatchMode("all")
  }, [])

  const resetAll = useCallback(() => {
    applySnapshot({
      filters: cloneTasksFilters(emptyTasksFilters),
      matchMode: "all",
      display: defaultDisplaySettings,
      activeViewId: null,
    })
    setCreateViewOpen(false)
    setCreateViewName("")
    setCreateViewDescription("")
    setCreateViewPublic(false)
  }, [applySnapshot])

  const handleSaveNewView = useCallback(async () => {
    const name = createViewName.trim()
    if (name.length === 0) return
    const description = createViewDescription.trim()
    await savedViews.createCurrentView(
      name,
      description.length > 0 ? description : null,
      createViewPublic ? "public" : "private"
    )
    setCreateViewOpen(false)
    setCreateViewName("")
    setCreateViewDescription("")
    setCreateViewPublic(false)
  }, [
    createViewDescription,
    createViewName,
    createViewPublic,
    savedViews,
  ])

  return {
    pageId,
    filters,
    matchMode,
    display,
    activeViewId,
    isDirty,
    hasActiveFilters: hasActiveTaskFilters(filters),
    showMatchModeToggle: shouldShowTaskMatchModeToggle(filters),
    setMatchMode,
    setArrayFilter,
    setDueDate,
    setDisplay,
    clearFilters,
    resetAll,
    savedViews,
    createViewOpen,
    setCreateViewOpen,
    createViewName,
    setCreateViewName,
    createViewDescription,
    setCreateViewDescription,
    createViewPublic,
    setCreateViewPublic,
    handleSaveNewView,
  }
}

export function TaskListProvider({
  pageId,
  children,
}: {
  pageId: string
  children: ReactNode
}) {
  return (
    <TaskListContext value={useTaskListState(pageId)}>{children}</TaskListContext>
  )
}
