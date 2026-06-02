import { describe, expect, test } from "vitest"
import {
  buildTaskPathCandidates,
  DEFAULT_TASK_PATH_FONT,
  getLabelCandidateTexts,
  selectTaskPathLayout,
} from "./task-path-layout"

class TestOffscreenCanvas {
  height: number
  width: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  getContext() {
    return {
      font: "",
      measureText: (text: string) => ({
        width: measureTestText(text),
      }),
    }
  }
}

const testGlobal = globalThis as unknown as {
  OffscreenCanvas?: typeof TestOffscreenCanvas
}

testGlobal.OffscreenCanvas ??= TestOffscreenCanvas

describe("getLabelCandidateTexts", () => {
  test("keeps legacy compact count labels without ellipsis candidates", () => {
    expect(getLabelCandidateTexts("+2 Labels", "+2")).toEqual([
      "+2 Labels",
      "+2",
    ])
  })

  test("truncates a single label to four graphemes before count fallback", () => {
    expect(
      getLabelCandidateTexts({ count: 1, primaryName: "Purchasing" })
    ).toEqual([
      "Purchasing",
      "Purchasin...",
      "Purchasi...",
      "Purchas...",
      "Purcha...",
      "Purch...",
      "Purc...",
      "+1",
    ])
  })

  test("truncates multiple labels by trimming the count suffix", () => {
    expect(getLabelCandidateTexts({ count: 10 })).toEqual([
      "+10 Labels",
      "+10 Label",
      "+10 Labe",
      "+10 Lab",
      "+10 La",
      "+10 L",
      "+10",
    ])
  })

  test("truncates labels by grapheme instead of code unit", () => {
    expect(
      getLabelCandidateTexts({ count: 1, primaryName: "😀😃😄😁😆" })
    ).toEqual(["😀😃😄😁😆", "😀😃😄😁...", "+1"])
  })
})

