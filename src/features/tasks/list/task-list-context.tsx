/* oxlint-disable react/only-export-components -- context + provider colocated */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import type {
  DateRangeFilter,
  DisplaySettings,
  MatchMode,
} from "@/features/list-views/types"
import type { ArrayFilterSetter } from "@/features/list-views/filter-handlers"
import { defaultDisplaySettings } from "@/features/list-views/types"
import type {
  TaskFilterKey,
  TaskListPresetId,
  TaskListViewSnapshot,
  TasksFilters,
} from "@/features/tasks/list/task-list-types"
import {
  countActiveTaskFilterChips,
  countVisibleTaskFilterChips,
} from "@/features/tasks/list/task-list-types"
import {
  emptyOverlayFilters,
  getPresetSnapshot,
  hasOverlayFilters,
  isTeamScoped,
  mergeViewFilters,
  serializeTaskFiltersForPage,
  type TaskListPageConfig,
} from "@/features/tasks/list/task-list-config"
import {
  cloneTasksFilters,
  parseTasksFiltersJson,
  serializeDisplaySettings,
} from "@/features/tasks/list/task-list-serialize"
import {
  readTaskListPageSnapshot,
  writeTaskListPageSnapshot,
} from "@/features/tasks/list/task-list-storage"
import { shouldShowTaskMatchModeToggle } from "@/features/tasks/list/task-list-types"
import { useTaskSavedViews } from "@/features/tasks/list/use-task-saved-views"
import { useQuery } from "convex/react"

const EMPTY_HIDDEN_FILTER_KEYS: readonly TaskFilterKey[] = []
const TEAM_HIDDEN_FILTER_KEYS: readonly TaskFilterKey[] = ["owner"]

export interface TaskListContextValue {
  config: TaskListPageConfig
  viewFilters: TasksFilters
  viewMatchMode: MatchMode
  overlayFilters: TasksFilters
  overlayMatchMode: MatchMode
  matchMode: MatchMode
  display: DisplaySettings
  activeViewId: Id<"savedViews"> | null
  activePresetId: TaskListPresetId | null
  isDirty: boolean
  hasActiveFilters: boolean
  hasVisibleFilterChips: boolean
  canClearFilters: boolean
  showMatchModeToggle: boolean
  hiddenFilterKeys: readonly TaskFilterKey[]
  lockedFilters: TasksFilters | null
  editFilters: TasksFilters
  editMatchMode: MatchMode
  setMatchMode: (matchMode: MatchMode) => void
  setArrayFilter: ArrayFilterSetter<TaskFilterKey>
  setDueDate: (range: DateRangeFilter | undefined) => void
  setEditArrayFilter: ArrayFilterSetter<TaskFilterKey>
  setEditDueDate: (range: DateRangeFilter | undefined) => void
  setEditMatchMode: (matchMode: MatchMode) => void
  setDisplay: (display: DisplaySettings) => void
  clearOverlay: () => void
  clearEditableFilters: () => void
  applyPreset: (presetId: TaskListPresetId) => void
  savedViews: ReturnType<typeof useTaskSavedViews>
  createViewOpen: boolean
  setCreateViewOpen: (open: boolean) => void
  createViewName: string
  setCreateViewName: (name: string) => void
  createViewDescription: string
  setCreateViewDescription: (description: string) => void
  createViewPublic: boolean
  setCreateViewPublic: (isPublic: boolean) => void
  handleSaveNewView: () => Promise<void>
}

export const TaskListContext = createContext<TaskListContextValue | null>(null)

