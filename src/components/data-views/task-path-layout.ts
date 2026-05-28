import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext"

const MIN_TRUNCATED_GRAPHEMES = 4
const ELLIPSIS = "..."
const TEXT_WIDTH_BUFFER_PX = 2
const CHEVRON_WIDTH_PX = 16
const PATH_GAP_COUNT = 3
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
  labelText: string
  compactLabelText: string
  textFont: string
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
  return `${String(Math.max(labelCount, 1))}+`
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
  labelText,
  compactLabelText,
  textFont,
}: TaskPathLayoutInput): TaskPathLayout[] {
  const candidates: TaskPathLayout[] = []
  const taskGraphemes = splitGraphemes(taskTitle)
  const subtaskGraphemes = splitGraphemes(subtaskTitle)
  const labelCandidates = getLabelCandidateTexts(labelText, compactLabelText)
  const fullTask = getTextVariant(taskGraphemes, taskGraphemes.length)
  const fullSubtask = getTextVariant(subtaskGraphemes, subtaskGraphemes.length)

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
  const longestSubtaskOnlyCount = Math.max(
    taskGraphemes.length,
    MIN_TRUNCATED_GRAPHEMES
  )

  for (
    let subtaskCount = subtaskGraphemes.length - 1;
    subtaskCount >= longestSubtaskOnlyCount;
    subtaskCount -= 1
  ) {
    pushCandidate(candidates, {
      task: fullTask,
      subtask: getTextVariant(subtaskGraphemes, subtaskCount),
      subtaskIndicator,
      hasBlockIndicator,
      label: compactLabel,
      textFont,
    })
  }

  const balancedSubtaskBaseCount = Math.min(
    subtaskGraphemes.length,
    taskGraphemes.length
  )

  for (let step = 1; step <= taskGraphemes.length; step += 1) {
    const taskCount = Math.max(
      MIN_TRUNCATED_GRAPHEMES,
      taskGraphemes.length - step
    )
    const subtaskCount = Math.max(
      MIN_TRUNCATED_GRAPHEMES,
      balancedSubtaskBaseCount - step * 2
    )
    pushCandidate(candidates, {
      task: getTextVariant(taskGraphemes, taskCount),
      subtask: getTextVariant(subtaskGraphemes, subtaskCount),
      subtaskIndicator,
      hasBlockIndicator,
      label: compactLabel,
      textFont,
    })

    if (
      taskCount === MIN_TRUNCATED_GRAPHEMES &&
      subtaskCount === MIN_TRUNCATED_GRAPHEMES
    ) {
      return candidates
    }
  }

  pushCandidate(candidates, {
    task: getTextVariant(taskGraphemes, MIN_TRUNCATED_GRAPHEMES),
    subtask: getTextVariant(subtaskGraphemes, MIN_TRUNCATED_GRAPHEMES),
    subtaskIndicator,
    hasBlockIndicator,
    label: compactLabel,
    textFont,
  })

  return candidates
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
  const badgeCount =
    (subtaskIndicator === null ? 0 : 1) + (hasBlockIndicator ? 1 : 0)
  const pathGapCount = badgeCount === 0 ? 2 : PATH_GAP_COUNT
  const pathWidth =
    taskWidth +
    CHEVRON_WIDTH_PX +
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

function getLabelCandidateTexts(labelText: string, compactLabelText: string) {
  if (labelText.length === 0) return [""]

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

function getTextVariant(graphemes: string[], graphemeCount: number) {
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
