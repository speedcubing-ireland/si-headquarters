import { useMutation, useQuery } from "convex/react"
import { ArrowLeftIcon } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ObjectAvatar } from "@/components/object-avatar"
import { DiscordLinkSection } from "@/features/admin/users/discord-link-card"
import { TeamMembershipChips } from "@/features/admin/users/team-membership-chips"
import { useUserManagementDraft } from "@/features/admin/users/use-user-management-draft"
import type {
  AdminUser,
  UserManagementTeam,
} from "@/features/admin/users/utils"
import {
  buildLinkedDiscordByUserId,
  formatPermissionLabel,
  userDisplayName,
} from "@/features/admin/users/utils"
import { cn } from "@/lib/utils"

function UserSettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description !== undefined ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
        {action !== undefined ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      {children !== undefined ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}

export function UserDetailPanel({
  userId,
  allUsers,
  teams,
  currentUserId,
  onBack,
  showBackButton,
  onDirtyChange,
  className,
}: {
  userId: Id<"users"> | null
  allUsers: AdminUser[]
  teams: UserManagementTeam[]
  currentUserId: Id<"users"> | null
  onBack?: () => void
  showBackButton?: boolean
  onDirtyChange?: (dirty: boolean) => void
  className?: string
}) {
  const user = useQuery(
    api.users.queries.getForAdmin,
    userId !== null ? { userId } : "skip"
  )
  const updateUser = useMutation(api.users.mutations.updateForAdmin)

  const { draft, dirty, updateDraft, toggleTeam } = useUserManagementDraft(
    user ?? undefined
  )

  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const linkedDiscordByUserId = useMemo(
    () => buildLinkedDiscordByUserId(allUsers),
    [allUsers]
  )
  const isSelf = currentUserId === userId

  if (userId === null) {
    return (
      <EmptyDetailState className={className}>
        Select a user to manage their account.
      </EmptyDetailState>
    )
  }

  if (user === undefined) {
    return (
      <EmptyDetailState className={className}>Loading…</EmptyDetailState>
    )
  }

  if (user === null || draft === null) {
    return (
      <EmptyDetailState className={className}>User not found.</EmptyDetailState>
    )
  }

  async function handleSave() {
    if (user === null || user === undefined || draft === null) {
      return
    }
    setIsSaving(true)
    try {
      await updateUser({
        userId: user._id,
        disabled: !draft.enabled,
        teamIds: [...draft.teamIds],
        discord: draft.discord,
      })
      toast.success("Saved")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save."
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto",
        className
      )}
    >
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            {showBackButton === true && onBack !== undefined ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 md:hidden"
                onClick={onBack}
                aria-label="Back"
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
            ) : null}
            <ObjectAvatar
              obj={{ _id: user._id, name: user.name, image: user.image }}
              avatarUrl={user.avatarUrl}
              size="lg"
              className="shrink-0"
            />
            <div className="min-w-0">
              <CardTitle className="truncate">{userDisplayName(user)}</CardTitle>
              {user.email !== undefined && user.email.length > 0 ? (
                <CardDescription className="truncate">
                  {user.email}
                </CardDescription>
              ) : null}
            </div>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {user.disabled ? (
                <Badge variant="destructive" className="hidden sm:inline-flex">
                  Disabled
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className={cn(!dirty && "pointer-events-none opacity-0")}
                aria-hidden={!dirty}
              >
                Unsaved
              </Badge>
              <Button
                type="button"
                size="sm"
                disabled={!dirty || isSaving}
                onClick={() => {
                  void handleSave()
                }}
              >
                {isSaving ? <Spinner /> : null}
                Save
              </Button>
            </div>
          </CardAction>
        </CardHeader>
      </Card>

      <UserSettingsCard
        title="Account"
        description="Disabled users cannot sign in to HQ."
        action={
          <Switch
            id="account-enabled"
            checked={draft.enabled}
            disabled={isSelf}
            aria-label="Account enabled"
            onCheckedChange={(enabled) => {
              if (!enabled) {
                setDisableDialogOpen(true)
                return
              }
              updateDraft((current) => ({ ...current, enabled: true }))
            }}
          />
        }
      />

      <UserSettingsCard title="Discord">
        <DiscordLinkSection
          user={user}
          discord={draft.discord}
          linkedDiscordByUserId={linkedDiscordByUserId}
          onDiscordChange={(discord) => {
            updateDraft((current) => ({ ...current, discord }))
          }}
        />
      </UserSettingsCard>

      <UserSettingsCard title="Teams">
        <TeamMembershipChips
          teams={teams}
          selectedTeamIds={draft.teamIds}
          onToggleTeam={toggleTeam}
        />
      </UserSettingsCard>

      <UserSettingsCard
        title="Permissions"
        description="Effective grants from current team membership."
      >
        {user.effectivePermissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {user.effectivePermissions.map((permission) => (
              <Badge
                key={`${permission.action}:${permission.subject}`}
                variant="secondary"
              >
                {formatPermissionLabel(permission)}
              </Badge>
            ))}
          </div>
        )}
      </UserSettingsCard>

      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable account?</AlertDialogTitle>
            <AlertDialogDescription>
              They will not be able to sign in until re-enabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                updateDraft((current) => ({ ...current, enabled: false }))
                setDisableDialogOpen(false)
              }}
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyDetailState({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Empty
      className={cn(
        "min-h-0 flex-1 rounded-xl border-solid bg-card ring-1 ring-foreground/10",
        className
      )}
    >
      <EmptyDescription>{children}</EmptyDescription>
    </Empty>
  )
}
