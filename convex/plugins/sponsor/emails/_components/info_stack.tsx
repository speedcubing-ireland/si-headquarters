import { Section } from "@react-email/components"
import type { EmailInfoRow } from "../types"
import { SponsorshipInfoBlock } from "../_design"

export function SponsorshipInfoStack(props: { rows: EmailInfoRow[] }) {
  if (props.rows.length === 0) {
    return null
  }

  const [first, ...rest] = props.rows
  return (
    <Section>
      <SponsorshipInfoBlock label={first.label} value={first.value} />
      {rest.map((row) => (
        <Section key={row.label} className="mt-3">
          <SponsorshipInfoBlock label={row.label} value={row.value} />
        </Section>
      ))}
    </Section>
  )
}
