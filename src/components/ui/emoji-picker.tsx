import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  EmojiPicker as FrimousseEmojiPicker,
  type Emoji,
  type EmojiPickerRootProps,
} from "frimousse"
import { SmilePlusIcon } from "lucide-react"
import * as React from "react"

const DEFAULT_FAVOURITE_EMOJIS: Emoji[] = [
  { emoji: "👍", label: "Like" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "😡", label: "Angry" },
]

function EmojiPicker({
  className,
  favouriteEmojis = DEFAULT_FAVOURITE_EMOJIS,
  onEmojiSelect,
  ...props
}: Omit<EmojiPickerRootProps, "children"> & {
  favouriteEmojis?: Emoji[]
}) {
  return (
    <FrimousseEmojiPicker.Root
      columns={8}
      onEmojiSelect={onEmojiSelect}
      className={cn("grid w-72 gap-2", className)}
      {...props}
    >
      {favouriteEmojis.length > 0 && (
        <div className="grid gap-1.5 border-b pb-2">
          <div className="px-1 text-xs font-medium text-muted-foreground">
            Favourites
          </div>
          <div className="flex flex-wrap gap-1">
            {favouriteEmojis.map((emoji) => (
              <button
                key={emoji.emoji}
                type="button"
                className="flex size-8 items-center justify-center rounded-md text-lg outline-none hover:bg-accent focus-visible:bg-accent"
                title={emoji.label}
                aria-label={emoji.label}
                onClick={() => onEmojiSelect?.(emoji)}
              >
                {emoji.emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      <FrimousseEmojiPicker.Search
        placeholder="Search emoji..."
        className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <FrimousseEmojiPicker.Viewport className="h-64 overflow-y-auto rounded-md">
        <FrimousseEmojiPicker.Loading className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          Loading emoji...
        </FrimousseEmojiPicker.Loading>
        <FrimousseEmojiPicker.Empty className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          No emoji found.
        </FrimousseEmojiPicker.Empty>
        <FrimousseEmojiPicker.List
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className="sticky top-0 z-10 bg-popover px-1.5 py-1 text-xs font-medium text-muted-foreground"
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1.5 px-1.5" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                className="flex size-8 items-center justify-center rounded-md text-lg outline-none hover:bg-accent focus-visible:bg-accent data-[active]:bg-accent"
                title={emoji.label}
                {...props}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </FrimousseEmojiPicker.Viewport>
    </FrimousseEmojiPicker.Root>
  )
}

function EmojiPickerPopover({
  trigger,
  onEmojiSelect,
  ...props
}: Omit<EmojiPickerRootProps, "children" | "onEmojiSelect"> & {
  trigger?: React.ReactNode
  onEmojiSelect: (emoji: Emoji) => void
  favouriteEmojis?: Emoji[]
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" aria-label="Add reaction">
            <SmilePlusIcon />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2.5" align="start">
        <EmojiPicker
          onEmojiSelect={(emoji) => {
            onEmojiSelect(emoji)
            setOpen(false)
          }}
          {...props}
        />
      </PopoverContent>
    </Popover>
  )
}

export { EmojiPicker, EmojiPickerPopover, type Emoji }
