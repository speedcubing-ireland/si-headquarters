import { Loader2, RefreshCw, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { Page, PAGE_CONTENT_PADDING } from "@/components/layout/page"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRefundMutations, useRefundVolunteers } from "./use-refunds"
import { useRefundAnalysis } from "./use-refund-analysis"
import { CompetitionList } from "./competition-list"
import { StatsRow } from "./stats-row"
import { VolunteersTab } from "./volunteers-tab"

export function RefundsDashboard() {
  const { volunteers, isLoading: volunteersLoading } = useRefundVolunteers()
  const { computeRefunds } = useRefundMutations()
  const { analysis, isLoading, isRefreshing, error, refresh } =
    useRefundAnalysis(computeRefunds)

  const stats = useMemo(() => {
    const competitions = analysis?.competitions ?? []
    const total = competitions.length
    let refundDue = 0
    let alreadyRefunded = 0
    let noEligible = 0

    for (const c of competitions) {
      if (c.status === "no_eligible_volunteer") {
        noEligible += 1
      }
      for (const match of c.volunteerMatches) {
        if (match.status === "refund_due") {
          refundDue += 1
        } else {
          alreadyRefunded += 1
        }
      }
    }

    const totalVolunteers = volunteers.filter((v) => !v.archived).length
    return { total, refundDue, alreadyRefunded, noEligible, totalVolunteers }
  }, [analysis, volunteers])

  const [activeTab, setActiveTab] = useState<string>("refunds")

  return (
    <Page.Shell
      title="Refunds"
      header={
        <Page.Header>
          <Page.Title>Refunds</Page.Title>
          <Page.Actions>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab("volunteers")
              }}
            >
              <Users className="size-4" />
              {stats.totalVolunteers} volunteers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </Page.Actions>
        </Page.Header>
      }
      contentClassName={PAGE_CONTENT_PADDING}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <StatsRow
          periodStartDate={analysis?.periodStartDate}
          periodEndDate={analysis?.periodEndDate}
          stats={stats}
          isLoading={isLoading}
        />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
            <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
          </TabsList>

          <TabsContent value="refunds" className="mt-4">
            <CompetitionList
              analysis={analysis}
              isLoading={isLoading}
              error={error}
            />
          </TabsContent>

          <TabsContent value="volunteers" className="mt-4">
            <VolunteersTab
              volunteers={volunteers}
              isLoading={volunteersLoading}
              onRefresh={() => {
                void refresh()
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Page.Shell>
  )
}
