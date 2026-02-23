import { type CSSProperties, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppPageHeader } from "@/components/shared/page-header";
import { AttentionBar } from "@/components/dashboard/attention-bar";
import { CompetitionPhaseStatusList } from "@/components/competitions/competition-phase-status-list";
import {
	AuctionAmountEntryCard,
	AuctionBidActivityCard,
	AuctionBiddingSummaryCard,
} from "@/components/sponsorship/auction-bidding-cards";
import {
	TaskIndicators,
	type TaskIndicatorsTask,
} from "@/components/tasks/task-indicators";
import { AuctionCompetitionSummaryPanel } from "@/components/sponsorship/competition-summary-panel";
import { SponsorBidStatusBadge } from "@/components/sponsorship/sponsor-bid-status-badge";
import { TaskReminderStrip } from "@/components/tasks/task-reminder-strip";
import { ThemeCodeSample } from "@/components/theme/theme-code-sample";
import {
	COMPETITION_PHASE_KEYS,
	type Competition,
	type Task,
} from "@/data/types-new";
import { getPhaseLabel, getPhaseVariant } from "@/lib/competition-phase-config";
import { taskStatusIcon } from "@/lib/task-filter-definitions";
import { statusIconColors } from "@/lib/task-utils";
import {
	SPONSORSHIP_BIDDING_HELP_TITLE,
	SPONSOR_BID_STATUSES,
} from "@/lib/sponsorship-ui";
import { useCompetitions, useTasks } from "@/hooks/use-convex-data";
import { AlertCircle, CopyCheck, TriangleAlert } from "lucide-react";

import exampleThemes from "@/components/theme/custom-themes.json";
import {
	type CustomTheme,
	type ThemeColors,
	themeColorKeys,
	defaultLightColors,
	defaultDarkColors,
} from "@/lib/theme-schema";

export const Route = createFileRoute("/demo/ui")({
	component: DemoUiRoute,
});

type ThemeCssVariables = CSSProperties &
	Partial<Record<`--${keyof ThemeColors}`, string>>;

function getStyleForTheme(colors: ThemeColors) {
	const style: ThemeCssVariables = {};
	for (const key of themeColorKeys) {
		style[`--${key}` as `--${keyof ThemeColors}`] = colors[key];
	}
	return style;
}

const systemDefaultTheme: CustomTheme = {
	name: "System Default",
	light: defaultLightColors,
	dark: defaultDarkColors,
};

const demoTaskIndicatorTasks: Record<
	"blockedWithSubtasks" | "blockedOnly" | "subtasksOnly",
	TaskIndicatorsTask
> = {
	blockedWithSubtasks: {
		isBlocked: true,
		unresolvedBlockerCount: 2,
		subTasks: [
			{ id: "demo-subtask-1", title: "Venue contract", status: "done" },
			{
				id: "demo-subtask-2",
				title: "Volunteer roster",
				status: "in-progress",
			},
			{ id: "demo-subtask-3", title: "Equipment check", status: "to-do" },
		],
	},
	blockedOnly: {
		isBlocked: true,
		unresolvedBlockerCount: 1,
		subTasks: [],
	},
	subtasksOnly: {
		isBlocked: false,
		unresolvedBlockerCount: 0,
		subTasks: [
			{ id: "demo-subtask-4", title: "Publish schedule", status: "done" },
			{ id: "demo-subtask-5", title: "Publish maps", status: "done" },
			{ id: "demo-subtask-6", title: "Send briefing", status: "cancelled" },
		],
	},
};

const demoCompetitionSummary = {
	name: "Speedcubing Ireland Open 2026",
	address: "National Basketball Arena, Tallaght, Dublin",
	startDate: "2026-06-13",
	endDate: "2026-06-14",
	competitorLimit: 180,
	eventIds: ["333", "222", "444", "333oh", "pyram", "skewb"],
};

