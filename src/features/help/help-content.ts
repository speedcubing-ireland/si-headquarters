import type { LucideIcon } from "lucide-react"
import { CompassIcon, MedalIcon, MilestoneIcon, ShieldIcon } from "lucide-react"
import type { ComponentType } from "react"
import type { FeatureId } from "@/config/lib/organisation"
import { isFeatureEnabled } from "@/config/lib/organisation"
import type { AdminTab } from "@/features/admin/types"
import * as Admin from "@/features/help/sections/admin"
import * as Phases from "@/features/help/sections/competition-phases"
import * as GettingStarted from "@/features/help/sections/getting-started"
import * as Records from "@/features/help/sections/records"

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
  /**
   * The Admin tab this topic describes. The topic is shown exactly when the
   * reader can open that tab, so help never explains a screen they cannot see.
   */
  adminTab?: AdminTab
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

/**
 * The whole help area in one declaration: every section, its topics, and the
 * order they are read in. Topic bodies live beside each other in the section
 * files and are referenced from here, so the contents list, the `#` anchors,
 * and what actually renders can never disagree.
 */
export const ALL_HELP_SECTIONS = [
  {
    slug: "getting-started",
    title: "Competitions, tasks, and subtasks",
    summary:
      "How the app is put together, and how to run a competition through it from first idea to finished event.",
    icon: CompassIcon,
    lastReviewed: "2026-11-23",
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
        id: "people-pickers",
        title: "Who you can pick",
        Body: GettingStarted.PeoplePickers,
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
    lastReviewed: "2026-11-23",
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
  {
    slug: "records",
    title: "Records",
    summary:
      "The records the Social Media page collects, how far to trust each one, and the weekly email that lists them.",
    icon: MedalIcon,
    feature: "records",
    lastReviewed: "2026-11-23",
    topics: [
      {
        id: "where",
        title: "Where records come from",
        Body: Records.WhereRecordsComeFrom,
      },
      {
        id: "statuses",
        title: "Provisional and confirmed",
        Body: Records.RecordStatuses,
      },
      {
        id: "filters",
        title: "Finding a record",
        Body: Records.RecordFilters,
      },
      {
        id: "weekly-email",
        title: "The weekly records email",
        Body: Records.WeeklyRecordsEmail,
      },
    ],
  },
  {
    slug: "admin",
    title: "Administration",
    summary:
      "Settings directors change while running the organisation, and where to find them.",
    icon: ShieldIcon,
    lastReviewed: "2026-11-23",
    topics: [
      {
        id: "settings",
        title: "Settings",
        Body: Admin.AdminSettings,
        adminTab: "settings",
      },
      {
        id: "wca-phases",
        title: "WCA phases",
        Body: Admin.AdminWcaPhases,
        adminTab: "wcaPhases",
      },
    ],
  },
] as const satisfies readonly HelpSection[]

/**
 * Every section slug, mapped to the ids of its topics. Lets cross-links between
 * topics be checked by the compiler rather than discovered as dead links.
 */
export type HelpTopicRefs = {
  [S in (typeof ALL_HELP_SECTIONS)[number] as S["slug"]]: S["topics"][number]["id"]
}

export type HelpSectionSlug = keyof HelpTopicRefs

/**
 * Sections this organisation has the features for. Filtered at module level in
 * the same way as `PLUGINS`, because a feature manifest does not change while
 * the app is running.
 */
export const HELP_SECTIONS: readonly HelpSection[] = ALL_HELP_SECTIONS.filter(
  (section: HelpSection) =>
    section.feature === undefined || isFeatureEnabled(section.feature)
)

/**
 * The sections a reader can see, given the Admin tabs they can open. Topics
 * about a tab the reader lacks are left out, and so is any section left with
 * nothing to show.
 */
export function visibleHelpSections(
  sections: readonly HelpSection[],
  adminTabs: readonly AdminTab[]
): readonly HelpSection[] {
  return sections.flatMap((section) => {
    const topics = section.topics.filter(
      (topic) =>
        topic.adminTab === undefined || adminTabs.includes(topic.adminTab)
    )
    if (topics.length === 0) return []
    return topics.length === section.topics.length
      ? [section]
      : [{ ...section, topics }]
  })
}

export function findHelpSection(
  sections: readonly HelpSection[],
  slug: string
): HelpSection | undefined {
  return sections.find((section) => section.slug === slug)
}
