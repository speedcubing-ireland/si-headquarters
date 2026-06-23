import { useQuery } from "convex/react"
import { useMemo, useState } from "react"
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
import { Page } from "@/components/layout/page"
import { UserDetailPanel } from "@/features/admin/users/user-detail-panel"
import { UsersSidebar } from "@/features/admin/users/users-sidebar"
import { userDisplayName } from "@/features/admin/users/utils"
import { cn } from "@/lib/utils"

export function AdminUsersPage() {
  const users = useQuery(api.users.queries.listForAdmin, {})
  const teams = useQuery(api.teams.queries.listForUserManagement, {})
  const currentUser = useQuery(api.users.queries.currentUser)

  const [requestedUserId, setRequestedUserId] = useState<Id<"users"> | null>(
    null
  )
  const [mobileShowsDetail, setMobileShowsDetail] = useState(false)
  const [detailDirty, setDetailDirty] = useState(false)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<Id<"users"> | null>(null)

  const sortedUsers = useMemo(() => {
    if (users === undefined) {
      return []
    }
    return [...users].sort((left, right) =>
      userDisplayName(left).localeCompare(userDisplayName(right))
    )
  }, [users])

  const selectedUserId = useMemo(() => {
    if (
      requestedUserId !== null &&
      sortedUsers.some((user) => user._id === requestedUserId)
    ) {
      return requestedUserId
    }
    return sortedUsers[0]?._id ?? null
  }, [requestedUserId, sortedUsers])

  if (users === undefined || teams === undefined) {
    return <Page.Status variant="loading" message="Loading users…" />
  }

  function selectUser(userId: Id<"users">) {
    setRequestedUserId(userId)
    setMobileShowsDetail(true)
    setDetailDirty(false)
  }

  function requestSelectUser(userId: Id<"users">) {
    if (userId === selectedUserId) {
      setMobileShowsDetail(true)
      return
    }
    if (detailDirty) {
      setPendingUserId(userId)
      setDiscardDialogOpen(true)
      return
    }
    selectUser(userId)
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <UsersSidebar
        users={sortedUsers}
        selectedUserId={selectedUserId}
        onSelectUser={requestSelectUser}
        onUserCreated={selectUser}
        className={cn(
          "min-h-0 md:min-h-0",
          mobileShowsDetail && "hidden md:flex"
        )}
      />

      <UserDetailPanel
        userId={selectedUserId}
        allUsers={users}
        teams={teams}
        currentUserId={currentUser?._id ?? null}
        onDirtyChange={setDetailDirty}
        showBackButton
        onBack={() => {
          setMobileShowsDetail(false)
        }}
        className={cn(
          "min-h-0 min-w-0",
          !mobileShowsDetail && "hidden md:flex"
        )}
      />

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits will be lost if you switch users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingUserId(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUserId !== null) {
                  selectUser(pendingUserId)
                }
                setPendingUserId(null)
                setDiscardDialogOpen(false)
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
