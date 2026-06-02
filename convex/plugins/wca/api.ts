"use node"

import { readJsonObject, readString } from "@/convex/plugins/core/jsonBoundary"
import { WCA_BASE_URL } from "@/convex/plugins/wca/oauth"

export async function lookupWcaCompetition(
  accessToken: string,
  wcaCompetitionId: string
): Promise<{ name: string; url: string }> {
  const response = await fetch(
    `${WCA_BASE_URL}/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  )
  if (!response.ok) {
    throw new Error(
      `WCA competition lookup failed (HTTP ${String(response.status)}).`
    )
  }
  const body = await readJsonObject(response)
  if (body === null) {
    throw new Error("WCA competition lookup returned an invalid response.")
  }
  return {
    name: readString(body, "name") ?? wcaCompetitionId,
    url:
      readString(body, "url") ??
      `${WCA_BASE_URL}/competitions/${wcaCompetitionId}`,
  }
}

export async function pushWcifToCompetition(
  accessToken: string,
  wcaCompetitionId: string,
  wcifJson: string
): Promise<void> {
  const response = await fetch(
    `${WCA_BASE_URL}/api/v0/competitions/${encodeURIComponent(wcaCompetitionId)}/wcif`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: wcifJson,
    }
  )
  if (!response.ok) {
    throw new Error(`WCA WCIF upload failed (HTTP ${String(response.status)}).`)
  }
}
