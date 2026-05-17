import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Loader2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/format-utils";
import { getNotificationTypeLabel } from "@/lib/notification-utils";
import {
	useDiscordMutations,
	useDiscordSettings,
} from "@/hooks/use-convex-data";
import { useRetainedQueryResult } from "@/hooks/convex/use-retained-query-result";

export const Route = createFileRoute("/account")({
	component: RouteComponent,
});

function toErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}
	return fallback;
}

function RouteComponent() {
	const userResult = useQuery(api.core.users.getCurrentUser);
	const userState = useRetainedQueryResult(userResult);
	const updateCurrentUserName = useMutation(
		api.core.users.updateCurrentUserName,
	);
	const {
		link,
		dmEnabled,
		preferences,
		isLoading: isDiscordLoading,
	} = useDiscordSettings();
	const { setCurrentUserDmEnabled, setCurrentUserTypePreference } =
		useDiscordMutations();
	const [nameInput, setNameInput] = useState("");
	const [isSavingName, setIsSavingName] = useState(false);

	useEffect(() => {
		const user = userState.data;
		if (!user) return;
		setNameInput(user.name ?? "");
	}, [userState.data]);

	const onSaveName = async (event: FormEvent) => {
		event.preventDefault();
		const nextName = nameInput.trim();
		if (!nextName || !user) {
			return;
		}
		setIsSavingName(true);
		try {
			await updateCurrentUserName({ name: nextName });
			toast.success("Name updated.");
		} catch (error) {
			toast.error(toErrorMessage(error, "Failed to update name."));
		} finally {
			setIsSavingName(false);
		}
	};

	if (userState.isLoading) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}
	const user = userState.data;

	if (user === null) {
		return (
			<div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
				Unable to load account details.
			</div>
		);
	}

	const displayName = user.name ?? user.email ?? "User";
	const trimmedName = nameInput.trim();
	const canSaveName = trimmedName.length > 0 && trimmedName !== user.name;

	return (
		<div className="flex flex-1 flex-col">
			<header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:px-6 lg:py-0">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<SidebarTrigger className="shrink-0" />
					<Separator
						orientation="vertical"
						className="hidden data-[orientation=vertical]:h-3 sm:block"
					/>
					<UserRound className="size-4 text-muted-foreground" />
					<h1 className="text-sm font-semibold">Account</h1>
				</div>
			</header>
			<div className="flex-1 p-4 lg:p-6">
				<div className="mx-auto w-full max-w-3xl">
					<Card>
						<CardHeader>
							<CardTitle>Profile</CardTitle>
							<CardDescription>
								Your avatar is connected through your discord account.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
								<Avatar className="size-20">
									<AvatarImage src={user.avatarUrl} alt={displayName} />
									<AvatarFallback>{getInitials(displayName)}</AvatarFallback>
								</Avatar>
							</div>
							<form
								className="space-y-4"
								onSubmit={(event) => void onSaveName(event)}
							>
								<div className="space-y-2">
									<Label htmlFor="account-name">Name</Label>
									<Input
										id="account-name"
										value={nameInput}
										onChange={(event) => setNameInput(event.target.value)}
										disabled={isSavingName}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="account-email">Email</Label>
									<Input
										id="account-email"
										value={user.email ?? ""}
										readOnly
										disabled
									/>
								</div>
								<Button type="submit" disabled={!canSaveName || isSavingName}>
									{isSavingName ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										"Save name"
									)}
								</Button>
							</form>
						</CardContent>
					</Card>
					<Card className="mt-6">
						<CardHeader>
							<CardTitle>Discord notifications</CardTitle>
							<CardDescription>
								Manage how Headquarters reaches you in Discord DMs.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="rounded-lg border border-border/70 p-4">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p className="font-medium text-sm">Linked account</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{isDiscordLoading
												? "Loading Discord link..."
												: link
													? `Connected to ${link.discordDisplayName ?? link.discordUsername}`
													: "A director needs to link your Headquarters account to a Discord guild member before DMs can be sent."}
										</p>
									</div>
									{link ? (
										<div className="text-right text-xs text-muted-foreground">
											<p>{link.discordUsername}</p>
											<p>{link.guildId}</p>
										</div>
									) : null}
								</div>
							</div>

							<div className="rounded-lg border border-border/70 p-4">
								<div className="flex items-start justify-between gap-3">
									<div>
										<Label
											htmlFor="discord-dm-enabled"
											className="text-sm font-medium"
										>
											Enable Discord DMs
										</Label>
										<p className="mt-1 text-sm text-muted-foreground">
											Turn all direct message notifications on or off.
										</p>
									</div>
									<Checkbox
										id="discord-dm-enabled"
										checked={dmEnabled}
										onCheckedChange={(checked) =>
											void setCurrentUserDmEnabled(checked === true).catch(
												(error) =>
													toast.error(
														toErrorMessage(
															error,
															"Failed to update Discord DM setting.",
														),
													),
											)
										}
									/>
								</div>
							</div>

							<div className="space-y-3">
								<div>
									<p className="font-medium text-sm">Notification types</p>
									<p className="text-sm text-muted-foreground">
										Choose which Headquarters events can send you a DM.
									</p>
								</div>
								<div className="grid gap-2 sm:grid-cols-2">
									{preferences.map(
										(preference: (typeof preferences)[number]) => (
											<div
												key={preference.type}
												className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
											>
												<span className="text-sm">
													{getNotificationTypeLabel(preference.type)}
												</span>
												<Checkbox
													checked={preference.enabled}
													onCheckedChange={(checked) =>
														void setCurrentUserTypePreference(
															preference.type,
															checked === true,
														).catch((error) =>
															toast.error(
																toErrorMessage(
																	error,
																	"Failed to update Discord notification preference.",
																),
															),
														)
													}
												/>
											</div>
										),
									)}
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
