import { UserIcon } from "lucide-react"
import { useState } from "react"
import * as DataSelector from "@/components/data-selectors/data-selector"
import { useSingleDataSelector } from "@/components/data-selectors/data-selector-model"
import * as SelectorFace from "@/components/data-selectors/selector-face"
import type { RecordsPerson } from "@/plugins/social-media/components/records-filters"

function renderPerson(person: RecordsPerson) {
  return <span className="truncate">{person.name}</span>
}

export function RecordsPersonFilter({
  people,
  value,
  onChange,
}: {
  people: RecordsPerson[]
  value: RecordsPerson | null
  onChange: (person: RecordsPerson | null) => void
}) {
  const [open, setOpen] = useState(false)
  const model = useSingleDataSelector<RecordsPerson, RecordsPerson>({
    getLabel: (person) => person.name,
    getValue: (person) => person,
    getValueKey: (person) => person.key,
    items: people,
    renderItem: renderPerson,
    selectedItem: value,
    value,
  })

  return (
    <DataSelector.SingleRoot
      model={model}
      open={open}
      onOpenChange={setOpen}
      onValueChange={onChange}
      searchable
    >
      <DataSelector.ButtonTrigger aria-label="Person">
        <SelectorFace.Root>
          <UserIcon />
          <SelectorFace.Text>{value?.name ?? "Everyone"}</SelectorFace.Text>
        </SelectorFace.Root>
      </DataSelector.ButtonTrigger>
      <DataSelector.Content
        align="start"
        clearLabel="Everyone"
        model={model}
        objectNoun="competitors"
        searchable
      />
    </DataSelector.SingleRoot>
  )
}
