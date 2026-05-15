import {
	Body,
	Button,
	Container,
	Font,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailTailwindConfig } from "../../emails/shared";

type SponsorshipEmailShellProps = {
	preview: string;
	title: string;
	subtitle?: string;
	ctaLabel?: string;
	ctaUrl?: string;
	children: ReactNode;
};

export function SponsorshipEmailShell(props: SponsorshipEmailShellProps) {
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
				<Body className="bg-brand-bg font-sans py-10">
					<Preview>{props.preview}</Preview>
					<Container className="mx-auto max-w-xl rounded-xl border border-solid border-brand-border bg-brand-surface px-6 py-6">
						<Text className="m-0 text-xs uppercase tracking-wide text-brand-muted">
							Speedcubing Ireland Sponsorship
						</Text>
						<Heading
							as="h1"
							className="m-0 mt-2 text-xl font-bold text-brand-foreground"
						>
							{props.title}
						</Heading>
						{props.subtitle ? (
							<Text className="m-0 mt-2 text-sm leading-6 text-brand-foreground">
								{props.subtitle}
							</Text>
						) : null}
						<Section className="mt-4">{props.children}</Section>
						<Text className="m-0 mt-4 text-xs leading-5 text-brand-muted">
							Need help with {props.title}? Reply to this email and the
							Sponsorship Team will assist.
						</Text>
						{props.ctaLabel && props.ctaUrl ? (
							<Section className="mt-4">
								<Button
									href={props.ctaUrl}
									className="box-border block rounded-lg bg-brand-primary px-6 py-3 text-center text-sm font-semibold text-brand-primary-fg no-underline"
									style={{
										backgroundColor: "#c2792a",
										color: "#ffffff",
										display: "block",
										textAlign: "center",
										fontSize: "14px",
										fontWeight: "600",
										textDecoration: "none",
										borderRadius: "8px",
										padding: "12px 24px",
									}}
								>
									{props.ctaLabel}
								</Button>
							</Section>
						) : null}
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

export function formatDateTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString("en-IE", {
		dateStyle: "full",
		timeStyle: "short",
		timeZone: "Europe/Dublin",
	});
}

export function SponsorshipInfoBlock(props: { label: string; value: string }) {
	return (
		<Section className="rounded-lg border border-brand-border px-4 py-3">
			<Text className="m-0 text-xs text-brand-muted">{props.label}</Text>
			<Text className="m-0 mt-1 text-sm font-semibold text-brand-foreground">
				{props.value}
			</Text>
		</Section>
	);
}
