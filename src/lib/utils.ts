import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function objectRefKey(ref: { type: string; id: string }) {
  return `${ref.type}:${ref.id}`
}
