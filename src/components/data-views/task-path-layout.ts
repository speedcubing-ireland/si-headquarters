import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext"

const MIN_TRUNCATED_GRAPHEMES = 4
const ELLIPSIS = "..."
const TEXT_WIDTH_BUFFER_PX = 2
const CHEVRON_WIDTH_PX = 16
const PATH_GAP_WIDTH_PX = 4
const PROGRESS_TO_LABEL_GAP_PX = 8
const LABEL_BADGE_CHROME_WIDTH_PX = 18
const PROGRESS_BADGE_CHROME_WIDTH_PX = 32
/** Icon-only block badge: px-1.5 (12) + size-3 icon (12) + 1px border (2). */
const BLOCK_BADGE_CHROME_WIDTH_PX = 26

export const DEFAULT_TASK_PATH_FONT =
  '400 14px "Noto Sans Variable", sans-serif'

const BADGE_FONT = '500 12px "Noto Sans Variable", sans-serif'

export interface TaskPathLayout {
  taskText: string
  subtaskText: string
  labelText: string
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
  label: string
  textFont: string
}

export function getCompactLabelText(labelCount: number) {
  return `+${String(Math.max(labelCount, 1))}`
}

export function selectTaskPathLayout(
  candidates: TaskPathLayout[],
  availableWidth: number
) {
  if (availableWidth <= 0) {
    return candidates[0]
  }

  return (
    candidates.find((candidate) => candidate.totalWidth <= availableWidth) ??
    candidates[candidates.length - 1]
  )
}

export function buildTaskPathCandidates({
  taskTitle,
  subtaskTitle,
  subtaskIndicator,
  hasBlockIndicator,
  labels,
  labelText,
  compactLabelText,
  textFont,
  subtaskTitleId,
}: TaskPathLayoutInput): TaskPathLayout[] {
  const candidates: TaskPathLayout[] = []
  const taskGraphemes = splitGraphemes(taskTitle)
  const subtaskGraphemes = splitGraphemes(subtaskTitle)
  const labelCandidates =
    labels !== undefined
      ? getLabelCandidateTexts(labels)
      : getLabelCandidateTexts(labelText ?? "", compactLabelText ?? "")
  const fullTask = getTextVariant(taskGraphemes, taskGraphemes.length)
  const fullSubtask = getTextVariant(subtaskGraphemes, subtaskGraphemes.length)
  const hasBreadcrumb = subtaskGraphemes.length > 0 && subtaskTitleId !== null

  for (const label of labelCandidates) {
    pushCandidate(candidates, {
      task: fullTask,
      subtask: fullSubtask,
      subtaskIndicator,
      hasBlockIndicator,
      label,
      textFont,
    })
  }

  const compactLabel = labelCandidates[labelCandidates.length - 1]

  if (!hasBreadcrumb) {
    pushTaskOnlyCandidates(candidates, {
      taskGraphemes,
      subtaskIndicator,
      hasBlockIndicator,
      label: compactLabel,
      textFont,
    })
    return candidates
  }

  const cappedSubtaskCount = pushParentCapCandidates(candidates, {
    taskGraphemes,
    subtaskGraphemes,
    subtaskIndicator,
    hasBlockIndicator,
    label: compactLabel,
    textFont,
  })

  pushBalancedBreadcrumbCandidates(candidates, {
    taskGraphemes,
    subtaskGraphemes,
    cappedSubtaskCount,
    subtaskIndicator,
    hasBlockIndicator,
    label: compactLabel,
    textFont,
  })

  pushCandidate(candidates, {
    task: getTextVariant(taskGraphemes, MIN_TRUNCATED_GRAPHEMES),
    subtask: "",
    subtaskIndicator,
    hasBlockIndicator,
    label: compactLabel,
    textFont,
  })
  pushCandidate(candidates, {
    task: "",
    subtask: "",
    subtaskIndicator,
    hasBlockIndicator,
    label: compactLabel,
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
    label,
    textFont,
  }: {
    taskGraphemes: string[]
    subtaskIndicator: string | null
    hasBlockIndicator: boolean
    label: string
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
      label,
      textFont,
    })
  }

  pushCandidate(candidates, {
    task: "",
    subtask: "",
    subtaskIndicator,
    hasBlockIndicator,
    label,
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
    label,
    textFont,
  }: {
    taskGraphemes: string[]
    subtaskGraphemes: string[]
    subtaskIndicator: string | null
    hasBlockIndicator: boolean
    label: string
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
      label,
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
      label,
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
    label,
    textFont,
  }: {
    taskGraphemes: string[]
    subtaskGraphemes: string[]
    cappedSubtaskCount: number
    subtaskIndicator: string | null
    hasBlockIndicator: boolean
    label: string
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
      label,
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
    previous.subtaskText === candidate.subtaskText &&
    previous.labelText === candidate.labelText
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
  label,
  textFont,
}: LayoutCandidateInput): TaskPathLayout {
  const taskWidth = measureTextForDom(task, textFont)
  const subtaskWidth = measureTextForDom(subtask, textFont)
  const showsChevron = taskWidth > 0 && subtaskWidth > 0
  const progressWidth =
    subtaskIndicator === null
      ? 0
      : measureBadgeWidth(subtaskIndicator, PROGRESS_BADGE_CHROME_WIDTH_PX)
  const blockWidth = hasBlockIndicator
    ? measureBadgeWidth("", BLOCK_BADGE_CHROME_WIDTH_PX)
    : 0
  const labelWidth =
    label.length === 0
      ? 0
      : measureBadgeWidth(label, LABEL_BADGE_CHROME_WIDTH_PX)
  const itemCount =
    (taskWidth > 0 ? 1 : 0) +
    (showsChevron ? 1 : 0) +
    (subtaskWidth > 0 ? 1 : 0) +
    (subtaskIndicator === null ? 0 : 1) +
    (hasBlockIndicator ? 1 : 0)
  const pathGapCount = Math.max(0, itemCount - 1)
  const pathWidth =
    taskWidth +
    (showsChevron ? CHEVRON_WIDTH_PX : 0) +
    subtaskWidth +
    progressWidth +
    blockWidth +
    PATH_GAP_WIDTH_PX * pathGapCount

  return {
    taskText: task,
    subtaskText: subtask,
    labelText: label,
    totalWidth:
      pathWidth +
      (labelWidth === 0 ? 0 : PROGRESS_TO_LABEL_GAP_PX + labelWidth),
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
