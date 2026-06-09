import {
  ArchiveRestore,
  ChevronDown,
  Gavel,
  Mail,
  Send,
  ShieldCheck,
  ShieldX,
  Star,
} from "lucide-react"
import { useState, type ReactNode, type SubmitEvent } from "react"
import { toast } from "sonner"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  useSponsorContactMutations,
  useSponsorContacts,
} from "@/plugins/sponsor/hooks/use-sponsorship"
import { formatDateTime } from "@/lib/format/irish-dates"

export function SponsorContactsPanel({
  sponsorId,
  sponsorActive,
  busyContactId,
  onBusyContactIdChange,
}: {
  sponsorId: Id<"sponsors">
  sponsorActive: boolean
  busyContactId: Id<"sponsorContacts"> | null
  onBusyContactIdChange: (id: Id<"sponsorContacts"> | null) => void
}) {
  const { contacts, isLoading } = useSponsorContacts(sponsorId)
  const {
    createContact,
    updateContact,
    sendContactAccessEmail,
    revokeContactSessions,
    setPrimaryContact,
    archiveContact,
    unarchiveContact,
  } = useSponsorContactMutations()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const runContactAction = async (
    contactId: Id<"sponsorContacts">,
    action: () => Promise<null | { sentTo: string; hasAuthAccount: boolean }>,
    successMessage: string,
    failureMessage: string
  ) => {
    onBusyContactIdChange(contactId)
    try {
      await action()
      toast.success(successMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failureMessage)
    } finally {
      onBusyContactIdChange(null)
    }
  }

  const onCreateContact = async (event: SubmitEvent) => {
    event.preventDefault()
    setIsCreating(true)
    try {
      await createContact({ sponsorId, name, email })
      toast.success("Contact added.")
      setName("")
      setEmail("")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add contact."
      )
    } finally {
      setIsCreating(false)
    }
  }

  const toggleFlag = async (
    contactId: Id<"sponsorContacts">,
    patch: {
      receivesCc?: boolean
      portalAccess?: boolean
      canBid?: boolean
    }
  ) => {
    onBusyContactIdChange(contactId)
    try {
      await updateContact({ contactId, ...patch })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update contact."
      )
    } finally {
      onBusyContactIdChange(null)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5">
          <ChevronDown
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
          Manage contacts ({isLoading ? "…" : contacts.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <ItemGroup>
            {contacts.map((contact) => (
              <Item key={contact.id} variant="outline" className="items-start">
                <ItemContent>
                  <ItemTitle>
                    {contact.name}
                    {contact.isPrimary ? (
                      <Badge variant="secondary">Primary</Badge>
                    ) : null}
                  </ItemTitle>
                  <ItemDescription>{contact.email}</ItemDescription>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.portalAccess ? (
                      <Badge variant="outline">Portal</Badge>
                    ) : null}
                    {contact.canBid ? (
                      <Badge variant="outline">Can bid</Badge>
                    ) : null}
                    {contact.receivesCc ? (
                      <Badge variant="outline">CC</Badge>
                    ) : null}
                    {!contact.active ? (
                      <Badge variant="outline">Archived</Badge>
                    ) : null}
                  </div>
                  {contact.lastAccessEmailSentAt !== undefined ? (
                    <p className="text-xs text-muted-foreground">
                      Access email{" "}
                      {formatDateTime(contact.lastAccessEmailSentAt)}
                    </p>
                  ) : null}
                </ItemContent>
                <ItemActions className="flex-wrap justify-end">
                  {!contact.isPrimary && contact.active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyContactId === contact.id}
                      onClick={() => {
                        void runContactAction(
                          contact.id,
                          () => setPrimaryContact({ contactId: contact.id }),
                          "Primary contact updated.",
                          "Failed to set primary contact."
                        )
                      }}
                    >
                      <Star className="size-3.5" />
                      Make primary
                    </Button>
                  ) : null}
                  {contact.active && contact.portalAccess ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyContactId === contact.id}
                      onClick={() => {
                        void runContactAction(
                          contact.id,
                          () =>
                            sendContactAccessEmail({ contactId: contact.id }),
                          "Access email sent.",
                          "Failed to send access email."
                        )
                      }}
                    >
                      <Send className="size-3.5" />
                      Send access
                    </Button>
                  ) : null}
                  {contact.active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyContactId === contact.id}
                      onClick={() => {
                        void runContactAction(
                          contact.id,
                          () =>
                            revokeContactSessions({ contactId: contact.id }),
                          "Sessions revoked.",
                          "Failed to revoke sessions."
                        )
                      }}
                    >
                      <ShieldX className="size-3.5" />
                      Revoke
                    </Button>
                  ) : null}
                  {contact.active && !contact.isPrimary ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyContactId === contact.id}
                      onClick={() => {
                        void runContactAction(
                          contact.id,
                          () => archiveContact(contact.id),
                          "Contact archived.",
                          "Failed to archive contact."
                        )
                      }}
                    >
                      Archive
                    </Button>
                  ) : null}
                  {!contact.active && sponsorActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyContactId === contact.id}
                      onClick={() => {
                        void runContactAction(
                          contact.id,
                          () => unarchiveContact(contact.id),
                          "Contact restored.",
                          "Failed to restore contact."
                        )
                      }}
                    >
                      <ArchiveRestore className="size-3.5" />
                      Unarchive
                    </Button>
                  ) : null}
                </ItemActions>
                {contact.active ? (
                  <ItemFooter className="grid gap-3 sm:grid-cols-3">
                    <ContactPermissionSwitch
                      id={`contact-cc-${contact.id}`}
                      label="CC emails"
                      icon={<Mail className="size-3.5" />}
                      checked={contact.receivesCc}
                      disabled={
                        busyContactId === contact.id || contact.isPrimary
                      }
                      onCheckedChange={(checked) => {
                        void toggleFlag(contact.id, { receivesCc: checked })
                      }}
                    />
                    <ContactPermissionSwitch
                      id={`contact-portal-${contact.id}`}
                      label="Portal access"
                      icon={<ShieldCheck className="size-3.5" />}
                      checked={contact.portalAccess}
                      disabled={busyContactId === contact.id}
                      onCheckedChange={(checked) => {
                        void toggleFlag(contact.id, { portalAccess: checked })
                      }}
                    />
                    <ContactPermissionSwitch
                      id={`contact-bid-${contact.id}`}
                      label="Can bid"
                      icon={<Gavel className="size-3.5" />}
                      checked={contact.canBid}
                      disabled={busyContactId === contact.id}
                      onCheckedChange={(checked) => {
                        void toggleFlag(contact.id, { canBid: checked })
                      }}
                    />
                  </ItemFooter>
                ) : null}
              </Item>
            ))}
          </ItemGroup>
        )}
        {sponsorActive ? (
          <form
            className="grid gap-2 border-t pt-3"
            onSubmit={(event) => void onCreateContact(event)}
          >
            <p className="text-sm font-medium">Add contact</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`contact-name-${sponsorId}`}>
                  Name
                </FieldLabel>
                <Input
                  id={`contact-name-${sponsorId}`}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                  }}
                  required
                  disabled={isCreating}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`contact-email-${sponsorId}`}>
                  Email
                </FieldLabel>
                <Input
                  id={`contact-email-${sponsorId}`}
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                  }}
                  required
                  disabled={isCreating}
                />
              </Field>
            </div>
            <Button type="submit" size="sm" disabled={isCreating}>
              {isCreating ? <Spinner /> : "Add contact"}
            </Button>
          </form>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ContactPermissionSwitch({
  id,
  label,
  icon,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: string
  icon?: ReactNode
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal" className="justify-between">
      <FieldLabel htmlFor={id}>
        {icon}
        {label}
      </FieldLabel>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </Field>
  )
}
