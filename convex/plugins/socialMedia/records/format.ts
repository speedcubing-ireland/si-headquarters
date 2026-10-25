export type RecordKind = "NR" | "CR" | "WR"

export type RecordType = "single" | "average"

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

/** Centiseconds as the WCA prints them: `9.87`, `1:02.34`, `1:00:05.00`. */
function formatCentiseconds(centiseconds: number): string {
  const totalSeconds = Math.floor(centiseconds / 100)
  const cs = pad2(centiseconds % 100)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0)
    return `${String(hours)}:${pad2(minutes)}:${pad2(seconds)}.${cs}`
  if (minutes > 0) return `${String(minutes)}:${pad2(seconds)}.${cs}`
  return `${String(seconds)}.${cs}`
}

/** Whole seconds as `m:ss` or `h:mm:ss`, for multi-blind's time component. */
function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${String(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return `${String(minutes)}:${pad2(seconds)}`
}

/**
 * Multi-blind packs points, time and misses into one integer, `0DDTTTTTMM`:
 * DD is 99 minus the points, TTTTT the time in seconds and MM the cubes missed.
 */
function formatMultiBlind(value: number): string {
  const missed = value % 100
  const seconds = Math.floor(value / 100) % 100_000
  const points = 99 - Math.floor(value / 10_000_000)
  const solved = points + missed
  const attempted = solved + missed
  return `${String(solved)}/${String(attempted)} ${formatSeconds(seconds)}`
}

/**
 * A WCA result value as the WCA site prints it. Time events are centiseconds,
 * a fewest-moves single is a move count and its average is hundredths of a
 * move, and multi-blind has its own packed encoding.
 */
export function formatWcaResult(
  eventId: string,
  type: RecordType,
  value: number
): string {
  if (value === -1) return "DNF"
  if (value === -2) return "DNS"
  if (value <= 0) return ""

  if (eventId === "333fm") {
    return type === "single" ? String(value) : (value / 100).toFixed(2)
  }
  if (eventId === "333mbf") return formatMultiBlind(value)
  return formatCentiseconds(value)
}
