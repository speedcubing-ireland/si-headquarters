import {
	Body,
	Button,
	Column,
	Container,
	Head,
	Heading,
	Html,
	Hr,
	Link,
	Preview,
	Row,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import { emailTailwindConfig, getPriorityBadge } from "./shared";

export type NotificationDigestMode =
	| "hourly"
	| "daily"
	| "three_daily"
	| "quiet_hours";

export interface NotificationDigestItem {
	title: string;
	message: string;
	entityType: string;
	priority: string;
	actorName?: string;
	link: string;
}

export interface NotificationDigestEmailProps {
	mode: NotificationDigestMode;
	items: NotificationDigestItem[];
	appUrl: string;
}

function digestModeLabel(mode: NotificationDigestMode): string {
	switch (mode) {
		case "hourly":
			return "Hourly digest";
		case "daily":
			return "Daily digest";
		case "three_daily":
			return "3x daily digest";
		case "quiet_hours":
			return "Quiet hours digest";
	}
}

export default function NotificationDigestEmail(
	props: NotificationDigestEmailProps,
) {
	const digestLabel = digestModeLabel(props.mode);
	const count = props.items.length;
	const previewText = `${count} ${count === 1 ? "update" : "updates"} waiting in HQ`;

	return (
		<Html lang="en">
			<Tailwind config={emailTailwindConfig}>
				<Head />
				<Preview>{previewText}</Preview>
				<Body className="bg-brand-bg font-sans py-10">
					<Container className="mx-auto max-w-xl">
						<Section className="bg-brand-primary rounded-t-lg py-5 px-6">
							<Row>
								<Column>
									<Text className="text-brand-primary-fg text-lg font-bold m-0">
										Speedcubing Ireland HQ
									</Text>
								</Column>
								<Column className="text-right">
									<Text className="text-brand-primary-fg text-xs m-0 opacity-90">
										{digestLabel}
									</Text>
								</Column>
							</Row>
						</Section>

						<Section className="bg-brand-surface border-solid border-brand-border border-t-0 border-r border-b border-l px-6 py-6">
							<Heading
								as="h1"
								className="text-xl font-bold text-brand-foreground m-0 mb-2"
							>
								{count} {count === 1 ? "update" : "updates"} in your inbox
							</Heading>
							<Text className="text-sm leading-6 text-brand-muted m-0 mb-4">
								Here is a summary of unread notifications in this digest window.
							</Text>
							<Hr className="border-solid border-brand-border my-4" />

							{props.items.map((item, index) => {
								const badge = getPriorityBadge(item.priority);
								return (
									<Section key={`${item.title}-${index}`} className="mb-4">
										<Row>
											<Column>
												<Text className="text-sm font-semibold text-brand-foreground m-0">
													{item.title}
												</Text>
											</Column>
											{badge && (
												<Column className="w-16 text-right align-top">
													<Text
														className={`${badge.bgClass} ${badge.textClass} text-[10px] font-semibold rounded px-2 py-1 m-0 inline-block`}
													>
														{badge.label}
													</Text>
												</Column>
											)}
										</Row>
										<Text className="text-xs leading-5 text-brand-muted m-0 mt-2 mb-2">
											{item.message}
										</Text>
										<Text className="text-[11px] leading-4 text-brand-muted m-0">
											{item.actorName ? `By ${item.actorName} · ` : ""}
											{item.entityType}
										</Text>
										<Text className="m-0 mt-2">
											<Link
												href={item.link}
												className="text-brand-primary underline text-xs"
											>
												Open update
											</Link>
										</Text>
										{index < props.items.length - 1 && (
											<Hr className="border-solid border-brand-border my-4" />
										)}
									</Section>
								);
							})}

							<Section className="mt-4 mb-2">
								<Button
									href={`${props.appUrl}/inbox`}
									className="bg-brand-primary text-brand-primary-fg text-sm font-semibold rounded-lg px-6 py-3 box-border block text-center no-underline"
								>
									Open Inbox in HQ
								</Button>
							</Section>
						</Section>

						<Section className="bg-brand-cream rounded-b-lg border-solid border-brand-border border-t-0 border-r border-b border-l px-6 py-4">
							<Text className="text-xs text-brand-muted text-center m-0 leading-5">
								You received this digest because you enabled email
								notifications.
							</Text>
							<Text className="text-xs text-brand-muted text-center m-0 mt-1 leading-5">
								<Link
									href={`${props.appUrl}/inbox`}
									className="text-brand-primary underline"
								>
									Manage preferences
								</Link>
								{" · "}
								<Link
									href={props.appUrl}
									className="text-brand-primary underline"
								>
									Open HQ
								</Link>
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

NotificationDigestEmail.PreviewProps = {
	mode: "daily",
	appUrl: "https://hq.speedcubing.ie",
	items: [
		{
			title: "SI-42: Update volunteer rota — status changed",
			message: 'Jane moved SI-42 from "To Do" to "In Progress".',
			entityType: "Task",
			priority: "normal",
			actorName: "Jane Doe",
			link: "https://hq.speedcubing.ie/tasks/example-1",
		},
		{
			title: "Progress update: Irish Open 2026",
			message: "Mark posted an at-risk update for Irish Open 2026.",
			entityType: "Competition",
			priority: "high",
			actorName: "Mark",
			link: "https://hq.speedcubing.ie/competitions/example-1",
		},
	],
} satisfies NotificationDigestEmailProps;
