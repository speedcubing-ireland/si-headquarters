import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { isFeatureEnabled } from "@/config/lib/organisation"
import {
  ADMIN_SETTINGS_FEATURES,
  type AdminSettingsFeature,
} from "@/features/admin/settings/availability"
import {
  Definitions,
  HelpTopicLink,
  Note,
  Prose,
  Ui,
} from "@/features/help/help-prose"

/**
 * What each Admin → Settings card holds. Keyed by the feature it configures, so
 * a new card cannot ship without help describing it.
 */
const SETTINGS_CARDS: Record<
  AdminSettingsFeature,
  { term: string; description: ReactNode }
> = {
  canva: {
    term: "Canva",
    description:
      "The brand template each Canva integration fills in, such as certificates or lanyards, and the folder the new design is saved to. Leave a preset empty to turn that integration off.",
  },
  records: {
    term: "Weekly records email",
    description: (
      <>
        Who receives the{" "}
        <HelpTopicLink section="records" topic="weekly-email">
          Monday records email
        </HelpTopicLink>
        , and who it comes from.
      </>
    ),
  },
  sponsors: {
    term: "Sponsorship emails",
    description:
      "The sender of sponsor portal sign-in codes and sponsorship emails. Left empty, it falls back to the sponsorship team's name and address.",
  },
  wcaIntegration: {
    term: "SI Achievements",
    description:
      "Where the badges link on competition tasks points. Leave it empty to hide the link.",
  },
}

/** The cards this deployment shows, the same way Admin → Settings picks them. */
function settingsCards() {
  return ADMIN_SETTINGS_FEATURES.filter((feature) =>
    isFeatureEnabled(feature)
  ).map((feature) => SETTINGS_CARDS[feature])
}

export function AdminSettings() {
  return (
    <Prose>
      <p>
        <Link
          to="/admin"
          search={{ tab: "settings" }}
          className="underline underline-offset-4"
        >
          Admin → Settings
        </Link>{" "}
        holds the choices staff change while running the organisation, without a
        deploy. Each card saves on its own:
      </p>
      <Definitions items={settingsCards()} />
      <Note>
        Secrets — API keys, sign-in clients, and signing keys — are not here.
        They stay in the deployment's environment, where only the people who
        deploy the app can change them.
      </Note>
    </Prose>
  )
}

export function AdminWcaPhases() {
  return (
    <Prose>
      <p>
        <Ui>Admin → WCA phases</Ui> decides which WCA milestone moves a
        competition into which phase. Saving it takes effect from the next sync,
        and{" "}
        <HelpTopicLink section="competition-phases" topic="milestones">
          What moves a competition on
        </HelpTopicLink>{" "}
        always shows the mapping as it is currently saved.
      </p>
      <p>
        Each phase can back at most one milestone. Leaving a milestone unmapped
        means it moves nothing, and a phase no milestone reaches can only be set
        by hand.
      </p>
    </Prose>
  )
}
