import * as UserSelector from "@/components/data-selectors/user-selector"
import * as UserTeamSelector from "@/components/data-selectors/user-team-selector"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { UserIcon, UsersRoundIcon } from "lucide-react"
import { PageCard, PageCardContent, PageCardRow } from "@/components/page-card"

type ProjectPeople = FunctionReturnType<typeof api.projects.queries.getPeople>
type ProjectMemberRef = Doc<"projectMembers">["member"]

function toProjectMemberRef(
  member: ProjectPeople["members"][number]
): ProjectMemberRef {
  return member.type === "users"
    ? { type: "users", id: member._id }
    : { type: "teams", id: member._id }
}

export function ProjectPeopleCard({
  canUpdate,
  projectId,
}: {
  canUpdate: boolean
  projectId: Id<"projects">
}) {
  const people = useQuery(api.projects.queries.getPeople, { id: projectId })
  const setLead = useMutation(api.projects.mutations.setLead)
  const setMembers = useMutation(api.projects.mutations.setMembers)

  if (people === undefined) {
    return null
  }

  const { project, lead, members } = people

  return (
    <PageCard title="People" icon={<UserIcon className="size-4" />}>
      <PageCardContent>
        <PageCardRow
          icon={<UserIcon className="size-4" />}
          label="Project lead"
        >
          <UserSelector.SinglePropertyButton
            selectedUser={lead}
            value={project.leadUserId}
            disabled={!canUpdate}
            onChange={(userId) => {
              void setLead({ id: projectId, leadUserId: userId })
            }}
          />
        </PageCardRow>
        <PageCardRow
          icon={<UsersRoundIcon className="size-4" />}
          label="Members"
        >
          <UserTeamSelector.MultiPropertyButton
            projectId={projectId}
            selectedMembers={members}
            value={members.map(toProjectMemberRef)}
            disabled={!canUpdate}
            onChange={(nextMembers) => {
              void setMembers({ id: projectId, members: nextMembers })
            }}
          />
        </PageCardRow>
      </PageCardContent>
    </PageCard>
  )
}
