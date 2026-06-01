import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { XIcon } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { cn } from "@/lib/utils"
import { AbilityRouteGuard } from "@/features/auth"

export const Route = createFileRoute("/admin/")({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  return (
    <AbilityRouteGuard
      action="manage"
      subject="UserManagement"
      deniedMessage="User management access is required."
      loadingMessage="Loading users…"
    >
      <AdminUsersContent />
    </AbilityRouteGuard>
  )
}

function AdminUsersContent() {
  const users = useQuery(api.users.queries.listForAdmin, {})
  const teams = useQuery(api.teams.queries.listForUserManagement, {})
  const addMember = useMutation(api.teams.mutations.addMember)
  const removeMember = useMutation(api.teams.mutations.removeMember)

  return (
    <Page.Shell
      title="Users"
      contentClassName={cn(PAGE_CONTENT_PADDING, "flex flex-col gap-6")}
    >
      {users !== undefined && teams !== undefined ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead>Add team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const memberTeamIds = new Set(user.teams.map((team) => team._id))
              const availableTeams = teams.filter(
                (team) => !memberTeamIds.has(team._id)
              )

              return (
                <TableRow key={user._id}>
                  <TableCell>
                    <div className="flex min-w-52 flex-col">
                      <span className="font-medium">
                        {user.name ?? user.email ?? "Unnamed user"}
                      </span>
                      {user.email !== undefined && user.email.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-xl flex-wrap gap-1.5">
                      {user.teams.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          No teams
                        </span>
                      ) : (
                        user.teams.map((team) => (
                          <Badge key={team._id} variant="outline">
                            {team.name}
                            <Button
                              type="button"
                              variant="icon"
                              size="icon-xs"
                              aria-label={`Remove ${team.name}`}
                              onClick={() =>
                                void removeMember({
                                  teamId: team._id,
                                  userId: user._id,
                                })
                              }
                            >
                              <XIcon />
                            </Button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <AddTeamSelect
                      userId={user._id}
                      teams={availableTeams}
                      onAdd={(teamId) =>
                        void addMember({ teamId, userId: user._id })
                      }
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <Page.Status variant="loading" message="Loading users…" />
      )}
    </Page.Shell>
  )
}

function AddTeamSelect({
  userId,
  teams,
  onAdd,
}: {
  userId: Id<"users">
  teams: { _id: Id<"teams">; name: string }[]
  onAdd: (teamId: Id<"teams">) => void
}) {
  return (
    <NativeSelect
      key={`${userId}:${teams.map((team) => team._id).join(",")}`}
      size="sm"
      value=""
      disabled={teams.length === 0}
      aria-label="Add team"
      onChange={(event) => {
        const teamId = event.currentTarget.value
        const team = teams.find((entry) => entry._id === teamId)
        if (team !== undefined) {
          onAdd(team._id)
        }
      }}
    >
      <NativeSelectOption value="">Select team</NativeSelectOption>
      {teams.map((team) => (
        <NativeSelectOption key={team._id} value={team._id}>
          {team.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
