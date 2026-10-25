import { render } from "@react-email/components"
import type { ReactElement } from "react"

/** Renders an email's HTML and plain-text bodies in one go. */
export async function renderEmailFormats(element: ReactElement): Promise<{
  html: string
  plainText: string
}> {
  const [html, plainText] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  return { html, plainText }
}
