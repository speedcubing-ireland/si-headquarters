import { Button } from "@/components/ui/button"
import { ObjectAvatar } from "@/components/object-avatar"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import type { PublicUser } from "@/convex/users/validators"
import { getUserName } from "@/components/data-selectors/user-selector-model"
import type { CommentMention } from "@/features/comments/comment-body"
import { MENTION_TOKEN } from "@/convex/comments/mentionTokens"
import type { CommentTargetRef } from "@/convex/utils"
import { useQuery } from "convex/react"
import { useRef, useState } from "react"

const ACTIVE_MENTION = /(^|\s)@([^@\s]{0,40})$/

interface ActiveMention {
  start: number
  query: string
}

function findActiveMention(value: string, caret: number): ActiveMention | null {
  const match = ACTIVE_MENTION.exec(value.slice(0, caret))
  if (match === null) return null
  return { start: match.index + match[1].length, query: match[2] }
}

export function CommentComposer({
  target,
  onSubmit,
  initialValue = "",
  initialMentions = [],
  submitLabel = "Comment",
  onCancel,
  autoFocus,
}: {
  target: CommentTargetRef
  onSubmit: (body: string) => Promise<void>
  initialValue?: string
  initialMentions?: CommentMention[]
  submitLabel?: string
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(initialValue)
  const [active, setActive] = useState<ActiveMention | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [namesById, setNamesById] = useState(
    () =>
      new Map<string, string>(initialMentions.map((m) => [m.userId, m.name]))
  )

  const query = active?.query.trim() ?? ""
  const suggestions =
    useQuery(
      api.comments.queries.searchMentionableUsers,
      active !== null && query !== "" ? { target, query } : "skip"
    ) ?? []

  const mentionedNames = [...value.matchAll(MENTION_TOKEN)]
    .map(([, id]) => namesById.get(id))
    .filter((name): name is string => name !== undefined)

  function syncActive(nextValue: string, caret: number) {
    setActive(findActiveMention(nextValue, caret))
  }

  function insertMention(user: PublicUser) {
    const textarea = textareaRef.current
    if (textarea === null || active === null) return
    const caret = textarea.selectionStart
    const next = `${value.slice(0, active.start)}@${user._id} ${value.slice(caret)}`
    setValue(next)
    setActive(null)
    setNamesById((prev) => new Map(prev).set(user._id, getUserName(user)))
    const nextCaret = active.start + user._id.length + 2
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCaret, nextCaret)
    })
  }

  async function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setValue("")
      setActive(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Popover open={suggestions.length > 0}>
        <PopoverAnchor asChild>
          <Textarea
            ref={textareaRef}
            value={value}
            autoFocus={autoFocus}
            placeholder="Write a comment… use @ to mention someone"
            disabled={submitting}
            className="min-h-20 resize-y font-mono text-sm"
            onChange={(event) => {
              setValue(event.target.value)
              syncActive(event.target.value, event.target.selectionStart)
            }}
            onClick={(event) => {
              syncActive(value, event.currentTarget.selectionStart)
            }}
            onKeyUp={(event) => {
              syncActive(value, event.currentTarget.selectionStart)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && active !== null) {
                event.preventDefault()
                setActive(null)
                return
              }
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-72 p-1"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
          }}
        >
          <div className="grid">
            {suggestions.map((user) => (
              <button
                key={user._id}
                type="button"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(event) => {
                  event.preventDefault()
                  insertMention(user)
                }}
              >
                <ObjectAvatar obj={user} size="sm" />
                <span className="truncate">{getUserName(user)}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {mentionedNames.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Mentioning: {mentionedNames.join(", ")}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void handleSubmit()
          }}
          disabled={submitting || !value.trim()}
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  )
}
