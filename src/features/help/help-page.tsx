import { Link, useLocation } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ListIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  findHelpSection,
  helpTopicAnchor,
  type HelpSection,
} from "@/features/help/help-content"
import { useHelpSections } from "@/features/help/use-help-sections"
import { useActiveTopic } from "@/features/help/use-active-topic"
import { formatDate } from "@/lib/format/dates"
import { cn } from "@/lib/utils"

function SectionLink({
  section,
  className,
  children,
}: {
  section: HelpSection
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      to="/help/$section"
      params={{ section: section.slug }}
      activeOptions={{ exact: true }}
      className={className}
    >
      {children}
    </Link>
  )
}

function TopicLink({
  section,
  topicId,
  active,
  children,
}: {
  section: HelpSection
  topicId: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to="/help/$section"
      params={{ section: section.slug }}
      hash={helpTopicAnchor(section.slug, topicId)}
      // Every topic shares the section's path, so without the hash the router
      // would mark all of them as the current page.
      activeOptions={{ exact: true, includeHash: true }}
      data-reading={active ? "" : undefined}
      className={cn(
        "-ml-px block border-l py-0.5 pl-3 text-sm text-muted-foreground hover:text-foreground",
        active && "border-foreground font-medium text-foreground"
      )}
    >
      {children}
    </Link>
  )
}

/**
 * Every section, with the current one opened out to its topics. The topic
 * being read is highlighted, so the list doubles as a "you are here".
 */
function Contents({
  sections,
  current,
  activeTopicId,
}: {
  sections: readonly HelpSection[]
  current: HelpSection
  activeTopicId: string | undefined
}) {
  return (
    <ul className="flex flex-col gap-3">
      {sections.map((section) => {
        const Icon = section.icon
        const isCurrent = section.slug === current.slug

        return (
          <li key={section.slug} className="flex flex-col gap-1.5">
            <SectionLink
              section={section}
              className={cn(
                "flex items-center gap-2 font-heading text-sm",
                isCurrent
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {section.title}
            </SectionLink>
            {isCurrent ? (
              <ul className="ml-2 flex flex-col border-l">
                {section.topics.map((topic) => (
                  <li key={topic.id}>
                    <TopicLink
                      section={section}
                      topicId={topic.id}
                      active={topic.id === activeTopicId}
                    >
                      {topic.title}
                    </TopicLink>
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
function MobileContents(props: {
  sections: readonly HelpSection[]
  current: HelpSection
  activeTopicId: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Picking a topic navigates; close the list so the topic is visible.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

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
        <nav
          aria-label="Help contents"
          className="max-h-[60vh] overflow-y-auto pt-3 pb-1"
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
    <section
      id={section.slug}
      className="flex flex-col gap-8"
      aria-labelledby={headingId}
    >
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
        const anchor = helpTopicAnchor(section.slug, topic.id)
        const { Body } = topic

        return (
          <article key={topic.id} id={anchor} className="scroll-mt-16">
            <h3 className="mb-3 font-heading text-base font-semibold">
              <Link
                to="/help/$section"
                params={{ section: section.slug }}
                hash={anchor}
                activeOptions={{ exact: true, includeHash: true }}
                className="hover:underline hover:underline-offset-4"
              >
                {topic.title}
              </Link>
            </h3>
            <Body />
          </article>
        )
      })}
    </section>
  )
}

function PreviousNext({
  previous,
  next,
}: {
  previous: HelpSection | undefined
  next: HelpSection | undefined
}) {
  const card =
    "flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-sm hover:bg-muted/40"

  return (
    <nav
      aria-label="More help"
      className="grid gap-3 border-t pt-6 sm:grid-cols-2"
    >
      {previous === undefined ? (
        <Link to="/help" activeOptions={{ exact: true }} className={card}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeftIcon className="size-3" /> Back
          </span>
          <span className="font-medium">All help</span>
        </Link>
      ) : (
        <SectionLink section={previous} className={card}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeftIcon className="size-3" /> Previous
          </span>
          <span className="truncate font-medium">{previous.title}</span>
        </SectionLink>
      )}
      {next === undefined ? null : (
        <SectionLink section={next} className={cn(card, "sm:text-right")}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
            Next <ArrowRightIcon className="size-3" />
          </span>
          <span className="truncate font-medium">{next.title}</span>
        </SectionLink>
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

  return (
    <Page.Shell title="Help" contentClassName={PAGE_CONTENT_PADDING_SCROLL}>
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <MobileContents
          sections={sections}
          current={section}
          activeTopicId={activeTopicId}
        />
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
          <Contents
            sections={sections}
            current={section}
            activeTopicId={activeTopicId}
          />
        </nav>
        <div className="flex min-w-0 flex-col gap-10">
          <SectionBody section={section} />
          <PreviousNext
            previous={sections[index - 1]}
            next={sections[index + 1]}
          />
        </div>
      </div>
    </Page.Shell>
  )
}

/** The front page of Help: one card per section, with its topics. */
export function HelpOverview() {
  const { sections } = useHelpSections()

  return (
    <Page.Shell title="Help" contentClassName={PAGE_CONTENT_PADDING_SCROLL}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Pick a topic to read about. Each one has its own page, and every
          heading links to itself so you can share exactly the part you mean.
        </p>
        <ul className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon

            return (
              <li
                key={section.slug}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4"
              >
                <SectionLink
                  section={section}
                  className="group flex flex-col gap-1"
                >
                  <span className="flex items-center gap-2 font-heading font-semibold group-hover:underline group-hover:underline-offset-4">
                    <Icon className="size-4 text-muted-foreground" />
                    {section.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {section.summary}
                  </span>
                </SectionLink>
                <ul className="flex flex-col gap-1 border-l pl-3">
                  {section.topics.map((topic) => (
                    <li key={topic.id}>
                      <Link
                        to="/help/$section"
                        params={{ section: section.slug }}
                        hash={helpTopicAnchor(section.slug, topic.id)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {topic.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </div>
    </Page.Shell>
  )
}
