import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import {
	useAdminImpersonationMutations,
	useAdminImpersonationTargets,
} from "@/hooks/use-convex-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type LoginLinkState = {
	url: string;
	expiresAt: number;
	targetType: "user" | "sponsor";
	targetName: string;
	targetEmail: string;
};

function normalizeText(value: string): string {
	return value.trim().toLowerCase();
}

function filterBySearch<T extends { name: string; email: string }>(
	items: T[],
	query: string,
): T[] {
	if (!query) return items;
	return items.filter((item) =>
		normalizeText(`${item.name} ${item.email}`).includes(query),
	);
}

type CreateLinkArgs =
	| { key: string; payload: { targetType: "user"; userId: Id<"users"> } }
	| {
			key: string;
			payload: { targetType: "sponsor"; sponsorId: Id<"sponsors"> };
	  };

export function IncognitoLoginLinksSection() {
	const { users, sponsors, isLoading } = useAdminImpersonationTargets();
	const { createImpersonationLoginLink } = useAdminImpersonationMutations();
	const [search, setSearch] = useState("");
	const [linkState, setLinkState] = useState<LoginLinkState | null>(null);
	const [loadingKey, setLoadingKey] = useState<string | null>(null);

	const query = normalizeText(search);
	const filteredUsers = useMemo(
		() => filterBySearch(users, query),
		[users, query],
	);
	const filteredSponsors = useMemo(
		() => filterBySearch(sponsors, query),
		[sponsors, query],
	);

	const createLink = async ({ key, payload }: CreateLinkArgs) => {
		setLoadingKey(key);
		try {
			const result = await createImpersonationLoginLink(payload);
			setLinkState(result);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to create impersonation link.",
			);
		} finally {
			setLoadingKey(null);
		}
	};

	const copyLink = async () => {
		if (!linkState) return;
		try {
			await navigator.clipboard.writeText(linkState.url);
			toast.success("Login link copied.");
		} catch {
			toast.error("Could not copy link.");
		}
	};

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between gap-2">
						<span>Incognito Login Links</span>
						<span className="text-xs font-normal text-muted-foreground">
							One-time links for secure impersonation
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search users or sponsors"
						className="max-w-sm"
					/>
					{isLoading ? (
						<div className="text-sm text-muted-foreground">
							Loading login targets...
						</div>
					) : (
						<div className="grid gap-4 lg:grid-cols-2">
							<div className="space-y-2">
								<p className="text-sm font-medium">Users</p>
								<div className="max-h-72 space-y-2 overflow-y-auto pr-1">
									{filteredUsers.length === 0 ? (
										<p className="text-xs text-muted-foreground">
											No matching users.
										</p>
									) : (
										filteredUsers.map((user) => {
											const key = `user:${user.id}`;
											return (
												<div
													key={user.id}
													className="flex items-center justify-between gap-2 rounded border px-2 py-1.5"
												>
													<div className="min-w-0">
														<p className="truncate text-sm font-medium">
															{user.name}
														</p>
														{user.email ? (
															<p className="truncate text-xs text-muted-foreground">
																{user.email}
															</p>
														) : null}
													</div>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															void createLink({
																key,
																payload: {
																	targetType: "user",
																	userId: user.id,
																},
															})
														}
														disabled={loadingKey !== null}
													>
														{loadingKey === key ? "Creating..." : "Login"}
													</Button>
												</div>
											);
										})
									)}
								</div>
							</div>
							<div className="space-y-2">
								<p className="text-sm font-medium">Sponsors</p>
								<div className="max-h-72 space-y-2 overflow-y-auto pr-1">
									{filteredSponsors.length === 0 ? (
										<p className="text-xs text-muted-foreground">
											No matching sponsors.
										</p>
									) : (
										filteredSponsors.map((sponsor) => {
											const key = `sponsor:${sponsor.id}`;
											return (
												<div
													key={sponsor.id}
													className="flex items-center justify-between gap-2 rounded border px-2 py-1.5"
												>
													<div className="min-w-0">
														<p className="truncate text-sm font-medium">
															{sponsor.name}
														</p>
														<p className="truncate text-xs text-muted-foreground">
															{sponsor.email}
														</p>
													</div>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															void createLink({
																key,
																payload: {
																	targetType: "sponsor",
																	sponsorId: sponsor.id,
																},
															})
														}
														disabled={loadingKey !== null || !sponsor.active}
													>
														{loadingKey === key ? "Creating..." : "Login"}
													</Button>
												</div>
											);
										})
									)}
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
			<Dialog
				open={linkState !== null}
				onOpenChange={(open) => {
					if (!open) setLinkState(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Open In Incognito</DialogTitle>
						<DialogDescription>
							Open this one-time link in an incognito/private window to avoid
							overwriting your current admin session.
						</DialogDescription>
					</DialogHeader>
					{linkState ? (
						<div className="space-y-2 rounded border bg-muted/30 p-3">
							<p className="text-xs text-muted-foreground">
								{linkState.targetType === "user" ? "User" : "Sponsor"}:{" "}
								<span className="font-medium text-foreground">
									{linkState.targetName}
								</span>
								{linkState.targetEmail ? ` (${linkState.targetEmail})` : ""}
							</p>
							<p className="break-all font-mono text-xs">{linkState.url}</p>
							<p className="text-xs text-muted-foreground">
								Expires at: {new Date(linkState.expiresAt).toLocaleString()}
							</p>
						</div>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => void copyLink()}>
							Copy link
						</Button>
						<Button asChild disabled={!linkState}>
							<a
								href={linkState?.url ?? "#"}
								target="_blank"
								rel="noopener noreferrer"
							>
								Open link
							</a>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
