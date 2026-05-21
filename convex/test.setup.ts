/// <reference types="vite/client" />

import { afterEach, beforeEach, vi } from "vitest"

export const modules = import.meta.glob<string[]>("./**/!(*.*.*)*.*s")

process.env.RESEND_API_KEY ??= "re_test"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  if (vi.isFakeTimers()) {
    vi.clearAllTimers()
  }
  vi.useRealTimers()
})
