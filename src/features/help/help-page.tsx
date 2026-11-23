import { Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ListIcon,
} from "lucide-react"
import { useState } from "react"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { helpTopicAnchor } from "@/features/help/help-anchors"
import { findHelpSection, type HelpSection } from "@/features/help/help-content"
import { HelpLink } from "@/features/help/help-prose"
import { useActiveTopic } from "@/features/help/use-active-topic"
import { VisibleHelpSectionsContext } from "@/features/help/help-visibility"
import { useHelpSections } from "@/features/help/use-help-sections"
import { formatDate } from "@/lib/format/dates"
import { cn } from "@/lib/utils"

interface ContentsProps {
  sections: readonly HelpSection[]
  current: HelpSection
  activeTopicId: string | undefined
}

/**
 * Every section, with the current one opened out to its topics. The topic
 * being read is highlighted, so the list doubles as a "you are here".
 */
function Contents({ sections, current, activeTopicId }: ContentsProps) {
  return (
    <ul className="flex flex-col gap-3">
      {sections.map((section) => {
        const Icon = section.icon
        const isCurrent = section.slug === current.slug

        return (
          <li key={section.slug} className="flex flex-col gap-1.5">
            <HelpLink
              section={section.slug}
              className={cn(
                "flex items-center gap-2 font-heading text-sm",
                isCurrent
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {section.title}
            </HelpLink>
            {isCurrent ? (
              <ul className="ml-2 flex flex-col border-l">
                {section.topics.map((topic) => (
                  <li key={topic.id}>
                    <HelpLink
                      section={section.slug}
                      topic={topic.id}
                      className={cn(
                        "-ml-px block border-l py-0.5 pl-3 text-sm text-muted-foreground hover:text-foreground",
                        topic.id === activeTopicId &&
                          "border-foreground font-medium text-foreground"
                      )}
                    >
                      {topic.title}
                    </HelpLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Small screens have no room for a sidebar, so the contents fold away. */
function MobileContents(props: ContentsProps) {
  const [open, setOpen] = useState(false)

  const activeTitle = props.current.topics.find(
    (topic) => topic.id === props.activeTopicId
  )?.title

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="sticky -top-4 z-10 -mx-4 -mt-4 border-b bg-background/95 px-4 py-2 backdrop-blur lg:hidden @lg/main:-top-6 @lg/main:-mx-6 @lg/main:-mt-6 @lg/main:px-6"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm">
        <ListIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-muted-foreground">On this page</span>
          {activeTitle === undefined ? null : (
            <span className="font-medium"> · {activeTitle}</span>
          )}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Picking a topic navigates; close the list so the topic is visible. */}
        <nav
          aria-label="Help contents"
          className="max-h-[60vh] overflow-y-auto pt-3 pb-1"
          onClick={() => {
            setOpen(false)
          }}
        >
          <Contents {...props} />
        </nav>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SectionBody({ section }: { section: HelpSection }) {
  const Icon = section.icon
  const headingId = `${section.slug}-heading`

  return (
    <section className="flex flex-col gap-8" aria-labelledby={headingId}>
      <header className="flex flex-col gap-2 border-b pb-4">
        <h2
          id={headingId}
          className="flex items-center gap-2.5 font-heading text-xl font-semibold"
        >
          <Icon className="size-5 text-muted-foreground" />
          {section.title}
        </h2>
        <p className="text-sm text-muted-foreground">{section.summary}</p>
        <p className="text-xs text-muted-foreground/70">
          Last reviewed {formatDate(section.lastReviewed)}
        </p>
      </header>
      {section.topics.map((topic) => {
        const { Body } = topic

        return (
          <article
            key={topic.id}
            id={helpTopicAnchor(section.slug, topic.id)}
            className="scroll-mt-16"
          >
            <h3 className="mb-3 font-heading text-base font-semibold">
              <HelpLink
                section={section.slug}
                topic={topic.id}
                className="hover:underline hover:underline-offset-4"
              >
                {topic.title}
              </HelpLink>
            </h3>
            <Body />
          </article>
        )
      })}
    </section>
  )
}

const NAV_CARD =
  "flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-sm hover:bg-muted/40"

function NavCardLabel({
  label,
  title,
  direction,
}: {
  label: string
  title: string
  direction: "previous" | "next"
}) {
  return (
    <>
      <span
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          direction === "next" && "sm:justify-end"
        )}
      >
        {direction === "previous" ? (
          <>
            <ArrowLeftIcon className="size-3" /> {label}
          </>
        ) : (
          <>
            {label} <ArrowRightIcon className="size-3" />
          </>
        )}
      </span>
      <span className="truncate font-medium">{title}</span>
    </>
  )
}

function PreviousNext({
  previous,
  next,
}: {
  previous: HelpSection | undefined
  next: HelpSection | undefined
}) {
  return (
    <nav
      aria-label="More help"
      className="grid gap-3 border-t pt-6 sm:grid-cols-2"
    >
      {previous === undefined ? (
        <Link to="/help" activeOptions={{ exact: true }} className={NAV_CARD}>
          <NavCardLabel label="Back" title="All help" direction="previous" />
        </Link>
      ) : (
        <HelpLink section={previous.slug} className={NAV_CARD}>
          <NavCardLabel
            label="Previous"
            title={previous.title}
            direction="previous"
          />
        </HelpLink>
      )}
      {next === undefined ? null : (
        <HelpLink section={next.slug} className={cn(NAV_CARD, "sm:text-right")}>
          <NavCardLabel label="Next" title={next.title} direction="next" />
        </HelpLink>
      )}
    </nav>
  )
}

export function HelpSectionPage({ slug }: { slug: string }) {
  const { sections, isLoading } = useHelpSections()
  const section = findHelpSection(sections, slug)
  const activeTopicId = useActiveTopic(section)

  if (section === undefined) {
    return (
      <Page.Shell title="Help">
        {isLoading ? (
          <Page.Status variant="loading" message="Loading help…" />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Page.Status
              variant="empty"
              message="There is no help page here, or it is not one you can see."
            />
            <Link to="/help" className="text-sm underline underline-offset-4">
              Browse all help
            </Link>
          </div>
        )}
      </Page.Shell>
    )
  }

  const index = sections.indexOf(section)
  const contents = { sections, current: section, activeTopicId }

  return (
    <Page.Shell title="Help" contentClassName={PAGE_CONTENT_PADDING_SCROLL}>
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <MobileContents {...contents} />
        <nav
          aria-label="Help contents"
          className="top-0 hidden lg:sticky lg:block lg:max-h-screen lg:self-start lg:overflow-y-auto lg:py-1"
        >
          <Link
            to="/help"
            activeOptions={{ exact: true }}
            className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" /> All help
          </Link>
          <Contents {...contents} />
        </nav>
        <div className="flex min-w-0 flex-col gap-10">
          <VisibleHelpSectionsContext value={sections}>
            <SectionBody section={section} />
          </VisibleHelpSectionsContext>
          <PreviousNext
            previous={sections[index - 1]}
            next={sections[index + 1]}
          />
        </div>
      </div>
    </Page.Shell>
  )
}
