/// <reference types="vite/client" />

export const modules = import.meta.glob([
  "./**/*.{ts,tsx,js,jsx}",
  "!./**/*.*.{ts,tsx,js,jsx}",
])
