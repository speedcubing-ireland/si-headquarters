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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {SPONSOR_PROXY_BID_INCREMENTS.description}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Current leading bid</TableHead>
            <TableHead className="text-right">Minimum increment</TableHead>
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
    </div>
  )
}
