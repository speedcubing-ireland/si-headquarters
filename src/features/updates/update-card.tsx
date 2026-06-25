import { ObjectAvatar } from "@/components/object-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalForm,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal"
import { EmojiPickerPopover } from "@/components/ui/emoji-picker"
import type { api } from "@/convex/_generated/api"
import { MarkdownEditorField } from "@/features/shared/markdown-editor-field"
import { format } from "date-fns"
import type { FunctionReturnType } from "convex/server"
import { PlusIcon, TrashIcon } from "lucide-react"
import { useState } from "react"
import { Streamdown } from "streamdown"

type UpdateReaction = FunctionReturnType<
  typeof api.updates.queries.listReactionCounts
>[number]

type CurrentUpdateDetails = FunctionReturnType<
  typeof api.updates.queries.getCurrent
>
type CurrentUpdate = NonNullable<CurrentUpdateDetails["update"]> & {
  author: CurrentUpdateDetails["author"]
}

function AddUpdateDialog({
  editorId,
  placeholder,
  title,
  onSubmit,
}: {
  editorId: string
  placeholder: string
  title: string
  onSubmit: (body: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedBody = body.trim()
    if (!trimmedBody || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(trimmedBody)
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setBody("")
      }}
    >
      <ResponsiveModalTrigger asChild>
        <Button variant="outline" size="icon" aria-label={`Add ${title}`}>
          <PlusIcon />
        </Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent className="sm:max-w-2xl">
        <ResponsiveModalForm
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
        >
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Add {title}</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Write in Markdown and preview before saving.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalBody className="grid gap-4">
            <MarkdownEditorField
              id={editorId}
              label="Update"
              placeholder={placeholder}
              value={body}
              onChange={setBody}
              disabled={isSubmitting}
            />
          </ResponsiveModalBody>
          <ResponsiveModalFooter>
            <Button type="submit" disabled={isSubmitting || !body.trim()}>
              {isSubmitting ? "Saving..." : "Save update"}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalForm>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

function DeleteUpdateDialog({
  title,
  onDelete,
}: {
  title: string
  onDelete: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="icon"
          aria-label={`Delete ${title}`}
        >
          <TrashIcon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the current update and clears its reactions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function UpdateCard({
  editorId,
  placeholder,
  reactions,
  title,
  update,
  onAdd,
  onDelete,
  onToggleReaction,
}: {
  editorId: string
  placeholder: string
  reactions: UpdateReaction[]
  title: string
  update: CurrentUpdate | null
  onAdd: (body: string) => Promise<void>
  onDelete: () => void
  onToggleReaction: (emoji: string) => void
}) {
  const addDialog = (
    <AddUpdateDialog
      editorId={editorId}
      placeholder={placeholder}
      title={title}
      onSubmit={onAdd}
    />
  )

  if (update === null) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="pt-2">{title}</CardTitle>
          <CardAction>{addDialog}</CardAction>
        </CardHeader>
        <CardContent divided className="border-t">
          <p className="pt-2 text-sm text-muted-foreground">
            No update posted yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  const authorName = update.author?.name ?? "Unknown user"

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pt-2">
          {update.author ? (
            <ObjectAvatar obj={update.author} size="sm" />
          ) : null}
          {authorName}
          <Badge variant="secondary">
            {format(new Date(update.editedAt), "P")}
          </Badge>
        </CardTitle>
        <CardAction className="flex gap-2">
          <DeleteUpdateDialog title={title} onDelete={onDelete} />
          {addDialog}
        </CardAction>
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown className="pt-2">{update.body}</Streamdown>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {reactions.map((reaction) => (
          <Button
            key={reaction.emoji}
            size="sm"
            variant={reaction.selected ? "default" : "outline"}
            onClick={() => {
              onToggleReaction(reaction.emoji)
            }}
          >
            <span className="text-center text-lg">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </Button>
        ))}
        <EmojiPickerPopover
          onEmojiSelect={(emoji) => {
            onToggleReaction(emoji.emoji)
          }}
        />
      </CardFooter>
    </Card>
  )
}
