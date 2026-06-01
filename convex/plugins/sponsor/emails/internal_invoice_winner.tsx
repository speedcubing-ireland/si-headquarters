import {
  InternalInvoiceEmail,
  type InternalInvoiceEmailProps,
} from "./_components/internal_invoice_email"
import { fixtures } from "./fixtures"
import { buildInternalInvoiceProps, type BuildEmailInput } from "./_build"

function InternalInvoiceWinnerEmail(props: InternalInvoiceEmailProps) {
  return <InternalInvoiceEmail {...props} />
}

InternalInvoiceWinnerEmail.PreviewProps = fixtures.internalInvoiceWinner
export default InternalInvoiceWinnerEmail

export function buildElement(input: BuildEmailInput) {
  const props = buildInternalInvoiceProps(input)
  return props ? <InternalInvoiceWinnerEmail {...props} /> : null
}
