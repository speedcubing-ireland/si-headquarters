import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext"

const MIN_TRUNCATED_GRAPHEMES = 4
const ELLIPSIS = "..."
const TEXT_WIDTH_BUFFER_PX = 2
const CHEVRON_WIDTH_PX = 16
const PATH_GAP_WIDTH_PX = 4
const PROGRESS_TO_LABEL_GAP_PX = 8
/** Badge px-2 (16) + 1px border each side. */
const LABEL_BADGE_CHROME_WIDTH_PX = 18
/** h-5 badge with icon + px-2 + gap-1; text measured separately. */
const PROGRESS_BADGE_CHROME_WIDTH_PX = 28
/** Icon-only block badge: px-1.5 (12) + size-3 icon (12) + border (2). */
const BLOCK_BADGE_CHROME_WIDTH_PX = 24

export const DEFAULT_TASK_PATH_FONT =
  '400 14px "Noto Sans Variable", sans-serif'

const BADGE_FONT = '500 12px "Noto Sans Variable", sans-serif'

export interface TaskPathLayout {
  taskText: string
  subtaskText: string
  labelText: string
  pathWidth: number
  totalWidth: number
}

export interface TaskPathLayoutInput {
  taskTitle: string
  subtaskTitle: string
  subtaskIndicator: string | null
  hasBlockIndicator: boolean
  labels?: TaskPathLabelInput
  labelText?: string
  compactLabelText?: string
  textFont: string
  subtaskTitleId: string | null
}

export interface TaskPathLabelInput {
  count: number
  primaryName?: string
}

interface LayoutCandidateInput {
  task: string
  subtask: string
  subtaskIndicator: string | null
  hasBlockIndicator: boolean
  textFont: string
}

export function getCompactLabelText(labelCount: number) {
  return `+${String(Math.max(labelCount, 1))}`
}

export function getLabelCandidatesFromInput(
  input: TaskPathLayoutInput
): string[] {
  if (input.labels !== undefined) {
    return getLabelCandidateTexts(input.labels)
  }

  return getLabelCandidateTexts(
    input.labelText ?? "",
    input.compactLabelText ?? ""
  )
}

export function selectTaskPathLayout(
  pathCandidates: TaskPathLayout[],
  labelCandidates: string[],
  availableWidth: number
): TaskPathLayout {
  const compactLabel = labelCandidates.at(-1) ?? ""
  const fallback = attachLabel(
    pathCandidates.at(-1) ?? {
      taskText: "",
      subtaskText: "",
      labelText: "",
      pathWidth: 0,
      totalWidth: 0,
    },
    compactLabel
  )

  if (pathCandidates.length === 0) {
    return {
      taskText: "",
      subtaskText: "",
      labelText: compactLabel,
      pathWidth: 0,
      totalWidth: measureLabelSlotWidth(compactLabel),
    }
  }

  if (availableWidth <= 0) {
    return attachLabel(pathCandidates[0], compactLabel)
  }

  let best = fallback
  let bestPathScore: readonly [number, number, number] = [-1, -1, -1]
  let bestLabelScore = -1
  let bestLabelSlotWidth = -1

  for (const path of pathCandidates) {
    const pathScore = getPathContentScore(path)
    for (const label of labelCandidates) {
      const labelSlotWidth = measureLabelSlotWidth(label)
      const totalWidth = path.pathWidth + labelSlotWidth
      if (totalWidth > availableWidth) {
        continue
      }

      const labelScore = getLabelContentScore(label)
      const isBetterPath =
        pathScore[0] > bestPathScore[0] ||
        (pathScore[0] === bestPathScore[0] && pathScore[1] > bestPathScore[1]) ||
        (pathScore[0] === bestPathScore[0] &&
          pathScore[1] === bestPathScore[1] &&
          pathScore[2] > bestPathScore[2])
      const isSamePath =
        pathScore[0] === bestPathScore[0] &&
        pathScore[1] === bestPathScore[1] &&
        pathScore[2] === bestPathScore[2]
      const isBetterLabel =
        labelScore > bestLabelScore ||
        (labelScore === bestLabelScore && labelSlotWidth > bestLabelSlotWidth)

      if (isBetterPath || (isSamePath && isBetterLabel)) {
        best = attachLabel(path, label)
        bestPathScore = pathScore
        bestLabelScore = labelScore
        bestLabelSlotWidth = labelSlotWidth
      }
    }
  }

  return best
}

