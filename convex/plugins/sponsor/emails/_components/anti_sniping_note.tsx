import { Text } from "@react-email/components"
import { ANTI_SNIPING_FOOTNOTE } from "../copy"

export function AntiSnipingFootnote() {
  return (
    <Text className="m-0 mt-3 text-xs leading-5 text-brand-muted">
      {ANTI_SNIPING_FOOTNOTE}
    </Text>
  )
}
