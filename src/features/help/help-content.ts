import type { LucideIcon } from "lucide-react"
import { CompassIcon, MilestoneIcon } from "lucide-react"
import type { ComponentType } from "react"
import type { FeatureId } from "@/config/lib/organisation"
import { isFeatureEnabled } from "@/config/lib/organisation"
import * as Phases from "@/features/help/sections/competition-phases"
import * as GettingStarted from "@/features/help/sections/getting-started"

/**
 * One addressable chunk of a help section. Topics carry their own anchor id so
 * the contents list, the `#` deep links, and the rendered body all come from
 * the same declaration — a topic cannot appear in the contents without
 * rendering, or render without being linkable.
 */
export interface HelpTopic {
  id: string
  title: string
  Body: ComponentType
}

export interface HelpSection {
  slug: string
  title: string
  summary: string
  icon: LucideIcon
  /**
   * Hide the section when the organisation has the feature turned off. Help for
   * a screen this deployment does not have is worse than no help at all.
   */
  feature?: FeatureId
  /**
   * When the prose was last checked against the app. Sections drift as the UI
   * changes, and a reader deserves to know how much to trust them. Sections
   * generated from the template drift too: they restate what the code ships
   * with, which is only part of what a deployment can be configured to do.
   */
  lastReviewed: string
  topics: readonly HelpTopic[]
}

export function helpTopicAnchor(sectionSlug: string, topicId: string): string {
  return `${sectionSlug}--${topicId}`
}

/**
 * The whole help area in one declaration: every section, its topics, and the
 * order they are read in. Topic bodies live beside each other in the section
 * files and are referenced from here, so the contents list, the `#` anchors,
 * and what actually renders can never disagree.
 */
const ALL_HELP_SECTIONS: readonly HelpSection[] = [
  {
    slug: "getting-started",
    title: "Competitions, tasks, and subtasks",
    summary:
      "How the app is put together, and how to run a competition through it from first idea to finished event.",
    icon: CompassIcon,
    lastReviewed: "2026-09-21",
    topics: [
      {
        id: "how-it-fits",
        title: "How it fits together",
        Body: GettingStarted.HowItFitsTogether,
      },
      {
        id: "starting-a-competition",
        title: "Starting a competition",
        Body: GettingStarted.StartingACompetition,
      },
      {
        id: "competition-page",
        title: "The competition page",
        Body: GettingStarted.TheCompetitionPage,
      },
      {
        id: "phase-sections",
        title: "Phases and progress",
        Body: GettingStarted.PhaseSections,
      },
      {
        id: "working-on-a-task",
        title: "Working on a task",
        Body: GettingStarted.WorkingOnATask,
      },
      {
        id: "status",
        title: "Status, and when it is set for you",
        Body: GettingStarted.StatusRules,
      },
      {
        id: "subtasks-and-flows",
        title: "Subtasks and flows",
        Body: GettingStarted.SubtasksAndFlows,
      },
      {
        id: "blockers-and-reviewers",
        title: "Blockers and reviewers",
        Body: GettingStarted.BlockersAndReviewers,
      },
      {
        id: "finding-your-work",
        title: "Finding your work",
        Body: GettingStarted.FindingYourWork,
      },
    ],
  },
  {
    slug: "competition-phases",
    title: "Phases and the WCA",
    summary:
      "The phases a competition moves through, what advances it between them, and why it sometimes does not.",
    icon: MilestoneIcon,
    feature: "wcaIntegration",
    lastReviewed: "2026-09-21",
    topics: [
      { id: "ladder", title: "The phases", Body: Phases.PhaseLadder },
      {
        id: "milestones",
        title: "What moves a competition on",
        Body: Phases.MilestoneMapping,
      },
      {
        id: "not-moving",
        title: "Why a competition did not move",
        Body: Phases.WhyItDidNotMove,
      },
    ],
  },
]

/**
 * Sections this organisation has the features for. Filtered at module level in
 * the same way as `PLUGINS`, because a feature manifest does not change while
 * the app is running.
 */
export const HELP_SECTIONS: readonly HelpSection[] = ALL_HELP_SECTIONS.filter(
  (section) =>
    section.feature === undefined || isFeatureEnabled(section.feature)
)