function getPathContentScore(
  path: Pick<TaskPathLayout, "pathWidth" | "subtaskText" | "taskText">
) {
  return [
    getSegmentContentScore(path.taskText),
    getSegmentContentScore(path.subtaskText),
    path.pathWidth,
  ] as const
}

function getSegmentContentScore(text: string) {
  if (text.length === 0) {
    return 0
  }

  if (text.endsWith(ELLIPSIS)) {
    return splitGraphemes(text.slice(0, -ELLIPSIS.length)).length
  }

  return splitGraphemes(text).length + 10_000
}

function getLabelContentScore(label: string) {
  if (label.length === 0) {
    return 0
  }

  if (label.endsWith(ELLIPSIS)) {
    return splitGraphemes(label.slice(0, -ELLIPSIS.length)).length
  }

  if (/^\+\d+($| )/.test(label)) {
    return splitGraphemes(label).length
  }

  return splitGraphemes(label).length + 10_000
}

export function resolveTaskPathLayout(
  input: TaskPathLayoutInput,
  availableWidth: number
): TaskPathLayout {
  const pathCandidates = buildTaskPathCandidates(input)
  const labelCandidates = getLabelCandidatesFromInput(input)
  return selectTaskPathLayout(pathCandidates, labelCandidates, availableWidth)
}

export function buildTaskPathCandidates({
  taskTitle,
  subtaskTitle,
  subtaskIndicator,
  hasBlockIndicator,
  textFont,
  subtaskTitleId,
}: TaskPathLayoutInput): TaskPathLayout[] {
  const candidates: TaskPathLayout[] = []
  const taskGraphemes = splitGraphemes(taskTitle)
  const subtaskGraphemes = splitGraphemes(subtaskTitle)
  const fullTask = getTextVariant(taskGraphemes, taskGraphemes.length)
  const fullSubtask = getTextVariant(subtaskGraphemes, subtaskGraphemes.length)
  const hasBreadcrumb = subtaskGraphemes.length > 0 && subtaskTitleId !== null

  pushCandidate(candidates, {
    task: fullTask,
    subtask: fullSubtask,
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  })

  if (!hasBreadcrumb) {
    pushTaskOnlyCandidates(candidates, {
      taskGraphemes,
      subtaskIndicator,
      hasBlockIndicator,
      textFont,
    })
    return candidates
  }

  const cappedSubtaskCount = pushParentCapCandidates(candidates, {
    taskGraphemes,
    subtaskGraphemes,
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  })

  pushBalancedBreadcrumbCandidates(candidates, {
    taskGraphemes,
    subtaskGraphemes,
    cappedSubtaskCount,
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  })

  pushCandidate(candidates, {
    task: getTextVariant(taskGraphemes, MIN_TRUNCATED_GRAPHEMES),
    subtask: "",
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  })
  pushCandidate(candidates, {
    task: "",
    subtask: "",
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  })

  return candidates
}

function pushTaskOnlyCandidates(
  candidates: TaskPathLayout[],
  {
    taskGraphemes,
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  }: {
    taskGraphemes: string[]
    subtaskIndicator: string | null
    hasBlockIndicator: boolean
    textFont: string
  }
) {
  for (
    let taskCount = taskGraphemes.length - 1;
    taskCount >= MIN_TRUNCATED_GRAPHEMES;
    taskCount -= 1
  ) {
    pushCandidate(candidates, {
      task: getTextVariant(taskGraphemes, taskCount),
      subtask: "",
      subtaskIndicator,
      hasBlockIndicator,
      textFont,
    })
  }

  pushCandidate(candidates, {
    task: "",
    subtask: "",
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  })
}

function pushParentCapCandidates(
  candidates: TaskPathLayout[],
  {
    taskGraphemes,
    subtaskGraphemes,
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  }: {
    taskGraphemes: string[]
    subtaskGraphemes: string[]
    subtaskIndicator: string | null
    hasBlockIndicator: boolean
    textFont: string
  }
) {
  const fullTask = getTextVariant(taskGraphemes, taskGraphemes.length)
  const fullTaskWidth = measureTextForDom(fullTask, textFont)
  const cappedSubtaskCount = findLargestVariantCountAtMost({
    graphemes: subtaskGraphemes,
    maxCount: subtaskGraphemes.length,
    minCount: 1,
    maxWidth: fullTaskWidth,
    textFont,
    fallbackCount: 0,
  })

  if (cappedSubtaskCount === 0) {
    pushCandidate(candidates, {
      task: fullTask,
      subtask: "",
      subtaskIndicator,
      hasBlockIndicator,
      textFont,
    })

    return cappedSubtaskCount
  }

  for (
    let subtaskCount = subtaskGraphemes.length - 1;
    subtaskCount >= cappedSubtaskCount;
    subtaskCount -= 1
  ) {
    pushCandidate(candidates, {
      task: fullTask,
      subtask: getTextVariant(subtaskGraphemes, subtaskCount),
      subtaskIndicator,
      hasBlockIndicator,
      textFont,
    })
  }

  return cappedSubtaskCount
}