describe("buildTaskPathCandidates", () => {
  function buildCandidates({
    hasBlockIndicator = false,
    labels = { count: 0 },
    subtaskIndicator = null,
    subtaskTitle = "Design Certificates Long Ah Name Hello Task",
    taskTitle = "New subtask",
  }: Partial<Parameters<typeof buildTaskPathCandidates>[0]> = {}) {
    return buildTaskPathCandidates({
      taskTitle,
      subtaskTitle,
      subtaskIndicator,
      hasBlockIndicator,
      labels,
      textFont: DEFAULT_TASK_PATH_FONT,
      subtaskTitleId: "parent",
    })
  }

  test("caps the parent segment before truncating the focal task", () => {
    const candidates = buildCandidates()
    const firstParentTruncation = candidates.findIndex((candidate) =>
      candidate.subtaskText.endsWith("...")
    )
    const firstTaskTruncation = candidates.findIndex(
      (candidate) =>
        candidate.taskText.endsWith("...") &&
        candidate.taskText !== "New subtask"
    )

    expect(firstParentTruncation).toBeGreaterThan(0)
    expect(firstTaskTruncation).toBeGreaterThan(firstParentTruncation)
  })

  test("keeps progressive parent shrink candidates for flat task list rows", () => {
    const candidates = buildCandidates({
      labels: { count: 1, primaryName: "MECC26" },
    })
    const fullTask = "New subtask"
    const fullCompactParent = candidates.find(
      (candidate) =>
        candidate.taskText === fullTask &&
        candidate.subtaskText === "Design Certificates Long Ah Name Hello Task" &&
        candidate.labelText === "+1"
    )
    const progressiveParent = candidates.find(
      (candidate) =>
        candidate.taskText === fullTask &&
        candidate.subtaskText.endsWith("...") &&
        measureTestText(candidate.subtaskText) > measureTestText(fullTask) &&
        candidate.totalWidth < (fullCompactParent?.totalWidth ?? 0)
    )

    expect(fullCompactParent).toBeDefined()
    expect(progressiveParent).toBeDefined()

    const layout = selectTaskPathLayout(
      candidates,
      progressiveParent?.totalWidth ?? 0
    )

    expect(layout.taskText).toBe(fullTask)
    expect(layout.subtaskText).toBe(progressiveParent?.subtaskText)
    expect(measureTestText(layout.subtaskText)).toBeGreaterThan(
      measureTestText(layout.taskText)
    )
  })

  test("keeps direct subtask view rows on task-only truncation", () => {
    const candidates = buildTaskPathCandidates({
      taskTitle: "Design Certificates Long Ah Name Hello Task",
      subtaskTitle: "",
      subtaskIndicator: "0/4",
      hasBlockIndicator: true,
      labels: { count: 0 },
      textFont: DEFAULT_TASK_PATH_FONT,
      subtaskTitleId: null,
    })
    const firstTruncated = candidates.find(
      (candidate) =>
        candidate.taskText.endsWith("...") &&
        candidate.subtaskText === "" &&
        candidate.totalWidth < candidates[0].totalWidth
    )

    expect(candidates.every((candidate) => candidate.subtaskText === "")).toBe(
      true
    )
    expect(firstTruncated).toBeDefined()

    const layout = selectTaskPathLayout(
      candidates,
      firstTruncated?.totalWidth ?? 0
    )

    expect(layout.subtaskText).toBe("")
    expect(layout.taskText).toBe(firstTruncated?.taskText)
  })

  test("keeps the focal task longer than the parent in balanced truncation", () => {
    const candidates = buildCandidates({
      taskTitle: "Design Certificates Long Ah Name Hello Task",
      subtaskTitle: "Another Very Long Parent Task Name",
    })
    const balanced = candidates.find(
      (candidate) =>
        candidate.taskText.endsWith("...") &&
        candidate.subtaskText.endsWith("...")
    )

    expect(balanced).toBeDefined()
    expect(measureTestText(balanced?.subtaskText ?? "")).toBeLessThanOrEqual(
      (measureTestText(balanced?.taskText ?? "") * 2) / 3
    )
  })

  test("caps a very short task parent by hiding the parent when needed", () => {
    const candidates = buildCandidates({
      taskTitle: "Go",
      subtaskTitle: "Very Long Parent Task",
    })
    const capped = candidates.find(
      (candidate) => candidate.taskText === "Go" && candidate.subtaskText === ""
    )

    expect(capped).toBeDefined()
    expect(
      candidates
        .slice(1)
        .filter((candidate) => candidate.taskText === "Go")
        .every(
          (candidate) =>
            candidate.subtaskText === "" ||
            measureTestText(candidate.subtaskText) <=
              measureTestText(candidate.taskText)
        )
    ).toBe(true)
  })

  test("reserves indicator width before text", () => {
    const withoutIndicators = buildCandidates()
    const withIndicators = buildCandidates({
      hasBlockIndicator: true,
      subtaskIndicator: "0/4",
    })

    const layout = selectTaskPathLayout(
      withIndicators,
      withoutIndicators[0].totalWidth
    )

    expect(layout).not.toMatchObject({
      taskText: withIndicators[0].taskText,
      subtaskText: withIndicators[0].subtaskText,
      labelText: withIndicators[0].labelText,
    })
  })

  test("falls back to indicators and compact label at extremely narrow widths", () => {
    const candidates = buildCandidates({
      hasBlockIndicator: true,
      labels: { count: 1, primaryName: "Purchasing" },
      subtaskIndicator: "0/4",
    })
    const layout = selectTaskPathLayout(candidates, 1)

    expect(layout.taskText).toBe("")
    expect(layout.subtaskText).toBe("")
    expect(layout.labelText).toBe("+1")
  })
})

function measureTestText(value: string) {
  return countGraphemes(value) * 8
}

function countGraphemes(value: string) {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)
  ).length
}
