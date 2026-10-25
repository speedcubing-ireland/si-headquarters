import type { Record as WcaRecord } from "@/convex/plugins/wca/openapiClient/types.gen"

let nextResultId = 1

/** A record-history entry as `/v0/results/records?show=history` returns it. */
export function wcaRecord(overrides: Partial<WcaRecord> = {}): WcaRecord {
  const id = nextResultId
  nextResultId += 1
  return {
    type: "single",
    id,
    pos: 1,
    person_id: "2015MURP01",
    person_name: "Aoife Murphy",
    country_id: "Ireland",
    competition_country_id: "Ireland",
    competition_id: "DublinOpen2026",
    competition_name: "Dublin Open 2026",
    event_id: "333",
    round_type_id: "f",
    round_id: null,
    format_id: "a",
    value1: 987,
    value2: 1012,
    value3: 1103,
    value4: 995,
    value5: 1040,
    best: 987,
    average: 1016,
    regional_single_record: "NR",
    regional_average_record: null,
    updated_at: "2026-10-20T10:00:00.000Z",
    start_date: "2026-10-17",
    value: 987,
    ...overrides,
  }
}