function DemoUiRoute() {
	const [activeTheme, setActiveTheme] =
		useState<CustomTheme>(systemDefaultTheme);
	const { competitions, isLoading: competitionsLoading } = useCompetitions();
	const { tasks } = useTasks(false);

	return (
		<div className="flex flex-col w-full min-h-screen">
			<AppPageHeader
				title="Theme UI Showcase"
				actions={
					<div className="flex max-w-[60vw] items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						<Button
							variant={
								activeTheme.name === "System Default" ? "default" : "outline"
							}
							onClick={() => setActiveTheme(systemDefaultTheme)}
							size="sm"
						>
							System Default
						</Button>
						{exampleThemes.map((t) => (
							<Button
								key={t.name}
								variant={activeTheme.name === t.name ? "default" : "outline"}
								onClick={() => setActiveTheme(t as CustomTheme)}
								size="sm"
								className="gap-1.5"
							>
								<span
									className="size-3 rounded-full border border-border"
									style={{ backgroundColor: t.light.primary }}
								/>
								{t.name}
							</Button>
						))}
					</div>
				}
			/>

			<div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x border-t border-b overflow-hidden">
				{/* LIGHT MODE HALF */}
				<div
					className="bg-background text-foreground shrink-0 pb-10"
					style={getStyleForTheme(activeTheme.light)}
				>
					<DemoContent
						title={`Light Mode: ${activeTheme.name}`}
						competitions={competitions}
						competitionsLoading={competitionsLoading}
						tasks={tasks}
					/>
				</div>

				{/* DARK MODE HALF */}
				<div
					className="dark bg-background text-foreground shrink-0 pb-10"
					style={getStyleForTheme(activeTheme.dark)}
				>
					<DemoContent
						title={`Dark Mode: ${activeTheme.name}`}
						competitions={competitions}
						competitionsLoading={competitionsLoading}
						tasks={tasks}
					/>
				</div>
			</div>
		</div>
	);
}