function pushBalancedBreadcrumbCandidates(
  candidates: TaskPathLayout[],
  {
    taskGraphemes,
    subtaskGraphemes,
    cappedSubtaskCount,
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  }: {
    taskGraphemes: string[]
    subtaskGraphemes: string[]
    cappedSubtaskCount: number
    subtaskIndicator: string | null
    hasBlockIndicator: boolean
    textFont: string
  }
) {
  if (cappedSubtaskCount <= 0) {
    return
  }

  for (
    let taskCount = taskGraphemes.length - 1;
    taskCount >= MIN_TRUNCATED_GRAPHEMES;
    taskCount -= 1
  ) {
    const task = getTextVariant(taskGraphemes, taskCount)
    const taskWidth = measureTextForDom(task, textFont)
    const subtaskCount = findLargestVariantCountAtMost({
      graphemes: subtaskGraphemes,
      maxCount: cappedSubtaskCount,
      minCount: MIN_TRUNCATED_GRAPHEMES,
      maxWidth: (taskWidth * 2) / 3,
      textFont,
      fallbackCount: Math.min(cappedSubtaskCount, MIN_TRUNCATED_GRAPHEMES),
    })

    pushCandidate(candidates, {
      task,
      subtask: getTextVariant(subtaskGraphemes, subtaskCount),
      subtaskIndicator,
      hasBlockIndicator,
      textFont,
    })

    if (taskCount === MIN_TRUNCATED_GRAPHEMES) {
      break
    }
  }
}

function findLargestVariantCountAtMost({
  graphemes,
  maxCount,
  minCount,
  maxWidth,
  textFont,
  fallbackCount = minCount,
}: {
  graphemes: string[]
  maxCount: number
  minCount: number
  maxWidth: number
  textFont: string
  fallbackCount?: number
}) {
  for (let count = maxCount; count >= minCount; count -= 1) {
    const width = measureTextForDom(getTextVariant(graphemes, count), textFont)
    if (width <= maxWidth) {
      return count
    }
  }

  return Math.min(maxCount, fallbackCount)
}

function pushCandidate(
  candidates: TaskPathLayout[],
  candidateInput: LayoutCandidateInput
) {
  const candidate = buildLayoutCandidate(candidateInput)
  const previous = candidates.at(-1)

  if (
    previous?.taskText === candidate.taskText &&
    previous?.subtaskText === candidate.subtaskText
  ) {
    return
  }

  candidates.push(candidate)
}

function buildLayoutCandidate({
  task,
  subtask,
  subtaskIndicator,
  hasBlockIndicator,
  textFont,
}: LayoutCandidateInput): TaskPathLayout {
  const pathWidth = measurePathWidth({
    task,
    subtask,
    subtaskIndicator,
    hasBlockIndicator,
    textFont,
  })

  return {
    taskText: task,
    subtaskText: subtask,
    labelText: "",
    pathWidth,
    totalWidth: pathWidth,
  }
}

export function measurePathWidth({
  task,
  subtask,
  subtaskIndicator,
  hasBlockIndicator,
  textFont,
}: LayoutCandidateInput): number {
  const taskWidth = measureTextForDom(task, textFont)
  const subtaskWidth = measureTextForDom(subtask, textFont)
  const showsChevron = taskWidth > 0 && subtaskWidth > 0
  const indicatorsWidth = measureIndicatorsWidth(subtaskIndicator, hasBlockIndicator)
  const segmentCount =
    (taskWidth > 0 ? 1 : 0) +
    (showsChevron ? 1 : 0) +
    (subtaskWidth > 0 ? 1 : 0) +
    (indicatorsWidth > 0 ? 1 : 0)
  const pathGapCount = Math.max(0, segmentCount - 1)

  return (
    taskWidth +
    (showsChevron ? CHEVRON_WIDTH_PX : 0) +
    subtaskWidth +
    indicatorsWidth +
    PATH_GAP_WIDTH_PX * pathGapCount
  )
}

