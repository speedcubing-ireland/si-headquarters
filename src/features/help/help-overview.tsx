import { Page, PAGE_CONTENT_PADDING_SCROLL } from "@/components/layout/page"
import { HelpLink } from "@/features/help/help-prose"
import { useHelpSections } from "@/features/help/use-help-sections"

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
                <HelpLink
                  section={section.slug}
                  className="group flex flex-col gap-1"
                >
                  <span className="flex items-center gap-2 font-heading font-semibold group-hover:underline group-hover:underline-offset-4">
                    <Icon className="size-4 text-muted-foreground" />
                    {section.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {section.summary}
                  </span>
                </HelpLink>
                <ul className="flex flex-col gap-1 border-l pl-3">
                  {section.topics.map((topic) => (
                    <li key={topic.id}>
                      <HelpLink
                        section={section.slug}
                        topic={topic.id}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {topic.title}
                      </HelpLink>
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
