/// <reference types="vite/client" />

import { describe, expect, test } from "vitest"
import type { Id } from "@/convex/_generated/dataModel"
import {
  buildPhaseSortKeyById,
  isSubtaskRowOverdue,
  isTaskOverdue,
} from "@/convex/tasks/overdue"
import type { TaskInlineRow } from "@/convex/tasks/inlineRow"

const phaseA = "phase-a" as Id<"phases">
const phaseB = "phase-b" as Id<"phases">
const competitionId = "comp-a" as Id<"competitions">
const projectId = "project-a" as Id<"projects">
const taskId = "task-a" as Id<"tasks">
const today = "2026-06-09"
const phaseSortKeyById = buildPhaseSortKeyById([
  {
    _id: phaseA,
    sortKey: "a",
  } as never,
  {
    _id: phaseB,
    sortKey: "b",
  } as never,
])

describe("task overdue helpers", () => {
  test("isTaskOverdue ignores terminal tasks", () => {
    expect(
      isTaskOverdue({
        effectiveStatus: "done",
        dueDate: "2000-01-01",
        phaseId: phaseA,
        subtaskTitleId: null,
        competitionId,
        projectId: null,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(false)
  })

  test("isTaskOverdue is true for past due dates", () => {
    expect(
      isTaskOverdue({
        effectiveStatus: "to-do",
        dueDate: "2000-01-01",
        phaseId: phaseB,
        subtaskTitleId: null,
        competitionId,
        projectId: null,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(true)
  })

  test("isTaskOverdue is true for open direct phase tasks in earlier phases", () => {
    expect(
      isTaskOverdue({
        effectiveStatus: "to-do",
        dueDate: null,
        phaseId: phaseA,
        subtaskTitleId: null,
        competitionId,
        projectId: null,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(true)

    expect(
      isTaskOverdue({
        effectiveStatus: "to-do",
        dueDate: null,
        phaseId: phaseA,
        subtaskTitleId: taskId,
        competitionId,
        projectId: null,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(false)
  })

  test("subtask rows use section phase for carry-over on direct phase tasks", () => {
    const row = {
      task: {
        dueDate: null,
      },
      statusView: { effectiveStatus: "to-do" },
      path: { depth: 0, subtaskTitleId: null },
    } as TaskInlineRow

    expect(
      isSubtaskRowOverdue({
        row,
        sectionPhaseId: phaseA,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(true)

    expect(
      isSubtaskRowOverdue({
        row: {
          ...row,
          statusView: {
            effectiveStatus: "done",
          } as TaskInlineRow["statusView"],
        },
        sectionPhaseId: phaseA,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(false)
  })

  test("isTaskOverdue covers board row inputs", () => {
    expect(
      isTaskOverdue({
        dueDate: "2000-01-01",
        effectiveStatus: "backlog",
        phaseId: phaseB,
        subtaskTitleId: null,
        competitionId,
        projectId: null,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(true)

    expect(
      isTaskOverdue({
        dueDate: null,
        effectiveStatus: "to-do",
        phaseId: phaseA,
        subtaskTitleId: null,
        competitionId,
        projectId: null,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(true)
  })

  test("isTaskOverdue treats project phase carry-over the same as competitions", () => {
    expect(
      isTaskOverdue({
        effectiveStatus: "to-do",
        dueDate: null,
        phaseId: phaseA,
        subtaskTitleId: null,
        competitionId: null,
        projectId,
        ownerCurrentPhaseId: phaseB,
        phaseSortKeyById,
        today,
      })
    ).toBe(true)
  })
})
