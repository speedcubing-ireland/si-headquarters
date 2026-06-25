import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Streamdown } from "streamdown"

interface MarkdownEditorFieldProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function MarkdownEditorField({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: MarkdownEditorFieldProps) {
  const [preview, setPreview] = useState(false)
  const previewId = `${id}-preview`

  return (
    <div className="grid min-h-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Label
          htmlFor={previewId}
          className="gap-2 text-sm text-muted-foreground"
        >
          Preview
          <Switch
            id={previewId}
            checked={preview}
            onCheckedChange={setPreview}
            disabled={disabled}
          />
        </Label>
      </div>

      <div className="min-h-0 rounded-lg border bg-background shadow-xs">
        <Textarea
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-[min(42svh,20rem)] min-h-48 resize-none border-0 bg-transparent p-3 font-mono text-sm shadow-none focus-visible:ring-0",
            preview && "hidden"
          )}
        />
        <ScrollArea
          className={cn(
            "h-[min(42svh,20rem)] min-h-48 p-3",
            !preview && "hidden"
          )}
        >
          {value.trim() ? (
            <Streamdown>{value}</Streamdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing to preview yet.
            </p>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
