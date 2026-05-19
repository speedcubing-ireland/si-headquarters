import { useCallback, useLayoutEffect, useState } from "react"

export type ElementMeasurement = {
  width: number
  font: string
}

export function useMeasuredElement<T extends HTMLElement>(defaultFont: string) {
  const [node, setNode] = useState<T | null>(null)
  const [measurement, setMeasurement] = useState<ElementMeasurement>({
    width: 0,
    font: defaultFont,
  })
  const ref = useCallback((nextNode: T | null) => {
    setNode(nextNode)
  }, [])

  useLayoutEffect(() => {
    if (!node) {
      return
    }

    let cancelled = false
    const update = () => {
      if (cancelled) {
        return
      }

      const computedStyle = getComputedStyle(node)
      const next = {
        width: node.getBoundingClientRect().width,
        font: getFont(computedStyle),
      }

      setMeasurement((current) =>
        Math.abs(current.width - next.width) < 0.5 && current.font === next.font
          ? current
          : next
      )
    }

    update()

    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(node)
    document.fonts?.ready.then(update)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
    }
  }, [node])

  return [ref, measurement] as const satisfies readonly [
    (node: T | null) => void,
    ElementMeasurement,
  ]
}

function getFont(computedStyle: CSSStyleDeclaration) {
  return (
    computedStyle.font ||
    [
      computedStyle.fontStyle,
      computedStyle.fontVariant,
      computedStyle.fontWeight,
      `${computedStyle.fontSize}/${computedStyle.lineHeight}`,
      computedStyle.fontFamily,
    ].join(" ")
  )
}
