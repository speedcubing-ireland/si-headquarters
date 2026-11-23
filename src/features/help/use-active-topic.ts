import { useEffect, useState } from "react"
import { helpTopicAnchor } from "@/features/help/help-anchors"
import type { HelpSection } from "@/features/help/help-content"

/**
 * A thin band a little below the top of the screen. The topic crossing it is
 * the one being read; its height bridges the gap between topics, so some topic
 * is nearly always in it.
 */
const READING_BAND = "-20% 0px -75% 0px"

/**
 * The topic the reader is looking at, for highlighting in the contents. Starts
 * on the first topic so the contents never highlight nothing, and holds the
 * last one seen while the band is between topics.
 */
export function useActiveTopic(
  section: HelpSection | undefined
): string | undefined {
  const [active, setActive] = useState<{ slug: string; topicId: string }>()

  useEffect(() => {
    if (section === undefined) return

    const elements = section.topics.flatMap((topic) => {
      const element = document.getElementById(
        helpTopicAnchor(section.slug, topic.id)
      )
      return element === null ? [] : [{ topicId: topic.id, element }]
    })

    const observer = new IntersectionObserver(
      (entries) => {
        const crossing = entries.find((entry) => entry.isIntersecting)
        const topic = elements.find((item) => item.element === crossing?.target)
        if (topic !== undefined) {
          setActive({ slug: section.slug, topicId: topic.topicId })
        }
      },
      { rootMargin: READING_BAND }
    )
    for (const { element } of elements) observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [section])

  return active?.slug === section?.slug
    ? active?.topicId
    : section?.topics[0]?.id
}
