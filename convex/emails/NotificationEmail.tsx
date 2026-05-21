import {
	Html,
	Head,
	Preview,
	Body,
	Container,
	Section,
	Row,
	Column,
	Heading,
	Text,
	Button,
	Hr,
	Link,
	Tailwind,
	Font,
} from "@react-email/components";
import {
	emailTailwindConfig,
	buildEntityLink,
	formatEntityTypeLabel,
	getPriorityBadge,
} from "./shared";

export interface NotificationEmailProps {
	title: string;
	message: string;
	body?: string;
	entityType: string;
	entityId: string;
	parentEntityId?: string;
	actorName?: string;
	priority: string;
	appUrl: string;
}

export default function NotificationEmail(props: NotificationEmailProps) {
	const link = buildEntityLink(props.appUrl, props);
	const priorityVariant = getPriorityBadge(props.priority);
	const entityLabel = formatEntityTypeLabel(props.entityType);

	return (
		<Html lang="en">
			<Tailwind config={emailTailwindConfig}>
				<Head>
					<Font
						fontFamily="Montserrat"
						fallbackFontFamily="Helvetica"
						webFont={{
							url: "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2",
							format: "woff2",
						}}
					/>
				</Head>
				<Preview>{props.message}</Preview>
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
									<Text className="text-brand-primary-fg text-xs m-0 opacity-80">
										{entityLabel}
									</Text>
								</Column>
							</Row>
						</Section>
						<Section className="bg-brand-surface border-solid border-brand-border border-t-0 border-r border-b border-l px-6 py-6">
							<Row>
								<Column>
									<Heading
										as="h1"
										className="text-xl font-bold text-brand-foreground m-0 mb-1"
									>
										{props.title}
									</Heading>
								</Column>
								{priorityVariant && (
									<Column className="w-20 text-right align-top">
										<Text
											className={`${priorityVariant.bgClass} ${priorityVariant.textClass} text-xs font-semibold rounded px-2 py-1 m-0 inline-block`}
										>
											{priorityVariant.label}
										</Text>
									</Column>
								)}
							</Row>
							{props.actorName && (
								<Text className="text-brand-muted text-xs m-0 mt-1 mb-3">
									By {props.actorName}
								</Text>
							)}
							<Hr className="border-solid border-brand-border my-4" />
							<Text className="text-sm leading-6 text-brand-foreground my-0">
								{props.message}
							</Text>
							{props.body && (
								<Section className="bg-brand-cream rounded-lg mt-4 px-4 py-3">
									<Text className="text-xs leading-5 text-brand-muted m-0">
										{props.body}
									</Text>
								</Section>
							)}
							<Section className="mt-6 mb-2">
								<Button
									href={link}
									className="bg-brand-primary text-brand-primary-fg text-sm font-semibold rounded-lg px-6 py-3 box-border block text-center no-underline"
								>
									View in HQ
								</Button>
							</Section>
						</Section>
						<Section className="bg-brand-cream rounded-b-lg border-solid border-brand-border border-t-0 border-r border-b border-l px-6 py-4">
							<Text className="text-xs text-brand-muted text-center m-0 leading-5">
								You received this email because you opted in to email
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

NotificationEmail.PreviewProps = {
	title: "Assigned to SI-42: Design competition schedule layout",
	message:
		"Jane Doe assigned you to task SI-42: Design competition schedule layout",
	body: undefined,
	entityType: "task",
	entityId: "abc123",
	parentEntityId: undefined,
	actorName: "Jane Doe",
	priority: "high",
	appUrl: "https://hq.speedcubing.ie",
} satisfies NotificationEmailProps;
