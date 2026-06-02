import type { Dispatch, SetStateAction, SubmitEvent } from "react"
import { toast } from "sonner"
import type { Id } from "@/convex/_generated/dataModel"

export interface SponsorActionsDeps {
  name: string
  email: string
  avatarUrl: string
  createSponsor: (args: {
    name: string
    email: string
    avatarUrl?: string
  }) => Promise<Id<"sponsors">>
  sendAccessEmail: (sponsorId: Id<"sponsors">) => Promise<{
    sentTo: string
    hasAuthAccount: boolean
  }>
  revokeSessions: (sponsorId: Id<"sponsors">) => Promise<null>
  archiveSponsor: (sponsorId: Id<"sponsors">) => Promise<null>
  unarchiveSponsor: (sponsorId: Id<"sponsors">) => Promise<null>
  setName: Dispatch<SetStateAction<string>>
  setEmail: Dispatch<SetStateAction<string>>
  setAvatarUrl: Dispatch<SetStateAction<string>>
  setIsSubmittingSponsor: Dispatch<SetStateAction<boolean>>
  setBusySponsorId: Dispatch<SetStateAction<Id<"sponsors"> | null>>
}

export function buildSponsorActions(deps: SponsorActionsDeps) {
  const {
    name,
    email,
    avatarUrl,
    createSponsor,
    sendAccessEmail,
    revokeSessions,
    archiveSponsor,
    unarchiveSponsor,
    setName,
    setEmail,
    setAvatarUrl,
    setIsSubmittingSponsor,
    setBusySponsorId,
  } = deps

  const onCreateSponsor = async (event: SubmitEvent) => {
    event.preventDefault()
    setIsSubmittingSponsor(true)
    try {
      await createSponsor({
        name,
        email,
        avatarUrl: avatarUrl || undefined,
      })
      toast.success("Sponsor created.")
      setName("")
      setEmail("")
      setAvatarUrl("")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create sponsor."
      toast.error(message)
    } finally {
      setIsSubmittingSponsor(false)
    }
  }

  const onSendAccessEmail = async (sponsorId: Id<"sponsors">) => {
    setBusySponsorId(sponsorId)
    try {
      await sendAccessEmail(sponsorId)
      toast.success("Sponsor access email sent.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send access email."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  const onResetSessions = async (sponsorId: Id<"sponsors">) => {
    setBusySponsorId(sponsorId)
    try {
      await revokeSessions(sponsorId)
      toast.success("Sponsor sessions revoked.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to revoke sessions."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  const onArchiveSponsor = async (sponsorId: Id<"sponsors">) => {
    const shouldArchive = window.confirm(
      "Archive this sponsor? They will lose portal access until unarchived."
    )
    if (!shouldArchive) return
    setBusySponsorId(sponsorId)
    try {
      await archiveSponsor(sponsorId)
      toast.success("Sponsor archived and active sessions revoked.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to archive sponsor."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  const onUnarchiveSponsor = async (sponsorId: Id<"sponsors">) => {
    setBusySponsorId(sponsorId)
    try {
      await unarchiveSponsor(sponsorId)
      toast.success("Sponsor reactivated.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reactivate sponsor."
      toast.error(message)
    } finally {
      setBusySponsorId(null)
    }
  }

  return {
    onCreateSponsor,
    onSendAccessEmail,
    onResetSessions,
    onArchiveSponsor,
    onUnarchiveSponsor,
  }
}
