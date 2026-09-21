import { Link } from "@tanstack/react-router"
import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import {
  HELP_SECTIONS,
  helpTopicAnchor,
  type HelpSection,
} from "@/features/help/help-content"
import { formatDate } from "@/lib/format/dates"

function Contents() {
  return (
    <nav
      aria-label="Help contents"
      className="top-0 flex flex-col gap-5 lg:sticky lg:max-h-screen lg:self-start lg:overflow-y-auto lg:py-1"
    >
      {HELP_SECTIONS.map((section) => (
        <div key={section.slug} className="flex flex-col gap-1.5">
          <Link
            to="/help"
            hash={section.slug}
            className="font-heading text-sm font-semibold"
          >
            {section.title}
          </Link>
          <ul className="flex flex-col gap-1 border-l pl-3">
            {section.topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  to="/help"
                  hash={helpTopicAnchor(section.slug, topic.id)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {topic.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Section({ section }: { section: HelpSection }) {
  const Icon = section.icon
  const headingId = `${section.slug}-heading`

  return (
    <section
      id={section.slug}
      className="flex scroll-mt-16 flex-col gap-6"
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
                to="/help"
                hash={anchor}
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

export function HelpPage() {
  return (
    <Page.Shell title="Help" contentClassName={PAGE_CONTENT_PADDING_SCROLL}>
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <Contents />
        <div className="flex min-w-0 flex-col gap-12">
          {HELP_SECTIONS.map((section) => (
            <Section key={section.slug} section={section} />
          ))}
        </div>
      </div>
    </Page.Shell>
  )
}
