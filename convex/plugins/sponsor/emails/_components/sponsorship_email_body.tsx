import { Section, Text } from "@react-email/components"
import type { EmailTemplateCopy } from "../types"
import { AntiSnipingFootnote } from "./anti_sniping_note"
import { SponsorshipInfoStack } from "./info_stack"

const bodyTextClass = "m-0 mt-3 text-sm leading-5"
const footnoteTextClass = "m-0 mt-3 text-xs leading-5 text-brand-muted"

export function SponsorshipEmailBody(props: { copy: EmailTemplateCopy }) {
  const { copy } = props
  return (
    <Section>
      <SponsorshipInfoStack rows={copy.infoRows} />
      {copy.bodyParagraphs.map((paragraph) => (
        <Text key={paragraph} className={bodyTextClass}>
          {paragraph}
        </Text>
      ))}
      {copy.footnoteParagraphs.map((paragraph) => (
        <Text key={paragraph} className={footnoteTextClass}>
          {paragraph}
        </Text>
      ))}
      {copy.showAntiSnipingNote ? <AntiSnipingFootnote /> : null}
    </Section>
  )
}
