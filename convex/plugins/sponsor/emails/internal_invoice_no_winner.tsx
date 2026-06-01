import {
  InternalInvoiceEmail,
  type InternalInvoiceEmailProps,
} from "./_components/internal_invoice_email"
import { fixtures } from "./fixtures"

function InternalInvoiceNoWinnerEmail(props: InternalInvoiceEmailProps) {
  return <InternalInvoiceEmail {...props} />
}

InternalInvoiceNoWinnerEmail.PreviewProps = fixtures.internalInvoiceNoWinner
export default InternalInvoiceNoWinnerEmail