function DemoContent({
	title,
	competitions,
	competitionsLoading,
	tasks,
}: {
	title: string;
	competitions: Competition[];
	competitionsLoading: boolean;
	tasks: Task[];
}) {
	const demoCompetition = competitions[0] ?? null;
	const reminderTask = tasks[0] ?? null;
	const [demoBidAmount, setDemoBidAmount] = useState("470.00");
	const [demoMaxAmount, setDemoMaxAmount] = useState("520.00");

	return (
		<div className="container mx-auto px-4 lg:px-8 flex flex-col gap-10 mt-6 w-full">
			<h2 className="text-3xl font-bold tracking-tight mb-2 py-4 border-b">
				{title}
			</h2>

			{/* 1. PROJECT-SPECIFIC UI */}
			<section className="grid grid-cols-1 gap-8">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-semibold mb-2">Project-specific UI</h2>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Competition Phase Badges
						</h3>
						<div className="flex flex-wrap gap-2">
							{COMPETITION_PHASE_KEYS.map((key) => (
								<Badge key={key} variant={getPhaseVariant(key)}>
									{getPhaseLabel(key)}
								</Badge>
							))}
						</div>
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Task Indicators
						</h3>
						<div className="space-y-2 rounded-md border bg-card p-3">
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium">Blocked + Subtasks</span>
								<TaskIndicators
									task={demoTaskIndicatorTasks.blockedWithSubtasks}
									blockedClassName="shrink-0"
									progressClassName="shrink-0 gap-1"
								/>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium">Blocked Only</span>
								<TaskIndicators
									task={demoTaskIndicatorTasks.blockedOnly}
									blockedClassName="shrink-0"
									progressClassName="shrink-0 gap-1"
								/>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium">Subtasks Progress</span>
								<TaskIndicators
									task={demoTaskIndicatorTasks.subtasksOnly}
									blockedClassName="shrink-0"
									progressClassName="shrink-0 gap-1"
								/>
							</div>
						</div>
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Sponsor Bid Status
						</h3>
						<div className="flex flex-wrap gap-2">
							{SPONSOR_BID_STATUSES.map((status) => (
								<SponsorBidStatusBadge key={status} status={status} showDot />
							))}
						</div>
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Competition Summary Panel
						</h3>
						<AuctionCompetitionSummaryPanel
							summary={demoCompetitionSummary}
							source="wca"
						/>
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Sponsor Bidding Cards
						</h3>
						<AuctionBiddingSummaryCard
							stateLabel="Active"
							stateVariant="default"
							frameworkLabel="Proxy Bidding"
							helpTitle={SPONSORSHIP_BIDDING_HELP_TITLE}
							closesAtText="Sunday at 18:00"
							priceLabel="Current price"
							priceValue="EUR 450.00"
							sponsorBidStatus="winning"
							myLastBidText="EUR 450.00"
							myMaxBidText="EUR 520.00"
						/>
						<div className="grid gap-3 xl:grid-cols-2">
							<AuctionAmountEntryCard
								title="Place Bid"
								description="Submit a direct bid amount."
								minimumLabel="Current minimum next bid"
								minimumValue="EUR 460.00"
								inputId="demo-bid-amount"
								inputLabel="Bid amount (EUR)"
								inputValue={demoBidAmount}
								inputMin="460.00"
								inputPlaceholder="460.00"
								onInputChange={setDemoBidAmount}
								onSubmit={(event) => event.preventDefault()}
								submitLabel="Submit bid"
							/>
							<AuctionAmountEntryCard
								title="Set Max Bid"
								description="Set the highest amount you are willing to pay. Automatic bidding can go up to this amount."
								minimumLabel="Current max bid"
								minimumValue="EUR 520.00"
								inputId="demo-max-amount"
								inputLabel="Max amount (EUR)"
								inputValue={demoMaxAmount}
								inputMin="460.00"
								inputPlaceholder="460.00"
								onInputChange={setDemoMaxAmount}
								onSubmit={(event) => event.preventDefault()}
								submitLabel="Save max bid"
							/>
						</div>
						<AuctionBidActivityCard
							description="Your bids are marked as You. Other sponsors are anonymized."
							isProxyAuction
							bidHistoryVisible
							items={[
								{
									id: "demo-bid-1",
									sponsorLabel: "You",
									amountLabel: "EUR 450.00",
									isOwnBid: true,
									typeLabel: "Manual",
									createdAtLabel: "10:42",
								},
								{
									id: "demo-bid-2",
									sponsorLabel: "Sponsor #2",
									amountLabel: "EUR 430.00",
									isOwnBid: false,
									typeLabel: "Bid",
									createdAtLabel: "10:39",
								},
							]}
							sealedMessage="Only your own submitted amount is visible in your bid form."
							unavailableMessage="Bid history is unavailable until bidding opens."
							emptyMessage="No bids yet."
						/>
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Competition Phase Status
						</h3>
						{competitionsLoading ? (
							<p className="text-sm text-muted-foreground">
								Loading competition phase UI...
							</p>
						) : demoCompetition ? (
							<div className="rounded-md border bg-card p-3">
								<CompetitionPhaseStatusList
									competition={demoCompetition}
									disableSelection
								/>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No competitions available yet. Create one to preview the
								phase-status component.
							</p>
						)}
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Reminder Strip
						</h3>
						{reminderTask ? (
							<div className="rounded-md border bg-card p-3">
								<TaskReminderStrip task={reminderTask} />
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No tasks available yet. Create a task to preview reminder UI.
							</p>
						)}
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Attention Badges
						</h3>
						<AttentionBar />
					</div>

					<div className="space-y-3">
						<h3 className="text-sm font-medium text-muted-foreground">
							Code Block Theme Tokens
						</h3>
						<ThemeCodeSample />
					</div>
				</div>
			</section>

			{/* 2. BUTTONS */}
			<section>
				<h2 className="text-2xl font-semibold mb-6">Buttons</h2>
				<div className="flex flex-col gap-6">
					<div className="flex flex-wrap gap-4 items-center">
						<Button variant="default">Default</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="outline">Outline</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="link">Link</Button>
						<Button variant="destructive">Destructive</Button>
					</div>
					<div className="flex flex-wrap gap-4 items-center">
						<Button size="sm">Small Size</Button>
						<Button size="default">Default Size</Button>
						<Button size="lg">Large Size</Button>
						<Button size="icon">
							<CopyCheck className="size-4" />
						</Button>
					</div>
					<div className="flex flex-wrap gap-4 items-center">
						<Button disabled>Disabled Default</Button>
						<Button disabled variant="outline">
							Disabled Outline
						</Button>
					</div>
				</div>
			</section>

			{/* 3. BADGES */}
			<section>
				<h2 className="text-2xl font-semibold mb-6">Badges</h2>
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap gap-3">
						<Badge variant="default">Default</Badge>
						<Badge variant="secondary">Secondary</Badge>
						<Badge variant="outline">Outline</Badge>
						<Badge variant="destructive">Destructive</Badge>
						<Badge variant="ghost">Ghost</Badge>
						<Badge variant="link">Link</Badge>
					</div>
					<div className="flex flex-wrap gap-3">
						<Badge variant="success">Success</Badge>
						<Badge variant="warning">Warning</Badge>
						<Badge variant="error">Error</Badge>
						<Badge variant="info">Info</Badge>
					</div>
					<div className="flex flex-wrap gap-3">
						<Badge variant="success-outline">Success Outline</Badge>
						<Badge variant="warning-outline">Warning Outline</Badge>
						<Badge variant="error-outline">Error Outline</Badge>
						<Badge variant="info-outline">Info Outline</Badge>
					</div>
				</div>
			</section>

			{/* 4. ALERTS & CARDS */}
			<section className="grid grid-cols-1 gap-8">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-semibold mb-2">Alerts</h2>
					<Alert>
						<AlertCircle className="size-4" />
						<AlertTitle>Default Alert</AlertTitle>
						<AlertDescription>
							This is a standard informational alert mapping to foreground and
							background variants.
						</AlertDescription>
					</Alert>
					<Alert variant="destructive">
						<TriangleAlert className="size-4" />
						<AlertTitle>Destructive Alert</AlertTitle>
						<AlertDescription>
							This is a critical alert showing an error condition that maps to
							the destructive colors correctly.
						</AlertDescription>
					</Alert>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-semibold mb-2">Cards</h2>
					<Card>
						<CardHeader>
							<CardTitle>Example Card</CardTitle>
							<CardDescription>
								These are the default card surfaces acting as floating elements.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="text-sm text-muted-foreground w-full flex items-center bg-muted/50 p-3 rounded-md border">
								Inner muted/container block mapping to muted surfaces.
							</div>
						</CardContent>
					</Card>
				</div>
			</section>

			{/* 5. TASK ICONS & PROGRESS STRIPES */}
			<section className="grid grid-cols-1 gap-8">
				<div>
					<h2 className="text-2xl font-semibold mb-6">Task Status Icons</h2>
					<div className="flex flex-col gap-3">
						{Object.entries(taskStatusIcon).map(([key, Icon]) => {
							const colorClass =
								statusIconColors[key as keyof typeof statusIconColors];
							return (
								<div key={key} className="flex items-center gap-3">
									<Icon className={`size-5 ${colorClass}`} />
									<span className="capitalize">{key.replace("-", " ")}</span>
									<span className="text-sm text-muted-foreground ml-auto">
										Class: {colorClass}
									</span>
								</div>
							);
						})}
					</div>
				</div>

				<div>
					<h2 className="text-2xl font-semibold mb-6">Palette Combinations</h2>
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						<ColorBlock
							name="Primary"
							bg="bg-primary"
							fg="text-primary-foreground"
						/>
						<ColorBlock
							name="Secondary"
							bg="bg-secondary"
							fg="text-secondary-foreground"
						/>
						<ColorBlock
							name="Accent"
							bg="bg-accent"
							fg="text-accent-foreground"
						/>
						<ColorBlock name="Muted" bg="bg-muted" fg="text-muted-foreground" />

						<ColorBlock
							name="Success"
							bg="bg-success"
							fg="text-success-foreground"
						/>
						<ColorBlock
							name="Warning"
							bg="bg-warning"
							fg="text-warning-foreground"
						/>
						<ColorBlock name="Error" bg="bg-error" fg="text-error-foreground" />
						<ColorBlock name="Info" bg="bg-info" fg="text-info-foreground" />

						<ColorBlock
							name="Destructive"
							bg="bg-destructive"
							fg="text-destructive-foreground"
						/>
						<ColorBlock name="Card" bg="bg-card" fg="text-card-foreground" />
						<ColorBlock
							name="Popover"
							bg="bg-popover"
							fg="text-popover-foreground"
						/>
						<ColorBlock
							name="Sidebar"
							bg="bg-sidebar"
							fg="text-sidebar-foreground"
						/>

						<ColorBlock
							name="Background"
							bg="bg-background"
							border
							fg="text-foreground"
						/>
						<ColorBlock
							name="Header"
							bg="bg-header"
							border
							fg="text-header-foreground"
						/>
					</div>

					<h3 className="text-lg font-semibold mt-8 mb-4">Structural Colors</h3>
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						<div className="p-4 rounded-lg flex flex-col shadow-sm bg-ring text-background font-medium">
							Ring
						</div>
						<div className="p-4 rounded-lg flex flex-col shadow-sm bg-border text-foreground font-medium">
							Border
						</div>
						<div className="p-4 rounded-lg flex flex-col shadow-sm bg-input text-foreground font-medium border">
							Input
						</div>
					</div>

					<h3 className="text-lg font-semibold mt-8 mb-4">
						Progress Bars / Scales
					</h3>
					<div className="flex flex-col gap-2">
						<div className="h-4 w-full rounded-full bg-success" />
						<div className="h-4 w-full rounded-full bg-warning" />
						<div className="h-4 w-full rounded-full bg-error" />
						<div className="h-4 w-full rounded-full bg-info" />
						<div className="h-4 w-full rounded-full bg-primary" />
						<div className="h-4 w-full rounded-full bg-secondary" />
						<div className="h-4 w-full rounded-full bg-muted" />
					</div>
				</div>
			</section>
		</div>
	);
}

function ColorBlock({
	name,
	bg,
	fg,
	border,
}: {
	name: string;
	bg: string;
	fg: string;
	border?: boolean;
}) {
	return (
		<div
			className={`p-4 rounded-lg flex flex-col shadow-sm ${bg} ${border ? "border" : ""}`}
		>
			<span className={`text-base font-semibold ${fg}`}>{name} Base</span>
			<span className={`text-xs opacity-80 ${fg}`}>{fg} text</span>
		</div>
	);
}