function useTaskListState(config: TaskListPageConfig): TaskListContextValue {
  const currentUser = useQuery(api.users.queries.currentUser)
  const userId = currentUser?._id ?? null

  const storedSnapshot = useMemo(
    () => readTaskListPageSnapshot(config.pageId),
    [config.pageId]
  )

  const initialPresetId =
    storedSnapshot?.activeViewId !== null &&
    storedSnapshot?.activeViewId !== undefined
      ? config.defaultPreset
      : (storedSnapshot?.activePresetId ?? config.defaultPreset)

  const initialPreset = useMemo(
    () => getPresetSnapshot(initialPresetId, userId),
    [initialPresetId, userId]
  )

  const [viewBaseline, setViewBaseline] = useState(() => ({
    filters: cloneTasksFilters(initialPreset.filters),
    matchMode: initialPreset.matchMode,
  }))
  const [overlayFilters, setOverlayFilters] = useState<TasksFilters>(() =>
    storedSnapshot !== null
      ? cloneTasksFilters(storedSnapshot.overlayFilters)
      : emptyOverlayFilters()
  )
  const [overlayMatchMode, setOverlayMatchMode] = useState<
    MatchMode | undefined
  >(() => storedSnapshot?.overlayMatchMode)
  const [display, setDisplay] = useState<DisplaySettings>(() => {
    return storedSnapshot?.display ?? defaultDisplaySettings
  })
  const pendingStoredViewId = useRef(storedSnapshot?.activeViewId ?? null)
  const [activeViewId, setActiveViewId] = useState<Id<"savedViews"> | null>(
    null
  )
  const [activePresetId, setActivePresetId] = useState<TaskListPresetId | null>(
    () =>
      storedSnapshot?.activeViewId != null
        ? null
        : (storedSnapshot?.activePresetId ?? config.defaultPreset)
  )

  const presetBaseline = useMemo(
    () =>
      activePresetId !== null && activeViewId === null
        ? getPresetSnapshot(activePresetId, userId)
        : null,
    [activePresetId, activeViewId, userId]
  )
  const baseline = presetBaseline ?? viewBaseline
  const combinedFilters = useMemo(
    () => mergeViewFilters(baseline.filters, overlayFilters),
    [baseline.filters, overlayFilters]
  )
  const userMatchMode = overlayMatchMode ?? "all"
  const combinedMatchMode = useMemo(
    () =>
      hasOverlayFilters(overlayFilters) ? userMatchMode : baseline.matchMode,
    [baseline.matchMode, overlayFilters, userMatchMode]
  )
  const [createViewOpen, setCreateViewOpen] = useState(false)
  const [createViewName, setCreateViewName] = useState("")
  const [createViewDescription, setCreateViewDescription] = useState("")
  const [createViewPublic, setCreateViewPublic] = useState(false)

  const applySnapshot = useCallback((snapshot: TaskListViewSnapshot) => {
    setViewBaseline({
      filters: cloneTasksFilters(snapshot.baselineFilters),
      matchMode: snapshot.baselineMatchMode,
    })
    setOverlayFilters(emptyOverlayFilters())
    setOverlayMatchMode(undefined)
    setDisplay(snapshot.display)
    setActiveViewId(snapshot.activeViewId)
    setActivePresetId(snapshot.activePresetId)
    pendingStoredViewId.current = null
  }, [])

  const savedViews = useTaskSavedViews({
    config,
    userId,
    filters: combinedFilters,
    matchMode: combinedMatchMode,
    display,
    activeViewId,
    applySnapshot,
  })

  useEffect(() => {
    const viewId = pendingStoredViewId.current
    if (viewId === null) return
    if (!savedViews.isLoaded) return

    const view = savedViews.views.find((entry) => entry._id === viewId)
    if (view === undefined) {
      const preset = getPresetSnapshot(config.defaultPreset, userId)
      setViewBaseline({
        filters: cloneTasksFilters(preset.filters),
        matchMode: preset.matchMode,
      })
      setActiveViewId(null)
      setActivePresetId(config.defaultPreset)
      pendingStoredViewId.current = null
      return
    }

    const parsed = parseTasksFiltersJson(view.filtersJson)
    setViewBaseline({
      filters: cloneTasksFilters(parsed.filters),
      matchMode: parsed.matchMode,
    })
    setActiveViewId(view._id)
    setActivePresetId(null)
    pendingStoredViewId.current = null
  }, [config.defaultPreset, savedViews.isLoaded, savedViews.views, userId])

  useEffect(() => {
    if (pendingStoredViewId.current !== null) return
    writeTaskListPageSnapshot(config.pageId, {
      activePresetId: activeViewId !== null ? null : activePresetId,
      activeViewId,
      overlayFilters,
      overlayMatchMode,
      display,
    })
  }, [
    activePresetId,
    activeViewId,
    config.pageId,
    display,
    overlayFilters,
    overlayMatchMode,
  ])

  const activeView = useMemo(
    () => savedViews.views.find((view) => view._id === activeViewId) ?? null,
    [activeViewId, savedViews.views]
  )

  const hasActiveFilters = useMemo(
    () => hasOverlayFilters(overlayFilters),
    [overlayFilters]
  )

  const isDirty = useMemo(() => {
    const filtersJson = serializeTaskFiltersForPage(
      config.scope,
      combinedFilters,
      combinedMatchMode
    )
    const displayJson = serializeDisplaySettings(display)

    if (activeView !== null) {
      return (
        filtersJson !== activeView.filtersJson ||
        displayJson !== activeView.displaySettingsJson
      )
    }

    return (
      hasOverlayFilters(overlayFilters) ||
      displayJson !== serializeDisplaySettings(defaultDisplaySettings)
    )
  }, [
    activeView,
    config.scope,
    combinedFilters,
    combinedMatchMode,
    display,
    overlayFilters,
  ])

  const applyPreset = useCallback(
    (presetId: TaskListPresetId) => {
      const preset = getPresetSnapshot(presetId, userId)
      applySnapshot({
        baselineFilters: preset.filters,
        baselineMatchMode: preset.matchMode,
        display,
        activeViewId: null,
        activePresetId: presetId,
      })
    },
    [applySnapshot, display, userId]
  )

  const setArrayFilter = useCallback<ArrayFilterSetter<TaskFilterKey>>(
    (key, value) => {
      setOverlayFilters((current) => ({ ...current, [key]: value }))
    },
    []
  )

  const setDueDate = useCallback((range: DateRangeFilter | undefined) => {
    setOverlayFilters((current) => ({ ...current, dueDate: range }))
  }, [])

  const setMatchMode = useCallback((nextMatchMode: MatchMode) => {
    if (nextMatchMode === "all") {
      setOverlayMatchMode(undefined)
    } else {
      setOverlayMatchMode(nextMatchMode)
    }
  }, [])

  const clearOverlay = useCallback(() => {
    setOverlayFilters(emptyOverlayFilters())
    setOverlayMatchMode(undefined)
  }, [])

  const setViewArrayFilter = useCallback<ArrayFilterSetter<TaskFilterKey>>(
    (key, value) => {
      setViewBaseline((current) => ({
        ...current,
        filters: { ...current.filters, [key]: value },
      }))
    },
    []
  )

  const setViewDueDate = useCallback((range: DateRangeFilter | undefined) => {
    setViewBaseline((current) => ({
      ...current,
      filters: { ...current.filters, dueDate: range },
    }))
  }, [])

  const setViewMatchMode = useCallback((mode: MatchMode) => {
    setViewBaseline((current) => ({ ...current, matchMode: mode }))
  }, [])

  const isSavedViewActive = activeViewId !== null
  const editFilters = isSavedViewActive ? baseline.filters : overlayFilters
  const editMatchMode = isSavedViewActive ? baseline.matchMode : userMatchMode
  const lockedFilters = isSavedViewActive ? null : baseline.filters

  const setEditArrayFilter = useCallback<ArrayFilterSetter<TaskFilterKey>>(
    (key, value) => {
      if (activeViewId !== null) {
        setViewArrayFilter(key, value)
      } else {
        setArrayFilter(key, value)
      }
    },
    [activeViewId, setViewArrayFilter, setArrayFilter]
  )

  const setEditDueDate = useCallback(
    (range: DateRangeFilter | undefined) => {
      if (activeViewId !== null) {
        setViewDueDate(range)
      } else {
        setDueDate(range)
      }
    },
    [activeViewId, setViewDueDate, setDueDate]
  )

  const setEditMatchMode = useCallback(
    (mode: MatchMode) => {
      if (activeViewId !== null) {
        setViewMatchMode(mode)
      } else {
        setMatchMode(mode)
      }
    },
    [activeViewId, setViewMatchMode, setMatchMode]
  )

  const clearEditableFilters = useCallback(() => {
    if (activeViewId !== null) {
      setViewBaseline({ filters: emptyOverlayFilters(), matchMode: "all" })
    } else {
      clearOverlay()
    }
  }, [activeViewId, clearOverlay])

  const hiddenFilterKeys = isTeamScoped(config)
    ? TEAM_HIDDEN_FILTER_KEYS
    : EMPTY_HIDDEN_FILTER_KEYS

  const hasVisibleFilterChips = useMemo(
    () =>
      (lockedFilters !== null &&
        countVisibleTaskFilterChips(lockedFilters, hiddenFilterKeys) > 0) ||
      countVisibleTaskFilterChips(editFilters, hiddenFilterKeys) > 0,
    [lockedFilters, editFilters, hiddenFilterKeys]
  )

  const canClearFilters = useMemo(
    () => countActiveTaskFilterChips(editFilters) > 0,
    [editFilters]
  )

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
  }, [createViewDescription, createViewName, createViewPublic, savedViews])

  return {
    config,
    viewFilters: baseline.filters,
    viewMatchMode: baseline.matchMode,
    overlayFilters,
    overlayMatchMode: userMatchMode,
    matchMode: userMatchMode,
    display,
    activeViewId,
    activePresetId,
    isDirty,
    hasActiveFilters,
    hasVisibleFilterChips,
    canClearFilters,
    showMatchModeToggle: shouldShowTaskMatchModeToggle(editFilters),
    hiddenFilterKeys,
    lockedFilters,
    editFilters,
    editMatchMode,
    setMatchMode,
    setArrayFilter,
    setDueDate,
    setEditArrayFilter,
    setEditDueDate,
    setEditMatchMode,
    setDisplay,
    clearOverlay,
    clearEditableFilters,
    applyPreset,
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
  config,
  children,
}: {
  config: TaskListPageConfig
  children: ReactNode
}) {
  return (
    <TaskListContext value={useTaskListState(config)}>
      {children}
    </TaskListContext>
  )
}

export function useTaskListPage() {
  const value = use(TaskListContext)
  if (!value) {
    throw new Error("useTaskListPage must be used within TaskListProvider")
  }
  return value
}
