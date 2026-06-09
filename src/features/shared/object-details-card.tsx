import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EditDetailsFormDialog } from "@/features/shared/edit-details-form-dialog"
import { ObjectWatchButton } from "@/features/subscriptions/object-watch-button"
import type { CompetitionOrProjectRef } from "@/convex/utils"
import type { ReactNode } from "react"
import { Streamdown } from "streamdown"

export function ObjectDetailsCard({
  name,
  description,
  metadata,
  phaseProgress,
  editDialog,
  watchObject,
  footer,
}: {
  name: string
  description: string | null
  metadata: ReactNode
  phaseProgress: ReactNode
  editDialog?: {
    descriptionId: string
    descriptionPlaceholder: string
    initialValue: { name: string; description: string | null }
    nameId: string
    title: string
    triggerLabel: string
    onSubmit: (value: {
      name: string
      description: string | null
    }) => Promise<null> | undefined
  }
  watchObject: CompetitionOrProjectRef
  footer?: ReactNode
}) {
  const iconUrl = `https://api.dicebear.com/9.x/glass/svg?seed=${name}`

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center gap-4">
          <img
            src={iconUrl}
            className="size-12 shrink-0 rounded-lg border border-border object-cover"
            alt=""
          />
          <div className="flex flex-col items-start gap-2">
            <CardTitle className="text-2xl">{name}</CardTitle>
            {metadata}
          </div>
        </div>
        {editDialog ? (
          <CardAction className="flex flex-col gap-2 sm:flex-row">
            <EditDetailsFormDialog {...editDialog} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent divided className="border-t">
        <Streamdown>{description ?? "Enter a description..."}</Streamdown>
        {phaseProgress}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <ObjectWatchButton object={watchObject} />
        {footer}
      </CardFooter>
    </Card>
  )
}
