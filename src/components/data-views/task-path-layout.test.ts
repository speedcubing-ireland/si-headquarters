import { describe, expect, test } from "vitest"
import {
  buildTaskPathCandidates,
  DEFAULT_TASK_PATH_FONT,
  getLabelCandidateTexts,
  measureIndicatorsWidth,
  measurePathWidth,
  resolveTaskPathLayout,
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

describe("measurePathWidth", () => {
  test("groups progress and block indicators into one flex segment", () => {
    const textFont = DEFAULT_TASK_PATH_FONT
    const shared = {
      task: "New subtask",
      subtask: "",
      textFont,
    }
    const taskOnly = measurePathWidth({
      ...shared,
      subtaskIndicator: "1/1",
      hasBlockIndicator: true,
    })
    const progressOnly = measurePathWidth({
      ...shared,
      subtaskIndicator: "1/1",
      hasBlockIndicator: false,
    })
    const blockOnly = measurePathWidth({
      ...shared,
      subtaskIndicator: null,
      hasBlockIndicator: true,
    })
    expect(measureIndicatorsWidth("1/1", true)).toBe(
      measureIndicatorsWidth("1/1", false) +
        measureIndicatorsWidth(null, true) +
        4
    )
    expect(taskOnly - progressOnly).toBe(measureIndicatorsWidth(null, true) + 4)
    expect(taskOnly - blockOnly).toBe(measureIndicatorsWidth("1/1", false) + 4)
    expect(progressOnly).toBeLessThan(taskOnly)
    expect(blockOnly).toBeLessThan(taskOnly)
  })
})

describe("buildTaskPathCandidates", () => {
  function buildCandidates({
    hasBlockIndicator = false,
    labels = { count: 0 },
    subtaskIndicator = null,
    subtaskTitle = "Design Certificates Long Ah Name Hello Task",
    taskTitle = "New subtask",
    subtaskTitleId = "parent",
  }: Partial<Parameters<typeof buildTaskPathCandidates>[0]> = {}) {
    return buildTaskPathCandidates({
      taskTitle,
      subtaskTitle,
      subtaskIndicator,
      hasBlockIndicator,
      labels,
      textFont: DEFAULT_TASK_PATH_FONT,
      subtaskTitleId,
    })
  }

  function resolveAtWidth(
    options: Parameters<typeof buildCandidates>[0] & { width: number }
  ) {
    const { width, ...input } = options
    return resolveTaskPathLayout(
      {
        ...input,
        labels: input.labels ?? { count: 0 },
        textFont: DEFAULT_TASK_PATH_FONT,
        subtaskTitleId: input.subtaskTitleId ?? "parent",
        taskTitle: input.taskTitle ?? "New subtask",
        subtaskTitle: input.subtaskTitle ?? "",
        subtaskIndicator: input.subtaskIndicator ?? null,
        hasBlockIndicator: input.hasBlockIndicator ?? false,
      },
      width
    )
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
    const labelCandidates = getLabelCandidateTexts({
      count: 1,
      primaryName: "MECC26",
    })
    const fullTask = "New subtask"
    const fullCompactParent = candidates.find(
      (candidate) =>
        candidate.taskText === fullTask &&
        candidate.subtaskText === "Design Certificates Long Ah Name Hello Task"
    )
    const progressiveParent = candidates.find(
      (candidate) =>
        candidate.taskText === fullTask &&
        candidate.subtaskText.endsWith("...") &&
        measureTestText(candidate.subtaskText) > measureTestText(fullTask) &&
        candidate.pathWidth < (fullCompactParent?.pathWidth ?? 0)
    )

    expect(fullCompactParent).toBeDefined()
    expect(progressiveParent).toBeDefined()

    const layout = selectTaskPathLayout(
      candidates,
      labelCandidates,
      (progressiveParent?.pathWidth ?? 0) + 40
    )

    expect(layout.taskText).toBe(fullTask)
    expect(layout.subtaskText).toMatch(
      /^Design Certificates Long Ah Name Hello/
    )
    expect(layout.subtaskText.endsWith("...")).toBe(true)
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
        candidate.pathWidth < candidates[0].pathWidth
    )

    expect(candidates.every((candidate) => candidate.subtaskText === "")).toBe(
      true
    )
    expect(firstTruncated).toBeDefined()

    const layout = selectTaskPathLayout(
      candidates,
      [""],
      firstTruncated?.pathWidth ?? 0
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
    const labelCandidates = getLabelCandidateTexts({ count: 0 })

    const layout = selectTaskPathLayout(
      withIndicators,
      labelCandidates,
      withoutIndicators[0].pathWidth
    )

    expect(layout).not.toMatchObject({
      taskText: withIndicators[0].taskText,
      subtaskText: withIndicators[0].subtaskText,
    })
  })

  test("falls back to indicators and compact label at extremely narrow widths", () => {
    const layout = resolveAtWidth({
      hasBlockIndicator: true,
      labels: { count: 1, primaryName: "Purchasing" },
      subtaskIndicator: "0/4",
      width: 1,
    })

    expect(layout.taskText).toBe("")
    expect(layout.subtaskText).toBe("")
    expect(layout.labelText).toBe("+1")
  })

  test("does not select empty task text at typical list widths when shorter text fits", () => {
    const layout = resolveAtWidth({
      taskTitle: "New subtask",
      subtaskTitle: "",
      subtaskIndicator: "1/1",
      hasBlockIndicator: true,
      labels: { count: 1, primaryName: "MECC26" },
      subtaskTitleId: null,
      width: 191,
    })

    expect(layout.taskText.length).toBeGreaterThan(0)
    expect(layout.taskText).not.toBe("")
    expect(layout.labelText).toBe("+1")
  })

  test("uses more task text as width increases for task-only rows", () => {
    const widths = [170, 191, 220, 260] as const
    const layouts = widths.map((width) =>
      resolveAtWidth({
        taskTitle: "New subtask",
        subtaskTitle: "",
        subtaskIndicator: "1/1",
        hasBlockIndicator: true,
        labels: { count: 1, primaryName: "MECC26" },
        subtaskTitleId: null,
        width,
      })
    )

    for (let index = 1; index < layouts.length; index += 1) {
      expect(measureTestText(layouts[index].taskText)).toBeGreaterThanOrEqual(
        measureTestText(layouts[index - 1].taskText)
      )
    }

    expect(layouts[layouts.length - 1].taskText).toBe("New subtask")
  })

  test("keeps focal task visible for breadcrumb rows at typical list widths", () => {
    const layout = resolveAtWidth({
      taskTitle: "New subtask",
      subtaskTitle: "Design Certificates Long Ah Name Hello Task",
      subtaskIndicator: "1/1",
      hasBlockIndicator: true,
      labels: { count: 2 },
      width: 191,
    })

    expect(layout.taskText.length).toBeGreaterThan(0)
    expect(layout.taskText).not.toBe("")
    expect(layout.labelText).toBe("+2")
  })

  test("prefers full label text over truncated variants when width allows", () => {
    const layout = resolveAtWidth({
      taskTitle: "New subtask",
      hasBlockIndicator: true,
      labels: { count: 1, primaryName: "Design" },
      width: 400,
    })

    expect(layout.labelText).toBe("Design")
    expect(layout.taskText).toBe("New subtask")
    expect(layout.totalWidth).toBeLessThan(400)
  })

  test("shows more path text when available width increases", () => {
    const narrow = resolveAtWidth({
      taskTitle: "New subtask",
      subtaskTitle: "Design Certificates Long Ah Name Hello Task",
      subtaskIndicator: "1/1",
      hasBlockIndicator: true,
      labels: { count: 1, primaryName: "MECC26" },
      width: 150,
    })
    const wide = resolveAtWidth({
      taskTitle: "New subtask",
      subtaskTitle: "Design Certificates Long Ah Name Hello Task",
      subtaskIndicator: "1/1",
      hasBlockIndicator: true,
      labels: { count: 1, primaryName: "MECC26" },
      width: 300,
    })

    const narrowContent =
      measureTestText(narrow.taskText) + measureTestText(narrow.subtaskText)
    const wideContent =
      measureTestText(wide.taskText) + measureTestText(wide.subtaskText)

    expect(wideContent).toBeGreaterThanOrEqual(narrowContent)
    expect(wide.totalWidth).toBeLessThanOrEqual(300)
    expect(narrow.totalWidth).toBeLessThanOrEqual(150)
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
