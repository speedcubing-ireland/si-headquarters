import { api } from "@/convex/_generated/api"
import { LinkIdPopover, useLinkAction } from "@/features/integrations"
import type { LinkResourceActionProps } from "@/plugins/integrations/registry"
import { useAction } from "convex/react"
import { FileSpreadsheetIcon } from "lucide-react"
import { useState } from "react"

export function LinkGoogleSheetButton({ object }: LinkResourceActionProps) {
  const { open, setOpen, close, error, pending, run } = useLinkAction()
  const [sheetId, setSheetId] = useState("")
  const linkSheet = useAction(api.plugins.sheets.resources.linkSheet)

  return (
    <LinkIdPopover
      icon={<FileSpreadsheetIcon className="text-lime-500" />}
      label="Link Google Sheet"
      submitLabel="Link sheet"
      placeholder="Spreadsheet ID"
      value={sheetId}
      onValueChange={setSheetId}
      canSubmit={sheetId.trim() !== ""}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSheetId("")
        }
      }}
      error={error}
      pending={pending}
      onSubmit={() => {
        void (async () => {
          const linked = await run(async () => {
            await linkSheet({
              object,
              sheetId: sheetId.trim(),
            })
          })
          if (linked) {
            close()
            setSheetId("")
          }
        })()
      }}
    />
  )
}
