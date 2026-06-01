import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Loader2, LogIn, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import {
	SponsorFrameworkGuideCard,
} from "@/plugins/sponsor/components/sponsor-framework-guide-card";
import {
	SponsorPageHeader,
	SponsorPageShell,
} from "@/plugins/sponsor/components/sponsor-page-layout";
import { PortalThemeToggle } from "@/plugins/sponsor/components/portal-theme-toggle";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { isSponsorshipEnabled } from "@/lib/feature-flags";
import { sponsorAuthClient } from "@/plugins/sponsor/lib/sponsor-auth-client";
import {
	PROXY_BID_INCREMENT_ROWS,
	SPONSOR_AUCTIONS_OVERVIEW,
	SPONSOR_BIDDING_NOTICE,
	SPONSOR_CLOSING_AND_RESULTS,
	SPONSOR_LOGIN_STEPS,
	SPONSOR_MINIMUM_BIDS,
	SPONSOR_PORTAL_INTRO,
	SPONSOR_TEAM_EMAIL,
} from "@/plugins/sponsor/lib/sponsor-guide";
import {
	SPONSORSHIP_FRAMEWORKS,
	SPONSOR_GUIDE_PAGE_TITLE,
	sponsorshipFrameworkLabel,
} from "@/plugins/sponsor/lib/sponsorship-ui";

export function PortalGuidePage() {
	if (!isSponsorshipEnabled) {
		return <Navigate to="/" />;
	}
	return <SponsorGuideEnabled />;
}

function SponsorGuideEnabled() {
	const navigate = useNavigate();
	const { data: authSession, isPending: authPending } =
		sponsorAuthClient.useSession();
	const sessionToken = authSession?.session.token ?? null;
	const isSignedIn = sessionToken !== null;

	if (authPending) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const onLogout = async () => {
		await sponsorAuthClient.signOut();
		toast.success("Signed out.");
		await navigate({ to: "/sponsor/login" });
	};

	return (
		<SponsorPageShell maxWidthClassName="max-w-4xl">
			<SponsorPageHeader
				title={SPONSOR_GUIDE_PAGE_TITLE}
				subtitle="Auction formats, bidding rules, and sponsorship policy"
				actions={
					<>
						<PortalThemeToggle />
						{isSignedIn ? (
							<Button variant="outline" onClick={() => void onLogout()}>
								<LogOut className="size-4" />
								Log out
							</Button>
						) : (
							<Button asChild variant="outline">
								<Link to="/sponsor/login">
									<LogIn className="size-4" />
									Sign in
								</Link>
							</Button>
						)}
					</>
				}
			/>

			{isSignedIn ? (
				<Button asChild variant="outline" size="sm">
					<Link to="/sponsor/auctions">
						<ArrowLeft className="size-4" />
						Back to auctions
					</Link>
				</Button>
			) : (
				<Button asChild variant="outline" size="sm">
					<Link to="/sponsor/login">
						<ArrowLeft className="size-4" />
						Back to sign in
					</Link>
				</Button>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BookOpen className="size-5" />
						{SPONSOR_PORTAL_INTRO.title}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
					<p className="text-foreground">{SPONSOR_PORTAL_INTRO.lead}</p>
					<p>{SPONSOR_PORTAL_INTRO.body}</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Getting logged in</CardTitle>
					<CardDescription>
						Use the email address Speedcubing Ireland has on file for your
						sponsor account.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
						{SPONSOR_LOGIN_STEPS.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{SPONSOR_AUCTIONS_OVERVIEW.title}</CardTitle>
					<CardDescription>{SPONSOR_AUCTIONS_OVERVIEW.body}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm leading-relaxed text-muted-foreground">
						{SPONSOR_AUCTIONS_OVERVIEW.formatsIntro}
					</p>
					<ul className="flex flex-wrap gap-2 text-sm">
						{SPONSORSHIP_FRAMEWORKS.map((framework) => (
							<li
								key={framework}
								className="rounded-full border bg-muted/30 px-3 py-1"
							>
								{sponsorshipFrameworkLabel(framework)}
							</li>
						))}
					</ul>
				</CardContent>
			</Card>

			<section className="space-y-3">
				<div>
					<h2 className="text-lg font-semibold">Auction formats</h2>
					<p className="text-sm text-muted-foreground">
						Each competition uses one format. Open an auction to see which applies.
					</p>
				</div>
				<div className="space-y-4">
					{SPONSORSHIP_FRAMEWORKS.map((framework) => (
						<SponsorFrameworkGuideCard key={framework} framework={framework} />
					))}
				</div>
			</section>

			<Card>
				<CardHeader>
					<CardTitle>{SPONSOR_MINIMUM_BIDS.title}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
					<p>{SPONSOR_MINIMUM_BIDS.sealed}</p>
					<p>{SPONSOR_MINIMUM_BIDS.proxy}</p>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Current winning bid</TableHead>
								<TableHead className="text-right">Minimum increment</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{PROXY_BID_INCREMENT_ROWS.map((row) => (
								<TableRow key={row.rangeLabel}>
									<TableCell>{row.rangeLabel}</TableCell>
									<TableCell className="text-right">
										{row.incrementLabel}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{SPONSOR_CLOSING_AND_RESULTS.title}</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm leading-relaxed text-muted-foreground">
						{SPONSOR_CLOSING_AND_RESULTS.body}
					</p>
				</CardContent>
			</Card>

			<Card className="border-amber-500/30">
				<CardHeader>
					<CardTitle>{SPONSOR_BIDDING_NOTICE.title}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
					{SPONSOR_BIDDING_NOTICE.paragraphs.map((paragraph) => (
						<p key={paragraph}>{paragraph}</p>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Need help?</CardTitle>
					<CardDescription>
						Contact the Speedcubing Ireland sponsorship team with questions or
						technical issues.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<a href={`mailto:${SPONSOR_TEAM_EMAIL}`}>
							<Mail className="size-4" />
							{SPONSOR_TEAM_EMAIL}
						</a>
					</Button>
				</CardContent>
			</Card>
		</SponsorPageShell>
	);
}
