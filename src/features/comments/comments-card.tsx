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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmojiPickerPopover } from "@/components/ui/emoji-picker"
import type { api } from "@/convex/_generated/api"
import type { CommentTargetRef } from "@/convex/utils"
import { CommentBody } from "@/features/comments/comment-body"
import { CommentComposer } from "@/features/comments/comment-composer"
import { format } from "date-fns"
import type { FunctionReturnType } from "convex/server"
import { PencilIcon, TrashIcon } from "lucide-react"
import { useState } from "react"

type CommentList = FunctionReturnType<typeof api.comments.queries.list>
type Comment = CommentList["comments"][number]

function CommentItem({
  comment,
  canModerate,
  target,
  onEdit,
  onRemove,
  onToggleReaction,
}: {
  comment: Comment
  canModerate: boolean
  target: CommentTargetRef
  onEdit: (body: string) => Promise<void>
  onRemove: () => void
  onToggleReaction: (emoji: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const authorName = comment.author?.name ?? "Unknown user"

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        {comment.author ? (
          <ObjectAvatar obj={comment.author} size="sm" />
        ) : null}
        <span className="text-sm font-medium">{authorName}</span>
        <Badge variant="secondary">
          {format(new Date(comment.createdAt), "PPp")}
        </Badge>
        {comment.isEdited ? (
          <span className="text-xs text-muted-foreground">(edited)</span>
        ) : null}
        <div className="ml-auto flex gap-1">
          {comment.mine ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit comment"
              onClick={() => {
                setEditing((value) => !value)
              }}
            >
              <PencilIcon />
            </Button>
          ) : null}
          {comment.mine || canModerate ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete comment">
                  <TrashIcon />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the comment.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={onRemove}>
                    Delete comment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      {editing ? (
        <CommentComposer
          target={target}
          initialValue={comment.body}
          initialMentions={comment.mentions}
          submitLabel="Save"
          autoFocus
          onCancel={() => {
            setEditing(false)
          }}
          onSubmit={async (body) => {
            await onEdit(body)
            setEditing(false)
          }}
        />
      ) : (
        <CommentBody body={comment.body} mentions={comment.mentions} />
      )}

      <div className="flex flex-wrap gap-2">
        {comment.reactions.map((reaction) => (
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
      </div>
    </div>
  )
}

export function CommentsCard({
  comments,
  canModerate,
  target,
  onAdd,
  onEdit,
  onRemove,
  onToggleReaction,
}: {
  comments: Comment[]
  canModerate: boolean
  target: CommentTargetRef
  onAdd: (body: string) => Promise<void>
  onEdit: (messageId: string, body: string) => Promise<void>
  onRemove: (messageId: string) => void
  onToggleReaction: (messageId: string, emoji: string) => void
}) {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="pt-2">
          Comments
          {comments.length > 0 ? (
            <Badge variant="secondary" className="ml-2">
              {comments.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent divided className="border-t">
        {comments.map((comment) => (
          <CommentItem
            key={comment.messageId}
            comment={comment}
            canModerate={canModerate}
            target={target}
            onEdit={(body) => onEdit(comment.messageId, body)}
            onRemove={() => {
              onRemove(comment.messageId)
            }}
            onToggleReaction={(emoji) => {
              onToggleReaction(comment.messageId, emoji)
            }}
          />
        ))}
        <CommentComposer target={target} onSubmit={onAdd} />
      </CardContent>
    </Card>
  )
}
