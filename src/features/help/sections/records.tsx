import { Link } from "@tanstack/react-router"
import {
  Bullets,
  Definitions,
  HelpTopicLink,
  Note,
  Prose,
  Ui,
} from "@/features/help/help-prose"

export function WhereRecordsComeFrom() {
  return (
    <Prose>
      <p>
        <Link
          to="/plugins/social-media"
          className="underline underline-offset-4"
        >
          Social Media
        </Link>{" "}
        has a <Ui>Records</Ui> tab listing every world, continental, and
        national record (<Ui>WR</Ui>, <Ui>CR</Ui>, <Ui>NR</Ui>) that concerns
        the organisation: records set by its own competitors anywhere in the
        world, and records set by anyone at a competition held in its country.
      </p>
      <p>They arrive from three places, without anyone entering them:</p>
      <Bullets>
        <li>
          <Ui>WCA Live</Ui>, checked every hour, so a record shows up while the
          competition is still running.
        </li>
        <li>
          <Ui>The WCA's posted results</Ui>, checked every three hours. These
          settle the WCA Live records, and add records from competitions WCA
          Live never had, such as those scored with the WCA's own live results.
        </li>
        <li>
          <Ui>The WCA's records history</Ui>, imported once, so older records
          are there to browse too.
        </li>
      </Bullets>
      <p>
        Records are grouped by competition. The link on each card opens the
        competition's results: on the WCA website once they are posted, and on
        WCA Live until then.
      </p>
    </Prose>
  )
}

export function RecordStatuses() {
  return (
    <Prose>
      <p>Each record carries a badge saying how far to trust it:</p>
      <Definitions
        items={[
          {
            term: "Provisional",
            description:
              "As entered on WCA Live. Usually right, but the WCA can still change or strike it before posting results.",
          },
          {
            term: "Confirmed",
            description:
              "The WCA's posted results still mark it as a record. Its result, name, and WCA ID are taken from the WCA at that point.",
          },
          {
            term: "No longer a record",
            description:
              "The WCA posted the results and the record did not stand — a better result elsewhere, or a correction. It is dimmed and struck through, and it has no caption to copy.",
          },
        ]}
      />
      <Note>
        A provisional record stays provisional until the WCA posts the results,
        which can take days. If a lookup fails, the next run tries again, so
        nothing is lost by waiting.
      </Note>
    </Prose>
  )
}

export function RecordFilters() {
  return (
    <Prose>
      <p>
        The filters along the top combine, so you can narrow the list down to
        exactly what you are posting about:
      </p>
      <Definitions
        items={[
          {
            term: "Period",
            description: (
              <>
                By competition end date. Choose a preset such as{" "}
                <Ui>Last 4 weeks</Ui> (the default), any date range, or{" "}
                <Ui>All time</Ui>. A very long period may show only the latest
                records; pick a shorter one to see the rest.
              </>
            ),
          },
          {
            term: "Event",
            description: "One WCA event, or all of them.",
          },
          {
            term: "Person",
            description: "One competitor's records.",
          },
          {
            term: "Competitors",
            description: (
              <>
                <Ui>Everyone</Ui>, <Ui>Our competitors</Ui>, or{" "}
                <Ui>Visitors at our competitions</Ui>.
              </>
            ),
          },
          {
            term: "Single / Average",
            description: "Either kind of result, or both.",
          },
          {
            term: "WR / CR / NR",
            description: "Which tiers of record to show.",
          },
        ]}
      />
      <p>
        The copy button next to a record puts a ready-made caption on your
        clipboard, naming the record, the competitor, and the competition.
      </p>
    </Prose>
  )
}

export function WeeklyRecordsEmail() {
  return (
    <Prose>
      <p>
        Every Monday morning an email goes out with the week's records, each
        competition shown with its dates. It has two lists:
      </p>
      <Bullets>
        <li>
          <Ui>Confirmed</Ui> — records the WCA's posted results have confirmed
          since the last email, whichever week their competition was in.
        </li>
        <li>
          <Ui>Provisional</Ui> — records from last week still as entered on WCA
          Live.
        </li>
      </Bullets>
      <p>
        A record first sent as provisional is sent again under{" "}
        <Ui>Confirmed</Ui> once the WCA confirms it, so seeing one twice is
        expected. Records that turn out not to stand are left out.
      </p>
      <Note>
        Who receives the email, and who it comes from, is set by a director in{" "}
        <HelpTopicLink section="admin" topic="settings">
          Admin → Settings
        </HelpTopicLink>
        .
      </Note>
    </Prose>
  )
}
