import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PROXY_BID_INCREMENT_ROWS,
  SPONSOR_PROXY_BID_INCREMENTS,
} from "@/plugins/sponsor/lib/sponsor-guide"

export function ProxyBidIncrementTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{SPONSOR_PROXY_BID_INCREMENTS.columnHeaders.range}</TableHead>
          <TableHead className="text-right">
            {SPONSOR_PROXY_BID_INCREMENTS.columnHeaders.increment}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {PROXY_BID_INCREMENT_ROWS.map((row) => (
          <TableRow key={row.rangeLabel}>
            <TableCell>{row.rangeLabel}</TableCell>
            <TableCell className="text-right">{row.incrementLabel}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
