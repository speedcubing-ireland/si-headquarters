import { Link } from "@tanstack/react-router"
import { isFeatureEnabled } from "@/config/lib/organisation"
import {
  Definitions,
  HelpTopicLink,
  Note,
  Prose,
  Ui,
} from "@/features/help/help-prose"

/**
 * The Admin → Settings cards, each shown only when the feature it configures
 * is on, matching `hasAdminSettings` and the cards themselves.
 */
function settingsCards() {
  return [
    isFeatureEnabled("canva") && {
      term: "Canva",
      description:
        "The brand template each Canva integration fills in, such as certificates or lanyards, and the folder the new design is saved to. Leave a preset empty to turn that integration off.",
    },
    isFeatureEnabled("records") && {
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
    isFeatureEnabled("sponsors") && {
      term: "Sponsorship emails",
      description:
        "The sender of sponsor portal sign-in codes and sponsorship emails. Left empty, it falls back to the sponsorship team's name and address.",
    },
    isFeatureEnabled("wcaIntegration") && {
      term: "SI Achievements",
      description:
        "Where the badges link on competition tasks points. Leave it empty to hide the link.",
    },
  ].filter((card) => card !== false)
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
