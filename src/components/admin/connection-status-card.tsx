import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { CheckCircle2, Link2Off, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";

interface ConnectionStatusCardProps {
	title: string;
	description: string;
	connected: boolean;
	isLoading?: boolean;
	connectedText?: string;
	disconnectCommand: string;
	oAuthInstructions: string;
}

function ConnectionStatusCard({
	title,
	description,
	connected,
	isLoading = false,
	connectedText = "Account connected.",
	disconnectCommand,
	oAuthInstructions,
}: ConnectionStatusCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{isLoading ? (
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					) : connected ? (
						<CheckCircle2 className="size-4 text-success" />
					) : (
						<Link2Off className="size-4 text-muted" />
					)}
					{title}
				</CardTitle>
				<span className="text-xs text-muted-foreground">{description}</span>
			</CardHeader>
			<CardContent className="space-y-2">
				{isLoading ? (
					<p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Checking connection...
					</p>
				) : connected ? (
					<p className="text-sm text-muted-foreground">{connectedText}</p>
				) : (
					<>
						<p className="text-sm text-muted-foreground">
							Link via terminal (from repo root):
						</p>
						<code className="block rounded bg-muted px-2 py-1.5 text-xs">
							{disconnectCommand}
						</code>
						<p className="text-xs text-muted-foreground">{oAuthInstructions}</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}

type ConnectionStatusQuery = FunctionReference<
	"query",
	"public",
	{ service: "google" | "wca" | "canva"; nowSec?: number },
	{ connected: boolean }
>;

interface ConnectionStatusCardContainerProps {
	title: string;
	description: string;
	connectedText?: string;
	disconnectCommand: string;
	oAuthInstructions: string;
	service: "google" | "wca" | "canva";
	query: ConnectionStatusQuery;
}

export function ConnectionStatusCardContainer({
	title,
	description,
	connectedText,
	disconnectCommand,
	oAuthInstructions,
	service,
	query,
}: ConnectionStatusCardContainerProps) {
	const [nowSec, setNowSec] = useState(
		() => Math.floor(Date.now() / 60_000) * 60,
	);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNowSec(Math.floor(Date.now() / 60_000) * 60);
		}, 30_000);
		return () => window.clearInterval(intervalId);
	}, []);

	const result = useQuery(query, { service, nowSec });
	const { data: connectionStatus, isLoading } = useRetainedQueryResult(
		result,
		service,
	);
	const connected = connectionStatus?.connected ?? false;

	return (
		<ConnectionStatusCard
			title={title}
			description={description}
			connected={connected}
			isLoading={isLoading}
			connectedText={connectedText}
			disconnectCommand={disconnectCommand}
			oAuthInstructions={oAuthInstructions}
		/>
	);
}
