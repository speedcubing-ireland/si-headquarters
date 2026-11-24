/**
 * Joins a section slug to a topic id in an anchor. Neither may contain it, so
 * an anchor always splits back into the section it belongs to.
 */
export const HELP_ANCHOR_SEPARATOR = "--"

/**
 * The `#` anchor of a help topic on its section's page. Kept apart from the
 * section registry so prose components can link between topics without
 * importing the registry that imports them.
 */
export function helpTopicAnchor(sectionSlug: string, topicId: string): string {
  return `${sectionSlug}${HELP_ANCHOR_SEPARATOR}${topicId}`
}

/**
 * Where a hash from the old single-page `/help` points: `#<section>` or
 * `#<section>--<topic>`. Contextual links and bookmarks made before sections
 * got their own pages still carry these.
 */
export function legacyHelpHashTarget(
  hash: string
): { section: string; hash: string | undefined } | null {
  const anchor = hash.replace(/^#/, "")
  if (anchor === "") return null
  const separator = anchor.indexOf(HELP_ANCHOR_SEPARATOR)
  return separator === -1
    ? { section: anchor, hash: undefined }
    : { section: anchor.slice(0, separator), hash: anchor }
}
