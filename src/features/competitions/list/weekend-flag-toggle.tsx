import { cn } from "@/lib/utils"

const FLAG_TONE = {
  green: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
} as const

export function WeekendFlagPill({
  label,
  tone,
  pressed,
  onPressedChange,
}: {
  label: string
  tone: keyof typeof FLAG_TONE
  pressed: boolean
  onPressedChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => {
        onPressedChange(!pressed)
      }}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        pressed
          ? cn("border-transparent", FLAG_TONE[tone])
          : "border-border/60 text-muted-foreground/80 hover:border-border hover:bg-muted hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          pressed
            ? tone === "green"
              ? "bg-green-500"
              : "bg-amber-500"
            : "bg-muted-foreground/40"
        )}
      />
      {label}
    </button>
  )
}
