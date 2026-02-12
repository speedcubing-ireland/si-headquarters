import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { CheckCircle2, Link2Off } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ConnectionStatusCardProps {
	title: string;
	description: string;
	connected: boolean;
	connectedText?: string;
	disconnectCommand: string;
	oAuthInstructions: string;
}

function ConnectionStatusCard({
	title,
	description,
	connected,
	connectedText = "Account connected.",
	disconnectCommand,
	oAuthInstructions,
}: ConnectionStatusCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{connected ? (
						<CheckCircle2 className="size-4 text-green-600" />
					) : (
						<Link2Off className="size-4 text-muted-foreground" />
					)}
					{title}
				</CardTitle>
				<span className="text-xs text-muted-foreground">{description}</span>
			</CardHeader>
			<CardContent className="space-y-2">
				{connected ? (
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
	{ nowSec?: number },
	{ connected: boolean }
>;

interface ConnectionStatusCardContainerProps {
	title: string;
	description: string;
	connectedText?: string;
	disconnectCommand: string;
	oAuthInstructions: string;
	query: ConnectionStatusQuery;
}

export function ConnectionStatusCardContainer({
	title,
	description,
	connectedText,
	disconnectCommand,
	oAuthInstructions,
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

	const connectionStatus = useQuery(query, { nowSec });
	const connected = connectionStatus?.connected ?? false;

	return (
		<ConnectionStatusCard
			title={title}
			description={description}
			connected={connected}
			connectedText={connectedText}
			disconnectCommand={disconnectCommand}
			oAuthInstructions={oAuthInstructions}
		/>
	);
}
