import { createContext } from "react"
import type { Id } from "@/convex/_generated/dataModel"
import type { DateRangeFilter, DisplaySettings, MatchMode } from "@/features/list-views/types"
import type { TasksFilters } from "@/features/tasks/list/task-list-types"
import type { useTaskSavedViews } from "@/features/tasks/list/use-task-saved-views"

export interface TaskListContextValue {
  pageId: string
  filters: TasksFilters
  matchMode: MatchMode
  display: DisplaySettings
  activeViewId: Id<"savedViews"> | null
  isDirty: boolean
  hasActiveFilters: boolean
  showMatchModeToggle: boolean
  setMatchMode: (matchMode: MatchMode) => void
  setArrayFilter: <K extends keyof TasksFilters>(
    key: K,
    value: TasksFilters[K]
  ) => void
  setDueDate: (range: DateRangeFilter | undefined) => void
  setDisplay: (display: DisplaySettings) => void
  clearFilters: () => void
  resetAll: () => void
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
