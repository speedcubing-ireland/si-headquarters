import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/google-sheets/callback")({
	component: () => (
		<div className="flex min-h-svh items-center justify-center p-4 font-sans text-sm text-muted-foreground">
			Link Google Sheets from the terminal: bun run auth:google-sheets
		</div>
	),
});
