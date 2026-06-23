// Frontend redirect path for the staff WCA sign-in flow. Kept free of server
// imports so both the Convex backend and the web client can import it (mirrors
// ORGANISER_INVITE_PATH in convex/competitions/invites/validators.ts).
export const STAFF_WCA_LOGIN_PATH = "/auth/wca"
