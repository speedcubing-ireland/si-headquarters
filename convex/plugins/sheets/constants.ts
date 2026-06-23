import { checkinSheetsConfig } from "@/config/lib/organisation"

export function getCheckinShareEmail(): string {
  return checkinSheetsConfig().contacts.checkinShareEmail
}
