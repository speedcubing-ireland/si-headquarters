import { todayInConfiguredTimeZone } from "@/lib/format/dates"
import { useEffect, useState } from "react"

const TODAY_REFRESH_INTERVAL_MS = 60 * 1000

export function useConfiguredToday(): string {
  const [today, setToday] = useState(todayInConfiguredTimeZone)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setToday((current) => {
        const next = todayInConfiguredTimeZone()
        return next === current ? current : next
      })
    }, TODAY_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  return today
}