export function measureIndicatorsWidth(
  subtaskIndicator: string | null,
  hasBlockIndicator: boolean
) {
  const progressWidth =
    subtaskIndicator === null
      ? 0
      : measureBadgeWidth(subtaskIndicator, PROGRESS_BADGE_CHROME_WIDTH_PX)
  const blockWidth = hasBlockIndicator
    ? measureBadgeWidth("", BLOCK_BADGE_CHROME_WIDTH_PX)
    : 0

  if (progressWidth === 0) {
    return blockWidth
  }

  if (blockWidth === 0) {
    return progressWidth
  }

  return progressWidth + blockWidth + PATH_GAP_WIDTH_PX
}

function measureLabelSlotWidth(label: string) {
  if (label.length === 0) {
    return 0
  }

  return PROGRESS_TO_LABEL_GAP_PX + measureBadgeWidth(label, LABEL_BADGE_CHROME_WIDTH_PX)
}

function attachLabel(path: TaskPathLayout, label: string): TaskPathLayout {
  const labelSlotWidth = measureLabelSlotWidth(label)

  return {
    ...path,
    labelText: label,
    totalWidth: path.pathWidth + labelSlotWidth,
  }
}

export function getLabelCandidateTexts(
  input: TaskPathLabelInput | string,
  compactLabelText = ""
) {
  if (typeof input !== "string") {
    return getStructuredLabelCandidateTexts(input)
  }

  const labelText = input
  if (labelText.length === 0) return [""]
  if (
    compactLabelText.length > 0 &&
    labelText.startsWith(`${compactLabelText} `)
  ) {
    return [labelText, compactLabelText]
  }

  const graphemes = splitGraphemes(labelText)
  const candidates = [labelText]

  for (
    let count = graphemes.length - 1;
    count >= MIN_TRUNCATED_GRAPHEMES;
    count -= 1
  ) {
    candidates.push(`${graphemes.slice(0, count).join("")}${ELLIPSIS}`)
  }

  candidates.push(compactLabelText)
  return [...new Set(candidates)]
}

function getStructuredLabelCandidateTexts({
  count,
  primaryName,
}: TaskPathLabelInput) {
  if (count <= 0) return [""]
  if (count === 1) {
    return getSingleLabelCandidateTexts(primaryName ?? "", count)
  }

  return getCountLabelCandidateTexts(count)
}

function getSingleLabelCandidateTexts(label: string, count: number) {
  const fallback = `+${String(count)}`
  if (label.length === 0) return [fallback]

  const graphemes = splitGraphemes(label)
  const candidates = [label]

  for (
    let count = graphemes.length - 1;
    count >= MIN_TRUNCATED_GRAPHEMES;
    count -= 1
  ) {
    candidates.push(getTextVariant(graphemes, count))
  }

  candidates.push(fallback)
  return [...new Set(candidates)]
}

function getCountLabelCandidateTexts(count: number) {
  const prefix = `+${String(count)}`
  const suffix = "Labels"
  const candidates = [`${prefix} ${suffix}`]

  for (let suffixLength = suffix.length - 1; suffixLength >= 1; suffixLength -= 1) {
    candidates.push(`${prefix} ${suffix.slice(0, suffixLength)}`)
  }

  candidates.push(prefix)
  return candidates
}

function getTextVariant(graphemes: string[], graphemeCount: number) {
  if (graphemeCount <= 0) {
    return ""
  }

  if (graphemeCount >= graphemes.length) {
    return graphemes.join("")
  }

  return `${graphemes.slice(0, graphemeCount).join("")}${ELLIPSIS}`
}

function splitGraphemes(value: string) {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value),
    ({ segment }) => segment
  )
}

function measureTextForDom(text: string, font: string) {
  if (text.length === 0) {
    return 0
  }

  return Math.ceil(measureText(text, font) + TEXT_WIDTH_BUFFER_PX)
}

function measureBadgeWidth(text: string, chromeWidth: number) {
  return Math.ceil(measureText(text, BADGE_FONT) + chromeWidth)
}

function measureText(text: string, font: string) {
  if (text.length === 0) {
    return 0
  }

  return measureNaturalWidth(prepareWithSegments(text, font))
}
