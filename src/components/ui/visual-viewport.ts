export interface VisualViewportBox {
  height: number
  left: number
  top: number
  width: number
}

interface VisualViewportMetrics {
  height: number
  offsetLeft: number
  offsetTop: number
  width: number
}

interface ViewportFallback {
  innerHeight: number
  innerWidth: number
}

interface ViewportEventTarget {
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

interface SubscribeToVisualViewportChangesOptions {
  cancelFrame: (frameId: number) => void
  onChange: () => void
  requestFrame: (callback: () => void) => number
  visualViewport: ViewportEventTarget | null
  windowTarget: ViewportEventTarget
}

function finiteOrFallback(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function getVisualViewportBox(
  visualViewport: VisualViewportMetrics | null,
  fallback: ViewportFallback
): VisualViewportBox {
  if (visualViewport === null) {
    return {
      height: fallback.innerHeight,
      left: 0,
      top: 0,
      width: fallback.innerWidth,
    }
  }

  return {
    height: finiteOrFallback(visualViewport.height, fallback.innerHeight),
    left: Math.max(0, visualViewport.offsetLeft),
    top: Math.max(0, visualViewport.offsetTop),
    width: finiteOrFallback(visualViewport.width, fallback.innerWidth),
  }
}

export function isKeyboardVisible(
  viewport: VisualViewportBox,
  layoutViewportHeight: number
) {
  const obscuredHeight =
    layoutViewportHeight - (viewport.top + viewport.height)
  return obscuredHeight > 150
}

export function subscribeToVisualViewportChanges({
  cancelFrame,
  onChange,
  requestFrame,
  visualViewport,
  windowTarget,
}: SubscribeToVisualViewportChangesOptions) {
  let pendingFrame: number | null = null

  const scheduleChange = () => {
    if (pendingFrame !== null) return

    pendingFrame = requestFrame(() => {
      pendingFrame = null
      onChange()
    })
  }

  visualViewport?.addEventListener("resize", scheduleChange)
  visualViewport?.addEventListener("scroll", scheduleChange)
  windowTarget.addEventListener("resize", scheduleChange)
  windowTarget.addEventListener("orientationchange", scheduleChange)

  return () => {
    visualViewport?.removeEventListener("resize", scheduleChange)
    visualViewport?.removeEventListener("scroll", scheduleChange)
    windowTarget.removeEventListener("resize", scheduleChange)
    windowTarget.removeEventListener("orientationchange", scheduleChange)

    if (pendingFrame !== null) {
      cancelFrame(pendingFrame)
      pendingFrame = null
    }
  }
}
