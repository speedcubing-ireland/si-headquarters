import { describe, expect, it, vi } from "vitest"
import {
  getVisualViewportBox,
  isKeyboardVisible,
  subscribeToVisualViewportChanges,
} from "@/components/ui/visual-viewport"

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }
}

describe("getVisualViewportBox", () => {
  it("uses the visual viewport dimensions and offsets", () => {
    expect(
      getVisualViewportBox(
        {
          height: 412.5,
          offsetLeft: 3,
          offsetTop: 97.25,
          width: 390,
        },
        { innerHeight: 844, innerWidth: 390 }
      )
    ).toEqual({ height: 412.5, left: 3, top: 97.25, width: 390 })
  })

  it("falls back to the layout viewport when visual metrics are unavailable", () => {
    expect(
      getVisualViewportBox(null, { innerHeight: 844, innerWidth: 390 })
    ).toEqual({ height: 844, left: 0, top: 0, width: 390 })
  })

  it("guards against invalid dimensions and negative offsets", () => {
    expect(
      getVisualViewportBox(
        {
          height: 0,
          offsetLeft: -4,
          offsetTop: -10,
          width: Number.NaN,
        },
        { innerHeight: 700, innerWidth: 360 }
      )
    ).toEqual({ height: 700, left: 0, top: 0, width: 360 })
  })
})

describe("isKeyboardVisible", () => {
  it("distinguishes a keyboard-sized occlusion from browser chrome changes", () => {
    expect(
      isKeyboardVisible({ height: 420, left: 0, top: 50, width: 390 }, 844)
    ).toBe(true)
    expect(
      isKeyboardVisible({ height: 750, left: 0, top: 44, width: 390 }, 844)
    ).toBe(false)
  })
})

describe("subscribeToVisualViewportChanges", () => {
  it("coalesces viewport events and removes listeners on cleanup", () => {
    const visualViewport = new FakeEventTarget()
    const windowTarget = new FakeEventTarget()
    const queuedFrames = new Map<number, () => void>()
    const onChange = vi.fn()
    const cancelFrame = vi.fn((frameId: number) => {
      queuedFrames.delete(frameId)
    })
    let nextFrameId = 1

    const cleanup = subscribeToVisualViewportChanges({
      cancelFrame,
      onChange,
      requestFrame: (callback) => {
        const frameId = nextFrameId++
        queuedFrames.set(frameId, callback)
        return frameId
      },
      visualViewport,
      windowTarget,
    })

    visualViewport.dispatch("resize")
    visualViewport.dispatch("scroll")
    windowTarget.dispatch("orientationchange")
    expect(queuedFrames.size).toBe(1)

    const firstFrame = queuedFrames.get(1)
    queuedFrames.delete(1)
    firstFrame?.()
    expect(onChange).toHaveBeenCalledOnce()

    windowTarget.dispatch("resize")
    expect(queuedFrames.size).toBe(1)
    cleanup()
    expect(cancelFrame).toHaveBeenCalledWith(2)

    visualViewport.dispatch("resize")
    windowTarget.dispatch("resize")
    expect(queuedFrames.size).toBe(0)
  })
})
